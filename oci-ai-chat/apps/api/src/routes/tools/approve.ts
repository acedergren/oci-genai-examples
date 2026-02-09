import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ToolApproveBodySchema } from "../schemas.js";
import { getToolDefinition } from "../../services/tools.js";
import { pendingApprovals, recordApproval } from "../../services/approvals.js";

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
      const pending = Array.from(pendingApprovals.entries()).map(
        ([id, data]) => ({
          toolCallId: id,
          toolName: data.toolName,
          args: data.args,
          sessionId: data.sessionId,
          createdAt: new Date(data.createdAt).toISOString(),
          age: Date.now() - data.createdAt,
        }),
      );

      return reply.send({ pending, count: pending.length });
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
      const { toolCallId, approved } = request.body;

      // Atomic get-and-delete to prevent double-approval race (S-10)
      const pending = pendingApprovals.get(toolCallId);
      if (!pending) {
        return reply.code(404).send({
          error: "No pending approval found for this tool call",
          code: "NOT_FOUND",
        });
      }
      pendingApprovals.delete(toolCallId);

      const toolDef = getToolDefinition(pending.toolName);

      fastify.log.info(
        { toolName: pending.toolName, approved, toolCallId },
        "approval decision",
      );

      // Record server-side approval so execute endpoint can verify
      if (approved) {
        await recordApproval(toolCallId, pending.toolName);
      }

      // Resolve the pending promise (already removed from map)
      pending.resolve(approved);

      return reply.send({
        success: true,
        approved,
        toolCallId,
        toolName: pending.toolName,
        category: toolDef?.category ?? "unknown",
        message: approved
          ? "Tool execution approved"
          : "Tool execution rejected",
      });
    },
  );
};

export default toolApproveRoutes;
