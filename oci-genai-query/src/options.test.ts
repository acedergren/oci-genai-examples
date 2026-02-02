import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  modelsQueryOptions,
  sessionsQueryOptions,
  sessionDetailQueryOptions,
  sessionUsageQueryOptions,
} from './options.js';
import { queryKeys } from './keys.js';

// Mock global fetch for queryFn execution
const mockFetch = vi.fn();

describe('queryOptions factories', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('modelsQueryOptions', () => {
    test('has correct queryKey', () => {
      const options = modelsQueryOptions();
      expect(options.queryKey).toEqual(queryKeys.models());
    });

    test('has queryFn that fetches models', async () => {
      const mockResponse = {
        models: [{ id: 'test-model', name: 'Test', description: 'Test model', provider: 'test' }],
        region: 'eu-frankfurt-1',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const options = modelsQueryOptions();
      const result = await options.queryFn({ queryKey: options.queryKey, signal: new AbortController().signal, meta: undefined });

      expect(result).toEqual(mockResponse);
    });

    test('has appropriate staleTime for infrequent model changes', () => {
      const options = modelsQueryOptions();
      // Models don't change often, staleTime should be at least 5 minutes
      expect(options.staleTime).toBeGreaterThanOrEqual(5 * 60 * 1000);
    });

    test('accepts custom baseUrl option', () => {
      const options = modelsQueryOptions({ baseUrl: 'http://custom-api.com' });
      expect(options.queryKey).toEqual(queryKeys.models());
    });
  });

  describe('sessionsQueryOptions', () => {
    test('has correct queryKey', () => {
      const options = sessionsQueryOptions();
      expect(options.queryKey).toEqual(queryKeys.sessions.all());
    });

    test('has queryFn that fetches sessions', async () => {
      const mockResponse = {
        sessions: [{ id: 'session-1', title: 'Test', model: 'test', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const options = sessionsQueryOptions();
      const result = await options.queryFn({ queryKey: options.queryKey, signal: new AbortController().signal, meta: undefined });

      expect(result).toEqual(mockResponse);
    });

    test('has shorter staleTime than models for active session updates', () => {
      const modelsOptions = modelsQueryOptions();
      const sessionsOptions = sessionsQueryOptions();

      // Sessions change more often, should have shorter staleTime
      expect(sessionsOptions.staleTime).toBeLessThan(modelsOptions.staleTime!);
    });
  });

  describe('sessionDetailQueryOptions', () => {
    test('has correct queryKey with session id', () => {
      const options = sessionDetailQueryOptions('session-abc');
      expect(options.queryKey).toEqual(queryKeys.sessions.detail('session-abc'));
    });

    test('has queryFn that fetches session detail', async () => {
      const mockResponse = {
        session: { id: 'session-abc', title: 'Test', model: 'test', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' },
        messages: [{ role: 'user', content: 'Hello' }],
        usage: { tokens: 100, cost: 0.001 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const options = sessionDetailQueryOptions('session-abc');
      const result = await options.queryFn({ queryKey: options.queryKey, signal: new AbortController().signal, meta: undefined });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('sessionUsageQueryOptions', () => {
    test('has correct queryKey with session id and usage suffix', () => {
      const options = sessionUsageQueryOptions('session-xyz');
      expect(options.queryKey).toEqual(queryKeys.sessions.usage('session-xyz'));
    });

    test('has queryFn that fetches usage data', async () => {
      const mockResponse = {
        session: { id: 'session-xyz', title: 'Test', model: 'test', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' },
        messages: [],
        usage: { tokens: 500, cost: 0.005 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const options = sessionUsageQueryOptions('session-xyz');
      const result = await options.queryFn({ queryKey: options.queryKey, signal: new AbortController().signal, meta: undefined });

      expect(result).toEqual({ tokens: 500, cost: 0.005 });
    });

    test('has short staleTime for frequently changing usage data', () => {
      const options = sessionUsageQueryOptions('test');
      // Usage changes with each message, staleTime should be 30s or less
      expect(options.staleTime).toBeLessThanOrEqual(30 * 1000);
    });
  });

  describe('queryOptions type safety', () => {
    test('all options return objects compatible with TanStack Query v5', () => {
      // Each options factory should return an object with queryKey and queryFn
      const allOptions = [
        modelsQueryOptions(),
        sessionsQueryOptions(),
        sessionDetailQueryOptions('test-id'),
        sessionUsageQueryOptions('test-id'),
      ];

      for (const options of allOptions) {
        expect(options).toHaveProperty('queryKey');
        expect(options).toHaveProperty('queryFn');
        expect(Array.isArray(options.queryKey)).toBe(true);
        expect(typeof options.queryFn).toBe('function');
      }
    });
  });
});
