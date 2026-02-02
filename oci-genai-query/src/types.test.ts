import { describe, test, expect } from 'vitest';
import type {
  OciModel,
  OciSession,
  SessionUsage,
  ModelsResponse,
  SessionsResponse,
  SessionDetailResponse,
} from './types.js';

describe('types', () => {
  describe('OciModel', () => {
    test('accepts valid model structure', () => {
      const model: OciModel = {
        id: 'meta.llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B Instruct',
        description: 'Meta Llama 3.3 70B instruction-tuned model',
        provider: 'meta',
        capabilities: ['chat', 'reasoning'],
      };

      expect(model.id).toBe('meta.llama-3.3-70b-instruct');
      expect(model.capabilities).toContain('chat');
    });

    test('allows optional capabilities field', () => {
      const model: OciModel = {
        id: 'cohere.command-r-plus',
        name: 'Command R+',
        description: 'Cohere Command R+ model',
        provider: 'cohere',
      };

      expect(model.capabilities).toBeUndefined();
    });
  });

  describe('OciSession', () => {
    test('accepts valid session structure', () => {
      const session: OciSession = {
        id: 'session-abc123',
        title: 'OCI Resource Management',
        model: 'meta.llama-3.3-70b-instruct',
        createdAt: '2026-02-02T10:00:00Z',
        updatedAt: '2026-02-02T10:30:00Z',
      };

      expect(session.id).toBe('session-abc123');
      expect(session.title).toBe('OCI Resource Management');
    });

    test('allows null title for new sessions', () => {
      const session: OciSession = {
        id: 'session-new',
        title: null,
        model: 'meta.llama-3.3-70b-instruct',
        createdAt: '2026-02-02T10:00:00Z',
        updatedAt: '2026-02-02T10:00:00Z',
      };

      expect(session.title).toBeNull();
    });
  });

  describe('SessionUsage', () => {
    test('accepts valid usage structure', () => {
      const usage: SessionUsage = {
        tokens: 1500,
        cost: 0.0045,
      };

      expect(usage.tokens).toBe(1500);
      expect(usage.cost).toBe(0.0045);
    });
  });

  describe('ModelsResponse', () => {
    test('accepts valid models response structure', () => {
      const response: ModelsResponse = {
        models: [
          {
            id: 'meta.llama-3.3-70b-instruct',
            name: 'Llama 3.3 70B',
            description: 'Meta Llama model',
            provider: 'meta',
          },
        ],
        region: 'eu-frankfurt-1',
      };

      expect(response.models).toHaveLength(1);
      expect(response.region).toBe('eu-frankfurt-1');
    });
  });

  describe('SessionsResponse', () => {
    test('accepts valid sessions response structure', () => {
      const response: SessionsResponse = {
        sessions: [
          {
            id: 'session-1',
            title: 'Test Session',
            model: 'meta.llama-3.3-70b-instruct',
            createdAt: '2026-02-02T10:00:00Z',
            updatedAt: '2026-02-02T10:30:00Z',
          },
        ],
      };

      expect(response.sessions).toHaveLength(1);
    });
  });

  describe('SessionDetailResponse', () => {
    test('accepts valid session detail response', () => {
      const response: SessionDetailResponse = {
        session: {
          id: 'session-1',
          title: 'Test Session',
          model: 'meta.llama-3.3-70b-instruct',
          createdAt: '2026-02-02T10:00:00Z',
          updatedAt: '2026-02-02T10:30:00Z',
        },
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        usage: {
          tokens: 50,
          cost: 0.0001,
        },
      };

      expect(response.session.id).toBe('session-1');
      expect(response.messages).toHaveLength(2);
      expect(response.usage?.tokens).toBe(50);
    });

    test('allows optional usage field', () => {
      const response: SessionDetailResponse = {
        session: {
          id: 'session-1',
          title: null,
          model: 'meta.llama-3.3-70b-instruct',
          createdAt: '2026-02-02T10:00:00Z',
          updatedAt: '2026-02-02T10:00:00Z',
        },
        messages: [],
      };

      expect(response.usage).toBeUndefined();
    });
  });
});
