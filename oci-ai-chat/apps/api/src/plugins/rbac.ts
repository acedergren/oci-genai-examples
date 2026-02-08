import fp from 'fastify-plugin';
import type { FastifyPluginAsync, preHandlerHookHandler, FastifyRequest, FastifyReply } from 'fastify';
import { AuthError, getPermissionsForRole, hasPermission, type Permission } from '@acedergren/portal-shared';

/**
 * Symbol key for storing the cached role on the request object.
 * Uses a symbol to avoid conflicts with other request properties.
 */
const ROLE_CACHE_KEY = Symbol('userRole');

/**
 * Augment FastifyRequest with role cache.
 */
interface RequestWithRoleCache extends FastifyRequest {
  [ROLE_CACHE_KEY]?: string;
}

/**
 * Augment FastifyInstance with RBAC decorators.
 */
declare module 'fastify' {
  interface FastifyInstance {
    /**
     * PreHandler hook that requires request.user to be populated.
     * Returns 401 if user is null.
     */
    requireAuth: preHandlerHookHandler;

    /**
     * Factory for creating a preHandler hook that requires a specific permission.
     * Returns 401 if user is null, 403 if permission is denied.
     *
     * @param permission - The required permission (e.g., 'tools:execute')
     */
    requirePermission: (permission: Permission) => preHandlerHookHandler;
  }
}

/**
 * Get the user's role from Oracle, with per-request caching.
 *
 * @param request - FastifyRequest with user populated by session plugin
 * @param fastify - FastifyInstance with withConnection decorator (passed as any to avoid circular type issues)
 * @returns The user's org role (e.g., 'admin', 'operator', 'viewer')
 */
async function getUserRole(
  request: RequestWithRoleCache,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastify: any
): Promise<string> {
  // Check cache first
  if (request[ROLE_CACHE_KEY]) {
    return request[ROLE_CACHE_KEY];
  }

  // User must exist and have an org
  if (!request.user) {
    throw new AuthError('Not authenticated', 401);
  }

  if (!request.user.orgId) {
    throw new AuthError('User not associated with an organization', 403);
  }

  // Query Oracle for the user's role in this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fastify.withConnection(async (conn: any) => {
    return await conn.execute(
      `SELECT role
       FROM org_members
       WHERE user_id = :userId
         AND org_id = :orgId
       FETCH FIRST 1 ROWS ONLY`,
      {
        userId: request.user!.userId,
        orgId: request.user!.orgId,
      }
    );
  });

  // Default to viewer if no org membership found
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (result.rows?.[0] as any)?.ROLE ?? 'viewer';

  // Cache for this request
  request[ROLE_CACHE_KEY] = role;

  return role;
}

/**
 * RBAC plugin for Fastify.
 *
 * Provides two decorators:
 * - `fastify.requireAuth` — PreHandler that checks request.user exists
 * - `fastify.requirePermission(permission)` — PreHandler factory that checks permissions
 *
 * Architecture:
 * - Session plugin populates request.user (tested separately)
 * - RBAC plugin reads request.user and queries Oracle for role
 * - Role is cached per-request to avoid multiple DB queries
 * - Unknown roles fall back to viewer permissions
 *
 * @example
 * ```ts
 * fastify.register(rbacPlugin);
 *
 * fastify.get('/tools', { preHandler: fastify.requirePermission('tools:read') }, async () => {
 *   return { tools: [] };
 * });
 * ```
 */
const rbacPlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * requireAuth: Ensure user is authenticated.
   * Returns 401 if request.user is null.
   */
  const requireAuth: preHandlerHookHandler = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    if (!request.user) {
      const error = new AuthError('Not authenticated', 401);
      return reply.code(error.statusCode).send(error.toResponseBody());
    }
  };

  /**
   * requirePermission: Ensure user has a specific permission.
   * Returns 401 if user is null, 403 if permission is denied.
   */
  function requirePermission(permission: Permission): preHandlerHookHandler {
    return async (request: RequestWithRoleCache, reply: FastifyReply) => {
      try {
        // Get user's role (cached per-request)
        const role = await getUserRole(request, fastify);

        // Get permissions for this role
        const userPermissions = getPermissionsForRole(role);

        // Check if user has the required permission
        if (!hasPermission(userPermissions, permission)) {
          const error = new AuthError('Insufficient permissions', 403, {
            required: permission,
            role,
          });
          return reply.code(error.statusCode).send(error.toResponseBody());
        }
      } catch (err) {
        // If getUserRole throws AuthError, return it
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send(err.toResponseBody());
        }
        // Unexpected error — log and return 500
        fastify.log.error({ err, permission }, 'Permission check failed');
        const error = new AuthError('Permission check failed', 403);
        return reply.code(error.statusCode).send(error.toResponseBody());
      }
    };
  }

  // Decorate fastify instance with auth hooks
  fastify.decorate('requireAuth', requireAuth);
  fastify.decorate('requirePermission', requirePermission);
};

export default fp(rbacPlugin, {
  name: 'rbac',
  fastify: '5.x',
  dependencies: ['session'],
});
