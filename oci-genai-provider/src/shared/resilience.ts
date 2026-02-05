/**
 * Resilience Utilities
 *
 * Provides centralized retry and timeout logic for OCI API operations.
 * Used across all model implementations for consistent error handling.
 */

import { withRetry, withTimeout, isRetryableError } from './utils';
import type { RequestOptions } from '../types';

/**
 * Execute an operation with timeout and optional retry logic.
 *
 * This utility wraps OCI API calls with:
 * - Timeout protection (prevents hanging operations)
 * - Automatic retry with exponential backoff (for transient failures)
 * - Consistent error handling across all models
 *
 * @template T - The return type of the operation
 * @param operation - The async operation to execute
 * @param operationName - Human-readable name for error messages
 * @param options - Resolved request options (timeout, retry config)
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * const result = await executeWithResilience(
 *   () => client.embedText({ ... }),
 *   'OCI embed request',
 *   requestOptions
 * );
 * ```
 */
export async function executeWithResilience<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: Required<RequestOptions>
): Promise<T> {
  // Wrap operation with timeout
  const withTimeoutOperation = (): Promise<T> =>
    withTimeout(operation(), options.timeoutMs, operationName);

  // Apply retry logic if enabled
  if (options.retry.enabled) {
    return withRetry(withTimeoutOperation, {
      maxRetries: options.retry.maxRetries,
      baseDelayMs: options.retry.baseDelayMs,
      maxDelayMs: options.retry.maxDelayMs,
      isRetryable: isRetryableError,
    });
  }

  return withTimeoutOperation();
}
