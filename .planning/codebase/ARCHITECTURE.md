# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Modular monorepo with layered provider architecture and application specialization.

**Key Characteristics:**
- Monorepo using pnpm workspaces with 14+ independent packages
- Core provider layer (`oci-genai-provider`) implementing Vercel AI SDK v3 specification
- Shared state management (`agent-state`) for session/turn persistence
- Application-specific implementations (TUI, web, API clients)
- Model-specific converters and specialized model layers
- Centralized error handling, authentication, and utilities

## Layers

**Provider Layer (Core):**
- Purpose: Implements ProviderV3 interface for OCI Generative AI service integration
- Location: `oci-genai-provider/src/`
- Contains: Language models, embeddings, speech/transcription, reranking, realtime clients
- Depends on: OCI SDK (`oci-generativeaiinference`, `oci-common`), Vercel AI SDK (`@ai-sdk/provider`)
- Used by: All application packages, TUI agent, web chatbots

**Model Layer:**
- Purpose: Concrete model implementations for different OCI model families
- Location: `oci-genai-provider/src/language-models/`, `embedding-models/`, `speech-models/`, `transcription-models/`, `reranking-models/`
- Contains: Model-specific request/response converters, feature availability registries
- Depends on: Shared utilities, error handlers, OCI SDK
- Used by: Provider factory methods

**Configuration & Auth Layer:**
- Purpose: OCI configuration resolution and authentication provider selection
- Location: `oci-genai-provider/src/config/`, `auth/`
- Contains: Config file parsing, environment variable discovery, auth provider factory
- Depends on: OCI SDK, zod validation
- Used by: Client initialization, request handling

**State Persistence Layer:**
- Purpose: Session and turn storage with SQLite and Zod validation
- Location: `agent-state/src/`
- Contains: Repository pattern with transaction support, schema validation
- Depends on: `better-sqlite3`, `zod`
- Used by: Web applications, API handlers

**Application UI Layers:**

*TUI (Terminal UI):*
- Purpose: Interactive terminal-based agent interface
- Location: `tui-agent/src/`
- Contains: React components, Zustand stores, keyboard hooks, tool approval system
- Depends on: Ink React, `oci-genai-provider`, agent-state
- Used by: CLI entry point

*Web (SvelteKit):*
- Purpose: Server-rendered web chatbot with session persistence
- Location: `oci-ai-chat/src/`
- Contains: SvelteKit routes, server actions, UI components
- Depends on: SvelteKit, Tailwind, `oci-genai-provider`, agent-state
- Used by: Web browsers

*Next.js Chatbot:*
- Purpose: Next.js-based web UI for chat
- Location: `nextjs-chatbot/src/`
- Contains: React Server Components, API routes
- Depends on: Next.js, `oci-genai-provider`
- Used by: Web browsers

**Query/Data Client Layer:**
- Purpose: Centralized data fetching with TanStack Query (v5) integration
- Location: `oci-genai-query/src/`
- Contains: Query key factories, fetch functions, option builders
- Depends on: `@tanstack/react-query`, axios
- Used by: React applications (TUI, web)

**Shared Utilities Layer:**
- Purpose: Cross-cutting concerns and helpers
- Location: `oci-genai-provider/src/shared/`
- Contains: Error classes, retry logic, timeout wrappers, SSE parsing, validation schemas
- Depends on: zod
- Used by: All layers

## Data Flow

**Chat Request Flow (Web/TUI):**

1. User input → UI component state update (Zustand store)
2. Store triggers hook (`useAgentLoop`, `useLLMStream`)
3. Hook calls `OCILanguageModel.doStream()` via provider
4. Provider resolves OCI auth + region → creates `GenerativeAiInferenceClient`
5. Client sends formatted request to OCI GenAI API (SSE stream)
6. Provider parses SSE events → converts to AI SDK stream parts
7. App collects stream parts → updates chat display in real-time
8. On completion: prompt/response + tokens logged to session store
9. State persists to SQLite via `agent-state` repository

**Session Persistence Flow:**

1. Web handler receives chat payload → calls `getOrCreateSession()`
2. Repository performs SQLite transaction: validate → insert/update
3. Zod schemas validate turn data at runtime (Message, ToolCall, etc.)
4. JSON serialization for complex fields (tool args, config)
5. Response includes session ID + token usage
6. Web state updates with session context via query cache

**Tool Execution Flow (TUI Agent):**

1. Agent stream receives tool call block
2. `useAgentLoop` hook parses tool definition
3. Tool approval system checks rules (auto-approve vs. manual approval)
4. If manual: render `ToolApproval` panel + suspend execution
5. User reviews tool call args in panel + presses key to approve
6. Hook resumes → submits `toolResult` in next message
7. Tool execution tracked in `useAgentStore` for display
8. Reasoning steps from model thinking tracked separately

**State Management Flow:**

1. Zustand stores maintain local UI state (agent, chat, panels, config)
2. Agent store tracks: status, current thought, reasoning steps, tool executions, pending approval
3. Chat store tracks: messages, input focus, message list
4. Panel store tracks: visibility, active panels (thought, reasoning, tools, sessions)
5. Config store tracks: selected model, region, session ID, token usage, cost
6. Stores accessed via hooks in React components

## Key Abstractions

**ProviderV3 Implementation:**
- Purpose: Unified AI SDK interface for OCI models
- Examples: `oci-genai-provider/src/provider.ts`, `language-models/OCILanguageModel.ts`
- Pattern: Factory methods (`languageModel()`, `embeddingModel()`) return model instances implementing SDK interface

**Model Registry:**
- Purpose: Catalog of available models with metadata (capabilities, cost, limits)
- Examples: `language-models/registry.ts`, `embedding-models/registry.ts`
- Pattern: Array of model metadata with lookup functions (`isValidModelId()`, `getModelMetadata()`, `getModelsByFamily()`)

**Converter Pattern:**
- Purpose: Transform between Vercel AI SDK format and OCI-specific formats
- Examples: `language-models/converters/messages.ts`, `tools.ts`
- Pattern: Separate converters per model family (Cohere vs. Llama vs. Generic API format)

**Repository Pattern:**
- Purpose: Abstraction for data persistence with transaction support
- Examples: `agent-state/src/repository.ts`
- Pattern: Update builder, transaction management, Zod validation on parse

**Zustand Stores:**
- Purpose: Global client-side state management for UI
- Examples: `tui-agent/src/state/agent-store.ts`, `chat-store.ts`
- Pattern: Immutable updates, typed getters/setters via store hooks

**Service Layer (TUI):**
- Purpose: Business logic for LLM communication and agent execution
- Examples: `tui-agent/src/services/persistence.ts`, `llm-client.ts`, `agent-executor.ts`
- Pattern: Dependency injection via constructor, callback-based async results

**Hook Pattern (TUI):**
- Purpose: Encapsulate complex stateful logic for reuse
- Examples: `tui-agent/src/hooks/useAgentLoop.ts`, `useLLMStream.ts`
- Pattern: Custom React hooks with memoized callbacks, store selectors

## Entry Points

**TUI Agent:**
- Location: `tui-agent/src/index.tsx`
- Triggers: CLI execution via Ink entry point
- Responsibilities: Initialize stores, create Ink app, render App component

**Web Chat (SvelteKit):**
- Location: `oci-ai-chat/src/routes/+page.server.ts` (layout)
- Triggers: HTTP GET /
- Responsibilities: Load initial session, render SvelteKit layout

**Chat API Handler:**
- Location: `oci-ai-chat/src/routes/api/chat/+server.ts`
- Triggers: HTTP POST /api/chat
- Responsibilities: Parse request, initialize provider, stream response, persist session

**Next.js Chat:**
- Location: `nextjs-chatbot/src/app/page.tsx`
- Triggers: HTTP GET /
- Responsibilities: Render client component with chat UI

## Error Handling

**Strategy:** Multi-layered error boundaries with specialized error classes.

**Patterns:**

- **Custom Error Classes:** `oci-genai-provider/src/shared/errors/index.ts`
  - `OCIGenAIError` (base)
  - `AuthenticationError` (401, credentials)
  - `RateLimitError` (429, quota exceeded)
  - `NetworkError` (connectivity)
  - `ModelNotFoundError` (invalid model ID)

- **Error Detection:** `handleOCIError()` maps OCI SDK errors → custom classes

- **Retry Logic:** `withRetry()` wrapper applies exponential backoff for retryable errors
  - Checks `isRetryableStatusCode()` and `isRetryableError()`
  - Configurable max retries, base delay, max delay

- **Timeout Handling:** `withTimeout()` wrapper with `TimeoutError` for slow requests
  - Default 30s timeout, configurable per request

- **UI Error Display:**
  - TUI: Agent store tracks `lastError`, displayed in status bar
  - Web: API handler returns 500 with error message in response

## Cross-Cutting Concerns

**Logging:**
- No centralized logger
- Console logging in development (provider debug info via env vars)
- SvelteKit server logs in `src/hooks.server.ts`

**Validation:**
- Zod schemas for provider config, settings, request options
- Runtime parsing in repository layer for database deserialization
- Schema locations: `oci-genai-provider/src/shared/schemas/`

**Authentication:**
- OCI config file resolution via `~/.oci/config`
- Environment variable fallback (`OCI_*` env vars)
- Instance principal auth for OCI Compute (environment detection)
- Credentials cached per client instance

**Request Options:**
- Per-call overrides: timeout, retry config
- Provider-level defaults via OCIConfig
- Merged at request time in `resolveRequestOptions()`

---

*Architecture analysis: 2026-02-03*
