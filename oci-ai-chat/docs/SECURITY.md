# Security Model

This document describes the security architecture, authentication/authorization mechanisms, and hardening measures applied across the OCI Self-Service Portal (oci-ai-chat).

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization (RBAC)](#authorization-rbac)
3. [Input Validation](#input-validation)
4. [Injection Prevention](#injection-prevention)
5. [IDOR Prevention](#idor-prevention)
6. [Rate Limiting](#rate-limiting)
7. [SSRF Prevention](#ssrf-prevention)
8. [Cryptography](#cryptography)
9. [Security Headers](#security-headers)
10. [Error Handling](#error-handling)
11. [Server-Side Approval Tokens](#server-side-approval-tokens)
12. [Audit Trail](#audit-trail)
13. [Webhook Security](#webhook-security)
14. [API Key Management](#api-key-management)
15. [Applied Security Fixes](#applied-security-fixes)

## Authentication

### Session-Based Auth (Better Auth)

Primary authentication mechanism for browser-based access. Located in `apps/frontend/src/lib/server/auth/config.ts`.

- **Provider**: Better Auth with OCI IAM OIDC
- **Cookie-based**: Secure, HttpOnly, SameSite=Strict
- **OIDC Integration**: OpenID Connect via OCI Identity Cloud Service (IDCS)
- **Build-time secret**: `BETTER_AUTH_SECRET` required at build time for SvelteKit
- **Runtime validation**: Logs error if secret not set in production (hooks.server.ts line 69-71)

### API Key Authentication

Programmatic access for CI/CD pipelines, monitoring scripts, and external integrations. Located in `apps/frontend/src/lib/server/auth/api-keys.ts`.

**Key Format & Storage**:

- **Prefix**: `portal_` for easy identification in logs
- **Generation**: `crypto.randomBytes(32).toString('hex')` — cryptographically random 32-byte keys
- **Storage**: Only SHA-256 hash stored in database; plaintext shown once at creation
- **Key prefix display**: First 8 characters after `portal_` stored separately for quick UI identification without exposing full hash

**Validation**:

- Checked before session auth in hooks.server.ts (line 334-348)
- Supports both `Authorization: Bearer portal_...` and `X-API-Key: portal_...` headers
- Constant-time comparison via `crypto.timingSafeEqual()` to prevent timing oracle attacks
- Checks revocation status (REVOKED_AT timestamp)
- Validates expiration (EXPIRES_AT)
- Updates LAST_USED_AT on successful validation (fire-and-forget update)

**Lifecycle**:

- **Revocation**: Soft-delete (sets REVOKED_AT and status='revoked'); hash never removed
- **Expiration**: Optional EXPIRES_AT field for time-limited keys
- **Audit**: KEY_PREFIX logged, last_used_at tracked for audit visibility

### Bootstrap/Setup Auth

Initial configuration endpoints secured with setup token guard. Located in `apps/frontend/src/lib/server/api/require-auth.ts`.

- **Setup route**: `/setup` and `/api/setup` are public until portal configured
- **Initial user**: Created via setup flow with strong password requirements

### Dual Auth Pattern

All API endpoints support either session or API key authentication. Located in `apps/frontend/src/hooks.server.ts`:

1. API key is checked first (line 346-348)
2. If no API key, session auth is checked
3. Both establish `event.locals.user` and `event.locals.permissions`
4. Subsequent RBAC checks work identically for both auth types

## Authorization (RBAC)

Role-Based Access Control with 3 roles and 13 permissions. Located in `apps/frontend/src/lib/server/auth/rbac.ts`.

### Roles

| Role         | Permissions                                                             | Use Case                                             |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| **viewer**   | tools:read, sessions:read, workflows:read                               | Read-only access for stakeholders                    |
| **operator** | tools:read/execute/approve, sessions:read/write, workflows:read/execute | Day-to-day operations (approve tools, run workflows) |
| **admin**    | All 13 permissions                                                      | Full system access (user/org/audit management)       |

### Permissions

| Permission          | Description                                       |
| ------------------- | ------------------------------------------------- |
| `tools:read`        | View tool definitions and execution results       |
| `tools:execute`     | Execute pre-approved tools (no approval gate)     |
| `tools:approve`     | Approve/reject pending tool executions            |
| `tools:danger`      | Execute danger-level tools (bypasses rate limits) |
| `sessions:read`     | View chat sessions                                |
| `sessions:write`    | Create/modify chat sessions                       |
| `workflows:read`    | View workflow definitions and execution history   |
| `workflows:write`   | Create/modify workflow definitions                |
| `workflows:execute` | Execute workflows                                 |
| `admin:users`       | Manage user accounts                              |
| `admin:orgs`        | Manage organizations                              |
| `admin:audit`       | View audit logs and analytics                     |
| `admin:all`         | Full admin access (shortcut for all perms)        |

### Permission Checks

- **Route-level guard**: `requirePermission(event, 'tools:execute')` in +server.ts handlers
- **Admin-only endpoints**: Health detail endpoint checks for admin role (S-11 fix)
- **Admin health endpoint**: GET /api/health restricted to admins; public version at /api/healthz

**Implementation** (`rbac.ts` line 74-88):

- Checks `event.locals.user` exists (401 if missing)
- Checks `event.locals.permissions` includes required permission (403 if missing)
- Falls back to viewer permissions for unknown roles

**Fastify API Layer** (`apps/api/src/app.ts`):

- Deny-by-default auth gate via `onRequest` hook
- `PUBLIC_ROUTES` whitelist for health endpoints only
- `requirePermission()` decorator from RBAC plugin on individual routes
- `request.user` set by session plugin (cookie-based) or test user injection

## Input Validation

All API endpoints validate input using Zod schemas.

### Endpoint-Level Validation

- **Request body**: Validated via Zod schemas in +server.ts handlers
- **Query parameters**: Validated before processing
- **Path parameters**: Validated as part of route matching

### Body Size Limits

Global request body size limit: **512 KiB** (SvelteKit default).

- **Chat endpoint** (`/api/chat`): Limited to 10 messages max per request
- **Session LIKE search**: Query string length capped to prevent abuse

### Special Cases

**LIKE Pattern Escaping** (`apps/frontend/src/lib/server/oracle/oracle-adapter.ts`):

```sql
-- LIKE operator supports wildcards: % (any) and _ (single char)
-- Escape user input to prevent unintended pattern matching
SELECT * FROM sessions
WHERE name LIKE :pattern ESCAPE '\' AND user_id = :userId
```

- User-supplied patterns must escape `%`, `_`, and `\` characters
- ESCAPE clause added to all LIKE queries
- Prevents attacker-controlled wildcards from being interpreted as patterns

## Injection Prevention

### SQL Injection

- **No string interpolation**: All dynamic SQL uses bind parameters (`:paramName`)
- **Column/table validation**: Dynamic column/table names validated via allowlist regex
  - Column names: `/^[a-z_][a-z0-9_]{0,127}$/` (lowercase, alphanumeric + underscore)
  - Table names: Hardcoded allowlist in oracle-adapter.ts
  - Path traversal protection in migration loader (migrations.ts line 28-32)

**Example**:

```typescript
// SAFE: Bind parameter
await conn.execute(
  "SELECT * FROM sessions WHERE user_id = :userId AND status = :status",
  { userId: "123", status: "active" },
);

// UNSAFE: String interpolation (never used)
// await conn.execute(`SELECT * FROM sessions WHERE user_id = '${userId}'`);
```

### Command Injection

- **OCI CLI**: All CLI calls use `oracledb` library's execute function with array-based args
- **No shell string building**: Arguments passed as array, not shell command string
- **Tool arguments**: Validated/redacted before storage in audit logs

## IDOR Prevention

Indirect Object Reference (IDOR) attacks prevented via org/user scoping.

### Session Access Control

**In +page.server.ts and session endpoints**:

- All queries filtered by `user_id` AND `org_id`
- `switchToSession()` verifies ownership before allowing access
- Session UPDATE/DELETE operations verify user_id matches

**Example** (`apps/frontend/src/lib/server/oracle/repositories/session-repository.ts`):

```typescript
// Get sessions for current user only
const result = await conn.execute(
  "SELECT * FROM sessions WHERE org_id = :orgId AND user_id = :userId ORDER BY ...",
  { orgId, userId },
);
```

### Workflow Access Control

- **List operations**: Filtered by `org_id` (Phase 8 hardening, commit db9b0d3)
- **Get operations**: Verify `org_id` matches before returning
- **Execution**: `PUT /api/workflows/[id]/run` checks org_id (M-4 fix)
- **Approval**: `PUT /api/workflows/runs/[runId]/approve` org-scoped

### API Key Access Control

- **Organization scope**: API keys are org-scoped; cannot access other orgs
- **Revocation**: Scoped by org_id to prevent cross-org revocation (Phase 8 hardening)

## Rate Limiting

DB-backed rate limiting with in-memory fallback for DB failures. Located in `apps/frontend/src/lib/server/rate-limiter.ts`.

### Architecture

- **Primary**: Oracle MERGE INTO for atomic upsert (TOCTOU-safe)
- **Fallback**: JavaScript Map when DB unavailable
- **Cleanup**: Stale entries expired at 1% per-request probability (automatic)
- **Granular buckets**: Per-endpoint rate limits (not global)

### Per-Endpoint Limits

| Endpoint                  | Limit | Window | Reason                                  |
| ------------------------- | ----- | ------ | --------------------------------------- |
| `/api/chat`               | 20    | 60s    | AI inference (compute-heavy)            |
| `/api/tools/execute`      | 15    | 60s    | OCI CLI calls (expensive)               |
| `/api/workflows/[id]/run` | 5     | 60s    | Workflow execution (resource-intensive) |
| `/api/v1/search`          | 10    | 60s    | Vector search (DB-heavy)                |
| `/api/auth/*`             | 10    | 60s    | Auth attempts (brute-force protection)  |
| `/api/*` (default)        | 60    | 60s    | General API access                      |

### Rate Limit Exempt Paths

- `/api/health`, `/api/healthz` — Health checks (monitoring)
- `/api/metrics` — Prometheus scrape endpoint

### Enforcement in Hooks

Configured in `apps/frontend/src/hooks.server.ts` (line 130-165):

- Request rate limit checked before auth
- Client IP extracted via `event.getClientAddress()`
- Rate limit headers attached to all responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- Rate limit errors return 429 with retry-after guidance

### OCI CLI Concurrency Limiting

**Phase 9 addition** (commit 091747c):

- `MAX_CONCURRENT_CLI` enforces concurrency limit on simultaneous OCI CLI invocations
- Prevents resource exhaustion from parallel tool execution
- Coupled with approval queue limits (max 100 pending approvals)

## SSRF Prevention

Server-Side Request Forgery attacks blocked via URL validation. Located in `apps/frontend/src/lib/server/url-validation.ts`.

### Blocks

- **Non-HTTPS**: Only HTTPS URLs allowed
- **Private IPs**: 10.x, 127.x, 172.16-31.x, 192.168.x, 169.254.x
- **Loopback**: localhost, [::1], ::1
- **Cloud metadata**: Link-local 169.254.x (AWS metadata endpoint)
- **Internal hostnames**: \*.internal domain suffix
- **Zero address**: 0.0.0.0

### Webhook URL Validation

Webhooks validate URL before registration and before delivery:

```typescript
export function isValidWebhookUrl(url: string): boolean {
  return isValidExternalUrl(url); // SSRF checks applied
}
```

**Delivery validation** (`webhooks.ts` line 123-126):

- Re-validates URL before each delivery attempt
- Logs and fails webhook if URL fails validation
- Prevents race condition where URL validation changes between registration and delivery

## Cryptography

### Secrets at Rest (Admin API Keys)

**AES-256-GCM encryption** in `apps/frontend/src/lib/server/auth/crypto.ts`:

- **Algorithm**: AES-256-GCM for authenticated encryption
- **Key derivation**: HKDF-SHA256 from BETTER_AUTH_SECRET (domain-specific salt)
- **IV**: 12-byte random per encryption (optimal for GCM)
- **Auth tag**: 16-byte tag ensures integrity
- **Storage**: Ciphertext, IV, and tag stored separately in Oracle

**Example usage**:

```typescript
const { encrypted, iv, tag } = await encryptSecret(apiKeyPlaintext);
// Store all three in Oracle columns

// Decrypt later
const plaintext = await decryptSecret(encrypted, iv, tag);
```

### Webhook Signatures

**HMAC-SHA256** in `webhooks.ts`:

- **Generation**: `createHmac('sha256', secret).update(payload).digest('hex')`
- **Verification**: Timing-safe comparison via `crypto.timingSafeEqual()`
- **Header**: `X-Webhook-Signature: sha256=<hex>`

**Defense against timing attacks**:

```typescript
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = generateSignature(payload, secret);
  try {
    // Constant-time comparison prevents timing oracle
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false; // If lengths don't match, fail safely
  }
}
```

### API Key Hashing

**SHA-256** for API key storage (no salt needed as keys are random):

```typescript
function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
```

### CSP Nonce

**Per-request UUID** for Content Security Policy (hooks.server.ts line 280):

- **Production**: `crypto.randomUUID()` per request
- **Development**: Disabled for HMR compatibility
- **Injected into**: `<script nonce="{uuid}">` tags via `transformPageChunk`

## Security Headers

Applied globally via `addSecurityHeaders()` in `hooks.server.ts`.

### All Responses

| Header                           | Value                                     | Purpose                                         |
| -------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| **Content-Security-Policy**      | Nonce-based (prod) or unsafe-inline (dev) | Script execution control                        |
| **X-Content-Type-Options**       | nosniff                                   | Prevent MIME type sniffing                      |
| **X-Frame-Options**              | DENY                                      | Prevent clickjacking                            |
| **X-XSS-Protection**             | 0                                         | Disable browser XSS filters (CSP replaces them) |
| **Referrer-Policy**              | strict-origin-when-cross-origin           | Limit referrer leakage                          |
| **Permissions-Policy**           | Blocks camera, mic, payment, etc.         | Disable sensitive APIs                          |
| **Cross-Origin-Opener-Policy**   | same-origin                               | Isolate from popup windows                      |
| **Cross-Origin-Resource-Policy** | same-origin                               | Cross-origin resource blocking                  |

### Production-Only Headers

| Header                        | Value                               |
| ----------------------------- | ----------------------------------- | -------------------------- |
| **Strict-Transport-Security** | max-age=31536000; includeSubDomains | HTTPS enforcement (1 year) |

### API Responses

| Header            | Value                               |
| ----------------- | ----------------------------------- | ------------------------------ |
| **Cache-Control** | no-store, no-cache, must-revalidate | Prevent sensitive data caching |
| **Pragma**        | no-cache                            | Legacy cache prevention        |

### CORS Headers (for /api/v1/\*)

| Header                           | Value                                                |
| -------------------------------- | ---------------------------------------------------- |
| **Access-Control-Allow-Origin**  | Configured origin or \* (dev)                        |
| **Access-Control-Allow-Methods** | GET, POST, PUT, DELETE, OPTIONS                      |
| **Access-Control-Allow-Headers** | Authorization, X-API-Key, Content-Type, X-Request-Id |
| **Access-Control-Max-Age**       | 86400 (24 hours)                                     |

## Error Handling

Structured error hierarchy prevents information leakage. Located in `packages/shared/src/errors.ts` (shared across frontend and API).

### Error Types

```typescript
// All errors inherit from PortalError
new ValidationError(message, context); // 400
new AuthError(message, statusCode); // 401 or 403
new NotFoundError(message, context); // 404
new RateLimitError(message, context); // 429
new OCIError(message, context); // 502 (gateway error)
new DatabaseError(message, context); // 503 (service unavailable)
```

### Response Body (Safe)

Never exposes stack traces or internal context:

```typescript
// Returns to API clients
{
  error: "Validation failed",
  code: "VALIDATION_ERROR",
  requestId: "req-uuid"  // For debugging
}
```

### Internal Logging (Full Context)

For Pino and Sentry:

```typescript
{
  name: "ValidationError",
  code: "VALIDATION_ERROR",
  message: "Validation failed",
  statusCode: 400,
  context: { field: "userId" },
  stack: "...",
  cause: "..."
}
```

### Tool Execute Error Redaction

**Phase 9.1 hardening** (commit aa0f9ca):

- Internal error messages redacted in `/api/tools/execute` endpoint
- Returns generic "Tool execution failed" to client
- Full error logged server-side for debugging

## Server-Side Approval Tokens

Tool approval tokens generated and validated server-side to prevent client bypass. Located in `apps/frontend/src/lib/server/approvals.ts`.

### Token Lifecycle

1. **Recording**: `recordApproval(toolCallId, toolName)` creates entry
   - Oracle INSERT into approved_tool_calls table (preferred)
   - Falls back to in-memory Map if DB unavailable
   - Single-use token (consumed on use)

2. **TTL**: 5 minutes (`APPROVAL_TTL_MS`)
   - Oracle: `approved_at > SYSTIMESTAMP - INTERVAL '5' MINUTE`
   - In-memory: `Date.now() - entry.approvedAt > APPROVAL_TTL_MS`

3. **Consumption**: `consumeApproval(toolCallId, toolName)` atomically deletes entry
   - Oracle: Atomic DELETE statement (no TOCTOU race)
   - Returns true only if row deleted (matches both ID and tool name)
   - Falls back to in-memory if DB unavailable

### TOCTOU Safety

No race condition (Time-of-Check-Time-of-Use) due to atomic SQL:

```sql
DELETE FROM approved_tool_calls
WHERE tool_call_id = :toolCallId
  AND tool_name = :toolName
  AND approved_at > SYSTIMESTAMP - INTERVAL '5' MINUTE
```

Single DELETE statement ensures check and consumption happen atomically.

### Anti-Replay

Approval consumed (deleted) immediately after use. Attempting to use same token twice fails.

## Audit Trail

Two complementary audit mechanisms: standard audit table and blockchain (immutable) table.

### Standard Audit Table

**Located in**: `apps/frontend/src/lib/server/oracle/repositories/audit-repository.ts`

Logs all tool executions:

- **Columns**: user_id, org_id, tool_name, action (execute/approve/reject), result (success/failure), args_redacted, duration_ms, created_at, error_message
- **Retention**: Indefinite (standard table)
- **Query**: Org-scoped via org_id filter (IDOR prevention)
- **Redaction**: Sensitive args redacted before storage (e.g., API keys, passwords)

### Blockchain Audit Table (Immutable)

**Located in**: `apps/frontend/src/lib/server/oracle/migrations/007-ai-features.sql`

Tamper-proof INSERT-only ledger using Oracle 26AI blockchain tables:

```sql
CREATE BLOCKCHAIN TABLE audit_blockchain (
  action VARCHAR2(50),       -- 'tool_execution', 'approval', 'workflow_run', etc.
  tool_name VARCHAR2(255),   -- Tool or workflow name
  user_id VARCHAR2(255),
  org_id VARCHAR2(255),
  resource_type VARCHAR2(50), -- 'tool_execution', 'workflow_run', etc.
  resource_id VARCHAR2(255),
  detail JSON,               -- JSON payload (redacted sensitive fields)
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
)
NO DROP UNTIL 365 DAYS IDLE
NO DELETE UNTIL 365 DAYS AFTER INSERT
HASHING USING "SHA2_256"
```

**Properties**:

- **Immutable**: Cannot DROP or DELETE for 365 days minimum
- **Tamper-detection**: Hash chain ensures record integrity (SHA2_256)
- **Compliance**: Meets regulatory requirements for audit trails
- **Indexes**: Org, user, action, tool_name, resource, created_at for efficient queries

## Webhook Security

Webhooks signed with HMAC-SHA256 and rate-limited with exponential backoff. Located in `apps/frontend/src/lib/server/webhooks.ts`.

### Signing & Verification

**Sender** (portal):

1. Generate HMAC-SHA256 of JSON payload
2. Attach signature in `X-Webhook-Signature: sha256=<hex>` header

**Receiver** (customer):

1. Retrieve secret from webhook config
2. Generate HMAC-SHA256 of received payload
3. Compare to header signature using constant-time comparison
4. Process event only if signatures match

### Delivery Guarantees

- **Retry logic**: Up to 3 retries with exponential backoff (1s, 4s, 16s)
- **Timeout**: 10 seconds per delivery attempt
- **Circuit breaker**: Marks webhook as 'failed' after 5 consecutive failures
- **Fire-and-forget**: Dispatch is non-blocking; failures don't block request handler
- **Status codes**: Retries on 5xx, gives up on 4xx (except 429)

### SSRF Protection

- URL validated before registration (SSRF checks applied)
- URL re-validated before each delivery
- Prevents race condition where webhook URL changes between checks

## API Key Management

### Key Lifecycle (apps/frontend/src/lib/server/auth/api-keys.ts)

**Creation**:

- Generate random key: `crypto.randomBytes(32).toString('hex')` → `portal_<32-byte-hex>`
- Hash with SHA-256 for storage
- Extract key*prefix (first 8 chars after `portal*`) for UI display
- Return plaintext key to admin (shown once)

**Validation**:

- Check prefix matches `portal_`
- Hash incoming key and query by hash
- Constant-time comparison to prevent timing oracle
- Check revocation status (REVOKED_AT)
- Check expiration (EXPIRES_AT)
- Update last_used_at timestamp

**Revocation**:

- Soft-delete: Set REVOKED_AT and status = 'revoked'
- Hash is never deleted (prevents re-registration of compromised key)

**Listing**:

- Limited to 100 keys per org (Phase 8 hardening, commit b73c69f)
- Never returns key_hash or plaintext key
- Returns key_prefix for identification

## Applied Security Fixes

### Phase 4 Security Hardening

**C1: Build-time secret fallback**

- BETTER_AUTH_SECRET fallback for SvelteKit builds (which run with NODE_ENV=production)
- Runtime warning logged if secret not set in production

**H1: Auth error handling**

- Authentication failures return 503 or redirect, never grant default permissions
- Prevents escalation of auth errors to unintended access

**H2: Session IDOR**

- Session queries filtered by userId
- switchToSession() verifies ownership before access

**H3: Client-supplied approval bypass**

- Server-side approval tokens replace client-supplied `approved` flag
- Tokens single-use, 5-minute TTL, atomic deletion

### Phase 5 Security Hardening

**H4/H5: Rate limiter TOCTOU**

- Replaced SELECT+INSERT/UPDATE with atomic MERGE INTO
- Prevents race condition between checking and updating rate limit counter

**M3/M6: Session operations**

- switchToSession() now requires userId parameter
- Session CREATE passes userId from auth context (prevents orphaned sessions)

### Phase 7 Security Hardening

**I1: Column injection**

- Column/table names validated via regex allowlist
- Dynamic SQL never interpolates identifiers without validation

**I2: CSP nonce**

- Per-request crypto.randomUUID() nonce in production
- Injected into `<script nonce="{nonce}">` tags
- Prevents inline script execution without nonce

**M1-M5: LIKE pattern escaping**

- All user-supplied LIKE patterns escape `%`, `_`, `\`
- ESCAPE clause added to LIKE queries

### Phase 8 Security Hardening

**M-19: Webhook status validation**

- Webhook status must be 'active' before dispatch
- Prevents re-activation of failed/disabled webhooks

**M-20: Webhook event type validation**

- Event type must be in configured subscription list
- Prevents arbitrary event dispatch

**H-9/H-10/H-11: Workflow IDOR org-scoping**

- Workflow LIST, GET, and EXECUTE operations filtered by org_id
- Prevents cross-org workflow access

### Phase 9 Security Hardening

**S-4: Cache-Control headers**

- All API responses set Cache-Control: no-store
- Prevents sensitive data leakage via browser cache

**S-7: MCP server auth**

- MCP server executeTool endpoint requires valid session
- Prevents unauthorized tool execution

**S-11: Health endpoint detail exposure**

- /api/health (detailed) restricted to admins
- /api/healthz (minimal) available to all

**S-16: Security headers on proxy responses**

- Fastify proxy responses wrapped with addSecurityHeaders()
- CSP, HSTS, X-Frame-Options applied consistently

**RL-7/RL-8: Request body size limits**

- Global 512 KiB limit on request bodies
- Chat endpoint limits to 10 messages max

**RL-9: Rate limit result list queries**

- listApiKeys() limited to 100 rows
- Webhook list queries limited to prevent DoS

**RL-13: OCI CLI concurrency limiting**

- MAX_CONCURRENT_CLI enforces concurrency cap
- Approval queue limited to 100 pending entries

### CodeRabbit Review Fixes (Post Phase 9.7)

**Commit**: f9aab0d

**CR-1: Hook fail-open → fail-closed** (`.claude/hooks/block-sensitive-files.sh`)

- `block-sensitive-files.sh` silently allowed edits when `jq` was unavailable
- Fixed: Exit with error code 2 when `jq` missing (fail-closed)

**CR-2: Lost approval on recordApproval failure** (`apps/api/src/routes/tools/approve.ts`)

- `pendingApprovals.delete(toolCallId)` ran before `recordApproval()` — if recording failed, approval was lost
- Fixed: Delete from map only after successful recording; resolve promise last

**CR-3: HCL tag injection** (`apps/api/src/mastra/tools/lib/terraform/generator.ts`)

- Terraform tag keys/values were not escaped — attacker could inject `"` or `${` to break HCL syntax
- Fixed: Added `escapeHclString()` that escapes `\`, `"`, and `${` in tag generation

**CR-4: Workflow DELETE IDOR** (`apps/api/src/routes/workflows.ts`)

- DELETE handler did not scope by `orgId` — any authenticated user could delete any workflow
- Fixed: Added orgId validation and passes orgId to repository delete method

**CR-5: Workflow LIST incorrect total** (`apps/api/src/routes/workflows.ts`)

- List endpoint returned `results.length` as total instead of actual database count
- Fixed: Added parallel `COUNT(*)` query for accurate pagination total

---

**Last Updated**: February 9, 2026
**Version**: 1.0
