import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { withTimeout, TimeoutError } from '../timeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return result if function completes before timeout', async (): Promise<void> => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');

    const promise = withTimeout(fn(), 5000);
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('success');
  });

  it('should throw TimeoutError if function exceeds timeout', async (): Promise<void> => {
    const fn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10000));

    const promise = withTimeout(fn(), 1000);

    // Advance past the timeout
    jest.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow(TimeoutError);
    await expect(promise).rejects.toThrow('Operation timed out after 1000ms');
  });

  it('should include custom message in TimeoutError', async () => {
    /* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */
    const fn = () => new Promise((resolve) => setTimeout(resolve, 10000));

    const promise = withTimeout(fn(), 500, 'API request');

    jest.advanceTimersByTime(501);

    await expect(promise).rejects.toThrow('API request timed out after 500ms');
  });

  it('should clear timeout on successful completion', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const fn = Promise.resolve('quick');

    await withTimeout(fn, 5000);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should clear timeout on function error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const fn = new Promise((_, reject) => {
      setImmediate(() => reject(new Error('function error')));
    });

    const promise = withTimeout(fn, 5000);
    jest.runAllTimers();

    await expect(promise).rejects.toThrow('function error');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should propagate function errors, not timeout errors', async () => {
    const fn = new Promise((_, reject) => {
      setImmediate(() => reject(new Error('original error')));
    });

    const promise = withTimeout(fn, 5000);
    jest.runAllTimers();

    await expect(promise).rejects.toThrow('original error');
  });

  it('should handle zero timeout (immediate timeout)', async (): Promise<void> => {
    const fn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100));

    const promise = withTimeout(fn(), 0);
    jest.advanceTimersByTime(1);

    await expect(promise).rejects.toThrow(TimeoutError);
  });
});

describe('TimeoutError', () => {
  it('should be instanceof Error', () => {
    const error = new TimeoutError(1000);
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name', () => {
    const error = new TimeoutError(1000);
    expect(error.name).toBe('TimeoutError');
  });

  it('should expose timeoutMs property', () => {
    const error = new TimeoutError(5000);
    expect(error.timeoutMs).toBe(5000);
  });

  it('should have descriptive message', () => {
    const error = new TimeoutError(3000);
    expect(error.message).toBe('Operation timed out after 3000ms');
  });

  it('should include operation name in message', () => {
    const error = new TimeoutError(3000, 'Database query');
    expect(error.message).toBe('Database query timed out after 3000ms');
  });
});
