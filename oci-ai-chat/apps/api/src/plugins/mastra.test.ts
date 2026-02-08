import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// Mock @mastra/core and @mastra/fastify to avoid pulling in their full dependency tree
// Use `function` (not arrow) so the mock is constructable with `new`
const mockInit = vi.fn().mockResolvedValue(undefined);

vi.mock("@mastra/core", () => ({
  Mastra: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.getTools = vi.fn().mockReturnValue({});
    this.getAgent = vi.fn();
  }),
}));

vi.mock("@mastra/fastify", () => ({
  MastraServer: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
  ) {
    this.init = mockInit;
  }),
}));

// Mock the tool registry
vi.mock("../mastra/tools/registry.js", () => ({
  buildMastraTools: vi.fn().mockReturnValue({
    listInstances: { id: "listInstances", description: "List instances" },
    createVcn: { id: "createVcn", description: "Create VCN" },
  }),
}));

// Mock the oracle store — use `function` so it's constructable
vi.mock("../mastra/storage/oracle-store.js", () => ({
  OracleStore: vi.fn().mockImplementation(function () {
    // empty composite store mock
  }),
}));

// Import after mocks
const { default: mastraPlugin } = await import("./mastra.js");

describe("mastra plugin", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers successfully without oracle decorator", async () => {
    // No oracle plugin registered — mastra should still work
    await app.register(mastraPlugin);
    await app.ready();

    expect(app.mastra).toBeDefined();
  });

  it("decorates fastify with mastra instance", async () => {
    await app.register(mastraPlugin);
    await app.ready();

    expect(app.hasDecorator("mastra")).toBe(true);
  });

  it("calls MastraServer.init()", async () => {
    await app.register(mastraPlugin);
    await app.ready();

    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it("creates OracleStore when withConnection is available", async () => {
    const { OracleStore } = await import("../mastra/storage/oracle-store.js");

    // Simulate oracle plugin being registered
    app.decorate("withConnection", async (fn: unknown) => fn);
    app.decorate("oracle", { pool: {} });

    await app.register(mastraPlugin);
    await app.ready();

    expect(OracleStore).toHaveBeenCalledWith(
      expect.objectContaining({
        withConnection: expect.any(Function),
        disableInit: true,
      }),
    );
  });

  it("skips OracleStore when withConnection is not available", async () => {
    const { OracleStore } = await import("../mastra/storage/oracle-store.js");

    await app.register(mastraPlugin);
    await app.ready();

    // OracleStore should NOT be called when no oracle decorator
    expect(OracleStore).not.toHaveBeenCalled();
  });

  it("builds Mastra tools from registry", async () => {
    const { buildMastraTools } = await import("../mastra/tools/registry.js");

    await app.register(mastraPlugin);
    await app.ready();

    expect(buildMastraTools).toHaveBeenCalled();
  });
});
