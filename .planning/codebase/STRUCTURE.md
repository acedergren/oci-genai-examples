# Codebase Structure

**Analysis Date:** 2026-02-03

## Directory Layout

```
oci-genai-examples/
├── .planning/                    # GSD planning artifacts
│   └── codebase/                 # Analysis documents
├── agent-state/                  # Shared session/turn persistence
├── chatbot-demo/                 # Svelte demo chatbot (deprecated reference)
├── cli-tool/                     # CLI for OCI operations
├── fraud-analyst-agent/          # Fraud detection example agent
├── kyc-platform/                 # KYC (Know Your Customer) platform
├── mcp-client/                   # Model Context Protocol client
├── nextjs-chatbot/               # Next.js web chatbot
├── oci-ai-chat/                  # SvelteKit web chatbot (primary)
├── oci-genai-provider/           # Core provider (Vercel AI SDK v3)
├── oci-genai-query/              # TanStack Query client layer
├── rag-demo/                     # RAG (Retrieval-Augmented Gen) example
├── rag-reranking-demo/           # RAG with reranking example
├── realtime-stt-demo/            # Real-time speech-to-text demo
├── stt-demo/                     # Speech-to-text example
├── tui-agent/                    # Terminal UI agent (primary)
├── package.json                  # Root workspace config
├── pnpm-workspace.yaml           # pnpm workspace definition
├── pnpm-lock.yaml                # Dependency lock file
├── README.md                     # Project overview
└── SETUP.md                      # Development setup guide
```

## Directory Purposes

**Root (Workspace):**
- Purpose: Multi-package monorepo management
- Contains: pnpm workspaces config, shared scripts
- Key files: `package.json`, `pnpm-workspace.yaml`

**oci-genai-provider/:**
- Purpose: Core OCI Generative AI provider library
- Contains: Language models, embeddings, speech, transcription, reranking, realtime clients
- Key files: `src/index.ts`, `src/provider.ts`, `src/types.ts`

**oci-genai-provider/src/language-models/:**
- Purpose: Chat/completion model implementations
- Contains: OCILanguageModel class, registry with 16+ models, converters for different API formats
- Key files: `OCILanguageModel.ts`, `registry.ts`, `converters/messages.ts`, `converters/tools.ts`

**oci-genai-provider/src/embedding-models/:**
- Purpose: Embedding model implementations (vectors)
- Contains: OCIEmbeddingModel class, embedding model registry
- Key files: `OCIEmbeddingModel.ts`, `registry.ts`

**oci-genai-provider/src/speech-models/:**
- Purpose: Text-to-speech model implementations
- Contains: OCISpeechModel class, voice registry
- Key files: `OCISpeechModel.ts`, `registry.ts`

**oci-genai-provider/src/transcription-models/:**
- Purpose: Speech-to-text model implementations
- Contains: OCITranscriptionModel class, language support registry
- Key files: `OCITranscriptionModel.ts`, `registry.ts`

**oci-genai-provider/src/reranking-models/:**
- Purpose: Document reranking for RAG systems
- Contains: OCIRerankingModel class, reranking model registry
- Key files: `OCIRerankingModel.ts`, `registry.ts`

**oci-genai-provider/src/realtime/:**
- Purpose: Real-time streaming transcription (WebSocket)
- Contains: OCIRealtimeClient, OCIRealtimeTranscription, WebSocketAdapter
- Key files: `OCIRealtimeClient.ts`, `OCIRealtimeTranscription.ts`, `WebSocketAdapter.ts`, `types.ts`

**oci-genai-provider/src/config/:**
- Purpose: Configuration discovery and validation
- Contains: OCI config file parsing, environment variable resolution, fallback defaults
- Key files: `index.ts`, `oci-config.ts`, `discovery.ts`, `validation.ts`, `types.ts`

**oci-genai-provider/src/auth/:**
- Purpose: OCI authentication provider factory
- Contains: API key auth, instance principal detection, auth provider selection
- Key files: `index.ts`

**oci-genai-provider/src/shared/:**
- Purpose: Cross-cutting utilities and error handling
- Contains: Error classes, retry/timeout wrappers, SSE parser, validation schemas, storage client
- Key files: `errors/index.ts`, `utils/retry.ts`, `utils/timeout.ts`, `streaming/sse-parser.ts`, `schemas/index.ts`

**agent-state/:**
- Purpose: Session and turn persistence layer
- Contains: SQLite repository, Zod schemas for sessions/turns/messages/tools
- Key files: `src/repository.ts`, `src/types.ts`, `src/connection.ts`, `src/schema.ts`

**agent-state/src/__tests__/:**
- Purpose: Repository tests with SQLite fixtures
- Contains: Integration tests for session CRUD, turn management, validation

**oci-genai-query/:**
- Purpose: TanStack Query (React Query v5) client layer
- Contains: Query key factories, fetch functions, option builders
- Key files: `src/keys.ts`, `src/fetchers.ts`, `src/options.ts`, `src/types.ts`

**oci-ai-chat/src/**
- Purpose: SvelteKit web chatbot application (primary web app)
- Contains: Server-side chat handler, session management, UI components
- Key structure:
  - `routes/+page.server.ts`: Initial session loader
  - `routes/api/chat/+server.ts`: Chat streaming endpoint
  - `routes/api/sessions/`: Session CRUD endpoints
  - `lib/`: Shared utilities, components, hooks
  - `lib/server/`: Server-only modules (db, session logic)
  - `lib/query/`: Query client integration
  - `lib/tools/`: Tool definitions and registry

**oci-ai-chat/src/routes/:**
- Purpose: SvelteKit route handlers
- Contains: Page layouts, API endpoints for chat, models, sessions
- Key files: `api/chat/+server.ts`, `api/sessions/+server.ts`, `api/models/+server.ts`

**tui-agent/src/**
- Purpose: Terminal UI agent application
- Contains: React/Ink UI, Zustand stores, hooks for agent loop and session management
- Key structure:
  - `app.tsx`: Main App component
  - `components/`: UI layers (layout, chat, panels, tools)
  - `services/`: Business logic (persistence, LLM client, agent executor)
  - `state/`: Zustand stores (agent, chat, panel, config)
  - `hooks/`: Custom React hooks
  - `theme/`: Colors and styling
  - `tools/`: Tool definitions and approval rules

**tui-agent/src/components/:**
- Purpose: React/Ink UI components
- Contains: Layout components (Header, StatusBar, SplitPane), chat view, panels (thought, reasoning, tools, sessions)
- Key files: `layout/Header.tsx`, `chat/ChatView.tsx`, `panels/ToolPanel.tsx`, `shared/Spinner.tsx`

**tui-agent/src/state/:**
- Purpose: Zustand global state stores
- Contains: Stores for agent status, chat messages, panel visibility, config
- Key files: `agent-store.ts`, `chat-store.ts`, `panel-store.ts`, `config-store.ts`, `index.ts`

**tui-agent/src/services/:**
- Purpose: Business logic layer
- Contains: Session persistence, LLM client, agent executor with tool handling
- Key files: `persistence.ts` (wraps agent-state), `llm-client.ts`, `agent-executor.ts`

**tui-agent/src/hooks/:**
- Purpose: Custom React hooks for complex state logic
- Contains: Agent loop hook, LLM streaming hook, session management, keyboard input
- Key files: `useAgentLoop.ts`, `useLLMStream.ts`, `useSession.ts`, `useKeyboard.ts`

**nextjs-chatbot/src/app/:**
- Purpose: Next.js app directory structure
- Contains: Server and Client components for chat UI
- Key files: Entry points and component files

**rag-demo/, rag-reranking-demo/, stt-demo/, realtime-stt-demo/:**
- Purpose: Example implementations showing specific OCI features
- Contains: Minimal working examples with setup instructions
- Used for: Learning and feature demonstration

## Key File Locations

**Entry Points:**
- `tui-agent/src/index.tsx`: Terminal UI app initialization
- `oci-ai-chat/src/routes/+page.server.ts`: Web chat initial load
- `oci-ai-chat/src/routes/api/chat/+server.ts`: Chat API handler
- `nextjs-chatbot/src/app/page.tsx`: Next.js chat entry
- `oci-genai-provider/src/index.ts`: Provider library exports

**Configuration:**
- `oci-genai-provider/src/config/oci-config.ts`: OCI config file parser
- `oci-genai-provider/src/config/discovery.ts`: Environment/config resolution
- `tui-agent/src/tools/approval-rules.ts`: Tool approval configuration
- Root `package.json`: Workspace and script configuration

**Core Logic:**
- `oci-genai-provider/src/provider.ts`: ProviderV3 implementation
- `oci-genai-provider/src/language-models/OCILanguageModel.ts`: Language model implementation
- `agent-state/src/repository.ts`: Session/turn persistence
- `tui-agent/src/services/agent-executor.ts`: Agent loop execution

**Testing:**
- `oci-genai-provider/src/__tests__/`: Provider unit and integration tests
- `agent-state/src/__tests__/`: Repository and persistence tests
- `oci-genai-query/src/*.test.ts`: Query client tests

**Types & Schemas:**
- `oci-genai-provider/src/types.ts`: Provider config types
- `agent-state/src/types.ts`: Session/turn/message types (Zod schemas)
- `oci-genai-provider/src/shared/schemas/`: Validation schemas

## Naming Conventions

**Files:**
- Classes: PascalCase with suffix (e.g., `OCILanguageModel.ts`, `WebSocketAdapter.ts`)
- Utilities: camelCase with descriptive name (e.g., `sse-parser.ts`, `retry.ts`)
- Hooks: camelCase with `use` prefix (e.g., `useAgentLoop.ts`, `useLLMStream.ts`)
- Stores: camelCase with `-store` suffix (e.g., `agent-store.ts`, `chat-store.ts`)
- Tests: `*.test.ts` or `*.spec.ts` suffix
- Index files: `index.ts` for barrel exports

**Directories:**
- Feature domains: lowercase with hyphens (e.g., `language-models/`, `realtime/`)
- Component categories: lowercase with hyphens (e.g., `layout/`, `panels/`, `shared/`)
- Test directories: `__tests__/` (double underscore convention)

**Exports:**
- Named exports for utilities and functions
- Default export for classes (when singleton)
- Type exports prefixed with `type` keyword
- Barrel files re-export from `index.ts`

## Where to Add New Code

**New Language Model Support:**
- Model class: `oci-genai-provider/src/language-models/` (new file)
- Add to registry: `oci-genai-provider/src/language-models/registry.ts`
- Converters: `oci-genai-provider/src/language-models/converters/` (if new API format)
- Tests: `oci-genai-provider/src/language-models/__tests__/`

**New Application Feature (TUI):**
- Component: `tui-agent/src/components/[category]/NewFeature.tsx`
- Hook: `tui-agent/src/hooks/useNewFeature.ts`
- Service logic: `tui-agent/src/services/new-feature.ts` (if complex)
- Tests: `tui-agent/src/__tests__/[feature].test.ts`

**New Application Feature (Web):**
- Route handler: `oci-ai-chat/src/routes/api/[resource]/+server.ts`
- Component: `oci-ai-chat/src/lib/components/NewComponent.svelte`
- Utilities: `oci-ai-chat/src/lib/[category]/util.ts`
- Server logic: `oci-ai-chat/src/lib/server/new-feature.ts`

**New Error Type:**
- Add to: `oci-genai-provider/src/shared/errors/index.ts`
- Update error handler: Add case to `handleOCIError()`
- Export from: `oci-genai-provider/src/index.ts`

**New Utility/Helper:**
- Shared across packages: `oci-genai-provider/src/shared/utils/`
- Package-specific: `[package]/src/lib/utils/` or `[package]/src/services/`

**New Validation Schema:**
- Add to: `oci-genai-provider/src/shared/schemas/` or package-specific location
- Use Zod for runtime validation
- Export both schema and inferred type

## Special Directories

**oci-genai-provider/src/__tests__/:**
- Purpose: Provider test suite
- Generated: No
- Committed: Yes
- Contains: Unit tests, mocks, fixtures, integration tests, setup utilities

**oci-genai-provider/coverage/:**
- Purpose: Test coverage reports
- Generated: Yes (by Jest)
- Committed: No (in .gitignore)
- Command: `pnpm test --coverage`

**tui-agent/src/__tests__/ (if added):**
- Purpose: TUI component and hook tests
- Generated: No
- Committed: Yes
- Pattern: Co-locate with source or in `__tests__/` subdirectory

**agent-state/src/__tests__/:**
- Purpose: Repository and schema tests
- Generated: No
- Committed: Yes
- Contains: Fixtures for SQLite test database, transaction tests

**.turbo/:**
- Purpose: Turborepo cache
- Generated: Yes
- Committed: No
- Delete safely with `pnpm turbo prune`

**dist/, build/, .svelte-kit/, .next/:**
- Purpose: Build output directories
- Generated: Yes
- Committed: No
- Create by: `pnpm build` or dev servers

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by pnpm)
- Committed: No
- Install with: `pnpm install`

---

*Structure analysis: 2026-02-03*
