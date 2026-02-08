# OCI AI Chat - Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Web Browser                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼                             ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │   SvelteKit Pages   │      │  API Routes (+srv)  │
        │  (SSR, streaming)   │      │  (REST endpoints)   │
        └────────────┬────────┘      └────────────┬────────┘
                     │                            │
                     └──────────────┬─────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
           ┌────────────────────┐        ┌──────────────────────┐
           │  Better Auth       │        │  Tool Registry       │
           │  (sessions, OIDC)  │        │  (tool execution)    │
           └────────────┬───────┘        └──────────┬───────────┘
                        │                           │
                        │                 ┌─────────┴─────────┐
                        │                 │                   │
                        ▼                 ▼                   ▼
           ┌────────────────────┐    ┌─────────────┐   ┌──────────────┐
           │  Oracle ADB 26AI   │    │  OCI CLI    │   │  Approval    │
           │  (auth, audit)     │    │  (cloud ops)│   │  Queue       │
           └────────────────────┘    └─────────────┘   └──────────────┘
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
      ▼                 ▼                 ▼
  ┌─────────┐    ┌──────────────┐  ┌──────────────┐
  │ Sessions│    │ Workflows    │  │ Vector Search│
  │ Activity│    │ Approvals    │  │ Audit        │
  └─────────┘    │ Rate Limits  │  │ Webhooks     │
                 └──────────────┘  └──────────────┘
```

## Monorepo Layout

The codebase is organized as a pnpm workspace with three components:

```
oci-ai-chat/
├── apps/
│   ├── frontend/                    # SvelteKit app (SSR, routing, pages)
│   │   ├── src/
│   │   │   ├── routes/              # Pages and API routes
│   │   │   ├── lib/
│   │   │   │   ├── server/          # Backend logic (auth, DB, tools)
│   │   │   │   ├── components/      # Svelte UI components
│   │   │   │   ├── tools/           # OCI CLI tool wrappers
│   │   │   │   └── utils/           # Helpers (cn.ts, errors, etc.)
│   │   │   └── hooks.server.ts      # Request lifecycle (auth, rate limit, logging)
│   │   ├── Dockerfile              # Multi-stage build
│   │   └── svelte.config.js
│   │
│   └── api/                         # Fastify app (REST API, plugins)
│       ├── src/
│       │   ├── app.ts               # App factory with plugin chain
│       │   ├── plugins/             # Middleware (auth, logging, CORS, etc.)
│       │   ├── routes/              # API route modules
│       │   ├── config.ts            # Config from environment
│       │   └── index.ts             # Server entrypoint
│       └── package.json
│
├── packages/
│   └── shared/                      # Shared types and utilities
│       ├── src/
│       │   ├── errors.ts            # PortalError hierarchy
│       │   ├── rbac.ts              # Permission system
│       │   ├── types/               # Shared Zod schemas
│       │   └── index.ts             # Exports
│       └── package.json
│
├── docs/                            # Documentation
│   ├── ARCHITECTURE.md              # This file
│   ├── ROADMAP.md                   # Feature roadmap
│   ├── PORTAL_STRUCTURE.md          # Legacy structure reference
│   └── ...
│
└── package.json                     # Workspace root
```

**Responsibilities:**

- **apps/frontend**: SvelteKit SSR application — handles pages, SSR, client-side routing, form handling, and in-process API routes. Runs on port 3000.
- **apps/api**: Fastify REST API — independent route modules with plugin-based middleware. Used for external/v1 API endpoints. Optional parallel service (feature-flagged).
- **packages/shared**: Shared TypeScript types (errors, RBAC, Zod schemas). Builds to dist/ and included in Dockerfile.

## Request Flow

### Browser → SvelteKit (Frontend)

1. **Browser makes HTTP request** to SvelteKit
2. **hooks.server.ts handle()** intercepts:
   - Extracts/generates request ID (tracing)
   - Checks feature flag: if request matches `/api/*` route and Fastify is enabled, proxy request (see "Fastify Proxy" below)
   - Initializes database if needed (`ensureDatabase()`)
   - **CORS preflight handling** for `/api/v1/*` routes (OPTIONS requests skip auth)
   - **Auth guard**:
     - API key validation (Bearer token or X-API-Key header)
     - Or Better Auth session validation
     - Resolves permissions from org role
   - **Rate limiting** (granular per-endpoint)
   - **Security headers** (CSP with nonce, HSTS, X-Frame-Options, etc.)
   - **Logging** (method, path, status, duration, request ID)

3. **Page route** (+page.svelte, +page.server.ts):
   - Renders HTML via SvelteKit SSR
   - Calls load() functions to fetch initial data from database
   - Client-side navigation uses SvelteKit routing (no full page reload)

4. **API route** (+server.ts):
   - SvelteKit API routes live in `/routes/api/` (e.g., `/routes/api/chat/+server.ts`)
   - Export `POST`, `GET`, `PUT`, `DELETE` functions
   - Can use `requirePermission()` hook or manual auth checks
   - Examples: `/api/chat`, `/api/tools/execute`, `/api/workflows`

### Fastify Proxy (Optional)

When feature flag `ENABLE_FASTIFY_PROXY=true`:

1. **hooks.server.ts** checks `shouldProxyToFastify(pathname)`
2. Request is forwarded to Fastify server (running on separate port, default 4000)
3. Fastify processes request with its own middleware chain
4. Response returns to client, security headers applied by SvelteKit
5. Request ID forwarded for tracing correlation

See [FEATURE_FLAG.md](FEATURE_FLAG.md) for details.

### SvelteKit API Route → Oracle Database

```
+server.ts
  ↓
  requirePermission() or manual auth check
  ↓
  withConnection() — get Oracle connection from pool
  ↓
  Repository methods (query, insert, update, delete)
  ↓
  Structured logging + error handling
  ↓
  Response (JSON or 4xx/5xx error)
```

Example: `/routes/api/chat/+server.ts` POST handler

1. Extract user ID from event.locals.user
2. Call `withConnection()` to get Oracle connection
3. Query user's organization and settings
4. Call OCI GenAI chat API via AI SDK provider
5. Log tool calls to audit_logs table
6. Return chat response with streaming support

### Tool Execution Pipeline

```
POST /api/tools/execute or /api/v1/tools/{name}/execute
  ↓
  Auth check + rate limit (tool-execute bucket: 15/min)
  ↓
  Tool registry lookup (getToolByName)
  ↓
  Approval check (if tool requires it)
    → Store approval token in in-memory/Oracle
    → Return approval_token to client
    → Client submits token to /api/tools/approve
  ↓
  OCI CLI execution (with concurrency limiter)
  ↓
  Audit logging (tool_executions table)
  ↓
  Response slimming (slimOCIResponse)
  ↓
  JSON response or error
```

## Frontend (SvelteKit)

### Route Structure

**Pages (SSR):**

- `/` — Chat interface with AI SDK integration
- `/login` — Better Auth OIDC flow
- `/admin/` — Admin console (setup wizard, IDP config, AI models)
- `/self-service/` — Portal dashboard
- `/workflows/` — Workflow designer (Svelte Flow canvas)
- `/setup` — Initial setup if not complete

**API Routes (+server.ts):**

- `/api/chat` — AI chat with streaming support
- `/api/health`, `/api/healthz` — Health checks (public)
- `/api/metrics` — Prometheus metrics (public, exempt from rate limit)
- `/api/sessions` — Session management
- `/api/activity` — Tool execution audit logs
- `/api/tools/execute` — Tool execution
- `/api/tools/approve` — Approval token submission
- `/api/workflows` — Workflow CRUD
- `/api/workflows/[id]/run` — Workflow execution
- `/api/auth/*` — Better Auth endpoints
- `/api/admin/*` — Admin console endpoints
- `/api/setup/*` — Portal setup endpoints
- `/api/v1/*` — External REST API (API key auth, CORS)

### Server/Client Boundary

**$lib/server/** — Backend only

Cannot be imported from +page.svelte (SvelteKit build error). Instead:

- Exported from +page.server.ts load() functions
- Passed to page via page store or fetch() calls
- Examples:
  - `src/lib/server/oracle/connection.ts` — DB pool
  - `src/lib/server/auth/` — Auth config, RBAC, tenancy
  - `src/lib/server/workflows/` — Workflow executor
  - `src/lib/server/approvals.ts` — Approval queue

**$lib/** — Shared (can import from both)

- `src/lib/components/` — Svelte UI components
- `src/lib/tools/` — OCI tool wrappers
- `src/lib/utils/` — Helpers (cn.ts, errors, types)

### Component Hierarchy

Phase 5+ decomposed monolithic pages into reusable components:

- **TypingIndicator**, **ChatInput**, **ChatBubble** — Chat UI primitives
- **ChatOverlay** — Chat container with message history
- **HeroSection** — Landing page hero
- **Portal components** — 17 shadcn-svelte components (Button, Card, Dialog, etc.)
- **Workflow designer** — NodePalette, Canvas, NodeProperties, ExecutionTimeline

State managed at page level (AI SDK state in +page.svelte); components are pure presentation + callbacks.

### AI Chat Integration

`/api/chat` endpoint uses:

1. **AI SDK** (`ai/svelte` package) for request/response streaming
2. **OCI GenAI provider** (`@acedergren/oci-genai-provider`) for model calls
3. **Tool registry** (`src/lib/tools/`) — 60+ OCI tools in 11 categories
4. **Execution API** — Tool invoke → approval → audit → response

Streaming response:

```typescript
const stream = await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({ messages, tools }),
});

// Client reads streamed JSON chunks (tool calls, text, etc.)
```

## Backend — SvelteKit API Layer

### Authentication & Authorization

**Session Auth (Better Auth):**

1. Client sends OIDC callback to `/api/auth/callback/oidc` (Better Auth route)
2. OAuth2 code exchanged for ID token
3. Session stored in SQLite or Oracle (sessionRepository)
4. Cookie set (by default \_\_session)
5. Subsequent requests validated via Better Auth session middleware

**API Key Auth:**

1. Client sends `Authorization: Bearer portal_...` or `X-API-Key: portal_...`
2. Validated against api_keys table (SHA-256 hashed, read-only on client)
3. Permissions resolved from API key record
4. No session cookie used

**RBAC (Role-Based Access Control):**

Three roles: viewer, operator, admin

- **viewer** — Read-only (list resources)
- **operator** — Execute operations (tools, workflows)
- **admin** — Full access (settings, org management)

13 permissions: (tools:read, tools:write, workflows:read, workflows:write, etc.)

Resolved via `getOrgRole(userId, orgId)` — queries org_members table for role, falls back to viewer.

Used in `requirePermission('tools:write')` hook on routes.

### Tool Execution Pipeline

**Registry** (`src/lib/tools/index.ts`):

- 60+ tools organized in categories
- Each tool: name, description, category, approval required flag
- Metadata: input schema (Zod), output schema

**Execution** (`executeTool()`):

1. Lookup tool by name
2. Check user permissions
3. If approval_required:
   - Generate approval token (crypto.randomUUID)
   - Store in Oracle or in-memory (5-min expiry)
   - Return token to client (client displays approval UI)
4. Client submits token → `/api/tools/approve`
   - Validate token exists and not expired
   - Consume token (delete from Oracle)
   - Execute OCI CLI command
5. Log execution to audit_logs table
6. Response slimming (pick fields from verbose OCI output)
7. Return to client

**Rate Limiting** (granular per-endpoint):

- `/api/chat` — 20 requests/min per user
- `/api/tools/execute` — 15 requests/min per client IP
- `/api/workflows/[id]/run` — 5 requests/min per user
- Default — 60 requests/min

Implemented via `checkRateLimit()` in hooks.server.ts (Oracle-backed with fallback to in-memory Map).

### Workflow Engine

**Designer** (`src/lib/server/workflows/`):

- WorkflowExecutor — Kahn's topological sort, cycle detection
- Safe expression evaluation (property paths + comparisons)
- 8 node types: tool, condition, loop, approval, ai-step, input, output, parallel

**Execution** (`/api/workflows/[id]/run`):

1. Load workflow definition from workflow_definitions table
2. Parse DAG (nodes + edges)
3. Initialize execution in workflow_runs table
4. Iterate over sorted nodes:
   - Resolve inputs (bindings, previous node outputs)
   - Execute node (tool call, AI step, condition, etc.)
   - Store result in workflow_run_steps table
   - Check for approval nodes (pause execution, store token)
5. Update workflow_run status (completed/failed/pending_approval)

**Approvals** (`/api/workflows/[id]/run`):

- Approval nodes pause execution
- Token provided to admin for review
- Admin submits token → `/api/workflows/runs/[runId]/approve`
- Execution resumes from next node

## Backend — Fastify API Layer

### Plugin Architecture

**Registration order matters:**

```typescript
// 1. Error handler — catches all downstream errors
app.register(errorHandlerPlugin);

// 2. Request logging (request ID, headers)
app.register(requestLoggerPlugin);

// 3. Security headers (Helmet)
app.register(helmetPlugin);

// 4. CORS (for /api/v1/*)
app.register(corsPlugin, { corsOrigin: ... });

// 5. Rate limiting
app.register(rateLimitPlugin, { rateLimitMax: ... });

// 6. Cookie parser (required by session plugin)
app.register(cookie);

// 7. Oracle connection pool
app.register(oraclePlugin, { user, password, connectString });

// 8. Session validation (reads cookie, queries Oracle)
app.register(sessionPlugin);

// 9. RBAC permission hooks
app.register(rbacPlugin);

// Deny-by-default auth gate
app.addHook('onRequest', async (request, reply) => {
  if (!PUBLIC_ROUTES.has(request.url)) {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Route modules
app.register(healthRoutes);
app.register(sessionRoutes);
app.register(activityRoutes);
app.register(toolExecuteRoutes);
app.register(toolApproveRoutes);
```

Each plugin:

- Reads config from environment
- Decorates fastify instance with utilities (e.g., `app.withConnection()`)
- Decorates request with auth state (e.g., `request.user`, `request.permissions`)
- Can add hooks (onRequest, preHandler, onSend, etc.)

### Route Modules

Each route module is a Fastify plugin:

```typescript
export async function toolExecuteRoutes(app: FastifyInstance) {
  app.post<{ Body: ToolExecuteRequest }>(
    "/api/tools/:name/execute",
    async (request, reply) => {
      // request.user (from sessionPlugin)
      // request.withConnection() (from oraclePlugin)
      // request.requireAuth(), request.requirePermission() (from rbacPlugin)
      // ...
    },
  );
}
```

Routes can be:

- Dual-registered in SvelteKit (+server.ts) AND Fastify (same route module)
- Feature-flagged to route to Fastify instead of SvelteKit

### Auth Gate

```typescript
// PUBLIC_ROUTES (no auth required)
const PUBLIC_ROUTES = new Set(["/api/health", "/api/healthz"]);

// All other routes require request.user (set by sessionPlugin)
// If !request.user: 401 Unauthorized
```

Fail-closed: default deny, explicit whitelist for public routes.

## Database Layer

### Oracle ADB 26AI Connection

**Location:** `src/lib/server/oracle/connection.ts`

**Pool:**

- Adapter: `oracledb` (Node.js driver)
- Max connections: 10 (configurable)
- Timeout: 30s
- Wallet authentication (mTLS via wallet files)
- Lazy initialization in hooks.server.ts

**Configuration:**

```env
ORACLE_USER=ADMIN
ORACLE_PASSWORD=***
ORACLE_CONNECT_STRING=langflowdb_high
ORACLE_WALLET_LOCATION=/wallets/langflow
ORACLE_WALLET_PASSWORD=***
```

### Migration System

**Location:** `src/lib/server/oracle/migrations.ts`

Sequential SQL files: `001-init.sql`, `002-sessions.sql`, ..., `008-vector-search.sql`

- Run on app startup
- Track progress in `schema_version` table
- Idempotent (can re-run safely)
- DDL: Create tables, indexes, triggers
- Each migration handles a feature area (auth, workflows, vector search, etc.)

**Current migrations:**

- 001 — Core tables (users, orgs, audit_logs, settings)
- 002 — Sessions, activity
- 003 — Workflows, approvals
- 004 — Rate limiter, tool registry
- 005 — Workflow definitions + runs + steps
- 006 — API keys, webhooks
- 007 — Blockchain audit table
- 008 — Vector search, property graph

### Repository Pattern

**Location:** `src/lib/server/oracle/repositories/`

Each repository encapsulates SQL queries for a domain:

- `sessionRepository` — Session CRUD, lookup, cleanup
- `activityRepository` — Tool execution audit log
- `workflowRepository` — Workflow definition CRUD
- `webhookRepository` — Webhook CRUD, delivery attempts
- `apiKeyRepository` — API key CRUD, hash verification

Usage:

```typescript
const session = await sessionRepository.findById(sessionId, { withConnection });
```

Abstracts SQL, enforces bind parameters, handles fallback patterns.

### Fallback Behavior

When database is unavailable (degraded mode):

- **Sessions** — In-memory Map + JSONL fallback file (`./data/sessions.jsonl`)
- **Activity** — JSONL file (`./data/activity.jsonl`)
- **Rate limiting** — In-memory Map (resets on restart)
- **Approvals** — In-memory Map (single-instance only; 5-min timeout)

Fallback enables limited operation; features degrade gracefully.

### Special Features

**Vector Search (Oracle 26AI):**

- VECTOR(1536, FLOAT32) column type
- Cosine distance operator in SQL
- Used for semantic search over chat history, documents
- Integration: OCI GenAI embeddings API

**Blockchain Tables:**

- NO DROP UNTIL 365 DAYS IDLE
- NO DELETE UNTIL 365 DAYS AFTER INSERT
- HASHING USING "SHA2_256"
- Immutable audit trail (audit_logs table)

**Property Graph (SQL/PGQ):**

- CREATE PROPERTY GRAPH over existing tables
- GRAPH_TABLE() operator for multi-hop queries
- Workflow dependencies, org hierarchy traversal

## Authentication & Authorization

### Better Auth Setup

**Location:** `src/lib/server/auth/config.ts`

```typescript
const auth = new BetterAuth({
  database: {
    type: 'oracle',
    connection: { connectionString: ... }
  },
  plugins: [
    oidcPlugin({
      providers: [
        {
          id: 'oidc-oraclecloud',
          name: 'Oracle Cloud',
          clientId: process.env.OIDC_CLIENT_ID,
          clientSecret: process.env.OIDC_CLIENT_SECRET,
          issuer: 'https://identity.oraclecloud.com/'
        }
      ]
    })
  ]
});
```

### Session Flow

1. User navigates to `/login`
2. Better Auth generates OIDC auth URL
3. Browser redirected to Oracle Identity Provider
4. User logs in at OCI IAM
5. Redirect back to `/api/auth/callback/oidc?code=...&state=...`
6. Better Auth exchanges code for ID token
7. User object created/updated in better_auth_user table
8. Session created in sessions table
9. Session cookie set (secure, HttpOnly, SameSite)
10. Redirect to `/` (authenticated)

### IDCS Provisioning

**Location:** `src/lib/server/admin/idcs-provisioning.ts`

When session created via OIDC:

1. Resolve IDCS groups from ID token claims (`urn:opc:idm:groups`)
2. Stash groups in temporary cache (mapProfileToUser)
3. On session.created.after hook: call `provisionFromIdcsGroups()`
4. For each IDCS group:
   - Map to internal role (admin, operator, viewer)
   - MERGE INTO org_members table (create or update)
5. Update org_roles in user session

Enables automatic provisioning from enterprise directory (IDCS/Active Directory).

### RBAC

**Location:** `src/lib/server/auth/rbac.ts`

```typescript
const roleToPermissions = {
  viewer: ['tools:read', 'workflows:read', 'sessions:read'],
  operator: [...viewer, 'tools:write', 'tools:execute', 'workflows:write', ...],
  admin: [...all permissions...]
};
```

13 permissions total:

- Tools: read, write, execute, approve
- Workflows: read, write, execute, approve
- Admin: settings, org_members, api_keys, webhooks

Used in route guards:

```typescript
await requirePermission("tools:write")(request, reply);
```

Fails with 403 if user lacks permission.

### API Key Authentication

**Location:** `src/lib/server/auth/api-keys.ts`

Format: `portal_` + 64-char hex (crypto.randomBytes(32).hex)

Storage:

- `key_hash` — SHA-256(key) stored in api_keys table
- `key_prefix` — First 8 chars of key (for identification)
- `orgId` — Org the key belongs to
- `permissions` — Array of permission strings
- `created_at`, `last_used_at`, `expires_at`

Validation:

1. Extract key from Bearer or X-API-Key header
2. Hash key
3. Query api_keys where key_hash = hash(key)
4. If found: return org_id + permissions
5. If not found: return null (invalid key)

Used for external API clients (webhooks, integrations, MCP servers).

### Session Management

**Location:** `src/lib/server/auth/sessions.ts`

Each user can have multiple concurrent sessions (devices, browsers).

Session object:

```typescript
{
  sessionId: string,           // UUID
  userId: string,              // Foreign key
  activeOrganizationId: string,// Selected org
  createdAt: Date,
  lastActivityAt: Date,
  userAgent: string,           // Browser/device info
  ipAddress: string,           // Client IP
}
```

Operations:

- `listSessionsEnriched()` — List user's sessions with last message count
- `switchToSession()` — Change active org
- `invalidateSession()` — Logout (delete session)
- `cleanupStaleSessions()` — Auto-delete inactive sessions (60 days)

## External Integrations

### OCI CLI Tool Execution

**Location:** `src/lib/tools/index.ts` + `executeOCICommand()`

Each tool wraps an OCI CLI command:

```typescript
{
  name: 'list-instances',
  description: 'List compute instances in a compartment',
  category: 'compute',
  approval_required: false,
  inputSchema: z.object({
    compartment_id: z.string().describe('Compartment OCID')
  }),
  handler: async (inputs) => {
    return executeOCICommand([
      'compute', 'instance', 'list',
      '--compartment-id', inputs.compartment_id
    ]);
  }
}
```

**Execution:**

- CLI path: `/usr/local/bin/oci` (OCI CLI binary)
- Auth: Environment variables (OCI_CONFIG_DIR, OCI_PROFILE)
- Timeout: 30s (configurable per tool)
- Concurrency limiter: Max 5 parallel CLI calls (prevents resource exhaustion)
- Error handling: Capture stderr, map to user-friendly messages
- Response slimming: Extract relevant fields from verbose output

### OCI GenAI Provider

**Location:** `oci-genai-provider/src/` (separate npm package)

Implements Vercel AI SDK language model provider:

- Model classes (Chat, Embedding, Transcription, Speech)
- Connection to OCI GenAI API
- Streaming support (for chat)
- Token counting
- Error handling (rate limits, auth, service errors)

Used in:

- `/api/chat` for AI chat streaming
- Workflow `ai-step` nodes for model calls

### Sentry Error Tracking

**Location:** `src/lib/server/sentry.ts`

Optional integration (no-op if SENTRY_DSN not set):

- Captures exceptions and errors
- Attaches request context (user, request ID, org)
- Extracts PortalError details (code, statusCode, context)
- Integrations: node, http (request), onUncaughtException
- Performance monitoring: Manual wrapWithSpan() calls

Initialized on app startup in hooks.server.ts.

### Webhooks

**Location:** `src/lib/server/webhooks/`

Outbound event notifications to external URLs:

- Events: tool_executed, workflow_completed, user_created
- Signature: HMAC-SHA256(body, secret)
- Header: X-Portal-Signature: sha256=...
- Retry: Exponential backoff (3 attempts)
- SSRF protection: Blocks private IPs (10.x, 172.16-31.x, 192.168.x, etc.)
- Persistent delivery queue (webhook_deliveries table)

Admin can create webhooks via `/api/admin/webhooks`.

## Deployment

### Docker Image

**Multi-stage Dockerfile** (`apps/frontend/Dockerfile`):

1. **deps** — Alpine + pnpm + native build tools
   - Install all dependencies (pnpm install --frozen-lockfile)

2. **builder** — deps + source code
   - Build workspace packages (shared, oci-genai-provider)
   - Build SvelteKit app (pnpm build → adapter-node → build/)

3. **runner** — Slim Debian + Node.js
   - Install Python + OCI CLI (for tool execution)
   - Copy built app from builder
   - Copy built workspace packages
   - Non-root user (portal:nodejs, UID 1001)
   - Health check: curl /api/health
   - Volumes: /app/data, /wallets, /home/portal/.oci

**Environment:**

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
ORACLE_USER=ADMIN
ORACLE_PASSWORD=***
ORACLE_CONNECT_STRING=langflowdb_high
ORACLE_WALLET_LOCATION=/wallets
ORACLE_WALLET_PASSWORD=***
BETTER_AUTH_SECRET=***
OIDC_CLIENT_ID=***
OIDC_CLIENT_SECRET=***
```

**Volumes:**

- `/app/data` — Persistent application data (SQLite fallback, sessions JSONL)
- `/wallets` — Oracle Database wallet files (mTLS certificates)
- `/home/portal/.oci` — OCI CLI config + credentials (~/.oci/config, ~/.oci/key.pem)

### OCI Deployment

**Instance:** app01 (eu-frankfurt-1)

- Image: docker-langflow (5.2GB, pre-built with custom components)
- Port: 7860 (Langflow UI)
- Access: Cloudflare Tunnel → flow.solutionsedge.io

**SvelteKit Deployment (Planned):**

- Instance: New compute instance
- Container: oci-ai-chat Docker image
- Port: 3000
- Access: Cloudflare Tunnel → portal.solutionsedge.io

**Oracle Database:**

- Service: langflowdb_high (Oracle 26AI)
- Region: eu-frankfurt-1
- Features: Vector search, blockchain tables, property graph
- Connection: mTLS via wallet files

---

## Key Design Patterns

### Deny-by-Default Security

- All routes require auth (except PUBLIC_ROUTES whitelist)
- All tool execution requires approval token (server-side validation)
- All DB writes use bind parameters (no SQL injection)
- All errors fail closed (never grant permissions on auth failure)

### Graceful Degradation

- DB down: In-memory/JSONL fallback for sessions, activity, rate limiting
- Auth service down: Reject with 503 (not 401), never assume permissions
- OCI CLI timeout: Capture error, return user-friendly message
- OCI CLI rate limit: Respect Retry-After, backoff exponentially

### Observability

- Request tracing: req-{uuid} ID propagated across logs
- Metrics: Prometheus format at /api/metrics (Grafana dashboards)
- Logs: Structured JSON (Pino logger) with redacted headers
- Errors: Sentry integration with context (user, org, request ID)
- Activity audit: All tool execution logged to audit_logs table

### Type Safety

- Zod schemas for all I/O (validation + documentation)
- TypeScript strict mode across apps
- Shared types in packages/shared (imported by frontend + API)
- FastAPI Zod type provider (serializerCompiler, validatorCompiler)

---

Last updated: February 8, 2026
