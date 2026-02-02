import type { RequestOptions } from '../types';

/**
 * Default request options for retry and timeout behavior.
 */
export const DEFAULT_REQUEST_OPTIONS: Required<RequestOptions> = {
  timeoutMs: 30000,
  retry: {
    enabled: true,
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 10000,
  },
};

/**
 * Merge config and per-request options with defaults.
 */
export function resolveRequestOptions(
  configOptions?: RequestOptions,
  perRequestOptions?: RequestOptions
): Required<RequestOptions> {
  return {
    timeoutMs:
      perRequestOptions?.timeoutMs ?? configOptions?.timeoutMs ?? DEFAULT_REQUEST_OPTIONS.timeoutMs,
    retry: {
      ...DEFAULT_REQUEST_OPTIONS.retry,
      ...configOptions?.retry,
      ...perRequestOptions?.retry,
    },
  };
}
