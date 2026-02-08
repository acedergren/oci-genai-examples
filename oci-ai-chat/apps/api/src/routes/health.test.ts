import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildApp } from "../app.js";
import * as oraclePlugin from "../plugins/oracle.js";
import { execFile } from "node:child_process";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

/** Decorate app with a mock withConnection that simulates healthy Oracle. */
function mockOracleDecorators(
  app: ReturnType<typeof buildApp>,
  opts?: { throwOnQuery?: boolean },
) {
  const mockConn = {
    execute: opts?.throwOnQuery
      ? vi.fn().mockRejectedValue(new Error("Database connection failed"))
      : vi.fn().mockResolvedValue({ rows: [{ "1": 1 }] }),
    close: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
  };
  app.decorate(
    "withConnection",
    async <T>(fn: (conn: typeof mockConn) => Promise<T>) => fn(mockConn),
  );
  app.decorate("oracle", {
    getConnection: vi.fn().mockResolvedValue(mockConn),
    close: vi.fn(),
    connectionsOpen: 2,
    connectionsInUse: 1,
    poolMin: 2,
    poolMax: 10,
  });
}

describe("Health Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/health", () => {
    it("returns status ok", async () => {
      const app = buildApp({ skipAuth: true });
      await app.ready();

      const response = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("ok");
      expect(body.service).toBe("api");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("GET /api/healthz", () => {
    it("returns healthy when all checks pass", async () => {
      const app = buildApp({ skipAuth: true });
      mockOracleDecorators(app);
      await app.ready();

      // Mock getPoolStats to return healthy stats
      vi.spyOn(oraclePlugin, "getPoolStats").mockReturnValue({
        connectionsOpen: 2,
        connectionsInUse: 1,
        poolMin: 2,
        poolMax: 10,
      });

      // Mock OCI CLI check
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback) => {
        if (callback) {
          callback(null, "3.30.0", "");
        }
        return {} as ReturnType<typeof execFile>;
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/healthz",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("ok");
      expect(body.service).toBe("api");
      expect(body.checks).toBeDefined();
      expect(body.checks.database.status).toBe("ok");
      expect(body.checks.connection_pool.status).toBe("ok");
      expect(body.checks.oci_cli.status).toBe("ok");
    });

    it("returns degraded when non-critical check fails", async () => {
      const app = buildApp({ skipAuth: true });
      mockOracleDecorators(app);
      await app.ready();

      // Mock getPoolStats
      vi.spyOn(oraclePlugin, "getPoolStats").mockReturnValue({
        connectionsOpen: 2,
        connectionsInUse: 1,
        poolMin: 2,
        poolMax: 10,
      });

      // Mock OCI CLI failure (non-critical)
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback) => {
        if (callback) {
          callback(new Error("oci command not found"), "", "");
        }
        return {} as ReturnType<typeof execFile>;
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/healthz",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("degraded");
      expect(body.checks.database.status).toBe("ok");
      expect(body.checks.connection_pool.status).toBe("ok");
      expect(body.checks.oci_cli.status).toBe("error");
      expect(body.checks.oci_cli.message).toContain("OCI CLI check failed");
    });

    it("returns 503 unhealthy when database check fails", async () => {
      const app = buildApp({ skipAuth: true });
      mockOracleDecorators(app, { throwOnQuery: true });
      await app.ready();

      // Mock getPoolStats (still working)
      vi.spyOn(oraclePlugin, "getPoolStats").mockReturnValue({
        connectionsOpen: 2,
        connectionsInUse: 1,
        poolMin: 2,
        poolMax: 10,
      });

      // Mock OCI CLI
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback) => {
        if (callback) {
          callback(null, "3.30.0", "");
        }
        return {} as ReturnType<typeof execFile>;
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/healthz",
      });

      expect(response.statusCode).toBe(503);
      const body = response.json();
      expect(body.status).toBe("unhealthy");
      expect(body.checks.database.status).toBe("error");
      expect(body.checks.database.message).toContain(
        "Database connectivity check failed",
      );
    });

    it("returns 503 unhealthy when connection pool is unavailable", async () => {
      const app = buildApp({ skipAuth: true });
      mockOracleDecorators(app);
      await app.ready();

      // Mock getPoolStats returning null (pool not available)
      vi.spyOn(oraclePlugin, "getPoolStats").mockReturnValue(null);

      // Mock OCI CLI
      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback) => {
        if (callback) {
          callback(null, "3.30.0", "");
        }
        return {} as ReturnType<typeof execFile>;
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/healthz",
      });

      expect(response.statusCode).toBe(503);
      const body = response.json();
      expect(body.status).toBe("unhealthy");
      expect(body.checks.connection_pool.status).toBe("error");
      expect(body.checks.connection_pool.message).toContain(
        "Oracle pool not available",
      );
    });

    it("includes latency metrics for all checks", async () => {
      const app = buildApp({ skipAuth: true });
      mockOracleDecorators(app);
      await app.ready();

      // Mock successful checks
      vi.spyOn(oraclePlugin, "getPoolStats").mockReturnValue({
        connectionsOpen: 2,
        connectionsInUse: 1,
        poolMin: 2,
        poolMax: 10,
      });

      vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, callback) => {
        if (callback) {
          callback(null, "3.30.0", "");
        }
        return {} as ReturnType<typeof execFile>;
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/healthz",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(body.checks.connection_pool.latencyMs).toBeGreaterThanOrEqual(0);
      expect(body.checks.oci_cli.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
