# Architecture Research: FSI AI Demo Suite

**Domain:** Financial Services AI Demos on OCI GenAI
**Researched:** 2026-02-03
**Confidence:** HIGH (based on existing codebase analysis + verified OCI documentation)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  EU Regulatory   │  │  Credit Risk     │  │  Insurance       │          │
│  │  Q&A UI          │  │  Assessment UI   │  │  Claims UI       │          │
│  │  (SvelteKit)     │  │  (SvelteKit)     │  │  (SvelteKit)     │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│  ┌──────────────────┐  ┌──────────────────┐                                │
│  │  Financial       │  │  Fraud Detection │                                │
│  │  Advisor UI      │  │  Dashboard       │                                │
│  │  (SvelteKit)     │  │  (SvelteKit)     │                                │
│  └────────┬─────────┘  └────────┬─────────┘                                │
│           │                     │                                           │
├───────────┴─────────────────────┴───────────────────────────────────────────┤
│                        DEMO SERVICES LAYER (NEW)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Demo Shared Library                             │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │ RAG Utils  │ │ Vector     │ │ Document   │ │ Agent      │       │   │
│  │  │ (Citations,│ │ Search     │ │ Processing │ │ Coordination│      │   │
│  │  │ Chunking)  │ │ Helpers    │ │ Utils      │ │ (A2A)      │       │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                    │
│  │ Regulatory    │ │ NL2SQL        │ │ Document      │                    │
│  │ RAG Agent     │ │ Agent         │ │ Understanding │                    │
│  │               │ │               │ │ Agent         │                    │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘                    │
│          │                 │                 │                             │
│  ┌───────────────┐ ┌───────────────┐                                      │
│  │ Multi-Agent   │ │ Fraud         │                                      │
│  │ Coordinator   │ │ Analysis      │                                      │
│  │ (A2A)         │ │ Agent         │                                      │
│  └───────┬───────┘ └───────┬───────┘                                      │
│          │                 │                                               │
├──────────┴─────────────────┴───────────────────────────────────────────────┤
│                        EXISTING INFRASTRUCTURE (DO NOT MODIFY)              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      oci-genai-query (TanStack Query)               │   │
│  │  [queryKeys] [fetchModels] [fetchSessions] [sessionOptions]         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      agent-state (SQLite Persistence)               │   │
│  │  [Sessions] [Turns] [Messages] [ToolCalls]                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      oci-genai-provider (Vercel AI SDK)             │   │
│  │  [LanguageModel] [Embeddings] [Speech] [Transcription] [Reranking]  │   │
│  │  [RealtimeTranscription]                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        OCI SERVICES LAYER                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ GenAI        │ │ AI Vector    │ │ Document     │ │ Speech       │      │
│  │ Service      │ │ Search       │ │ Understanding│ │ Service      │      │
│  │ (Cohere,     │ │ (DB 23ai)    │ │ API          │ │ (STT/TTS)    │      │
│  │ Llama, etc.) │ │              │ │              │ │              │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│  ┌──────────────┐ ┌──────────────┐                                        │
│  │ Object       │ │ Autonomous   │                                        │
│  │ Storage      │ │ Database     │                                        │
│  └──────────────┘ └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Demo UIs** | User-facing interfaces for each FSI demo | SvelteKit apps extending `oci-ai-chat` patterns |
| **Demo Shared Library** | Reusable utilities across demos | New `fsi-demo-utils` package |
| **RAG Agent** | Vector search + LLM generation with citations | Uses embeddings + languageModel from provider |
| **NL2SQL Agent** | Speech transcription + SQL generation | Uses realtimeTranscription + languageModel |
| **Document Agent** | Document parsing + extraction | OCI Document Understanding API integration |
| **Multi-Agent Coordinator** | A2A protocol orchestration | Implements Google A2A spec |
| **Fraud Analysis Agent** | Semantic search + sentiment analysis | Vector search + languageModel |
| **oci-genai-provider** | Core AI model access (EXISTING) | DO NOT MODIFY |
| **agent-state** | Session/turn persistence (EXISTING) | DO NOT MODIFY |
| **oci-genai-query** | TanStack Query integration (EXISTING) | DO NOT MODIFY |

## Recommended Project Structure

```
oci-genai-examples/
├── .planning/
│   └── research/
│       └── ARCHITECTURE.md          # This document
│
├── packages/                        # New directory for shared packages
│   └── fsi-demo-utils/              # NEW: Shared FSI demo utilities
│       ├── src/
│       │   ├── rag/
│       │   │   ├── chunking.ts      # Document chunking utilities
│       │   │   ├── citations.ts     # Citation extraction & formatting
│       │   │   └── index.ts
│       │   ├── vector/
│       │   │   ├── search.ts        # Vector search helpers
│       │   │   ├── similarity.ts    # Cosine similarity, etc.
│       │   │   └── index.ts
│       │   ├── agents/
│       │   │   ├── a2a-client.ts    # A2A protocol client
│       │   │   ├── agent-card.ts    # Agent capability cards
│       │   │   └── index.ts
│       │   ├── nl2sql/
│       │   │   ├── schema-context.ts # DB schema context building
│       │   │   ├── query-builder.ts  # SQL query construction
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── demos/                           # NEW: FSI demo applications
│   ├── regulatory-qa/               # Demo 1: EU Regulatory Q&A
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── api/
│   │   │   │       └── chat/+server.ts
│   │   │   ├── lib/
│   │   │   │   ├── knowledge/       # Pre-loaded regulatory docs
│   │   │   │   ├── agents/          # RAG agent implementation
│   │   │   │   └── components/      # Demo-specific UI
│   │   │   └── app.css
│   │   └── package.json
│   │
│   ├── credit-risk/                 # Demo 2: Credit Risk Assessment
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── api/
│   │   │   │       ├── transcribe/+server.ts
│   │   │   │       └── query/+server.ts
│   │   │   ├── lib/
│   │   │   │   ├── nl2sql/          # NL2SQL implementation
│   │   │   │   ├── database/        # Sample credit data
│   │   │   │   └── components/
│   │   │   └── app.css
│   │   └── package.json
│   │
│   ├── insurance-claims/            # Demo 3: Insurance Claims
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── api/
│   │   │   │       ├── upload/+server.ts
│   │   │   │       └── extract/+server.ts
│   │   │   ├── lib/
│   │   │   │   ├── document/        # Document Understanding integration
│   │   │   │   └── components/
│   │   │   └── app.css
│   │   └── package.json
│   │
│   ├── financial-advisor/           # Demo 4: Financial Advisor
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── api/
│   │   │   │       └── advisor/+server.ts
│   │   │   ├── lib/
│   │   │   │   ├── agents/          # Specialized sub-agents
│   │   │   │   │   ├── product-agent.ts
│   │   │   │   │   ├── compliance-agent.ts
│   │   │   │   │   └── history-agent.ts
│   │   │   │   ├── coordinator/     # A2A orchestration
│   │   │   │   └── components/
│   │   │   └── app.css
│   │   └── package.json
│   │
│   └── fraud-detection/             # Demo 5: Fraud Detection
│       ├── src/
│       │   ├── routes/
│       │   │   ├── +page.svelte
│       │   │   └── api/
│       │   │       ├── search/+server.ts
│       │   │       └── prioritize/+server.ts
│       │   ├── lib/
│       │   │   ├── vector-search/   # Semantic fraud case search
│       │   │   ├── sentiment/       # Sentiment analysis
│       │   │   └── components/
│       │   └── app.css
│       └── package.json
│
├── agent-state/                     # EXISTING: Session persistence
├── oci-genai-provider/              # EXISTING: AI SDK provider
├── oci-genai-query/                 # EXISTING: TanStack Query
├── oci-ai-chat/                     # EXISTING: Base SvelteKit chat
├── kyc-intelligence/                # EXISTING: KYC demo (pattern reference)
└── pnpm-workspace.yaml              # Add new packages/demos
```

### Structure Rationale

- **packages/fsi-demo-utils/:** Shared utilities prevent code duplication across demos; follows monorepo best practices
- **demos/:** Separate from existing examples to maintain clear boundaries; each demo is independently deployable
- **lib/agents/ in each demo:** Demo-specific agent logic stays close to the UI that uses it
- **lib/knowledge/ in regulatory-qa/:** Pre-loaded document embeddings for demo reliability

## Architectural Patterns

### Pattern 1: Layered Extension (Core Immutability)

**What:** Demos extend existing infrastructure through composition, never modification
**When to use:** Always - this is the primary constraint
**Trade-offs:** May require wrapper code; ensures upgradability of core packages

**Example:**
```typescript
// demos/regulatory-qa/src/routes/api/chat/+server.ts
import { createOCI } from '@acedergren/oci-genai-provider';
import { getRepository } from '@acedergren/agent-state';
import { buildRAGContext, extractCitations } from '@acedergren/fsi-demo-utils/rag';

// Wrap existing provider with RAG capabilities
export const POST: RequestHandler = async ({ request }) => {
  const oci = createOCI();
  const repository = getRepository();

  // Demo-specific RAG logic
  const relevantDocs = await vectorSearch(query);
  const context = buildRAGContext(relevantDocs);

  const result = await streamText({
    model: oci.languageModel('cohere.command-r-plus'),
    messages: [{ role: 'system', content: context }, ...messages],
  });

  // Extract citations from response
  const citations = extractCitations(result.text, relevantDocs);

  // Persist using existing agent-state
  repository.updateTurn(turnId, { assistantResponse: result.text });

  return result.toUIMessageStreamResponse();
};
```

### Pattern 2: Agent Card Pattern (A2A Protocol)

**What:** Each specialized agent publishes its capabilities via JSON-LD agent card
**When to use:** Demo 4 (Financial Advisor) with multi-agent coordination
**Trade-offs:** Added complexity; enables true agent interoperability

**Example:**
```typescript
// packages/fsi-demo-utils/src/agents/agent-card.ts
export interface AgentCard {
  "@context": "https://a2a-protocol.org/latest/context.json";
  "@type": "AgentCard";
  name: string;
  description: string;
  capabilities: Capability[];
  inputModalities: ("text" | "audio" | "file")[];
  outputModalities: ("text" | "audio" | "file")[];
  endpoint: string;
}

// demos/financial-advisor/src/lib/agents/product-agent.ts
export const productAgentCard: AgentCard = {
  "@context": "https://a2a-protocol.org/latest/context.json",
  "@type": "AgentCard",
  name: "product-knowledge-agent",
  description: "Expert in financial products: mutual funds, ETFs, bonds",
  capabilities: ["product-lookup", "comparison", "risk-assessment"],
  inputModalities: ["text"],
  outputModalities: ["text"],
  endpoint: "/api/agents/product"
};
```

### Pattern 3: Pre-computed Embeddings (Demo Reliability)

**What:** Regulatory documents are embedded and indexed at build time, not runtime
**When to use:** Demo 1 (Regulatory Q&A) - critical for demo reliability
**Trade-offs:** Static knowledge base; eliminates runtime embedding failures

**Example:**
```typescript
// demos/regulatory-qa/scripts/embed-documents.ts
import { embedMany } from 'ai';
import { createOCI } from '@acedergren/oci-genai-provider';
import { chunkDocument } from '@acedergren/fsi-demo-utils/rag';

const oci = createOCI();
const embeddingModel = oci.embeddingModel('cohere.embed-multilingual-v3.0');

async function embedRegulations() {
  const docs = await loadRegulationDocs(); // MiFID II, CRR, GDPR

  for (const doc of docs) {
    const chunks = chunkDocument(doc, { maxTokens: 512, overlap: 50 });
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: chunks.map(c => c.text),
    });

    await saveToVectorStore(chunks, embeddings);
  }
}
```

## Data Flow

### Demo 1: EU Regulatory Q&A (RAG)

```
[User Question]
       ↓
[SvelteKit API Route]
       ↓
[Query Embedding] ← oci.embeddingModel('cohere.embed-multilingual-v3.0')
       ↓
[Vector Search] ← Pre-indexed regulatory docs (MiFID II, CRR, GDPR)
       ↓
[Context Assembly] ← Top-k relevant chunks + citations
       ↓
[LLM Generation] ← oci.languageModel('cohere.command-r-plus')
       ↓
[Citation Extraction] ← Map response to source documents
       ↓
[Streaming Response] → UI with answer + citations + confidence
```

### Demo 2: Credit Risk Assessment (Speech + NL2SQL)

```
[Voice Input]
       ↓
[Realtime Transcription] ← oci.realtimeTranscription()
       ↓
[Transcribed Text]
       ↓
[NL2SQL Agent] ← oci.languageModel() + schema context
       ↓
[SQL Query Generation]
       ↓
[Query Execution] → SQLite credit database
       ↓
[Result Interpretation] ← oci.languageModel()
       ↓
[Natural Language Response] → UI with risk indicators
```

### Demo 3: Insurance Claims (Document Understanding)

```
[Document Upload] (PDF, PNG, JPEG)
       ↓
[OCI Object Storage]
       ↓
[OCI Document Understanding API]
       ↓
[Extracted Data] (text, tables, key-values)
       ↓
[LLM Classification] ← oci.languageModel()
       ↓
[Flagging Logic] ← Business rules for manual review
       ↓
[Claim Dashboard Update] → UI with extracted data + flags
```

### Demo 4: Financial Advisor (Multi-Agent A2A)

```
[User Query]
       ↓
[Coordinator Agent] ← Parses intent, routes to specialists
       ↓
┌──────────┬──────────┬──────────┐
↓          ↓          ↓          ↓
[Product   [Compliance [Client   [Market
Agent]     Agent]      History]   Agent]
↓          ↓          ↓          ↓
└──────────┴──────────┴──────────┘
       ↓
[Response Aggregation] ← A2A message passing
       ↓
[Unified Response] → UI with comprehensive answer + citations
```

### Demo 5: Fraud Detection (Vector Search + Sentiment)

```
[Fraud Alert]
       ↓
[Alert Embedding] ← oci.embeddingModel()
       ↓
[Vector Search] ← Historical fraud cases
       ↓
[Similar Cases Retrieved]
       ↓
[Sentiment Analysis] ← oci.languageModel()
       ↓
[Priority Scoring] ← Business rules + ML signals
       ↓
[Alert Dashboard] → UI with prioritized alerts + similar cases
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Demo environment (1-10 users) | SQLite for vector storage; in-memory caching |
| Proof of concept (10-100 users) | Oracle 23ai for vector search; basic load balancing |
| Production pilot (100+ users) | OCI GenAI Agents service; dedicated vector DB; horizontal scaling |

### Scaling Priorities

1. **First bottleneck:** Vector search latency - Solution: Pre-compute common queries, increase reranking model usage
2. **Second bottleneck:** LLM rate limits - Solution: Implement request queuing, add retry with exponential backoff (already in provider)
3. **Third bottleneck:** Document processing throughput - Solution: Async processing queue with OCI Events + Functions

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying Core Packages

**What people do:** Edit `oci-genai-provider` or `agent-state` to add demo-specific logic
**Why it's wrong:** Breaks existing applications; creates upgrade path problems
**Do this instead:** Create wrapper functions in `fsi-demo-utils`; extend through composition

### Anti-Pattern 2: Tightly Coupled Demos

**What people do:** Demo 2 imports directly from Demo 1's internal modules
**Why it's wrong:** Prevents independent deployment; creates dependency nightmares
**Do this instead:** Extract shared logic to `fsi-demo-utils`; keep demos independent

### Anti-Pattern 3: Runtime Embedding for Static Content

**What people do:** Embed regulatory documents on every user query
**Why it's wrong:** Slow, expensive, and unreliable for demos
**Do this instead:** Pre-embed documents at build time; store in vector-optimized format

### Anti-Pattern 4: Monolithic Multi-Agent

**What people do:** Single large agent with all capabilities for Demo 4
**Why it's wrong:** Violates separation of concerns; hard to test and extend
**Do this instead:** Implement A2A protocol with specialized agents communicating via messages

### Anti-Pattern 5: Exposing Real Data Schemas

**What people do:** Connect NL2SQL to production database schemas
**Why it's wrong:** Security risk; data compliance violations
**Do this instead:** Use synthetic schemas and data designed for demos; clearly document limitations

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OCI GenAI Service | Via `oci-genai-provider` | All LLM calls go through existing provider |
| OCI Document Understanding | REST API + OCI SDK | New integration for Demo 3 |
| OCI Object Storage | For document uploads | Used by transcription and document understanding |
| OCI Speech Service | Via provider's `realtimeTranscription` | Demo 2 voice input |
| Oracle 23ai (optional) | For production vector search | Demo environment uses SQLite |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ API Routes | HTTP/WebSocket | Standard SvelteKit patterns |
| Demo ↔ fsi-demo-utils | TypeScript imports | Monorepo package references |
| Demo ↔ agent-state | TypeScript imports | Read-only access preferred |
| Demo ↔ oci-genai-provider | TypeScript imports | Use public API only |
| Agent ↔ Agent (Demo 4) | A2A Protocol (HTTP/JSON) | Async message passing |

## Build Order (Demo Dependencies)

```
Phase 1: Foundation
└─ fsi-demo-utils (shared utilities)
   └─ No demo dependencies; enables all demos

Phase 2: RAG Core (Demo 1)
└─ regulatory-qa
   └─ Dependencies: fsi-demo-utils (rag/, vector/)
   └─ Validates: Embedding pipeline, citation extraction, RAG patterns

Phase 3: Speech + SQL (Demo 2)
└─ credit-risk
   └─ Dependencies: fsi-demo-utils (nl2sql/)
   └─ Validates: Realtime transcription, NL2SQL, result interpretation

Phase 4: Document Processing (Demo 3)
└─ insurance-claims
   └─ Dependencies: fsi-demo-utils (minimal)
   └─ Validates: OCI Document Understanding integration, extraction pipeline

Phase 5: Multi-Agent (Demo 4)
└─ financial-advisor
   └─ Dependencies: fsi-demo-utils (agents/, rag/, vector/)
   └─ Validates: A2A protocol, agent coordination, response aggregation

Phase 6: Vector Search + Sentiment (Demo 5)
└─ fraud-detection
   └─ Dependencies: fsi-demo-utils (vector/)
   └─ Validates: Semantic search, sentiment analysis, alert prioritization
```

### Dependency Rationale

1. **fsi-demo-utils first:** All demos depend on shared utilities
2. **Demo 1 second:** Establishes RAG patterns used by Demo 4 and Demo 5
3. **Demo 2 third:** Independent of RAG; tests speech pipeline
4. **Demo 3 fourth:** Independent of other demos; OCI API integration
5. **Demo 4 fifth:** Most complex; depends on RAG patterns from Demo 1
6. **Demo 5 sixth:** Uses vector patterns from Demo 1; sentiment is additive

## Security Boundaries for FSI Data

### Data Classification

| Data Type | Classification | Handling |
|-----------|---------------|----------|
| Regulatory documents | Public | Can be embedded and stored |
| Sample credit data | Synthetic | Clearly labeled; no PII |
| Insurance claim samples | Synthetic | Generated data only |
| Financial product info | Public | Official documentation |
| Fraud case samples | Synthetic | Anonymized patterns |

### Compliance Considerations

| Regulation | Applicability | Mitigation |
|------------|---------------|------------|
| GDPR | All demos | No real user data; synthetic only |
| MiFID II | Demo 4 (advisory) | Disclaimers; not real advice |
| EU AI Act | All demos | Transparency about AI usage |
| Data residency | All demos | OCI EU regions (Frankfurt) |

### Security Controls

1. **Input validation:** All user inputs sanitized before LLM processing
2. **Output filtering:** Sensitive patterns (account numbers, SSN) blocked
3. **Audit logging:** All LLM calls logged via agent-state
4. **Rate limiting:** Inherited from OCI GenAI service
5. **Access control:** Demo environment isolation; no production data access

## Sources

- [OCI Generative AI Agents RAG Service](https://blogs.oracle.com/ai-and-datascience/oci-generative-ai-agents-rag-service) - HIGH confidence
- [Building Multi-Agent AI on OCI](https://blogs.oracle.com/developers/agentic-rag-enterprisescale-multiagent-ai-system-on-oracle-cloud-infrastructure) - HIGH confidence
- [Vercel AI SDK 6 Documentation](https://sdk.vercel.ai/docs/foundations/agents) - HIGH confidence
- [Google A2A Protocol](https://a2a-protocol.org/latest/) - HIGH confidence
- [Oracle AI Vector Search](https://www.oracle.com/database/ai-vector-search/) - HIGH confidence
- [OCI Document Understanding](https://docs.oracle.com/en-us/iaas/Content/document-understanding/using/home.htm) - HIGH confidence
- [NL2SQL System Design Guide 2025](https://medium.com/@adityamahakali/nl2sql-system-design-guide-2025-c517a00ae34d) - MEDIUM confidence
- [GDPR Compliance for AI Chatbots](https://quickchat.ai/post/gdpr-compliant-chatbot-guide) - MEDIUM confidence

---
*Architecture research for: FSI AI Demo Suite*
*Researched: 2026-02-03*
