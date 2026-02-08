import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ToolExecuteQuerySchema, ToolExecuteBodySchema } from "../schemas.js";

/**
 * Tool execution route module.
 *
 * Registers:
 * - GET  /api/tools/execute?toolName=xxx — get approval requirements for a tool
 * - POST /api/tools/execute              — execute a tool (with approval verification)
 *
 * Requires authentication + `tools:execute` permission.
 */
const toolExecuteRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/tools/execute — get tool approval requirements
  app.get(
    "/api/tools/execute",
    {
      schema: { querystring: ToolExecuteQuerySchema },
      preHandler: fastify.requirePermission("tools:execute"),
    },
    async (request, reply) => {
      // TODO: Implement tool info lookup (Task #5)
      // - getToolDefinition(toolName)
      // - Return { toolName, category, approvalLevel, requiresApproval, warning, description }
      const { toolName } = request.query;
      void toolName;
      return reply.code(501).send({ error: "Not implemented" });
    },
  );

  // POST /api/tools/execute — execute a tool
  app.post(
    "/api/tools/execute",
    {
      schema: { body: ToolExecuteBodySchema },
      preHandler: fastify.requirePermission("tools:execute"),
    },
    async (request, reply) => {
      // TODO: Implement tool execution (Task #5)
      // - Validate tool exists via getToolDefinition()
      // - If requiresApproval, verify via consumeApproval(toolCallId, toolName)
      // - Execute via executeTool(toolName, args)
      // - Log execution + metrics
      // - Return { success, toolCallId, toolName, data, duration, approvalLevel }
      const { toolCallId, toolName, args, sessionId } = request.body;
      void toolCallId;
      void toolName;
      void args;
      void sessionId;
      return reply.code(501).send({ error: "Not implemented" });
    },
  );
};

export default toolExecuteRoutes;
