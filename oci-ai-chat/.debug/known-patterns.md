# Known Debug Patterns

Structured lookup of recurring failure patterns. Consult this BEFORE attempting fixes.

Format: **Trigger** → **Root Cause** → **Fix** → **Affected Files**

---

## Fastify 5

### F-1: Decorator type locked at creation

- **Trigger**: `TypeError: fastify.foo is not a function` or decorator value is always `null`
- **Root Cause**: `fastify.decorate('foo', null)` permanently locks the type to `null`. Assigning a function later doesn't change the type.
- **Fix**: Always pass the real value or a properly-typed stub at decoration time. Never use `null` as a placeholder.
- **Affected**: Any plugin using `fastify.decorate()` or `fastify.decorateRequest()`

### F-2: reply.send(undefined) crash

- **Trigger**: `FST_ERR_SEND_UNDEFINED` error
- **Root Cause**: Route handler returns `undefined` or calls `reply.send()` with no argument
- **Fix**: Always return an object `{ ok: true }` or use `reply.code(204).send()`
- **Affected**: Route handlers, error handlers

### F-3: Plugin encapsulation hides decorators

- **Trigger**: `fastify.foo` is `undefined` in a sibling plugin, but works in child plugins
- **Root Cause**: Plugin not wrapped in `fastify-plugin` (`fp()`), so decorators are encapsulated
- **Fix**: Wrap with `fp()` and declare `dependencies` array for ordering
- **Affected**: Shared plugins (oracle, session, rbac, rate-limit)

### F-4: Auth hook ordering

- **Trigger**: 401 errors on endpoints that should be authenticated, or authenticated endpoints accessible without auth
- **Root Cause**: Plugin registration order is load-bearing: error-handler → request-logger → helmet → CORS → rate-limit → cookie → oracle → session → RBAC
- **Fix**: Check `apps/api/src/app.ts` registration order. New plugins must be inserted at the correct position.
- **Affected**: `apps/api/src/app.ts`, any new plugin

### F-5: PUBLIC_ROUTES deny-by-default

- **Trigger**: New endpoint returns 401 even though it shouldn't require auth
- **Root Cause**: `onRequest` hook rejects unauthenticated requests not in `PUBLIC_ROUTES` set
- **Fix**: Add the route path to `PUBLIC_ROUTES` in the session plugin
- **Affected**: `apps/api/src/plugins/session.ts`

### F-6: app.inject() in tests

- **Trigger**: `TypeError: Cannot read properties of undefined` when parsing inject response
- **Root Cause**: Not awaiting `app.ready()` before inject, or not calling `app.close()` after
- **Fix**: Always `await fastify.ready()` in `beforeAll`, `await fastify.close()` in `afterAll`. Parse with `JSON.parse(response.body)`.
- **Affected**: All API test files

---

## Vitest 4

### V-1: defineProject vs defineWorkspace

- **Trigger**: Tests collected twice, or "duplicate test" warnings
- **Root Cause**: Workspace member configs use `defineConfig` instead of `defineProject`
- **Fix**: Import from `vitest/config` and use `defineProject`, not `defineConfig`. Root uses `defineConfig({ test: { projects: [...] } })`.
- **Affected**: `vitest.config.ts` in each workspace

### V-2: $lib alias not resolved

- **Trigger**: `Cannot find module '$lib/...'` in test files
- **Root Cause**: Vitest needs explicit `resolve.alias` for SvelteKit's `$lib`
- **Fix**: Add `resolve: { alias: { '$lib': resolve(__dirname, './src/lib') } }` to the frontend vitest config
- **Affected**: `apps/frontend/vitest.config.ts`

### V-3: Mock hoisting order

- **Trigger**: Mock returns `undefined` when it should return a value, or "Cannot access before initialization"
- **Root Cause**: `vi.mock()` calls are hoisted in declaration order. If mock A depends on mock B's value, B must be declared first.
- **Fix**: Reorder `vi.mock()` declarations so dependencies come first. Use `vi.hoisted()` for shared mock state.
- **Affected**: Any test file with multiple `vi.mock()` calls

### V-4: vi.hoisted() for shared state

- **Trigger**: Mock factory can't access a variable defined outside it
- **Root Cause**: `vi.mock()` factories run before any other code in the file due to hoisting
- **Fix**: `const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }))` — creates state visible to hoisted mocks
- **Affected**: Test files needing shared mock state across multiple `vi.mock()` calls

---

## Oracle Database

### O-1: UPPERCASE column keys

- **Trigger**: `row.id` is `undefined` but `row.ID` works
- **Root Cause**: `OUT_FORMAT_OBJECT` returns UPPERCASE column names
- **Fix**: Use `fromOracleRow()` helper to convert to camelCase
- **Affected**: All repository files reading from Oracle

### O-2: MERGE INTO vs SELECT-then-INSERT

- **Trigger**: Duplicate key errors under concurrent requests, or TOCTOU race conditions
- **Root Cause**: SELECT-then-INSERT/UPDATE has a race window
- **Fix**: Always use `MERGE INTO ... USING ... WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT`
- **Affected**: Rate limiting, approvals, any upsert pattern

### O-3: Fire-and-forget connection reuse

- **Trigger**: `NJS-003: invalid connection` or silently dropped DB writes
- **Root Cause**: Reusing a connection that's being released by a parent request handler
- **Fix**: Use a separate `withConnection()` call for fire-and-forget operations, not the request's connection
- **Affected**: Audit logging, async DB writes

### O-4: LIKE injection

- **Trigger**: User search for `%` or `_` returns unexpected results
- **Root Cause**: LIKE wildcards not escaped in user input
- **Fix**: Escape `%`, `_`, `\` in search terms AND add `ESCAPE '\'` clause to the SQL
- **Affected**: Any search/filter query using LIKE

---

## SvelteKit Build

### S-1: Non-HTTP exports in +server.ts

- **Trigger**: Build error about unexpected exports from route files
- **Root Cause**: SvelteKit only allows HTTP method exports (GET, POST, etc.) from `+server.ts`
- **Fix**: Prefix non-HTTP exports with `_` (e.g., `export const _MODEL_ALLOWLIST = ...`)
- **Affected**: Any `+server.ts` file with helper exports

### S-2: Server/client boundary violation

- **Trigger**: Build error: "Cannot import $lib/server/ in client code"
- **Root Cause**: `+page.svelte` (client) trying to import from `$lib/server/` (server-only)
- **Fix**: Move data fetching to `+page.server.ts` `load()` function, pass data as props
- **Affected**: Page components needing server data

### S-3: BETTER_AUTH_SECRET at build time

- **Trigger**: Build fails with missing auth secret error
- **Root Cause**: SvelteKit runs builds with NODE_ENV=production, Better Auth requires the secret
- **Fix**: Set `BETTER_AUTH_SECRET` env var during build (use a dummy value for CI if needed)
- **Affected**: CI/CD, Docker builds

---

## Auth & Security

### A-1: Default permissions on auth error

- **Trigger**: Unauthenticated users get viewer permissions instead of being rejected
- **Root Cause**: Fallback code grants default permissions on auth failures
- **Fix**: NEVER grant default permissions on error — fail to 503 or redirect to login
- **Affected**: Auth middleware, session resolution

### A-2: Client-supplied approval flags

- **Trigger**: Users can bypass approval workflows
- **Root Cause**: Trusting a `approved: true` flag from the client request body
- **Fix**: Use server-side `recordApproval()`/`consumeApproval()` pattern
- **Affected**: Workflow approval endpoints

---

## Zod Schemas

### Z-1: z.record() type inference

- **Trigger**: TypeScript error about incompatible record types
- **Root Cause**: `z.record(z.unknown())` infers `Record<string, unknown>` which is overly strict
- **Fix**: Use `z.record(z.string(), z.unknown())` for explicit key type
- **Affected**: Schema definitions with dynamic keys

### Z-2: --all vs --limit in OCI CLI tools

- **Trigger**: OCI CLI error about incompatible flags
- **Root Cause**: Zod schema defaults always emit both `--all` and `--limit`, which are mutually exclusive
- **Fix**: Use `.optional()` without defaults, and handle the absence in the tool execution
- **Affected**: OCI tool wrappers in `src/lib/tools/`
