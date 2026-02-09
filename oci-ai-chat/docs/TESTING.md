# Testing Guide

This document covers testing strategy, how to run tests, and patterns used across the monorepo.

## Quick Start

Run all tests from the monorepo root:

```bash
pnpm test
```

This runs tests in all three workspaces in parallel: `apps/api`, `apps/frontend`, and `packages/shared`.

Run tests for a single package:

```bash
cd apps/api && pnpm test
cd apps/frontend && pnpm test
cd packages/shared && pnpm test
```

Run tests for a single file:

```bash
npx vitest run apps/api/src/app.test.ts
npx vitest run packages/shared/src/errors.test.ts
```

Watch mode (re-run on file change):

```bash
npx vitest apps/api/src/routes/health.test.ts
```

## Test Stack

- **Test Runner**: Vitest (Vite-native, parallel, fast)
- **Test Utilities**: Vitest built-ins (describe, it, expect, beforeEach, afterEach, vi)
- **Component Testing**: @testing-library/svelte (for frontend components, if needed)
- **HTTP Testing**: app.inject() for Fastify routes (see API tests)
- **Mocking**: vi.mock() for module mocks, vi.fn() for function spies

## Test Counts by Package

Current test coverage:

- **apps/api**: 28 test files
  - Fastify app factory, Mastra framework (agents, storage, RAG, tools, workflows), plugins (10), and routes (8)
  - app.test.ts, config.test.ts
  - mastra/: agents, models, rag, storage, tools, workflows (11 test files)
  - plugins/: cors, error-handler, helmet, mastra, oracle, rate-limit, rbac, request-logger, session (9 test files)
  - routes/: activity, chat, health, mcp, sessions, tools/approve, tools/execute, workflows (8 test files)
- **apps/frontend**: 51 test files
  - Oracle adapter, RBAC, pricing, search, auth flows, security hardening
  - Organized in subdirectories: `tests/`, `tests/auth/`, `tests/phase*/`
- **packages/shared**: 3 test files
  - `errors.test.ts`: 35 tests for PortalError hierarchy and serialization
  - `auth/rbac.test.ts`: 31 tests for PERMISSIONS and role-based access control
  - `graph-utils.test.ts`: Graph utility functions for workflow execution

**Total: 1213 tests across 82 test files (1211 passing, 2 skipped)**

## Test File Conventions

### Organization

Tests are colocated with source files using the `.test.ts` suffix:

```
apps/api/
  src/
    app.ts
    app.test.ts
    config.test.ts
    mastra/
      agents/
        cloud-advisor.test.ts
      models/
        provider-registry.test.ts
      rag/
        oci-embedder.test.ts
        oracle-vector-store.test.ts
      storage/
        oracle-store.test.ts
        oracle-store-memory.test.ts
        oracle-store-scores.test.ts
      tools/
        registry.test.ts
      workflows/
        executor.test.ts
    plugins/
      oracle.ts
      oracle.test.ts
      cors.test.ts
      error-handler.test.ts
      helmet.test.ts
      mastra.test.ts
      rate-limit.test.ts
      rbac.test.ts
      request-logger.test.ts
      session.test.ts
    routes/
      activity.test.ts
      chat.test.ts
      health.test.ts
      mcp.test.ts
      sessions.test.ts
      workflows.test.ts
      tools/
        approve.test.ts
        execute.test.ts

apps/frontend/
  src/
    lib/
      server/
        auth.ts
        auth.test.ts
    tests/
      cloud-pricing.test.ts (TDD files)
      auth/
        rbac.test.ts

packages/shared/
  src/
    errors.ts
    errors.test.ts
    graph-utils.test.ts
    auth/
      rbac.ts
      rbac.test.ts
```

No `__tests__/` directories — tests live next to source code.

### Naming Convention

Each test file uses a standard structure:

```typescript
import { describe, it, expect } from "vitest";

describe("ModuleName or ClassName", () => {
  it("should do X when Y happens", () => {
    // Arrange, Act, Assert
    expect(result).toBe(expected);
  });

  describe("nested behavior", () => {
    it("handles edge case", () => {
      expect(true).toBe(true);
    });
  });
});
```

Follow this pattern:

- Use `describe()` for the module or class name
- Use `it()` for each behavior being tested
- Nest `describe()` blocks for related behaviors
- Use "should" or "returns" in test names for clarity

## Running Tests

### All Tests

From monorepo root:

```bash
pnpm test
```

Vitest runs all projects in parallel and reports results for each.

### Single Package

```bash
cd apps/api && pnpm test
cd apps/frontend && pnpm test
cd packages/shared && pnpm test
```

### Single File

```bash
# From any directory
npx vitest run apps/api/src/app.test.ts
npx vitest run packages/shared/src/errors.test.ts
```

### Watch Mode

For development (re-runs on file change):

```bash
# Watch a single file
npx vitest apps/api/src/app.test.ts

# Watch entire package
cd apps/api && npx vitest
```

### Filter Tests by Name

```bash
# Only run tests matching "health"
npx vitest run -t "health"

# Only run tests in oracle.test.ts matching "pool"
npx vitest run apps/api/src/plugins/oracle.test.ts -t "pool"
```

## Test Patterns

### Unit Tests (Pure Functions)

Test functions that take inputs and return outputs, with no external dependencies.

**Location**: `packages/shared/src/errors.test.ts`, `packages/shared/src/auth/rbac.test.ts`

**Pattern**:

```typescript
import { describe, it, expect } from "vitest";
import { ValidationError, hasPermission } from "$lib/module.js";

describe("ValidationError", () => {
  it("creates error with default statusCode 400", () => {
    const err = new ValidationError("Missing field");

    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Missing field");
  });

  it("chains cause errors", () => {
    const cause = new Error("Root cause");
    const err = new ValidationError("Wrapped", {}, cause);

    expect(err.cause).toBe(cause);
  });
});

describe("hasPermission()", () => {
  it("returns true when user has required permission", () => {
    const result = hasPermission("admin", "admin:all");

    expect(result).toBe(true);
  });
});
```

**Key Points**:

- Import the module directly
- Test inputs → outputs
- Test happy path and error cases
- No mocking needed for pure functions

### API Route Tests (Fastify)

Test HTTP endpoints using `app.inject()` for request simulation.

**Location**: `apps/api/src/app.test.ts`, route test files

**Pattern**:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "./app.js";

describe("GET /api/health", () => {
  let app;

  beforeEach(() => {
    app = buildApp({ skipAuth: true });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 with status=ok", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", service: "api" });
  });

  it("includes X-Request-Id header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(res.headers["x-request-id"]).toMatch(/^req-/);
  });

  it("returns 401 for unauthenticated non-public routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
    });

    expect(res.statusCode).toBe(401);
  });
});
```

**Key Points**:

- Use `buildApp({ skipAuth: true })` for test isolation (no auth enforcement)
- Call `app.inject()` to simulate HTTP requests
- Test status codes, response body, and headers
- Test auth enforcement (deny-by-default)
- Clean up with `await app.close()` in afterEach

### Mocking External Modules

Mock third-party modules that would otherwise require real credentials or connections.

**Location**: `apps/api/src/plugins/oracle.test.ts`

**Pattern**:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// Define mock behavior before importing
const mockPool = {
  getConnection: vi.fn(),
  close: vi.fn(),
  connectionsOpen: 3,
};

const mockConnection = {
  execute: vi.fn(),
  close: vi.fn(),
  commit: vi.fn(),
};

// Mock the module
vi.mock('oracledb', () => ({
  default: {
    createPool: vi.fn().mockResolvedValue(mockPool),
    OUT_FORMAT_OBJECT: 4001,
  }
}));

// Import after mock is set up
import { default: oraclePlugin } from './oracle.js';

describe('oracle plugin', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.getConnection.mockResolvedValue(mockConnection);
  });

  afterEach(async () => {
    await app.close();
  });

  it('initializes connection pool with credentials', async () => {
    const oracledb = (await import('oracledb')).default;
    app = Fastify();

    await app.register(oraclePlugin, {
      user: 'admin',
      password: 'secret',
      connectString: 'localhost/XEPDB1',
    });
    await app.ready();

    expect(oracledb.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'admin',
        password: 'secret',
      })
    );
  });
});
```

**Key Points**:

- Use `vi.mock()` before importing the module being tested
- Define mock objects with `vi.fn()` for spying on calls
- Use `mockResolvedValue()` for async functions
- Clear mocks in `beforeEach` to prevent test pollution
- Verify calls with `expect(mock).toHaveBeenCalledWith()`

### Error/Edge Case Testing

Test both happy path and error conditions.

**Pattern**:

```typescript
describe("error handling", () => {
  it("throws ValidationError when field is missing", () => {
    expect(() => {
      validateUser({ name: "John" }); // missing email
    }).toThrow(ValidationError);
  });

  it("throws DatabaseError when connection fails", async () => {
    mockPool.getConnection.mockRejectedValueOnce(
      new Error("Connection timeout"),
    );

    expect(async () => {
      await withConnection((conn) => conn.execute("SELECT 1"));
    }).rejects.toThrow(DatabaseError);
  });

  it("returns null when resource not found", async () => {
    mockConnection.execute.mockResolvedValue({ rows: [] });

    const result = await getWorkflow("nonexistent-id");

    expect(result).toBeNull();
  });

  it("fails safe when rate limiter DB is down", async () => {
    // Rate limiter should allow request, not block on DB error
    mockConnection.execute.mockRejectedValue(new Error("DB down"));

    const allowed = await checkRateLimit("user123");

    expect(allowed).toBe(true); // fail-open
  });
});
```

**Key Points**:

- Test both success and failure paths
- Test null/undefined returns
- Test fail-safe fallbacks (rate limiter, approvals)
- Use `mockRejectedValue()` to simulate errors
- Verify error types with `toThrow()`

### TDD Test Files

Some test files exist before implementation (TDD style). These import modules that don't exist yet, and the tests define the expected API.

**Location**: `apps/frontend/src/tests/cloud-pricing.test.ts`

**Pattern**:

```typescript
import { describe, it, expect } from "vitest";

// These imports will fail until implementation is added
import {
  OCIPricingClient,
  CloudPricingService,
} from "$lib/pricing/cloud-pricing-service.js";

describe("OCIPricingClient", () => {
  it("returns compute pricing for a shape", async () => {
    const client = new OCIPricingClient();
    const pricing = await client.getComputePricing("VM.Standard.E5.Flex");

    expect(pricing).not.toBeNull();
    expect(pricing.shapeName).toBe("VM.Standard.E5.Flex");
    expect(pricing.ocpuPricePerHour).toBeGreaterThan(0);
  });
});
```

**Key Points**:

- TDD tests define the API before implementation
- Import errors are expected during development
- Tests serve as specification
- Implementation is added to make tests pass

## Quality Gates

Before every commit, run the complete quality gate pipeline:

### 1. Linting

```bash
pnpm lint
```

Checks code style and catches common mistakes (unused imports, typos, etc.).

### 2. Type Checking

Frontend:

```bash
svelte-check
```

API and shared:

```bash
tsc --noEmit
```

Verifies TypeScript types are correct (no type errors at build time).

### 3. Tests

```bash
pnpm test
```

or

```bash
npx vitest run
```

Runs all tests and must pass before committing.

### 4. Security Scanning

Use the `/semgrep` skill to scan changed files for security issues:

```bash
/semgrep apps/api/src/routes/workflow.ts
```

### 5. Code Review

Use the `/coderabbit` skill for automated code review on changed files:

```bash
/coderabbit apps/api/src/routes/workflow.ts
```

Use the `/codeql` skill for additional security vulnerability detection:

```bash
/codeql apps/api/src/routes/workflow.ts
```

## Adding New Tests

### Step 1: Create Test File

Create `module.test.ts` next to the source module:

```
src/
  auth.ts
  auth.test.ts  <- new file
```

### Step 2: Write Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./auth.js";

describe("myFunction", () => {
  it("should do something", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });
});
```

### Step 3: Follow Testing Patterns

- **Pure functions**: Test inputs → outputs (see Unit Tests)
- **API routes**: Test with `app.inject()` (see API Route Tests)
- **With dependencies**: Mock external modules (see Mocking)
- **Edge cases**: Always test error conditions

### Step 4: Run Tests

```bash
npx vitest run src/auth.test.ts
```

### Step 5: Ensure Coverage

- Happy path: normal inputs, expected output
- Error path: invalid inputs, error thrown
- Edge cases: null, undefined, empty arrays, etc.
- For API routes: test auth enforcement, input validation, IDOR protection

Example:

```typescript
describe("updateWorkflow", () => {
  it("updates workflow when user has permission", async () => {
    // happy path
  });

  it("throws ValidationError when definition is invalid", () => {
    // error case
  });

  it("throws AuthError when user lacks permission", async () => {
    // RBAC enforcement
  });

  it("throws NotFoundError when workflow not found", async () => {
    // edge case
  });

  it("prevents IDOR by verifying org ownership", async () => {
    // org-scoped access control
  });
});
```

## Debugging Tests

### Run a Single Test

```bash
npx vitest run -t "should update workflow"
```

### Run Tests in a File

```bash
npx vitest run apps/api/src/routes/workflow.test.ts
```

### Debug Mode with Console Output

Tests print console.log() by default. Add logging to understand test flow:

```typescript
it("updates workflow", async () => {
  console.log("Starting test...");
  const result = await updateWorkflow(id, newDef);
  console.log("Result:", result);
  expect(result.id).toBe(id);
});
```

Run with:

```bash
npx vitest run path/to/test.ts
```

### Visual Inspection

When a test fails, Vitest shows:

- Expected vs actual values
- File path and line number
- Full assertion error

Example output:

```
✓ updateWorkflow > should update when user has permission (5ms)
✗ updateWorkflow > should validate definition (12ms)

AssertionError: expected 'VALIDATION_ERROR' to be 'SYNTAX_ERROR'
  at tests/workflow.test.ts:45:7
```

### Check Specific Mock Calls

```typescript
it("calls oracle connection execute", async () => {
  const mockExecute = vi.fn().mockResolvedValue({ rows: [] });

  await someFunction();

  expect(mockExecute).toHaveBeenCalledTimes(1);
  expect(mockExecute).toHaveBeenCalledWith("SELECT ...", [param1]);
});
```

## Test Coverage

While vitest can generate coverage reports, the team prioritizes meaningful tests over high coverage percentages. Focus on:

- **Critical paths**: Auth, RBAC, database operations, API routes
- **Error handling**: Ensure errors are properly caught and reported
- **Security**: Input validation, IDOR prevention, SQL injection prevention
- **Edge cases**: Null values, empty arrays, boundary conditions

Run coverage report (optional):

```bash
npx vitest run --coverage
```

## Troubleshooting

### Tests Fail After Refactoring

First question: are the tests wrong or is the code wrong?

- Review the test to understand what it expected
- Review the refactored code to understand what changed
- Decide if the test assumptions are outdated or if the refactor broke something
- Update the test or the code accordingly

### Mock Not Working

Ensure `vi.mock()` is called before the module import:

```typescript
// WRONG: mock after import
import { oracle } from 'oracledb';
vi.mock('oracledb', ...);

// CORRECT: mock before import
vi.mock('oracledb', ...);
import { oracle } from 'oracledb';
```

### Tests Hang or Timeout

Check for unresolved promises:

```typescript
// Missing await
await app.close(); // ✓

// Forgot to return promise
return testPromise(); // ✓

// Forgot to resolve mock
mockFn.mockResolvedValue(data); // ✓
mockFn.mockRejectedValue(err); // ✓
```

### Test Pollution (Tests Interfere)

Use `beforeEach` and `afterEach` to reset state:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  app = buildApp({ skipAuth: true });
});

afterEach(async () => {
  await app.close();
});
```

## CI/CD Integration

Tests run automatically on push via GitHub Actions (if configured). Local test run should match CI behavior:

```bash
pnpm lint && pnpm test
```

If tests pass locally but fail in CI, check:

- Node.js version matches CI config
- Environment variables are set (OCI_REGION, etc.)
- Database mocks are properly scoped

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/)
- [Error Handling Patterns](../src/lib/errors.ts)
- [RBAC Testing](../packages/shared/src/auth/rbac.test.ts)
- [Oracle Connection Mocking](../apps/api/src/plugins/oracle.test.ts)

---

Last updated: February 9, 2026
