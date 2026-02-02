/**
 * Retry utility with exponential backoff for transient failures.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 100) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable'>> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 10000,
};

const RETRYABLE_ERROR_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'];

const RETRYABLE_ERROR_MESSAGES = ['socket hang up', 'network error', 'fetch failed'];

/**
 * Determines if an error is retryable based on its properties.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // Check HTTP status codes
  const status =
    (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode;
  if (typeof status === 'number') {
    // Retry on 429 (rate limit) and 5xx (server errors)
    if (status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
    // Don't retry on other status codes (4xx client errors)
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Check error codes (Node.js network errors)
  const code = (error as { code?: string }).code;
  if (code && RETRYABLE_ERROR_CODES.includes(code)) {
    return true;
  }

  // Check error messages for common patterns
  const message = error.message.toLowerCase();
  for (const pattern of RETRYABLE_ERROR_MESSAGES) {
    if (message.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for specific error code patterns in message
  for (const errorCode of RETRYABLE_ERROR_CODES) {
    if (error.message.includes(errorCode)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates delay with exponential backoff and jitter.
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  // Exponential backoff: base * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  // Clamp to max delay
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Executes a function with automatic retry on transient failures.
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    baseDelayMs = DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    isRetryable = isRetryableError,
  } = options ?? {};

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay and wait before retry
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}
