/**
 * Mastra Fastify plugin — registers Mastra framework routes
 * under the /api/mastra prefix.
 *
 * Integrates with the existing Oracle, session, and RBAC plugins
 * by bridging our auth context into Mastra's request context.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { Mastra } from "@mastra/core";
import { MastraServer } from "@mastra/fastify";
import { OracleStore } from "../mastra/storage/oracle-store.js";
import { buildMastraTools } from "../mastra/tools/registry.js";

declare module "fastify" {
  interface FastifyInstance {
    mastra: Mastra;
  }
}

const MASTRA_PREFIX = "/api/mastra";

const mastraPlugin: FastifyPluginAsync = async (fastify) => {
  // ── Oracle storage adapter ──────────────────────────────────────────
  const hasOracle = fastify.hasDecorator("withConnection");
  const storage = hasOracle
    ? new OracleStore({
        withConnection: fastify.withConnection,
        disableInit: true, // migrations handle DDL
      })
    : undefined;

  // ── Build Mastra tools from the OCI tool registry ──────────────────
  const tools = buildMastraTools();

  // ── Create Mastra instance ─────────────────────────────────────────
  const mastra = new Mastra({
    tools,
    storage,
  });

  fastify.decorate("mastra", mastra);

  // ── Create MastraServer and register routes ────────────────────────
  const server = new MastraServer({
    app: fastify,
    mastra,
    prefix: MASTRA_PREFIX,
    tools,
  });

  // Auth bridge: inject our session user into Mastra's request context.
  // Runs after Mastra's context middleware (registered in init) but
  // before route handlers via Fastify's hook ordering.
  fastify.addHook("onRequest", async (request) => {
    // Only bridge for Mastra routes
    if (!request.url.startsWith(MASTRA_PREFIX)) return;

    if (request.requestContext && request.user) {
      // Extend Mastra's RequestContext with our auth fields.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = request.requestContext as Record<string, any>;
      ctx.userId = request.user.userId;
      ctx.orgId = request.user.orgId;
    }
  });

  await server.init();

  fastify.log.info(
    `Mastra plugin registered with ${Object.keys(tools).length} tools at ${MASTRA_PREFIX}`,
  );
};

export default fp(mastraPlugin, {
  name: "mastra",
  fastify: "5.x",
  // No hard dependency on oracle — works without DB in test/dev mode
});
