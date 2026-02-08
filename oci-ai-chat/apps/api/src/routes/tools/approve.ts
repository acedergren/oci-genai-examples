import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ToolApproveBodySchema } from "../schemas.js";

/**
 * Tool approval route module.
 *
 * Registers:
 * - GET  /api/tools/approve — list pending approval requests
 * - POST /api/tools/approve — approve or reject a pending tool execution
 *
 * Requires authentication + `tools:approve` permission.
 */
const toolApproveRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/tools/approve — list pending approvals
  app.get(
    "/api/tools/approve",
    {
      preHandler: fastify.requirePermission("tools:approve"),
    },
    async (_request, reply) => {
      // TODO: Implement pending approvals listing (Task #5)
      // - Read pendingApprovals Map
      // - Return { pending: [...], count }
      return reply.code(501).send({ error: "Not implemented" });
    },
  );

  // POST /api/tools/approve — approve or reject a tool execution
  app.post(
    "/api/tools/approve",
    {
      schema: { body: ToolApproveBodySchema },
      preHandler: fastify.requirePermission("tools:approve"),
    },
    async (request, reply) => {
      // TODO: Implement approval handling (Task #5)
      // - Validate toolCallId exists in pendingApprovals
      // - If approved, recordApproval(toolCallId, toolName)
      // - Resolve the pending promise
      // - Log via logToolApproval()
      // - Return { success, approved, toolCallId, message }
      const { toolCallId, approved, reason } = request.body;
      void toolCallId;
      void approved;
      void reason;
      return reply.code(501).send({ error: "Not implemented" });
    },
  );
};

export default toolApproveRoutes;
