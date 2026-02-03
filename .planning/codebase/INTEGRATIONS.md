# External Integrations

**Analysis Date:** 2026-02-03

## APIs & External Services

**OCI Generative AI (Primary Service):**
- OCI Generative AI Inference - Language model API for chat, completion, embeddings, and reranking
  - SDK: `oci-generativeaiinference` 2.94.0
  - Client: `GenerativeAiInferenceClient`
  - Models: 16+ including Cohere Command, Llama, Grok, Gemini
  - Features: Tool calling, streaming responses, reasoning (partial)
  - Implementation: `oci-genai-provider/src/language-models/OCILanguageModel.ts`

**OCI Speech Services:**
- AI Service Speech for text-to-speech (TTS) and speech-to-text (STT)
  - SDK: `oci-aispeech` 2.94.0
  - Client: `AIServiceSpeechClient`
  - Features: Real-time transcription via WebSocket, batch speech synthesis
  - Implementation: `oci-genai-provider/src/speech-models/`, `oci-genai-provider/src/transcription-models/`
  - Realtime: `oci-genai-provider/src/realtime/` (WebSocket-based, event-driven)

**OCI Object Storage (File Storage):**
- Oracle Cloud Object Storage for audio/document persistence
  - SDK: `oci-objectstorage` 2.94.0
  - Client: `ObjectStorageClient`
  - Purpose: Store audio files before transcription processing, store transcription results
  - Implementation: `oci-genai-provider/src/shared/storage/object-storage.ts`
  - Namespace discovery: `getNamespace()` API call required
  - Operations: putObject, getObject, deleteObject

**OCI IAM & Authentication:**
- OCI Identity and Access Management
  - SDK: `oci-common` 2.94.0
  - Auth methods: ConfigFile, InstancePrincipal, ResourcePrincipal
  - Configuration: `oci-genai-provider/src/auth/index.ts`
  - Region handling: Automatic region resolution from config or env

**OCI Monitoring (Optional, tui-agent only):**
- OCI Monitoring service for metrics emission
  - SDK: `oci-monitoring` 2.124.0
  - Purpose: Publish custom metrics during agent execution
  - Used in: tui-agent for observability

**OCI Core Services (Optional, tui-agent only):**
- OCI Core for compute, networking queries
  - SDK: `oci-core` 2.124.0
  - Purpose: Query compute shapes, networking details

**OCI Database Services (Optional, tui-agent only):**
- OCI Database service client
  - SDK: `oci-database` 2.124.0
  - Purpose: Query database systems and resource information

**OCI Network Load Balancer (Optional, tui-agent only):**
- OCI NLB client for load balancing queries
  - SDK: `oci-networkloadbalancer` 2.124.0

## Data Storage

**Databases:**

**SQLite (Local):**
- Type: Embedded relational database
- Provider: Local file system via better-sqlite3
- Connection: Synchronous, WAL mode enabled
- Purpose: Agent session state, conversation history, tool execution logs
- Location: `~/.oci-provider-examples/agent-state.db`
- Env var: `AGENT_STATE_DB_PATH`
- Schema: Defined in `agent-state/src/schema.ts`
- ORM/Client: better-sqlite3 (raw SQL wrapper)
- Implementation: `agent-state/src/connection.ts` (singleton pattern)

**File Storage:**

**OCI Object Storage (Remote):**
- Purpose: Audio files for transcription, transcription result JSON
- Bucket: Application-configurable
- Namespace: Discovered via API
- Cleanup: `deleteFromObjectStorage()` after processing

**Local Filesystem:**
- Configuration files: `~/.oci/config`
- Database directory: `~/.oci-provider-examples/`
- Purpose: OCI SDK credentials, agent state persistence

**Caching:**

**TanStack Query (Client-side):**
- Framework: @tanstack/query-core 5.66.4
- Purpose: Request deduplication, response caching, background sync
- Utilities: `oci-genai-query/` package
- Peer dependency: ai@^6.0.0
- Used in: oci-ai-chat (via @tanstack/svelte-query)

**In-Memory State (Zustand):**
- Stores: Agent state, chat messages, panel visibility, configuration
- Files: `tui-agent/src/state/`
- Persistence: Serialized to SQLite via agent-state package

## Authentication & Identity

**Auth Provider:**
- OCI Identity and Access Management

**Implementation:**
- `oci-genai-provider/src/auth/index.ts`
- `createAuthProvider()` function: Routes to appropriate auth method
- Returns: `AuthenticationDetailsProvider` from oci-common

**Methods:**

1. **Config File (Default):**
   - Path: `~/.oci/config` (configurable)
   - Profile: DEFAULT (configurable)
   - Details: API key, tenancy ID, key fingerprint
   - When: Local development, OCI CLI-configured environments

2. **Instance Principal:**
   - Used by: OCI Compute instances
   - When: Running on OCI Compute with instance policies
   - Auth: Implicit, via instance metadata service

3. **Resource Principal:**
   - Used by: OCI Functions, Container Instances
   - When: Containerized/function deployments
   - Auth: Implicit, via OCI control plane

**Configuration Flow:**
```
config.auth → OCIConfig type → createAuthProvider()
           ↓
auth == 'config_file' → ConfigFileAuthenticationDetailsProvider
auth == 'instance_principal' → InstancePrincipalsAuthenticationDetailsProviderBuilder
auth == 'resource_principal' → ResourcePrincipalAuthenticationDetailsProvider
```

**Environment Variables:**
- `OCI_REGION` - Region for API calls (default: eu-frankfurt-1)
- `OCI_COMPARTMENT_ID` - Target compartment (required, from config or env)
- `OCI_CONFIG_PROFILE` - Config file profile (default: DEFAULT)

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Datadog, etc.)
- Errors handled locally via custom error types

**Logs:**
- pino 10.3.0+ - Structured JSON logging (CLI tool)
- console API - Basic logging (libraries, React apps)
- No centralized log aggregation detected

**Error Handling:**
- Custom error types: `oci-genai-provider/src/shared/errors/`
- OCI SDK errors wrapped and enriched
- Retry logic: `withRetry()` utility with exponential backoff
- Timeout protection: `withTimeout()` utility (default 30s)

## CI/CD & Deployment

**Hosting:**
- OCI Cloud (primary integration target)
- Vercel (potential, Next.js compatible)
- Self-hosted (Node.js/Bun runtimes)

**CI Pipeline:**
- Jest: `test:coverage:ci` with maxWorkers=2
- GitHub Actions (referenced in jest.config.js CI flag)
- Bail on first failure in CI mode

**Build Outputs:**
- ESM + CJS dual builds (tsup)
- SvelteKit Node adapter for SSR
- Next.js standard builds
- Bun standalone executable

## Environment Configuration

**Required Environment Variables:**

**OCI Access:**
- `OCI_COMPARTMENT_ID` - (required) Compartment OCID for inference
- `OCI_REGION` - (optional) OCI region, defaults to eu-frankfurt-1
- `OCI_CONFIG_PROFILE` - (optional) Config file profile, defaults to DEFAULT

**Database:**
- `AGENT_STATE_DB_PATH` - (optional) SQLite location, defaults to ~/.oci-provider-examples/agent-state.db

**Secrets Location:**
- OCI Config File: `~/.oci/config`
  - Format: API key configuration
  - Fields: key_file, fingerprint, tenancy, user, region
- Environment Variables: Runtime-provided secrets (CI/CD systems)
- No dotenv (.env) files used in production (OCI native auth preferred)

## Webhooks & Callbacks

**Incoming:**
- Not detected (no webhook endpoints)

**Outgoing:**
- Not detected (no webhook calls)

**WebSocket Connections:**
- OCI Speech Realtime: WebSocket connection for streaming speech-to-text
  - Adapter: `oci-genai-provider/src/realtime/WebSocketAdapter.ts`
  - Purpose: Real-time bidirectional audio/transcription streaming
  - Message protocol: Custom OCI realtime messages (auth, connect, result, ack, error, final)
  - Implementation: Event-driven (on: partial, on: final, on: error)

**Streaming Patterns:**

**Server-Sent Events (SSE):**
- Language model streaming responses parsed via eventsource-parser
- Implementation: `oci-genai-provider/src/shared/streaming/sse-parser.ts`
- Usage: Cohere and other models with streaming support

**Custom Streaming:**
- AI SDK streaming interfaces for embeddings, reranking
- Async iterables for result processing

## Request/Response Patterns

**Retry Configuration:**
```typescript
// Default: 3 max retries, exponential backoff (100ms base, 10s max)
// Configurable per request via OCIProviderOptions.requestOptions
retry: {
  enabled: boolean,      // default: true
  maxRetries: number,    // default: 3
  baseDelayMs: number,   // default: 100
  maxDelayMs: number     // default: 10000
}
```

**Timeout Configuration:**
```typescript
// Default: 30 seconds per request
timeoutMs: number        // default: 30000
```

**Serving Modes:**
- ON_DEMAND: Public model endpoint
- DEDICATED: Custom dedicated endpoint (modelId or endpointId)

---

*Integration audit: 2026-02-03*
