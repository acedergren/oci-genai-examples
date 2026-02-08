import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ActivityQuerySchema, type ActivityItem } from "./schemas.js";

/** Oracle row shape for tool_executions (OUT_FORMAT_OBJECT, uppercase keys). */
interface ActivityRow {
  ID: string;
  TOOL_CATEGORY: string;
  TOOL_NAME: string;
  ACTION: string;
  SUCCESS: number | null;
  CREATED_AT: Date;
}

function rowToActivityItem(row: ActivityRow): ActivityItem {
  const success = row.SUCCESS === null ? true : row.SUCCESS === 1;
  const action = row.ACTION;

  let status: ActivityItem["status"];
  if (action === "requested" || action === "approved") {
    status = "pending";
  } else if (success && (action === "executed" || action === "completed")) {
    status = "completed";
  } else {
    status = "failed";
  }

  return {
    id: row.ID,
    type: row.TOOL_CATEGORY,
    action: `${row.TOOL_NAME} (${row.ACTION})`,
    time: row.CREATED_AT.toISOString(),
    status,
  };
}

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

  app.get(
    "/api/activity",
    {
      schema: { querystring: ActivityQuerySchema },
      preHandler: fastify.requirePermission("tools:read"),
    },
    async (request, reply) => {
      const { limit, offset } = request.query;
      const userId = request.user?.userId;

      if (!userId) {
        return reply.send({ items: [], total: 0 });
      }

      if (!fastify.hasDecorator("withConnection")) {
        return reply.send({
          items: [],
          total: 0,
          message: "Database not available",
        });
      }

      try {
        const { items, total } = await fastify.withConnection(async (conn) => {
          const countResult = await conn.execute<{ CNT: number }>(
            `SELECT COUNT(*) AS "CNT" FROM tool_executions WHERE user_id = :userId`,
            { userId },
          );
          const total = countResult.rows?.[0]?.CNT ?? 0;

          const result = await conn.execute<ActivityRow>(
            `SELECT id AS "ID",
                    tool_category AS "TOOL_CATEGORY",
                    tool_name AS "TOOL_NAME",
                    action AS "ACTION",
                    success AS "SUCCESS",
                    created_at AS "CREATED_AT"
               FROM tool_executions
              WHERE user_id = :userId
              ORDER BY created_at DESC
              OFFSET :offset ROWS FETCH NEXT :maxRows ROWS ONLY`,
            { userId, offset, maxRows: limit },
          );

          return {
            items: (result.rows ?? []).map(rowToActivityItem),
            total,
          };
        });

        return reply.send({ items, total });
      } catch (err) {
        fastify.log.error({ err }, "Failed to fetch activity");
        return reply
          .code(500)
          .send({ items: [], total: 0, error: "Failed to retrieve activity" });
      }
    },
  );
};

export default activityRoutes;
