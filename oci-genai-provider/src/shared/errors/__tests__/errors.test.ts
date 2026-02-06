import { describe, it, expect } from '@jest/globals';
import {
  OCIGenAIError,
  NetworkError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
} from '../index';

describe('OCIGenAIError', () => {
  it('should be instanceof Error', () => {
    const error = new OCIGenAIError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name', () => {
    const error = new OCIGenAIError('test');
    expect(error.name).toBe('OCIGenAIError');
  });

  it('should preserve cause', () => {
    const cause = new Error('original');
    const error = new OCIGenAIError('wrapper', { cause });
    expect(error.cause).toBe(cause);
  });

  it('should have retryable property', () => {
    const error = new OCIGenAIError('test');
    expect(error.retryable).toBe(false);
  });
});

describe('NetworkError', () => {
  it('should extend OCIGenAIError', () => {
    const error = new NetworkError('Connection failed');
    expect(error).toBeInstanceOf(OCIGenAIError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name', () => {
    const error = new NetworkError('test');
    expect(error.name).toBe('NetworkError');
  });

  it('should indicate retryable by default', () => {
    const error = new NetworkError('ECONNRESET');
    expect(error.retryable).toBe(true);
  });

  it('should expose error code', () => {
    const error = new NetworkError('Connection reset', { code: 'ECONNRESET' });
    expect(error.code).toBe('ECONNRESET');
  });

  it('should preserve cause', () => {
    const cause = new Error('original network error');
    const error = new NetworkError('wrapper', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('RateLimitError', () => {
  it('should extend OCIGenAIError', () => {
    const error = new RateLimitError('Too many requests');
    expect(error).toBeInstanceOf(OCIGenAIError);
  });

  it('should have correct name', () => {
    const error = new RateLimitError('test');
    expect(error.name).toBe('RateLimitError');
  });

  it('should indicate retryable', () => {
    const error = new RateLimitError('Rate limited');
    expect(error.retryable).toBe(true);
  });

  it('should expose retryAfter when provided', () => {
    const error = new RateLimitError('Rate limited', { retryAfterMs: 60000 });
    expect(error.retryAfterMs).toBe(60000);
  });

  it('should have undefined retryAfter when not provided', () => {
    const error = new RateLimitError('Rate limited');
    expect(error.retryAfterMs).toBeUndefined();
  });

  it('should preserve cause', () => {
    const cause = new Error('original rate limit error');
    const error = new RateLimitError('wrapper', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('AuthenticationError', () => {
  it('should extend OCIGenAIError', () => {
    const error = new AuthenticationError('Invalid credentials');
    expect(error).toBeInstanceOf(OCIGenAIError);
  });

  it('should have correct name', () => {
    const error = new AuthenticationError('test');
    expect(error.name).toBe('AuthenticationError');
  });

  it('should not be retryable', () => {
    const error = new AuthenticationError('Bad token');
    expect(error.retryable).toBe(false);
  });

  it('should expose authentication type', () => {
    const error = new AuthenticationError('Invalid token', {
      authType: 'api_key',
    });
    expect(error.authType).toBe('api_key');
  });

  it('should support instance_principal auth type', () => {
    const error = new AuthenticationError('Instance auth failed', {
      authType: 'instance_principal',
    });
    expect(error.authType).toBe('instance_principal');
  });

  it('should preserve cause', () => {
    const cause = new Error('original auth error');
    const error = new AuthenticationError('wrapper', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('ModelNotFoundError', () => {
  it('should extend OCIGenAIError', () => {
    const error = new ModelNotFoundError('model-123');
    expect(error).toBeInstanceOf(OCIGenAIError);
  });

  it('should have correct name', () => {
    const error = new ModelNotFoundError('model-123');
    expect(error.name).toBe('ModelNotFoundError');
  });

  it('should not be retryable', () => {
    const error = new ModelNotFoundError('model-123');
    expect(error.retryable).toBe(false);
  });

  it('should expose model ID', () => {
    const error = new ModelNotFoundError('cohere.command-r-plus');
    expect(error.modelId).toBe('cohere.command-r-plus');
  });

  it('should have descriptive message', () => {
    const error = new ModelNotFoundError('cohere.command-r-plus');
    expect(error.message).toContain('cohere.command-r-plus');
  });

  it('should preserve cause', () => {
    const cause = new Error('original 404 error');
    const error = new ModelNotFoundError('model-123', { cause });
    expect(error.cause).toBe(cause);
  });
});
