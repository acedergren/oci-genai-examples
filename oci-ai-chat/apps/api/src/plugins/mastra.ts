/**
 * Mastra Fastify plugin — registers agents, memory, tools, vector store,
 * and Mastra framework routes under the /api/mastra prefix.
 *
 * Integrates with the existing Oracle, session, and RBAC plugins
 * by bridging our auth context into Mastra's request context.
 *
 * Phase 9.7: adds OracleVectorStore and OCI GenAI embedder for RAG.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { Mastra } from "@mastra/core";
import { MastraServer } from "@mastra/fastify";
import { Memory } from "@mastra/memory";
import { OracleStore } from "../mastra/storage/oracle-store.js";
import { OracleVectorStore } from "../mastra/rag/oracle-vector-store.js";
import { createOCIEmbedder } from "../mastra/rag/oci-embedder.js";
import { buildMastraTools } from "../mastra/tools/registry.js";
import {
  createCloudAdvisorAgent,
  DEFAULT_MODEL,
} from "../mastra/agents/cloud-advisor.js";

declare module "fastify" {
  interface FastifyInstance {
    mastra: Mastra;
    vectorStore?: OracleVectorStore;
    ociEmbedder?: ReturnType<typeof createOCIEmbedder>;
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

  // ── Oracle Vector Store (for RAG / semantic search) ─────────────────
  const vectorStore = hasOracle
    ? new OracleVectorStore({ withConnection: fastify.withConnection })
    : undefined;

  // ── OCI GenAI Embedder ──────────────────────────────────────────────
  const ociEmbedder = createOCIEmbedder();

  // ── Build Mastra tools from the OCI tool registry ──────────────────
  const tools = buildMastraTools();

  // ── Create Mastra Memory (conversation persistence) ─────────────────
  const memory = new Memory({
    options: {
      lastMessages: 40,
      workingMemory: { enabled: true },
    },
  });

  // ── Create CloudAdvisor agent ──────────────────────────────────────
  const compartmentId = process.env.OCI_COMPARTMENT_ID;
  const cloudAdvisor = createCloudAdvisorAgent({
    model: DEFAULT_MODEL,
    memory,
    compartmentId,
  });

  // ── Create Mastra instance ─────────────────────────────────────────
  const mastra = new Mastra({
    agents: { "cloud-advisor": cloudAdvisor },
    tools,
    storage,
    memory: { "cloud-advisor": memory },
  });

  fastify.decorate("mastra", mastra);

  // Expose vector store and embedder as Fastify decorators for direct use
  if (vectorStore) {
    fastify.decorate("vectorStore", vectorStore);
  }
  fastify.decorate("ociEmbedder", ociEmbedder);

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
    `Mastra plugin registered: ${Object.keys(tools).length} tools, 1 agent (CloudAdvisor), ` +
      `vector=${!!vectorStore} at ${MASTRA_PREFIX}`,
  );
};

export default fp(mastraPlugin, {
  name: "mastra",
  fastify: "5.x",
  // No hard dependency on oracle — works without DB in test/dev mode
});
