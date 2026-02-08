import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import sessionPlugin from './session.js';
import type { OracleConnection } from './oracle.js';

describe('Session Plugin', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(cookie);
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should populate request.user when valid session cookie exists', async () => {
    // Mock withConnection to return valid session data
    const mockWithConnection = vi.fn(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
      const mockResult = {
        rows: [
          {
            USER_ID: 'user-123',
            ACTIVE_ORGANIZATION_ID: 'org-456',
            EMAIL: 'alice@example.com',
            DISPLAY_NAME: 'Alice User',
            STATUS: 'active',
          },
        ],
      };
      return fn({ execute: async () => mockResult } as unknown as OracleConnection);
    });

    fastify.decorate('withConnection', mockWithConnection);

    await fastify.register(sessionPlugin);

    fastify.get('/test', async (request) => {
      return { user: request.user };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        'better-auth.session_token': 'valid-token-abc',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toEqual({
      userId: 'user-123',
      orgId: 'org-456',
      email: 'alice@example.com',
      displayName: 'Alice User',
      userStatus: 'active',
    });

    // Verify SQL query was called
    expect(mockWithConnection).toHaveBeenCalledOnce();
  });

  it('should leave request.user null when session cookie is missing', async () => {
    const mockWithConnection = vi.fn();
    fastify.decorate('withConnection', mockWithConnection);

    await fastify.register(sessionPlugin);

    fastify.get('/test', async (request) => {
      return { user: request.user };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      // No cookie sent
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toBeNull();

    // Should NOT query database when cookie is missing
    expect(mockWithConnection).not.toHaveBeenCalled();
  });

  it('should leave request.user null when session is expired', async () => {
    // Mock withConnection to return empty result (expired session)
    const mockWithConnection = vi.fn(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
      const mockResult = { rows: [] };
      return fn({ execute: async () => mockResult } as unknown as OracleConnection);
    });

    fastify.decorate('withConnection', mockWithConnection);

    await fastify.register(sessionPlugin);

    fastify.get('/test', async (request) => {
      return { user: request.user };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        'better-auth.session_token': 'expired-token-xyz',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toBeNull();

    expect(mockWithConnection).toHaveBeenCalledOnce();
  });

  it('should leave request.user null when user status is not active', async () => {
    // Mock withConnection to return suspended user
    const mockWithConnection = vi.fn(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
      const mockResult = {
        rows: [
          {
            USER_ID: 'user-456',
            ACTIVE_ORGANIZATION_ID: 'org-789',
            EMAIL: 'bob@example.com',
            DISPLAY_NAME: 'Bob User',
            STATUS: 'suspended', // Not active!
          },
        ],
      };
      return fn({ execute: async () => mockResult } as unknown as OracleConnection);
    });

    fastify.decorate('withConnection', mockWithConnection);

    await fastify.register(sessionPlugin);

    fastify.get('/test', async (request) => {
      return { user: request.user };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        'better-auth.session_token': 'valid-token-for-suspended-user',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toBeNull();

    expect(mockWithConnection).toHaveBeenCalledOnce();
  });

  it('should leave request.user null when no matching session in database', async () => {
    // Mock withConnection to return no rows (token not found)
    const mockWithConnection = vi.fn(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
      const mockResult = { rows: [] };
      return fn({ execute: async () => mockResult } as unknown as OracleConnection);
    });

    fastify.decorate('withConnection', mockWithConnection);

    await fastify.register(sessionPlugin);

    fastify.get('/test', async (request) => {
      return { user: request.user };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        'better-auth.session_token': 'nonexistent-token',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toBeNull();

    expect(mockWithConnection).toHaveBeenCalledOnce();
  });

  it('should handle database errors gracefully by leaving request.user null', async () => {
    // Mock withConnection to throw error
    const mockWithConnection = vi.fn(async () => {
      throw new Error('Database connection failed');
    });

    fastify.decorate('withConnection', mockWithConnection);

    await fastify.register(sessionPlugin);

    fastify.get('/test', async (request) => {
      return { user: request.user };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        'better-auth.session_token': 'some-token',
      },
    });

    // Should not crash the request
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toBeNull();

    expect(mockWithConnection).toHaveBeenCalledOnce();
  });

  it('should handle sessions with null active_organization_id', async () => {
    // Mock withConnection to return session without org
    const mockWithConnection = vi.fn(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
      const mockResult = {
        rows: [
          {
            USER_ID: 'user-789',
            ACTIVE_ORGANIZATION_ID: null, // No active org
            EMAIL: 'charlie@example.com',
            DISPLAY_NAME: 'Charlie User',
            STATUS: 'active',
          },
        ],
      };
      return fn({ execute: async () => mockResult } as unknown as OracleConnection);
    });

    fastify.decorate('withConnection', mockWithConnection);

    await fastify.register(sessionPlugin);

    fastify.get('/test', async (request) => {
      return { user: request.user };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      cookies: {
        'better-auth.session_token': 'token-without-org',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toEqual({
      userId: 'user-789',
      orgId: null,
      email: 'charlie@example.com',
      displayName: 'Charlie User',
      userStatus: 'active',
    });

    expect(mockWithConnection).toHaveBeenCalledOnce();
  });
});
