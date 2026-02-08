import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { OracleConnection } from './oracle.js';
import rbacPlugin from './rbac.js';

/**
 * Test suite for RBAC plugin (Fastify preHandler hooks for permission checks).
 *
 * Architecture:
 * - Session plugin populates request.user (tested separately)
 * - RBAC plugin provides requireAuth and requirePermission hooks
 * - Role lookup happens once per request (cached)
 * - Unknown roles fall back to viewer permissions
 */

describe('RBAC Plugin', () => {
  let app: FastifyInstance;
  let mockWithConnection: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    // Mock withConnection (Oracle plugin decorator)
    mockWithConnection = vi.fn();
    app.decorate('withConnection', mockWithConnection);

    // Mock request.user (populated by session plugin)
    app.decorateRequest('user', null);

    // Register a fake session plugin to satisfy dependency
    const mockSessionPlugin = fp(async (fastify) => {
      // Session plugin logic is tested separately
      // Here we just satisfy the dependency
    }, { name: 'session' });

    await app.register(mockSessionPlugin);

    // Register RBAC plugin
    await app.register(rbacPlugin);
  });

  describe('requireAuth hook', () => {
    it('returns 401 when no user is present', async () => {
      app.get('/protected', { preHandler: app.requireAuth }, async () => {
        return { message: 'success' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        code: 'AUTH_ERROR',
        error: 'Not authenticated',
      });
    });

    it('allows request when user is present', async () => {
      app.addHook('onRequest', async (request) => {
        request.user = {
          userId: 'user-1',
          orgId: 'org-1',
          email: 'test@example.com',
          displayName: 'Test User',
          userStatus: 'active',
        };
      });

      app.get('/protected', { preHandler: app.requireAuth }, async () => {
        return { message: 'success' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'success' });
    });
  });

  describe('requirePermission hook', () => {
    beforeEach(() => {
      // Default: populate user in all tests
      app.addHook('onRequest', async (request) => {
        request.user = {
          userId: 'user-1',
          orgId: 'org-1',
          email: 'test@example.com',
          displayName: 'Test User',
          userStatus: 'active',
        };
      });
    });

    it('returns 401 when no user is present', async () => {
      // Create a new app instance without the user hook
      const appNoUser = Fastify({ logger: false });
      appNoUser.decorate('withConnection', mockWithConnection);
      appNoUser.decorateRequest('user', null);

      const mockSessionPlugin = fp(async (fastify) => {
        // Empty session plugin for dependency
      }, { name: 'session' });

      await appNoUser.register(mockSessionPlugin);
      await appNoUser.register(rbacPlugin);

      appNoUser.get(
        '/tools/execute',
        { preHandler: appNoUser.requirePermission('tools:execute') },
        async () => {
          return { message: 'executed' };
        }
      );

      const response = await appNoUser.inject({
        method: 'GET',
        url: '/tools/execute',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        code: 'AUTH_ERROR',
        error: 'Not authenticated',
      });
    });

    it('allows admin role to access all permissions', async () => {
      mockWithConnection.mockImplementation(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValue({
            rows: [{ ROLE: 'admin' }],
          }),
        } as unknown as OracleConnection;
        return fn(mockConn);
      });

      app.get(
        '/admin/users',
        { preHandler: app.requirePermission('admin:users') },
        async () => {
          return { message: 'admin access granted' };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/admin/users',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'admin access granted' });
    });

    it('denies viewer role from executing tools', async () => {
      mockWithConnection.mockImplementation(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValue({
            rows: [{ ROLE: 'viewer' }],
          }),
        } as unknown as OracleConnection;
        return fn(mockConn);
      });

      app.get(
        '/tools/execute',
        { preHandler: app.requirePermission('tools:execute') },
        async () => {
          return { message: 'executed' };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/tools/execute',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: 'AUTH_ERROR',
        error: 'Insufficient permissions',
      });
    });

    it('allows operator role to execute tools', async () => {
      mockWithConnection.mockImplementation(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValue({
            rows: [{ ROLE: 'operator' }],
          }),
        } as unknown as OracleConnection;
        return fn(mockConn);
      });

      app.get(
        '/tools/execute',
        { preHandler: app.requirePermission('tools:execute') },
        async () => {
          return { message: 'executed' };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/tools/execute',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'executed' });
    });

    it('denies operator role from admin permissions', async () => {
      mockWithConnection.mockImplementation(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValue({
            rows: [{ ROLE: 'operator' }],
          }),
        } as unknown as OracleConnection;
        return fn(mockConn);
      });

      app.get(
        '/admin/users',
        { preHandler: app.requirePermission('admin:users') },
        async () => {
          return { message: 'admin access granted' };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/admin/users',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: 'AUTH_ERROR',
        error: 'Insufficient permissions',
      });
    });

    it('returns 403 when user has no org (orgId null)', async () => {
      // Create a new app instance with user that has no org
      const appNoOrg = Fastify({ logger: false });
      appNoOrg.decorate('withConnection', mockWithConnection);
      appNoOrg.decorateRequest('user', null);

      const mockSessionPlugin = fp(async (fastify) => {
        // Empty session plugin for dependency
      }, { name: 'session' });

      await appNoOrg.register(mockSessionPlugin);
      await appNoOrg.register(rbacPlugin);

      appNoOrg.addHook('onRequest', async (request) => {
        request.user = {
          userId: 'user-1',
          orgId: null,
          email: 'test@example.com',
          displayName: 'Test User',
          userStatus: 'active',
        };
      });

      appNoOrg.get(
        '/tools/execute',
        { preHandler: appNoOrg.requirePermission('tools:execute') },
        async () => {
          return { message: 'executed' };
        }
      );

      const response = await appNoOrg.inject({
        method: 'GET',
        url: '/tools/execute',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: 'AUTH_ERROR',
        error: 'User not associated with an organization',
      });
    });

    it('caches role lookup — second permission check does not re-query Oracle', async () => {
      let queryCount = 0;

      mockWithConnection.mockImplementation(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
        const mockConn = {
          execute: vi.fn().mockImplementation(async () => {
            queryCount++;
            return { rows: [{ ROLE: 'operator' }] };
          }),
        } as unknown as OracleConnection;
        return fn(mockConn);
      });

      // Two permission checks on the same route
      app.get(
        '/multi-check',
        {
          preHandler: [
            app.requirePermission('tools:read'),
            app.requirePermission('tools:execute'),
          ],
        },
        async () => {
          return { message: 'success' };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/multi-check',
      });

      expect(response.statusCode).toBe(200);
      expect(queryCount).toBe(1); // Only queried Oracle once
    });

    it('falls back to viewer permissions for unknown roles', async () => {
      mockWithConnection.mockImplementation(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValue({
            rows: [{ ROLE: 'unknown-role' }],
          }),
        } as unknown as OracleConnection;
        return fn(mockConn);
      });

      app.get(
        '/tools/execute',
        { preHandler: app.requirePermission('tools:execute') },
        async () => {
          return { message: 'executed' };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/tools/execute',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: 'AUTH_ERROR',
        error: 'Insufficient permissions',
      });
    });

    it('allows viewer role to read tools', async () => {
      mockWithConnection.mockImplementation(async (fn: (conn: OracleConnection) => Promise<unknown>) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValue({
            rows: [{ ROLE: 'viewer' }],
          }),
        } as unknown as OracleConnection;
        return fn(mockConn);
      });

      app.get(
        '/tools',
        { preHandler: app.requirePermission('tools:read') },
        async () => {
          return { message: 'tools list' };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/tools',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'tools list' });
    });
  });
});
