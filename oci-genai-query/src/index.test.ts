import { describe, test, expect } from 'vitest';
import * as exports from './index.js';

describe('oci-genai-query exports', () => {
  test('exports queryKeys factory', () => {
    expect(exports.queryKeys).toBeDefined();
    expect(typeof exports.queryKeys.models).toBe('function');
    expect(typeof exports.queryKeys.sessions.all).toBe('function');
    expect(typeof exports.queryKeys.sessions.detail).toBe('function');
    expect(typeof exports.queryKeys.sessions.usage).toBe('function');
    expect(typeof exports.queryKeys.sessions.messages).toBe('function');
    expect(typeof exports.queryKeys.region).toBe('function');
  });

  test('exports queryOptions factories', () => {
    expect(typeof exports.modelsQueryOptions).toBe('function');
    expect(typeof exports.sessionsQueryOptions).toBe('function');
    expect(typeof exports.sessionDetailQueryOptions).toBe('function');
    expect(typeof exports.sessionUsageQueryOptions).toBe('function');
  });

  test('exports fetcher functions', () => {
    expect(typeof exports.fetchModels).toBe('function');
    expect(typeof exports.fetchSessions).toBe('function');
    expect(typeof exports.fetchSessionDetail).toBe('function');
    expect(typeof exports.fetchSessionUsage).toBe('function');
    expect(typeof exports.createSession).toBe('function');
    expect(typeof exports.deleteSession).toBe('function');
  });

  test('exports types (compile-time check)', () => {
    // These are type-only exports, so we verify the module loads without error
    // Type correctness is verified by TypeScript at compile time
    expect(true).toBe(true);
  });
});
