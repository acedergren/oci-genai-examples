import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

/**
 * Session user information extracted from Better Auth session.
 * Populated when a valid session cookie exists.
 */
export interface SessionUser {
  userId: string;
  orgId: string | null;
  email: string;
  displayName: string;
  userStatus: 'active' | 'suspended' | 'deleted';
}

/**
 * Augment FastifyRequest with session user information and cookies.
 */
declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    cookies: Record<string, string | undefined>;
  }
}

const COOKIE_NAME = 'better-auth.session_token';

/**
 * Session validation plugin for Fastify.
 *
 * Reads the `better-auth.session_token` cookie set by SvelteKit's Better Auth,
 * queries the Oracle database to validate the session, and decorates the request
 * with user information if the session is valid.
 *
 * Architecture:
 * - Auth stays in SvelteKit (Better Auth handles OAuth callbacks, CSRF, session creation)
 * - Fastify READS the session cookie and resolves it to a user
 * - Routes decide whether to 401 if request.user is null
 *
 * Key constraints:
 * - The session token in the cookie is NOT hashed — Better Auth stores the raw token
 * - User status must be 'active' for session to be valid
 * - Expired sessions (expires_at < SYSTIMESTAMP) are rejected
 *
 * @example
 * ```ts
 * fastify.register(sessionPlugin);
 *
 * fastify.get('/protected', async (request, reply) => {
 *   if (!request.user) {
 *     return reply.code(401).send({ error: 'Unauthorized' });
 *   }
 *   return { message: `Hello ${request.user.displayName}` };
 * });
 * ```
 */
const sessionPlugin: FastifyPluginAsync = async (fastify) => {
  // Ensure cookie plugin is registered (for reading cookies)
  if (!fastify.hasDecorator('parseCookie')) {
    throw new Error('Session plugin requires @fastify/cookie to be registered first');
  }

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Default to no authenticated user
    request.user = null;

    // Extract session token from cookie
    const token = request.cookies[COOKIE_NAME];
    if (!token) {
      // No session cookie present — leave user as null
      return;
    }

    try {
      // Query Oracle for session validation
      // JOIN auth_sessions and users to get user info in a single query
      const result = await fastify.withConnection(async (conn) => {
        return await conn.execute<{
          USER_ID: string;
          ACTIVE_ORGANIZATION_ID: string | null;
          EMAIL: string;
          DISPLAY_NAME: string;
          STATUS: string;
        }>(
          `SELECT s.user_id, s.active_organization_id, u.email, u.display_name, u.status
           FROM auth_sessions s
           JOIN users u ON s.user_id = u.id
           WHERE s.token = :token
             AND s.expires_at > SYSTIMESTAMP
           FETCH FIRST 1 ROWS ONLY`,
          { token }
        );
      });

      // No matching session or session expired
      if (!result.rows || result.rows.length === 0) {
        return;
      }

      const row = result.rows[0];

      // Reject sessions for suspended or deleted users
      if (row.STATUS !== 'active') {
        return;
      }

      // Populate request.user with session information
      request.user = {
        userId: row.USER_ID,
        orgId: row.ACTIVE_ORGANIZATION_ID,
        email: row.EMAIL,
        displayName: row.DISPLAY_NAME,
        userStatus: row.STATUS as 'active' | 'suspended' | 'deleted',
      };
    } catch (error) {
      // Log error but don't crash the request
      // Leave user as null — routes will handle unauthenticated state
      fastify.log.error(
        { err: error, token: token.substring(0, 8) + '...' },
        'Session validation failed'
      );
    }
  });
};

export default fp(sessionPlugin, {
  name: 'session',
  fastify: '5.x',
  dependencies: ['@fastify/cookie'],
});
