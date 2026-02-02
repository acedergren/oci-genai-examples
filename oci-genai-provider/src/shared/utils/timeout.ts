/**
 * Timeout utility for wrapping async operations with time limits.
 */

/**
 * Error thrown when an operation exceeds its timeout.
 */
export class TimeoutError extends Error {
  readonly name = 'TimeoutError';
  readonly timeoutMs: number;
  readonly operation?: string;

  constructor(timeoutMs: number, operation?: string) {
    const message = operation
      ? `${operation} timed out after ${timeoutMs}ms`
      : `Operation timed out after ${timeoutMs}ms`;
    super(message);
    this.timeoutMs = timeoutMs;
    this.operation = operation;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * Wraps a promise with a timeout.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param operation - Optional name for the operation (for error messages)
 * @returns The result of the promise if it completes in time
 * @throws TimeoutError if the timeout is exceeded
 * @throws The original error if the promise rejects
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withTimeout(fetch(url), 5000);
 *
 * // With operation name
 * const result = await withTimeout(
 *   fetchFromOCI(params),
 *   10000,
 *   'OCI API request'
 * );
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(timeoutMs, operation));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
