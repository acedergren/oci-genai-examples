import type { Handle, RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { createLogger } from '$lib/server/logger.js';

const log = createLogger('hooks');

/**
 * Simple in-memory rate limiter
 *
 * NOTE: In Cloudflare Workers, this in-memory store resets per-request
 * since there's no persistent memory. For actual rate limiting in production,
 * use Cloudflare's built-in rate limiting rules in the dashboard.
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
 */
function getClientId(event: RequestEvent): string {
  try {
    return event.getClientAddress();
  } catch {
    return 'unknown-client';
  }
}

/**
 * Check and update rate limit for a client
 */
function checkRateLimit(
  clientId: string,
  endpoint: 'chat' | 'api'
): { remaining: number; resetAt: number } | null {
  const now = Date.now();
  const key = `${clientId}:${endpoint}`;
  const maxRequests = RATE_LIMIT.maxRequests[endpoint];

  // Clean up expired entries periodically
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
    const resetAt = now + RATE_LIMIT.windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
    });
    return { remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return null;
  }

  entry.count++;
  return { remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Content Security Policy configuration
 */
function getCSPHeader(): string {
  const directives = [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ];

  return directives.join('; ');
}

/**
 * Security headers applied to all responses
 */
function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  headers.set('Content-Security-Policy', getCSPHeader());
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '0');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

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
  headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

export const handle: Handle = async ({ event, resolve }) => {
  const { url } = event;

  // Apply rate limiting to API routes (except exempt paths)
  if (url.pathname.startsWith('/api/') && !RATE_LIMIT_EXEMPT_PATHS.includes(url.pathname)) {
    const clientId = getClientId(event);
    const endpoint = url.pathname.startsWith('/api/chat') ? 'chat' : 'api';
    const rateLimitResult = checkRateLimit(clientId, endpoint);

    if (rateLimitResult === null) {
      const resetAt = rateLimitStore.get(`${clientId}:${endpoint}`)?.resetAt ?? Date.now() + 60000;
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

      log.warn({ clientId, endpoint, retryAfter }, 'rate limit exceeded');

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

  const response = await resolve(event);
  return addSecurityHeaders(response);
};
