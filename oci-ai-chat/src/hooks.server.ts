import type { Handle, RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';

/**
 * Simple in-memory rate limiter
 *
 * PRODUCTION NOTE: This in-memory store is suitable for single-instance deployments.
 * For multi-instance production deployments, replace with Redis or another distributed store
 * to ensure rate limits are enforced across all instances.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configuration
const RATE_LIMIT = {
  windowMs: 60_000, // 1 minute window
  maxRequests: {
    chat: 20, // Chat endpoint: 20 requests/minute
    api: 60, // Other API endpoints: 60 requests/minute
  },
};

// Paths exempt from rate limiting (health checks, etc.)
const RATE_LIMIT_EXEMPT_PATHS = ['/api/health', '/api/healthz'];

/**
 * Get client identifier from request event
 *
 * Uses SvelteKit's getClientAddress() which properly handles proxy headers
 * based on the adapter configuration, avoiding X-Forwarded-For spoofing vulnerabilities.
 */
function getClientId(event: RequestEvent): string {
  try {
    // SvelteKit's getClientAddress() handles proxy trust properly based on adapter config
    return event.getClientAddress();
  } catch {
    // Fallback for environments where getClientAddress() isn't available (e.g., some test setups)
    return 'unknown-client';
  }
}

/**
 * Check and update rate limit for a client
 * Returns { remaining, resetAt } or null if limit exceeded
 */
function checkRateLimit(
  clientId: string,
  endpoint: 'chat' | 'api'
): { remaining: number; resetAt: number } | null {
  const now = Date.now();
  const key = `${clientId}:${endpoint}`;
  const maxRequests = RATE_LIMIT.maxRequests[endpoint];

  // Clean up expired entries periodically (lower threshold for better memory management)
  if (rateLimitStore.size > 1000) {
    const keysToDelete: string[] = [];
    rateLimitStore.forEach((v, k) => {
      if (v.resetAt < now) {
        keysToDelete.push(k);
      }
    });
    keysToDelete.forEach((k) => rateLimitStore.delete(k));
  }

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + RATE_LIMIT.windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
    });
    return { remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return null; // Rate limited
  }

  entry.count++;
  return { remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Content Security Policy configuration
 * Restricts resource loading to prevent XSS and data injection attacks
 *
 * NOTE: 'unsafe-inline' is required for Svelte's runtime-generated styles and scripts.
 * For stricter CSP, consider implementing nonce-based CSP with SvelteKit's handle hook.
 */
function getCSPHeader(): string {
  const directives = [
    // Only allow resources from same origin by default
    "default-src 'self'",

    // Scripts: self + inline (needed for Svelte) + unsafe-eval only in dev
    dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",

    // Styles: self + inline (needed for Tailwind/Svelte)
    "style-src 'self' 'unsafe-inline'",

    // Images: self + data URIs (for embedded images)
    "img-src 'self' data: blob:",

    // Fonts: self
    "font-src 'self'",

    // Connect: self (for API calls)
    "connect-src 'self'",

    // Frames: none (no iframes needed)
    "frame-src 'none'",

    // Objects: none (no plugins)
    "object-src 'none'",

    // Base URI: self
    "base-uri 'self'",

    // Form actions: self
    "form-action 'self'",

    // Frame ancestors: none (prevent clickjacking)
    "frame-ancestors 'none'",

    // Upgrade insecure requests in production
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ];

  return directives.join('; ');
}

/**
 * Security headers applied to all responses
 */
function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Content Security Policy
  headers.set('Content-Security-Policy', getCSPHeader());

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection (legacy browsers; CSP frame-ancestors is the modern approach)
  headers.set('X-Frame-Options', 'DENY');

  // XSS Protection: Disabled as it's deprecated and can introduce vulnerabilities
  // Modern browsers have removed XSS Auditor; CSP is the proper mitigation
  headers.set('X-XSS-Protection', '0');

  // Referrer policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (restrict browser features)
  headers.set(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Cross-origin isolation headers for additional security
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // HSTS: Enforce HTTPS in production (1 year max-age with subdomains)
  if (!dev) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(
  headers: Headers,
  endpoint: 'chat' | 'api',
  remaining: number,
  resetAt: number
): void {
  headers.set('X-RateLimit-Limit', String(RATE_LIMIT.maxRequests[endpoint]));
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000))); // Unix timestamp in seconds
}

export const handle: Handle = async ({ event, resolve }) => {
  const { url } = event;

  // Apply rate limiting to API routes (except exempt paths)
  if (url.pathname.startsWith('/api/') && !RATE_LIMIT_EXEMPT_PATHS.includes(url.pathname)) {
    const clientId = getClientId(event);
    const endpoint = url.pathname.startsWith('/api/chat') ? 'chat' : 'api';
    const rateLimitResult = checkRateLimit(clientId, endpoint);

    if (rateLimitResult === null) {
      // Rate limited - return 429
      const resetAt = rateLimitStore.get(`${clientId}:${endpoint}`)?.resetAt ?? Date.now() + 60000;
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(RATE_LIMIT.maxRequests[endpoint]),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          },
        }
      );
    }

    // Process request and add rate limit headers
    const response = await resolve(event);
    const headers = new Headers(response.headers);
    addRateLimitHeaders(headers, endpoint, rateLimitResult.remaining, rateLimitResult.resetAt);

    return addSecurityHeaders(
      new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    );
  }

  // Non-API routes: just add security headers
  const response = await resolve(event);
  return addSecurityHeaders(response);
};
