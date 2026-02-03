# Stack Research

**Domain:** FSI AI Demo Suite - Stack Additions
**Researched:** 2026-02-03
**Confidence:** HIGH

## Context: Brownfield Addition

This research covers stack **additions** to the existing OCI GenAI provider infrastructure. The following are already in place and NOT re-researched:

- OCI GenAI provider (`@acedergren/oci-genai-provider`) - Vercel AI SDK v6 ProviderV3 implementation
- Web UIs: SvelteKit 5, Next.js 15
- TanStack Query for data fetching
- SQLite (better-sqlite3) + Drizzle ORM for persistence
- TypeScript monorepo with pnpm workspaces

## Recommended Stack Additions

### OCI Services (Required)

| Service | Version/Release | Purpose | Why Recommended |
|---------|-----------------|---------|-----------------|
| OCI Generative AI Agents | GA (Sept 2024+) | RAG agents, tool orchestration, multiagent coordination | Native RAG with managed knowledge bases; SQL Tool for NL2SQL; Function Calling for custom tools; Agent-as-Tool for multiagent patterns |
| OCI Document Understanding | GA | Insurance claims processing, document extraction | OCR, table extraction, key-value extraction for insurance documents; supports custom models for FSI-specific forms |
| OCI Speech | GA | Real-time transcription for credit risk demo | Realtime websocket API already integrated in provider; supports 8kHz/16kHz telephony-grade audio |
| OCI AI Language | GA | Sentiment analysis for fraud detection triage | Aspect-based sentiment, PII detection, named entity recognition; supports batch processing |
| OCI Search with OpenSearch | v2.15 | Vector search for fraud detection, RAG knowledge bases | Native GenAI Agents integration; supports hybrid search (vector + keyword) |
| Oracle Database 23ai/26ai | 23ai (GA) / 26ai (Jan 2026) | Vector search, Select AI for NL2SQL | Native VECTOR data type; Select AI for natural language to SQL; can serve as alternative to OpenSearch |

### Database Options by Demo

| Demo | Recommended DB | Alternative | Rationale |
|------|----------------|-------------|-----------|
| EU Regulatory Q&A | OCI OpenSearch v2.15 | Oracle DB 23ai | OpenSearch for document-heavy RAG; native GenAI Agents integration |
| Real-Time Credit Risk | SQLite (existing) + Select AI | Oracle DB 23ai | Select AI provides NL2SQL without custom implementation; SQLite sufficient for demo scale |
| Insurance Claims | OCI Object Storage | Oracle DB 23ai | Document Understanding outputs to Object Storage; metadata can use existing SQLite |
| Financial Advisor | OCI OpenSearch v2.15 | Oracle DB 23ai | Multi-source RAG requires scalable vector search |
| Fraud Detection | Oracle DB 23ai | OCI OpenSearch | Prefer Oracle DB for hybrid queries combining vector similarity with structured fraud rules |

### NPM Packages to Add

| Package | Version | Purpose | Demo(s) |
|---------|---------|---------|---------|
| `oci-sdk` | ^2.122.2 | OCI TypeScript SDK (full bundle) | All demos (Agents, Document Understanding, Language) |
| `node-oracledb` | ^6.6.0 | Oracle DB 23ai with VECTOR support | Credit Risk (Select AI), Fraud Detection |
| `@opensearch-project/opensearch` | ^3.0.0 | OpenSearch client for vector operations | Regulatory Q&A, Financial Advisor |
| `@langchain/core` | ^0.3.x | Agent abstractions, tool definitions | Multiagent coordination (Financial Advisor) |
| `drizzle-orm` | ^0.38.0 | (Already in use) | Continue using for SQLite; add Oracle dialect if needed |
| `zod` | ^3.25.x | (Already in use) | Tool schema definitions |

### OCI SDK Modules (from oci-sdk umbrella)

| Module | Purpose | Demo(s) |
|--------|---------|---------|
| `oci-generativeaiagent` | GenAI Agents API | Regulatory Q&A, Financial Advisor |
| `oci-aidocument` | Document Understanding | Insurance Claims |
| `oci-ailanguage` | Sentiment analysis, NER | Fraud Detection |
| `oci-aivision` | (Optional) Image processing | Insurance Claims (if photo evidence needed) |
| `oci-objectstorage` | (Already integrated) | Document storage for all demos |
| `oci-opensearch` | OpenSearch cluster management | Regulatory Q&A setup |

### UI Libraries (Demo-Specific)

| Library | Version | Purpose | Demo(s) |
|---------|---------|---------|---------|
| `d3` | ^7.9.0 | (Already in fraud-analyst-agent) | Fraud Detection visualizations |
| `@tanstack/svelte-table` | ^9.0.0 | Data tables for regulatory results | Regulatory Q&A, Credit Risk |
| `svelte-markdown` | ^0.4.0 | Render RAG responses | All demos with long-form output |
| `bits-ui` | ^1.0.0 | Accessible UI primitives | Consistent FSI-grade UI |

## Installation

```bash
# OCI SDK (full bundle - includes all AI services)
pnpm add oci-sdk

# Or selective installation (smaller bundle)
pnpm add oci-common oci-generativeaiagent oci-aidocument oci-ailanguage

# Oracle Database driver (for Select AI / Vector Search)
pnpm add oracledb

# OpenSearch client
pnpm add @opensearch-project/opensearch

# LangChain core (for multiagent patterns)
pnpm add @langchain/core

# UI additions
pnpm add @tanstack/svelte-table svelte-markdown bits-ui
```

## Alternatives Considered

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| OCI GenAI Agents | LangChain.js RAG | Agents provide managed RAG with tool orchestration; LangChain.js lacks official OCI integration (Python only) |
| OCI OpenSearch | Pinecone/Weaviate | External vector DBs add latency and data residency concerns for FSI; OpenSearch is OCI-native |
| Oracle Select AI | Custom NL2SQL | Select AI is production-tested for Oracle DB; custom implementation adds maintenance burden |
| OCI Document Understanding | Textract/Azure Doc Intel | OCI-native maintains single cloud compliance; Document Understanding supports custom FSI models |
| OCI Speech (realtime) | Whisper self-hosted | Already integrated in provider; OCI Speech has enterprise SLA and telephony optimization |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `langchain-oci` (Python) | Python-only; doesn't fit TypeScript monorepo | OCI TypeScript SDK + Vercel AI SDK Agent class |
| LangChain.js `@langchain/community` OCI | No official OCI integration for JS/TS | OCI GenAI Agents API directly via oci-sdk |
| Chroma/FAISS in-memory vector stores | Not production-grade for FSI; no persistence guarantees | OCI OpenSearch or Oracle DB 23ai VECTOR |
| OpenAI Whisper API | External API; data residency concerns for FSI | OCI Speech (already integrated) |
| Generic SQL query builders for NL2SQL | Reinventing Select AI; security risks from generated SQL | Oracle Select AI with proper object_list restrictions |
| `ws` package for WebSocket | Provider already has WebSocketAdapter abstraction | Use existing realtime infrastructure |

## Stack Patterns by Demo

### Demo 1: EU Regulatory Q&A (RAG Agent)

```
OCI GenAI Agents (RAG Tool) → OCI OpenSearch (knowledge base) → OCI GenAI (Cohere Command R+)
```

**Key additions:**
- `oci-generativeaiagent` for agent orchestration
- `@opensearch-project/opensearch` for direct vector queries if needed
- Knowledge base: PDF/Markdown regulatory documents in Object Storage

### Demo 2: Real-Time Credit Risk (Speech + NL2SQL)

```
Browser Audio → OCI Speech Realtime (existing) → OCI GenAI Agents (SQL Tool) → Oracle Select AI → SQLite/Oracle DB
```

**Key additions:**
- `oracledb` for Select AI integration (if using Oracle DB)
- For SQLite demo: custom NL2SQL tool using existing provider
- Agent-orchestrated flow for multi-step credit assessment

### Demo 3: Insurance Claims Processor (Document Understanding)

```
Document Upload → OCI Document Understanding → Key-Value/Table Extraction → OCI GenAI (summary/decision)
```

**Key additions:**
- `oci-aidocument` for document processing
- Object Storage integration (already in provider)
- Custom extraction model training for insurance forms

### Demo 4: Financial Advisor (Multiagent RAG)

```
User Query → Orchestrator Agent → [Market Agent, Portfolio Agent, Compliance Agent] → Aggregated Response
```

**Key additions:**
- OCI GenAI Agents "Agent as Tool" pattern
- Multiple specialized knowledge bases in OpenSearch
- `@langchain/core` for complex orchestration logic if Agents API insufficient

### Demo 5: Fraud Detection Triage (Vector Search + Sentiment)

```
Transaction Data → OCI AI Language (sentiment) → Oracle DB 23ai (vector similarity) → Risk Score → UI
```

**Key additions:**
- `oci-ailanguage` for sentiment analysis
- `oracledb` with VECTOR operations
- Hybrid queries combining vector similarity + structured rules

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `ai@^6.0.0` | `@acedergren/oci-genai-provider@0.1.0` | Provider supports AI SDK v5 and v6 |
| `oci-sdk@^2.122.x` | `oci-common@^2.94.x` | SDK umbrella includes all modules |
| `oracledb@^6.6.0` | Oracle DB 23ai/26ai | Required for VECTOR type and Select AI |
| `@opensearch-project/opensearch@^3.0.0` | OCI OpenSearch v2.15 | Client compatible with managed service |
| `svelte@^5.0.0` | `@ai-sdk/svelte@^2.0.0` | Svelte 5 runes syntax |

## Integration Points with Existing Stack

### Provider Extensions

The existing OCI GenAI provider can be extended for:

1. **Agents API wrapper** - Add `oci.agent()` method returning Agent-compatible interface
2. **Document Understanding model** - Add `oci.documentModel()` for extraction
3. **Language service wrapper** - Add `oci.languageModel()` overload for sentiment

### Vercel AI SDK Integration

The AI SDK 6 Agent class integrates naturally:

```typescript
import { Agent } from 'ai';
import { oci } from '@acedergren/oci-genai-provider';

const regulatoryAgent = new Agent({
  model: oci.languageModel('cohere.command-r-plus'),
  tools: {
    searchRegulations: ociAgentRAGTool({ knowledgeBaseId: '...' }),
    searchPrecedents: ociAgentRAGTool({ knowledgeBaseId: '...' }),
  },
  instructions: 'You are an EU regulatory compliance assistant...',
});
```

### TanStack Query Integration

Existing query patterns work with new endpoints:

```typescript
// Regulatory Q&A
const { data } = useQuery({
  queryKey: ['regulatory', 'search', query],
  queryFn: () => fetchRegulatory(query),
});

// Document processing status
const { data } = useQuery({
  queryKey: ['documents', documentId, 'status'],
  queryFn: () => fetchDocumentStatus(documentId),
  refetchInterval: (data) => (data?.status === 'PROCESSING' ? 2000 : false),
});
```

## Security/Compliance Considerations for FSI

### Data Residency

- All OCI services support regional deployment
- OpenSearch clusters must be in same region as data
- Select AI queries stay within Oracle DB

### PII Handling

- OCI AI Language includes PII detection/redaction
- Configure Document Understanding to mask sensitive fields
- Synthetic data generation required for demos (Faker.js already in use)

### Audit Trail

- OCI GenAI Agents supports session logging
- All API calls logged via OCI Logging
- Maintain human-in-the-loop checkpoints for credit/claims decisions

### Access Control

- IAM policies per demo/knowledge base
- Select AI object_list restricts queryable tables
- API key rotation for demo deployments

## Synthetic Data Strategy

| Demo | Data Type | Generation Approach |
|------|-----------|---------------------|
| Regulatory Q&A | EU regulation documents | Public EUR-Lex documents (CC BY 4.0) |
| Credit Risk | Customer profiles, credit scores | Faker.js with realistic distributions |
| Insurance Claims | Claim forms, photos | Generated PDFs + stock images with synthetic data |
| Financial Advisor | Portfolio data, market history | Historical public data + Faker.js for PII |
| Fraud Detection | Transactions, alerts | Faker.js patterns matching fraud typologies |

## Sources

- [OCI Generative AI Agents Overview](https://docs.oracle.com/en-us/iaas/Content/generative-ai-agents/overview.htm) - HIGH confidence
- [OCI Document Understanding](https://docs.oracle.com/en-us/iaas/Content/document-understanding/using/home.htm) - HIGH confidence
- [OCI Speech Service](https://docs.oracle.com/en-us/iaas/Content/speech/using/speech.htm) - HIGH confidence
- [OCI AI Language](https://docs.oracle.com/en-us/iaas/Content/language/using/overview.htm) - HIGH confidence
- [OCI Search with OpenSearch v2.15](https://blogs.oracle.com/cloud-infrastructure/oci-search-with-opensearch-v215) - HIGH confidence
- [Oracle Database 23ai AI Vector Search](https://oracle-base.com/articles/23/ai-vector-search-23) - HIGH confidence
- [Oracle Select AI Users Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/) - HIGH confidence
- [node-oracledb 6.6 VECTOR support](https://medium.com/oracledevs/node-oracledb-6-6-brings-more-vector-and-configuration-capabilities-to-support-oracle-database-23ai-ee9ea88d5349) - HIGH confidence
- [Vercel AI SDK Agents Documentation](https://ai-sdk.dev/docs/foundations/agents) - HIGH confidence
- [OCI TypeScript SDK](https://github.com/oracle/oci-typescript-sdk) - HIGH confidence
- [FSI AI Compliance 2026](https://fintech.global/2026/01/08/ai-regulatory-compliance-priorities-financial-institutions-face-in-2026/) - MEDIUM confidence

---
*Stack research for: FSI AI Demo Suite Additions*
*Researched: 2026-02-03*
