import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import cookie from "@fastify/cookie";
import { loadConfig, type AppConfig } from "./config.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import requestLoggerPlugin, {
  redactHeaders,
} from "./plugins/request-logger.js";
import corsPlugin from "./plugins/cors.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import helmetPlugin from "./plugins/helmet.js";
import oraclePlugin from "./plugins/oracle.js";
import sessionPlugin, { type SessionUser } from "./plugins/session.js";
import rbacPlugin from "./plugins/rbac.js";
import mastraPlugin from "./plugins/mastra.js";
import healthRoutes from "./routes/health.js";
import sessionRoutes from "./routes/sessions.js";
import activityRoutes from "./routes/activity.js";
import { toolExecuteRoutes, toolApproveRoutes } from "./routes/tools/index.js";

/** Routes that do not require authentication. */
const PUBLIC_ROUTES = new Set(["/api/health", "/api/healthz"]);

export interface BuildAppOptions extends FastifyServerOptions {
  config?: AppConfig;
  /** Skip Oracle/session/RBAC plugins (for unit tests without a database). */
  skipAuth?: boolean;
  /** Inject a test user on every request (only works with skipAuth). */
  testUser?: SessionUser;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const config = opts.config ?? loadConfig();

  const app = Fastify({
    ...opts,
    bodyLimit: 512 * 1024, // 512 KiB global default (API-M-1)
    logger: opts.logger ?? {
      level: config.logLevel,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            headers: redactHeaders(
              request.headers as Record<string, string | string[] | undefined>,
            ),
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
  });

  // Zod type provider for schema validation on routes
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ── Infrastructure plugins (order matters) ──────────────────────────

  // 1. Error handler first — catches errors from all subsequent plugins/routes
  app.register(errorHandlerPlugin);

  // 2. Request ID + logging hooks
  app.register(requestLoggerPlugin);

  // 3. Security headers
  app.register(helmetPlugin);

  // 4. CORS
  app.register(corsPlugin, { corsOrigin: config.corsOrigin });

  // 5. Rate limiting
  app.register(rateLimitPlugin, { rateLimitMax: config.rateLimitMax });

  // ── Auth chain (cookie → oracle → session → RBAC) ───────────────────

  if (!opts.skipAuth) {
    // 6. Cookie parser (required by session plugin)
    app.register(cookie);

    // 7. Oracle connection pool
    app.register(oraclePlugin, {
      user: process.env.ORACLE_USER ?? "",
      password: process.env.ORACLE_PASSWORD ?? "",
      connectString:
        process.env.ORACLE_CONNECT_STRING ?? process.env.ORACLE_DSN ?? "",
      walletLocation: process.env.ORACLE_WALLET_LOCATION,
      walletPassword: process.env.ORACLE_WALLET_PASSWORD,
    });

    // 8. Session validation (reads cookie, queries Oracle)
    app.register(sessionPlugin);

    // 9. RBAC permission hooks
    app.register(rbacPlugin);
  } else {
    // Stub decorators so route modules can reference them without the real plugins.
    // Tests can override withConnection/oracle via mockOracleDecorators() before app.ready().
    app.decorateRequest("user", null);
    app.decorate("requireAuth", async () => {});
    app.decorate("requirePermission", () => async () => {});

    // Inject test user before the auth gate (registered below) sees the request.
    if (opts.testUser) {
      const testUser = opts.testUser;
      app.addHook("onRequest", async (request) => {
        request.user = testUser;
      });
    }
  }

  // ── Deny-by-default auth gate ───────────────────────────────────────

  app.addHook("onRequest", async (request, reply) => {
    if (PUBLIC_ROUTES.has(request.url.split("?")[0])) return;
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // ── Mastra framework (agents, workflows, MCP) ─────────────────────

  // 10. Mastra — works with or without Oracle/auth
  app.register(mastraPlugin);

  // ── Route modules ───────────────────────────────────────────────────

  app.register(healthRoutes);
  app.register(sessionRoutes);
  app.register(activityRoutes);
  app.register(toolExecuteRoutes);
  app.register(toolApproveRoutes);

  return app;
}
