import { describe, it, expect, jest } from '@jest/globals';
import { withRetry, RetryOptions, isRetryableError } from '../retry';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on 4xx client errors', async () => {
    const error = Object.assign(new Error('Bad Request'), { status: 400 });
    const fn = jest.fn<() => Promise<string>>().mockImplementation(() => Promise.reject(error));

    await expect(withRetry(fn)).rejects.toThrow('Bad Request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use custom isRetryable function', async () => {
    const error = new Error('Custom error');
    const fn = jest.fn<() => Promise<string>>().mockImplementation(() => Promise.reject(error));
    const customIsRetryable = jest.fn<(error: unknown) => boolean>().mockReturnValue(false);

    await expect(withRetry(fn, { isRetryable: customIsRetryable })).rejects.toThrow('Custom error');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(customIsRetryable).toHaveBeenCalledWith(error);
  });

  // Test retry behavior using setTimeout replacement (works reliably)
  it('should retry on transient error and succeed', async () => {
    // Replace setTimeout to execute immediately
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: () => void) => originalSetTimeout(cb, 0)) as typeof setTimeout;

    try {
      let callCount = 0;
      const fn = jest.fn<() => Promise<string>>().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNRESET'));
        }
        return Promise.resolve('success');
      });

      const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
      expect(result).toBe('success');
      expect(callCount).toBe(2);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('should throw after max retries exceeded', async () => {
    // Replace setTimeout to execute immediately
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: () => void) => originalSetTimeout(cb, 0)) as typeof setTimeout;

    try {
      let callCount = 0;
      const fn = jest.fn<() => Promise<string>>().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error('ECONNRESET'));
      });

      await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 100 })).rejects.toThrow(
        'ECONNRESET'
      );
      expect(callCount).toBe(3); // initial + 2 retries
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('should retry on 5xx server errors', async () => {
    // Replace setTimeout to execute immediately
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: () => void) => originalSetTimeout(cb, 0)) as typeof setTimeout;

    try {
      let callCount = 0;
      const error = Object.assign(new Error('Internal Server Error'), {
        status: 500,
      });
      const fn = jest.fn<() => Promise<string>>().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(error);
        }
        return Promise.resolve('success');
      });

      const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 100 });
      expect(result).toBe('success');
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('should respect custom retry options', async () => {
    // Replace setTimeout to execute immediately
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: () => void) => originalSetTimeout(cb, 0)) as typeof setTimeout;

    try {
      let callCount = 0;
      const fn = jest.fn<() => Promise<string>>().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error('ECONNRESET'));
      });

      const options: RetryOptions = {
        maxRetries: 1,
        baseDelayMs: 50,
        maxDelayMs: 100,
      };

      await expect(withRetry(fn, options)).rejects.toThrow();
      expect(callCount).toBe(2); // initial + 1 retry
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});

describe('withRetry exponential backoff', () => {
  it('should use exponential backoff', async () => {
    const delays: number[] = [];

    // Capture delays by replacing setTimeout
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((callback: () => void, ms?: number): ReturnType<typeof setTimeout> => {
      if (ms !== undefined && ms > 0) {
        delays.push(ms);
      }
      // Execute immediately for testing
      return originalSetTimeout(callback, 0);
    }) as typeof setTimeout;

    const fn = jest.fn<() => Promise<string>>().mockImplementation(() => {
      return Promise.reject(new Error('ECONNRESET'));
    });

    try {
      await withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    } catch {
      // Expected to fail
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    // Should have 3 delays (for 3 retries)
    expect(delays.length).toBe(3);
    // Exponential: 100, 200, 400 (with some jitter tolerance of ±25%)
    expect(delays[0]).toBeGreaterThanOrEqual(75);
    expect(delays[0]).toBeLessThanOrEqual(125);
    expect(delays[1]).toBeGreaterThanOrEqual(150);
    expect(delays[1]).toBeLessThanOrEqual(250);
    expect(delays[2]).toBeGreaterThanOrEqual(300);
    expect(delays[2]).toBeLessThanOrEqual(500);
  });

  it('should cap delay at maxDelayMs', async () => {
    const delays: number[] = [];

    // Capture delays by replacing setTimeout
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((callback: () => void, ms?: number): ReturnType<typeof setTimeout> => {
      if (ms !== undefined && ms > 0) {
        delays.push(ms);
      }
      // Execute immediately for testing
      return originalSetTimeout(callback, 0);
    }) as typeof setTimeout;

    const fn = jest.fn<() => Promise<string>>().mockImplementation(() => {
      return Promise.reject(new Error('ECONNRESET'));
    });

    try {
      await withRetry(fn, {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 2000,
      });
    } catch {
      // Expected to fail
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    // All delays should be capped at maxDelayMs (2000)
    expect(delays.length).toBe(5);
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(2000);
    }
  });
});

describe('isRetryableError', () => {
  it('should return true for network errors', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
    expect(isRetryableError(new Error('socket hang up'))).toBe(true);
  });

  it('should return true for ECONNREFUSED errors', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
  });

  it('should return true for EAI_AGAIN DNS errors', () => {
    expect(isRetryableError(new Error('EAI_AGAIN'))).toBe(true);
  });

  it('should return true for 5xx errors', () => {
    const error = Object.assign(new Error('Server Error'), { status: 503 });
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 500 Internal Server Error', () => {
    const error = Object.assign(new Error('Internal Server Error'), {
      status: 500,
    });
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 502 Bad Gateway', () => {
    const error = Object.assign(new Error('Bad Gateway'), { status: 502 });
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 429 rate limit', () => {
    const error = Object.assign(new Error('Too Many Requests'), { status: 429 });
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for 4xx client errors', () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 });
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for 400 Bad Request', () => {
    const error = Object.assign(new Error('Bad Request'), { status: 400 });
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for 401 Unauthorized', () => {
    const error = Object.assign(new Error('Unauthorized'), { status: 401 });
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for 403 Forbidden', () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 });
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryableError(new Error('Invalid input'))).toBe(false);
  });

  it('should return false for non-Error values', () => {
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError(123)).toBe(false);
  });

  it('should check statusCode property as fallback', () => {
    const error = Object.assign(new Error('Server Error'), { statusCode: 503 });
    expect(isRetryableError(error)).toBe(true);
  });

  it('should check error code property', () => {
    const error = Object.assign(new Error('Connection reset'), {
      code: 'ECONNRESET',
    });
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for fetch failed errors', () => {
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
  });

  it('should return true for network error messages', () => {
    expect(isRetryableError(new Error('network error'))).toBe(true);
    expect(isRetryableError(new Error('Network Error'))).toBe(true);
  });
});
