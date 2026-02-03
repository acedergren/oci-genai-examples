# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- TypeScript 5.7-5.9 - Used across all packages for type safety and development
- JavaScript (ES2020+) - Target for compiled output and CLI tools
- TSX (TypeScript JSX) - React components in tui-agent and CLI applications

**Secondary:**
- Svelte - oci-ai-chat frontend framework (SvelteKit 2.50.1+)
- SQL - SQLite database schemas in agent-state

## Runtime

**Environment:**
- Node.js >= 18.0.0 (primary runtime)
- Bun >= 1.2.0 (tui-agent, alternative/faster runtime)
- Browser (Web applications via Vite/Next.js/SvelteKit)

**Package Manager:**
- pnpm >= 8.0.0
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Vercel AI SDK (ai 5.0.0 || 6.0.0) - AI SDK for chat, completion, and streaming
  - `@ai-sdk/provider` 3.0.5+ - Provider interface implementation
  - `@ai-sdk/provider-utils` 4.0.10+ - Provider utilities
  - `@ai-sdk/svelte` 4.0.64+ - Svelte integration for oci-ai-chat
  - `@ai-sdk/react` 3.0.59+ - React integration for nextjs-chatbot

**UI Frameworks:**
- React 19.1.0+ - TUI (tui-agent), CLI tools, Next.js apps
- Svelte 5.49.1+ - Web UI for oci-ai-chat
- OpenTUI 0.1.74+ - Terminal UI components (@opentui/core, @opentui/react)
- Next.js 16.1.6+ - nextjs-chatbot full-stack application
- SvelteKit 2.50.1+ - Framework for oci-ai-chat (SSR, routing, SSG)

**Build & Development:**
- Vite 6.4.1 - Bundler for oci-ai-chat (esm, fast HMR)
- tsup 8.3.7+ - TypeScript bundler for library packages
- Bun - Build system for tui-agent (`bun build`, `bun run`)
- TailwindCSS 4.0.0+ - Styling (nextjs-chatbot, oci-ai-chat)
- PostCSS 8.5.6 - CSS processing

**Testing:**
- Jest 30.2.0 - Unit testing (oci-genai-provider)
- Vitest 2.1.9+ - Lightweight test runner (agent-state, oci-genai-query, oci-ai-chat)
- ts-jest 29.4.6 - Jest TypeScript support

**Database:**
- better-sqlite3 12.6.2+ - Embedded SQLite for agent state persistence
- WAL mode enabled for concurrent access

## Key Dependencies

**Critical:**
- oci-generativeaiinference 2.94.0 - OCI GenAI inference API client
- oci-aispeech 2.94.0 - OCI speech/transcription services
- oci-objectstorage 2.94.0 - Object storage for audio/document uploads
- oci-identity 2.94.0 - OCI Identity and Access Management
- oci-common 2.94.0 - Common OCI SDK utilities and auth

**Data & State Management:**
- Zod 3.25.76-4.3.6 - Schema validation and type inference
- Zustand 5.0.0+ - Client state management (tui-agent)
- @tanstack/query-core 5.66.4 - Request deduplication and caching (oci-genai-query)
- @tanstack/svelte-query 5.66.4 - TanStack Query for Svelte (oci-ai-chat)

**Utilities:**
- eventsource-parser 3.0.0 - SSE parsing for streaming responses
- uuid 13.0.0 - UUID generation for sessions/requests
- chalk 5.6.2 - Terminal color output (CLI tools)
- commander 12.1.0+ - CLI argument parsing
- inquirer 13.2.2 - Interactive CLI prompts

**Infrastructure:**
- oci-core 2.124.0+ - OCI compute and networking (tui-agent)
- oci-database 2.124.0+ - OCI database services (tui-agent)
- oci-monitoring 2.124.0+ - OCI monitoring integration (tui-agent)
- oci-networkloadbalancer 2.124.0+ - OCI NLB client (tui-agent)
- pino 10.3.0+ - Structured logging (CLI tools)

## Configuration

**Environment Variables:**

**OCI Configuration:**
- `OCI_REGION` - OCI region (default: eu-frankfurt-1)
- `OCI_COMPARTMENT_ID` - Target compartment OCID (required for inference)
- `OCI_CONFIG_PROFILE` - Config profile name (default: DEFAULT)
- `OCI_CONFIG_PATH` - Path to OCI config file (default: ~/.oci/config)

**Database:**
- `AGENT_STATE_DB_PATH` - SQLite database location (default: ~/.oci-provider-examples/agent-state.db)

**Build:**
- `NODE_ENV` - Environment (development, production, test)
- `CI` - Set during CI/CD runs (affects Jest bail behavior)

**Authentication Methods:**
- config_file - API key from ~/.oci/config (default)
- instance_principal - OCI Compute instance IAM
- resource_principal - OCI Functions/Container Instances IAM

**Build Configuration Files:**
- `tsconfig.json` - TypeScript compilation (ES2020 target, strict mode)
- `jest.config.js` - Jest test configuration (ts-jest preset, 80% coverage threshold)
- `bun.toml` (implicit) - Bun configuration for tui-agent
- `next.config.js` - Next.js configuration (implicit)
- `svelte.config.js` - SvelteKit configuration (implicit)

## Platform Requirements

**Development:**
- Node.js 18+ or Bun 1.2+
- Git for version control
- pnpm 8+ for package management
- POSIX environment (Unix/Linux/macOS)

**Production:**
- OCI Tenancy with Generative AI access
- OCI credentials (config file, instance principal, or resource principal)
- Network access to OCI API endpoints
- Object Storage bucket for audio uploads (speech/transcription)
- Minimum: 512MB RAM for agent-state SQLite persistence

**Deployment Targets:**
- Node.js 18+ servers (Next.js, SvelteKit SSR)
- OCI Compute instances (with instance principal auth)
- OCI Container Instances / Functions (with resource principal auth)
- Docker-containerized applications
- CLI tool: Standalone bun binary or node.js script
- TUI agent: Bun runtime (native binary via `bun build --compile`)

---

*Stack analysis: 2026-02-03*
