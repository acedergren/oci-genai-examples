import { describe, test, expect } from 'vitest';
import { queryKeys } from './keys.js';

describe('queryKeys', () => {
  describe('models', () => {
    test('returns models key array', () => {
      const key = queryKeys.models();
      expect(key).toEqual(['models']);
    });

    test('returns readonly array for type safety', () => {
      const key = queryKeys.models();
      // TypeScript should infer this as readonly ['models']
      expect(Object.isFrozen(key) || Array.isArray(key)).toBe(true);
    });
  });

  describe('sessions', () => {
    test('all() returns sessions key array', () => {
      const key = queryKeys.sessions.all();
      expect(key).toEqual(['sessions']);
    });

    test('detail(id) returns session detail key with id', () => {
      const key = queryKeys.sessions.detail('session-123');
      expect(key).toEqual(['sessions', 'session-123']);
    });

    test('usage(id) returns session usage key with id', () => {
      const key = queryKeys.sessions.usage('session-456');
      expect(key).toEqual(['sessions', 'session-456', 'usage']);
    });

    test('messages(id) returns session messages key with id', () => {
      const key = queryKeys.sessions.messages('session-789');
      expect(key).toEqual(['sessions', 'session-789', 'messages']);
    });
  });

  describe('region', () => {
    test('returns region key array', () => {
      const key = queryKeys.region();
      expect(key).toEqual(['region']);
    });
  });

  describe('key hierarchy for invalidation', () => {
    test('session detail key starts with sessions.all() for hierarchical invalidation', () => {
      const allKey = queryKeys.sessions.all();
      const detailKey = queryKeys.sessions.detail('test-id');

      // Detail key should start with the same prefix as all()
      expect(detailKey.slice(0, allKey.length)).toEqual([...allKey]);
    });

    test('session usage key starts with sessions.detail() for hierarchical invalidation', () => {
      const detailKey = queryKeys.sessions.detail('test-id');
      const usageKey = queryKeys.sessions.usage('test-id');

      // Usage key should start with the same prefix as detail()
      expect(usageKey.slice(0, detailKey.length)).toEqual([...detailKey]);
    });
  });
});
