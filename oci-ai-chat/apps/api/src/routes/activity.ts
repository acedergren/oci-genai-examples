import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ActivityQuerySchema } from "./schemas.js";

/**
 * Activity route module.
 *
 * Registers:
 * - GET /api/activity — list recent tool execution activity (paginated)
 *
 * Requires authentication + `tools:read` permission.
 */
const activityRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/activity — list recent tool executions for the authenticated user
  app.get(
    "/api/activity",
    {
      schema: { querystring: ActivityQuerySchema },
      preHandler: fastify.requirePermission("tools:read"),
    },
    async (request, reply) => {
      // TODO: Implement activity listing (Task #4)
      // - Query tool_executions via fastify.withConnection()
      // - Filter by request.user!.userId (IDOR)
      // - Map Oracle UPPERCASE rows to camelCase ActivityItem
      // - Status mapping: requested|approved → pending, executed|completed + success → completed, else → failed
      // - Return { items, total }
      const { limit, offset } = request.query;
      void limit;
      void offset;
      return reply.code(501).send({ error: "Not implemented" });
    },
  );
};

export default activityRoutes;
