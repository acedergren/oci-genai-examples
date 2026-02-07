# Feature Flag: Fastify Backend Proxy

Phase 9 migrates API routes from SvelteKit `+server.ts` handlers to a dedicated Fastify backend. The feature flag enables a **gradual, per-route rollout** using a strangler fig pattern — SvelteKit acts as a reverse proxy, forwarding matched routes to Fastify while continuing to handle unmatched routes itself.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FASTIFY_ENABLED` | `false` | Set to `true` to enable proxying |
| `FASTIFY_URL` | `http://localhost:3001` | Base URL of the Fastify API service |
| `FASTIFY_PROXY_ROUTES` | _(empty = all)_ | Comma-separated route prefixes to proxy |

## How It Works

1. The SvelteKit `hooks.server.ts` handle function checks every request
2. If `FASTIFY_ENABLED=true` and the path matches a proxy route, the request is forwarded to `FASTIFY_URL` before SvelteKit processes auth, rate limiting, or route resolution
3. Fastify handles the request through its own middleware stack (auth, RBAC, rate limiting)
4. The response is returned to the client with an `X-Proxied-By: sveltekit` header for debugging
5. Request IDs (`X-Request-Id`) are forwarded so distributed traces stay correlated

### Excluded Routes

`/api/auth/*` is **never** proxied regardless of configuration. Better Auth's OIDC callbacks require the SvelteKit cookie and session handling to function correctly.

## Migration Strategy

### Step 1: No flag (current state)
All API routes handled by SvelteKit `+server.ts` files.

### Step 2: Selective proxy
Enable Fastify for validated routes only:

```env
FASTIFY_ENABLED=true
FASTIFY_URL=http://api:3001
FASTIFY_PROXY_ROUTES=/api/health,/api/healthz
```

### Step 3: Expand coverage
Add more routes as they are validated:

```env
FASTIFY_PROXY_ROUTES=/api/health,/api/healthz,/api/sessions,/api/activity,/api/v1/
```

### Step 4: Full proxy
Proxy all API routes (empty `FASTIFY_PROXY_ROUTES` means all `/api/*`):

```env
FASTIFY_ENABLED=true
FASTIFY_URL=http://api:3001
# FASTIFY_PROXY_ROUTES=  (empty = proxy all /api/* except /api/auth/)
```

### Step 5: Remove SvelteKit API routes
Once all routes are validated on Fastify, remove the `+server.ts` files and the proxy code. SvelteKit becomes a pure frontend.

## Docker Compose

In `docker-compose.yml`, the SvelteKit frontend and Fastify API run as separate services on a shared network:

```yaml
services:
  frontend:
    environment:
      - FASTIFY_ENABLED=true
      - FASTIFY_URL=http://api:3001
    depends_on:
      api:
        condition: service_healthy

  api:
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
```

The `depends_on` with `service_healthy` ensures Fastify is ready before SvelteKit starts proxying.

## Verifying the Proxy

```bash
# Check if a route is being proxied (look for X-Proxied-By header)
curl -v http://localhost:5173/api/health 2>&1 | grep -i x-proxied-by

# Compare responses between SvelteKit and Fastify directly
diff <(curl -s http://localhost:5173/api/health) <(curl -s http://localhost:3001/api/health)
```

## Rollback

To disable the proxy and revert to SvelteKit-only handling:

```env
FASTIFY_ENABLED=false
```

No restart is needed if using `$env/dynamic/private` — but since we read `process.env` at module load, a restart is required.

## Source Files

- `src/lib/server/feature-flags.ts` — flag logic, route matching, proxy function
- `src/hooks.server.ts` — proxy intercept (early in the handle chain)
- `.env.example` — documented configuration
