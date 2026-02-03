# FSI AI Demo Suite

## What This Is

A collection of five production-quality AI demos showcasing OCI Generative AI capabilities for Financial Services Industry use cases. Each demo targets a specific FSI pain point and is designed to be shown to customer prospects (banks, insurance companies, investment firms). Built on the existing OCI GenAI provider and TanStack Query infrastructure.

## Core Value

FSI prospects can see concrete, production-ready examples of how OCI GenAI solves real compliance, risk, and operational challenges in their industry—not generic chatbots, but purpose-built solutions addressing their exact pain points.

## Requirements

### Validated

<!-- Existing capabilities proven and working -->

- ✓ **OCI GenAI Provider** - Complete Vercel AI SDK implementation supporting language models, embeddings, speech, transcription, reranking — existing
- ✓ **Web UI Foundations** - SvelteKit (oci-ai-chat) and Next.js (nextjs-chatbot) chat interfaces with session persistence — existing
- ✓ **TanStack Query Base** - Centralized data fetching with query key factories, fetch functions, caching — existing (`oci-genai-query`)
- ✓ **State Management** - SQLite-based session/turn persistence via agent-state package — existing
- ✓ **Authentication** - OCI credential resolution (config file, instance principal, resource principal) — existing

### Active

<!-- Building toward these for the demo suite -->

**Demo 1: EU Regulatory Q&A Assistant (Primary Focus)**
- [ ] User can ask natural language questions about EU financial regulations
- [ ] System answers with accurate text + citations to specific regulatory sections
- [ ] System indicates confidence level for each answer
- [ ] System suggests related requirements proactively
- [ ] Pre-loaded knowledge base covers MiFID II, CRR/CRD IV, GDPR (FSI aspects), EBA Guidelines
- [ ] Web UI delivers responses in under 3 seconds
- [ ] 5-10 curated question-answer pairs work reliably for demos
- [ ] Professional FSI-appropriate UI design

**Demo 2: Real-Time Credit Risk Assessment**
- [ ] Loan officer can speak naturally to query credit data
- [ ] System transcribes speech and converts to SQL queries (NL2SQL)
- [ ] System executes queries against sample credit database
- [ ] Results returned in natural language with risk indicators

**Demo 3: Insurance Claims Document Processor**
- [ ] User can upload insurance claim documents (forms, receipts, medical records)
- [ ] System extracts structured data using OCI Document Understanding
- [ ] System categorizes and flags items requiring manual review
- [ ] Extracted data populates claim processing dashboard

**Demo 4: Financial Advisor Knowledge Assistant**
- [ ] Wealth manager can query product information, compliance rules, client history
- [ ] Multiple specialized agents coordinate via A2A protocol
- [ ] System provides comprehensive answers spanning multiple knowledge domains
- [ ] Citations link to internal knowledge base sources

**Demo 5: Fraud Detection Alert Triage**
- [ ] Fraud analyst can query historical fraud cases semantically
- [ ] System summarizes and prioritizes fraud alerts using sentiment analysis
- [ ] Vector search finds similar past cases
- [ ] Dashboard shows alert prioritization and recommended actions

### Out of Scope

- **Multi-tenancy** — Single-tenant demo environment only; production multi-tenancy is future work
- **Document upload for regulatory Q&A** — Pre-loaded docs only for v1; upload capability deferred to v2
- **Production deployment** — Demos run in controlled demo environment; production hardening out of scope
- **Multi-language support** — English only; EU language variants (French, German, etc.) deferred
- **Mobile interfaces** — Desktop web only; mobile optimization not required for customer demos
- **Real customer data integration** — Synthetic/sample data only; no real FSI data connections

## Context

**Existing Codebase:**
- Monorepo with 14+ packages (pnpm workspaces)
- Complete OCI GenAI provider implementing Vercel AI SDK v3 spec
- Web UIs: SvelteKit (`oci-ai-chat`), Next.js (`nextjs-chatbot`), TUI (`tui-agent`)
- TanStack Query infrastructure for data fetching (`oci-genai-query`)
- SQLite persistence for sessions (`agent-state`)
- TypeScript throughout, testing with Jest/Vitest

**FSI Demo Requirements:**
- Target audience: Compliance officers, risk managers, fraud analysts, wealth advisors at EU banks/insurers
- Goal: Show OCI GenAI solving real FSI problems, not generic capabilities
- Quality bar: Customer-facing polish, not proof-of-concept
- Use Oracle's AI solutions as reference patterns (RAG agents, vector search, NL2SQL, document understanding)

**Oracle AI Solutions Referenced:**
- Build a Multiagent RAG system with A2A Protocol (Demo 4 pattern)
- Use OCI Generative AI Agents with RAG (Demo 1 core)
- Speak with AI About Your Data Using Real-Time Speech Transcription (Demo 2 pattern)
- Build with AI Vector Search in Oracle AI Database (Demo 5 pattern)

## Constraints

- **Tech Stack**: Must use existing OCI GenAI provider, TanStack Query base, and SvelteKit/Next.js UIs — No new frameworks
- **Timeline**: Prioritize Demo 1 (Regulatory Q&A) first, others follow in roadmap order
- **Data**: Synthetic/curated data only — No real customer data or production databases
- **Deployment**: Demo environment only — Not production-hardened
- **Models**: Use OCI GenAI service models only — No external LLM providers
- **Regulations**: EU focus (MiFID II, CRR/CRD IV, GDPR, EBA) — No US regulations in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Start with Regulatory Q&A | Compliance is universal FSI pain point; RAG agents are proven pattern | — Pending |
| Pre-loaded docs only (v1) | Simplifies demo, focuses on Q&A experience vs document management | — Pending |
| TanStack Query foundation | Leverage existing `oci-genai-query` infrastructure for consistency | — Pending |
| Web UI primary interface | SvelteKit/Next.js more customer-friendly than TUI for FSI prospects | — Pending |
| EU regulations focus | Oracle has strong EU FSI presence; avoids US regulatory complexity | — Pending |
| 5 demos in roadmap | Comprehensive showcase across FSI use cases (compliance, risk, ops, advisory, fraud) | — Pending |

---
*Last updated: 2026-02-03 after initialization*
