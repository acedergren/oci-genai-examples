import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchModels,
  fetchSessions,
  fetchSessionDetail,
  fetchSessionUsage,
  createSession,
  deleteSession,
} from './fetchers.js';

// Mock global fetch
const mockFetch = vi.fn();

describe('fetchers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchModels', () => {
    test('fetches models from /api/models endpoint', async () => {
      const mockResponse = {
        models: [
          { id: 'meta.llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta model', provider: 'meta' },
        ],
        region: 'eu-frankfurt-1',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchModels();

      expect(mockFetch).toHaveBeenCalledWith('/api/models');
      expect(result).toEqual(mockResponse);
    });

    test('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchModels()).rejects.toThrow('Failed to fetch models');
    });

    test('accepts custom base URL', async () => {
      const mockResponse = { models: [], region: 'us-phoenix-1' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchModels({ baseUrl: 'http://localhost:3000' });

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/models');
    });
  });

  describe('fetchSessions', () => {
    test('fetches sessions from /api/sessions endpoint', async () => {
      const mockResponse = {
        sessions: [
          { id: 'session-1', title: 'Test', model: 'meta.llama-3.3-70b-instruct', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchSessions();

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions');
      expect(result).toEqual(mockResponse);
    });

    test('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchSessions()).rejects.toThrow('Failed to fetch sessions');
    });
  });

  describe('fetchSessionDetail', () => {
    test('fetches session detail with messages', async () => {
      const mockResponse = {
        session: { id: 'session-1', title: 'Test', model: 'meta.llama-3.3-70b-instruct', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' },
        messages: [{ role: 'user', content: 'Hello' }],
        usage: { tokens: 100, cost: 0.001 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchSessionDetail('session-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/continue', {
        method: 'POST',
      });
      expect(result).toEqual(mockResponse);
    });

    test('throws error when session not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchSessionDetail('invalid-id')).rejects.toThrow('Failed to fetch session');
    });
  });

  describe('fetchSessionUsage', () => {
    test('fetches session usage from continue endpoint', async () => {
      const mockResponse = {
        session: { id: 'session-1', title: 'Test', model: 'meta.llama-3.3-70b-instruct', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' },
        messages: [],
        usage: { tokens: 500, cost: 0.005 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchSessionUsage('session-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/continue', {
        method: 'POST',
      });
      expect(result).toEqual({ tokens: 500, cost: 0.005 });
    });

    test('returns zero usage when not available', async () => {
      const mockResponse = {
        session: { id: 'session-1', title: 'Test', model: 'meta.llama-3.3-70b-instruct', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' },
        messages: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchSessionUsage('session-1');

      expect(result).toEqual({ tokens: 0, cost: 0 });
    });
  });

  describe('createSession', () => {
    test('creates new session via POST', async () => {
      const mockResponse = {
        session: { id: 'new-session', title: null, model: 'meta.llama-3.3-70b-instruct', createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-02T10:00:00Z' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await createSession();

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
      });
      expect(result).toEqual(mockResponse.session);
    });

    test('throws error when creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(createSession()).rejects.toThrow('Failed to create session');
    });
  });

  describe('deleteSession', () => {
    test('deletes session via DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteSession('session-to-delete');

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-to-delete', {
        method: 'DELETE',
      });
    });

    test('throws error when deletion fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(deleteSession('invalid-id')).rejects.toThrow('Failed to delete session');
    });
  });
});
