# Project Research Summary

**Project:** FSI AI Demo Suite
**Domain:** Financial Services Industry AI Demonstrations on OCI GenAI
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

The FSI AI Demo Suite is not a typical AI application showcase—it operates under the strict regulatory regime of the EU AI Act (effective August 2026), GDPR, FINRA requirements, and SEC oversight. Five demos target specific FSI workflows: EU regulatory Q&A (RAG), real-time credit risk assessment (speech + NL2SQL), insurance claims processing (document understanding), financial advisor knowledge assistant (multi-agent), and fraud detection triage (vector search + sentiment analysis). Each demo must demonstrate production-readiness indicators: explainability, audit trails, human oversight, sub-3-second response times, and verifiable citations.

The recommended approach extends the existing OCI GenAI provider infrastructure through composition, not modification. Build on proven foundations: oci-genai-provider (Vercel AI SDK v6), agent-state (SQLite persistence), and oci-genai-query (TanStack Query). Add OCI services strategically: GenAI Agents for RAG orchestration, Document Understanding for claims processing, Speech Service for voice transcription (already integrated), and OpenSearch/Oracle 23ai for vector search. Create a shared fsi-demo-utils package for RAG utilities, vector search helpers, and A2A protocol clients to prevent code duplication across five demos.

The critical risk is hallucination in regulatory content. Research shows RAG systems from major providers still hallucinate 17-33% of responses, and 25% of citations don't support the answers they're attached to. For FSI demos, a single hallucinated MiFID II requirement destroys credibility with compliance officers. Mitigation requires mandatory citation verification using NLI models, confidence scoring with Bayesian RAG techniques, and pre-validated Q&A pairs for all demo scenarios. Build audit logging from day one—retrofitting is 3-5x harder, and FINRA's 2026 Report explicitly requires prompt/output logging for all compliance-related AI.

## Key Findings

### Recommended Stack

The stack is a brownfield extension of existing infrastructure. The oci-genai-provider already implements Vercel AI SDK v6 ProviderV3 with language models, embeddings, speech, transcription, and reranking. Web UIs use SvelteKit 5, TanStack Query handles data fetching, and SQLite + Drizzle ORM provides persistence. Do not modify these core packages—extend through composition and shared utilities.

**Core technologies to add:**
- **OCI GenAI Agents (GA Sept 2024+)**: Managed RAG with knowledge bases, SQL Tool for NL2SQL, Function Calling for custom tools, Agent-as-Tool for multi-agent patterns — eliminates custom RAG implementation burden while maintaining OCI-native compliance
- **OCI Document Understanding (GA)**: OCR, table extraction, key-value extraction for insurance documents — supports custom models for FSI-specific forms, maintains data residency
- **OCI OpenSearch v2.15**: Vector search for document-heavy RAG in regulatory Q&A and financial advisor demos — native GenAI Agents integration, hybrid search (vector + keyword)
- **Oracle Database 23ai/26ai**: Native VECTOR data type for fraud detection hybrid queries, Select AI for NL2SQL in credit risk demo — eliminates custom NL2SQL implementation
- **fsi-demo-utils package**: Shared RAG chunking/citations, vector search helpers, A2A protocol client, NL2SQL schema context — prevents duplication across five demos
- **oci-sdk ^2.122.x**: TypeScript SDK for GenAI Agents (oci-generativeaiagent), Document Understanding (oci-aidocument), Language Service (oci-ailanguage) — full bundle or selective installation
- **@langchain/core ^0.3.x**: Agent abstractions for multi-agent orchestration if Agents API insufficient — lightweight core package for complex coordination

Database strategy varies by demo: OpenSearch for document-heavy RAG (regulatory Q&A, financial advisor), SQLite + Select AI for credit risk NL2SQL, Oracle 23ai for fraud detection hybrid queries combining vector similarity with structured rules. UI additions include @tanstack/svelte-table for data grids, svelte-markdown for RAG responses, and bits-ui for accessible FSI-grade components.

### Expected Features

FSI AI demos in 2026 face fundamentally different expectations than general-purpose AI. The EU AI Act classifies credit scoring, fraud detection, and automated financial decisions as high-risk AI systems with requirements effective August 2, 2026. Table stakes center on regulatory compliance, not optional features.

**Must have (table stakes):**
- **Verifiable citations with source links** — EU AI Act Article 13 requires explainability; must cite "MiFID II Article 24(1)" not just "MiFID II"; compliance officers will verify citations
- **Confidence scoring per response** — FSI users must assess reliability; display percentage or qualitative indicator (HIGH/MEDIUM/LOW); known concern in regulated environments
- **Audit trail logging** — EU AI Act Article 12 mandates automatic, tamper-resistant logging for high-risk AI systems; log every query, response, source retrieval, user action with timestamps
- **Human-in-the-loop checkpoints** — GDPR Article 22 and EU AI Act require human intervention capability for automated decisions; clear "flag for review" and "override" buttons
- **Response time under 3 seconds** — Industry benchmark; production RAG systems achieve <2s; slower feels like a toy, makes demos unusable
- **Professional FSI-appropriate UI** — Compliance officers distrust consumer-style interfaces; muted colors, clear typography, data tables, no whimsical elements
- **Error handling with graceful degradation** — FSI users test edge cases; "crashed" demos destroy credibility; show meaningful error messages, not stack traces
- **Data residency visibility** — GDPR compliance requirement; display OCI region clearly, confirm no data leaves jurisdiction

**Should have (competitive differentiators):**
- **Inline regulatory cross-references** — Show which requirements relate to others (e.g., MiFID II vs GDPR overlap); unexpected value-add for compliance use cases
- **Real-time speech-to-query** — Demo 2 feature; loan officer speaks naturally, system transcribes and queries instantly; shows multimodal OCI capabilities
- **Explainable risk scoring with visual breakdown** — Show WHY the AI reached a risk assessment using SHAP/LIME; XAI is 2026 competitive edge for credit decisions
- **Multi-agent orchestration visibility** — Demo 4 feature; show agents collaborating in real-time; FSI prospects understand "specialist teams" metaphor
- **Semantic search across fraud cases** — Vector search demo; find similar historical fraud patterns by meaning, not keywords; shows OCI AI Vector Search
- **Document extraction with confidence heatmaps** — Demo 3 differentiator; visual showing which parts of scanned documents extracted with high/low confidence; builds trust

**Defer (v2+):**
- **Multi-agent orchestration (Demo 4)** — A2A protocol complexity requires stable single-agent first; defer until Demos 1-3 proven; 3-4 week effort
- **Fraud detection triage (Demo 5)** — Graph analytics and SAR narrative generation are high-complexity features; defer until infrastructure mature; 3-4 week effort
- **Multi-language support** — EU has many languages but translation errors create compliance risk; requires separate document corpora and validation; scope creep
- **Document upload for Demo 1** — Pre-loaded documents sufficient for v1; document management UI is significant scope addition

**Anti-features (things FSI prospects don't want):**
- **Chatbot-style persona/avatar** — Undermines professional credibility; compliance officers want tools, not assistants
- **Black-box risk scores** — EU AI Act requires explainability; unexplainable scores are compliance violations; always show contributing factors
- **Autonomous decisions without human trigger** — GDPR/EU AI Act mandate human oversight; autonomous FSI decisions are regulatory violations
- **LLM-powered search without retrieval** — Hallucination rates 30%+ without RAG; unacceptable for FSI; always ground in retrieved documents

### Architecture Approach

The architecture follows a layered extension pattern: demos extend existing infrastructure through composition, never modification. The constraint is core immutability—oci-genai-provider, agent-state, and oci-genai-query are brownfield assets that cannot be altered without breaking existing applications (oci-ai-chat, kyc-intelligence).

**Major components:**
1. **Demo Shared Library (fsi-demo-utils)** — Reusable utilities across five demos: RAG chunking/citations, vector search helpers, A2A protocol client, NL2SQL schema context; prevents code duplication; installed as monorepo package
2. **Demo-Specific Agents** — Each demo implements specialized agent logic: Regulatory RAG Agent (Demo 1), NL2SQL Agent (Demo 2), Document Understanding Agent (Demo 3), Multi-Agent Coordinator (Demo 4), Fraud Analysis Agent (Demo 5); agents use existing provider via composition
3. **Vector Store Infrastructure** — Pre-computed embeddings for regulatory documents (Demo 1), fraud case histories (Demo 5), knowledge bases (Demo 4); embeddings generated at build time, not runtime, for demo reliability; hybrid search (vector + BM25) mandatory
4. **Audit Logging Infrastructure** — Shared across all demos; logs every prompt, response, model version, user action to SQLite with structured JSON format; async logging to meet 3-second SLA; separate audit store from application logs
5. **SvelteKit Demo UIs** — Five independent demo applications in demos/ directory; extend oci-ai-chat patterns; demo-specific agents in lib/agents/; professional FSI-grade UI without whimsy

**Architectural patterns:**
- **Layered Extension (Core Immutability)**: Demos wrap existing provider with RAG capabilities; use agent-state for persistence; no modifications to core packages; ensures upgradability
- **Agent Card Pattern (A2A Protocol)**: Demo 4 implements Google A2A spec; each specialized agent publishes capabilities via JSON-LD; coordinator routes queries based on intent; enables true agent interoperability
- **Pre-computed Embeddings (Demo Reliability)**: Regulatory documents embedded and indexed at build time using oci.embeddingModel('cohere.embed-multilingual-v3.0'); eliminates runtime embedding failures during demos

**Data flow (Demo 1 example)**: User question → Query embedding (Cohere) → Vector search (pre-indexed regulatory docs) → Context assembly (top-k chunks + citations) → LLM generation (Cohere Command R+) → Citation extraction (map response to sources) → Streaming response with answer + citations + confidence

**Scaling considerations**: Demo environment (1-10 users) uses SQLite for vector storage with in-memory caching. Proof of concept (10-100 users) moves to Oracle 23ai for vector search. Production pilot (100+ users) uses OCI GenAI Agents service with dedicated vector DB and horizontal scaling. First bottleneck is vector search latency—mitigate with pre-computed common queries and reranking.

### Critical Pitfalls

The research identified eight critical pitfalls that cause demo failures, compliance issues, or project abandonment in FSI contexts. Each is mapped to specific demo phases.

1. **RAG Hallucination on Regulatory Content (Demo 1)** — RAG systems still hallucinate 17-33% of responses; single fabricated MiFID II requirement destroys credibility. **Prevention**: Implement citation verification with NLI models, use Bayesian RAG confidence scoring (lambda 0.3-0.4), pre-validate all demo Q&A pairs against source documents, display "unable to verify" rather than hallucinate. SEC/FCA require AI outputs to be traceable; FINRA mandates prompt/output logging.

2. **NL2SQL Prompt Injection / Dangerous Query Generation (Demo 2)** — Natural language to SQL can be manipulated to generate malicious queries; traditional WAFs don't flag natural language payloads. **Prevention**: NEVER auto-execute SQL (always show query first), read-only database connections (SELECT-only), query allowlisting (reject unexpected patterns), parameterized outputs, scope to specific tables. Data breach from injection = GDPR 72-hour reporting requirement.

3. **Multiagent Coordination Failures—The 17x Error Trap (Demo 4)** — Accuracy gains saturate beyond 4 agents; Gartner predicts 30% of agentic AI projects abandoned after POC; inter-agent misalignment causes cascading failures "incredibly difficult to diagnose." **Prevention**: Strict topology (hierarchical or sequential, not bag-of-agents), 4-agent maximum, clear responsibility boundaries, timeouts per agent, fallback to single-agent, human checkpoint before execution. FINRA recommends "narrow scope, permissions, audit trails."

4. **Document Extraction "Near-Human Accuracy" Myth (Demo 3)** — IDP vendors claim "near-human accuracy" but real-world performance on handwritten/damaged FSI documents falls short; plan for 70-85% automation rate, not 99%+. **Prevention**: Build confidence thresholds, flag low-confidence extractions for human review, document-type routing, validation rules, clear "requires review" workflow in demo UI. Incorrect claim data extraction can lead to improper denials (regulatory action).

5. **Fraud Detection False Positive Tsunami (Demo 5)** — Legacy fraud systems show 90%+ false positive rates; AI reduces this 60% in production (HSBC, Danske Bank) but demo systems without proper tuning can be worse. **Prevention**: Use pre-tuned thresholds (hard-code for demos), curate demo scenarios with known correct prioritization, show true positive rate not just alert volume, include similar case retrieval, emphasize analyst productivity. Excessive false positives = unfair customer treatment (regulatory concern).

6. **Vector Search Relevance Failures (Demo 1, Demo 5)** — Single-vector embeddings fail on complex queries ("compare X and Y" returns X OR Y); changing embedding models invalidates vector stores; benchmark performance doesn't translate to production. **Prevention**: Hybrid search mandatory (vector + BM25), reranking layer (OCI reranking model), lock embedding model version, query decomposition, metadata filtering before vector search, internal FSI-specific benchmarks.

7. **Missing Audit Trails for FSI Compliance (All Demos)** — FINRA 2026 Report explicitly requires prompt/output logging, version tracking, access controls; SEC requires "complete decision-making chain"; systems without this cannot progress from demo to pilot. **Prevention**: Audit logging from day 1, structured JSON with timestamp/session/user/action/inputs/outputs, separate audit store, include model metadata, log human decisions, async logging to meet SLA. Retrofit is 3-5x harder than building in from the start.

8. **Citation Accuracy Theater (Demo 1)** — Research shows 25% of RAG citations don't support the response; compliance officers will verify citations—fake citations are worse than no citations. **Prevention**: Verify citation supports claim with NLI model, show retrieved text (not paraphrased), precise source attribution (document/section/page/paragraph), click-to-verify in demo, citation confidence score, pre-validate all demo citations manually.

## Implications for Roadmap

Based on research, the recommended phase structure follows a dependency-driven build order: foundation → RAG core → independent demos → complex orchestration.

### Phase 1: Foundation Infrastructure
**Rationale:** All demos depend on shared utilities and audit infrastructure. Build once, reuse five times. Establishes patterns for RAG, vector search, and compliance logging.

**Delivers:**
- fsi-demo-utils package with RAG chunking/citations, vector search helpers, confidence scoring utilities
- Audit logging infrastructure (structured JSON to SQLite, async writes, model version tracking)
- Synthetic data generation pipeline (Faker.js patterns for credit, fraud, insurance claims)
- Development environment setup (OCI SDK integration, OpenSearch/Oracle 23ai connections)

**Addresses features:**
- Audit trail logging (table stakes)
- Data residency visibility (table stakes)
- Foundation for citation verification (table stakes)

**Avoids pitfalls:**
- Pitfall 7: Missing audit trails (build in from day 1, not retrofitted)
- Technical debt: Skip audit logging (NEVER acceptable in FSI)

**Estimated effort:** 1 week

### Phase 2: EU Regulatory Q&A (Demo 1)
**Rationale:** Validates core RAG + citation pattern used by Demos 4 and 5. Most critical for proving hallucination mitigation. Regulatory content is publicly available (EUR-Lex documents), reducing data curation overhead.

**Delivers:**
- SvelteKit UI extending oci-ai-chat patterns
- Pre-embedded regulatory documents (MiFID II, CRR/CRD IV, GDPR) in vector store
- RAG agent using oci.languageModel('cohere.command-r-plus') with citation extraction
- Confidence scoring per response (Bayesian RAG approach)
- Citation verification with NLI model (ensures citations support answers)
- 5-10 curated Q&A pairs with pre-validated answers
- Professional compliance officer UI (data tables, muted colors, clear typography)

**Addresses features:**
- Verifiable citations with source links (table stakes)
- Confidence scoring per response (table stakes)
- Response time under 3 seconds (table stakes)
- Professional FSI-appropriate UI (table stakes)
- Cross-regulation linking (differentiator, if time permits)

**Avoids pitfalls:**
- Pitfall 1: RAG hallucination (citation verification, Bayesian confidence, pre-validated Q&A)
- Pitfall 6: Vector search relevance (hybrid search + reranking from start)
- Pitfall 8: Citation accuracy theater (NLI verification, click-to-verify)

**Estimated effort:** 2-3 weeks

### Phase 3: Real-Time Credit Risk Assessment (Demo 2)
**Rationale:** Independent of RAG patterns (no dependencies on Demo 1). Tests speech-to-text pipeline (already integrated in provider) and NL2SQL. Validates OCI Speech realtime transcription and Oracle Select AI integration.

**Delivers:**
- SvelteKit UI with voice input and risk indicator visualization
- Realtime transcription using oci.realtimeTranscription() (existing provider feature)
- NL2SQL agent using schema context from fsi-demo-utils
- Oracle Select AI integration for natural language to SQL (or SQLite + custom NL2SQL for demo simplicity)
- Query preview and approval (human-in-the-loop checkpoint)
- Explainable risk scoring with SHAP visualization (XAI requirement)
- Synthetic credit profiles database (Faker.js with realistic distributions)

**Addresses features:**
- Real-time speech-to-query (differentiator)
- Explainable risk scoring with visual breakdown (differentiator)
- Human-in-the-loop checkpoints (table stakes)

**Avoids pitfalls:**
- Pitfall 2: NL2SQL prompt injection (query preview, read-only DB, allowlisting)
- Technical debt: Auto-execute SQL (NEVER acceptable—always show query first)
- Anti-feature: Black-box risk scores (always show contributing factors)

**Estimated effort:** 2-3 weeks

### Phase 4: Insurance Claims Document Processor (Demo 3)
**Rationale:** Independent of other demos. Tests OCI Document Understanding API integration. Different skillset (document processing vs. RAG/NL2SQL), can proceed in parallel with Demo 2.

**Delivers:**
- SvelteKit UI with document upload and extraction results display
- OCI Document Understanding integration (oci-aidocument SDK module)
- Structured data extraction (key-value pairs, tables, amounts, dates, policy numbers)
- Multi-label classification (claim type, urgency)
- Confidence heatmap overlay on document (differentiator)
- Human review queue for low-confidence extractions
- Synthetic insurance claim forms (generated PDFs with realistic data)

**Addresses features:**
- Document extraction with confidence heatmaps (differentiator)
- Human-in-the-loop checkpoints (table stakes)

**Avoids pitfalls:**
- Pitfall 4: Document extraction accuracy myth (build human review queue, set realistic 70-85% automation expectations)
- Anti-feature: Autonomous decisions (recommendations only, human approval required)

**Estimated effort:** 2-3 weeks

### Phase 5: Financial Advisor Knowledge Assistant (Demo 4)
**Rationale:** Most architecturally sophisticated; depends on RAG patterns from Demo 1. Implements A2A protocol for multi-agent coordination. Schedule after stable single-agent demonstrations.

**Delivers:**
- SvelteKit UI with multi-domain query handling and agent activity visualization
- Specialized sub-agents (product knowledge, compliance, client history, market data)
- A2A protocol coordinator using fsi-demo-utils agent-card utilities
- Agent handoff explanation ("Routing to compliance agent because...")
- Knowledge domain confidence indicators
- Multiple vector stores (one per knowledge domain)
- Consolidated response synthesis from multiple agents

**Addresses features:**
- Multi-agent orchestration visibility (differentiator)

**Avoids pitfalls:**
- Pitfall 3: Multiagent coordination failures (strict hierarchical topology, 4-agent maximum, timeouts per agent, fallback to single-agent)
- Anti-pattern: Bag-of-agents (use centralized orchestrator with clear authority)
- Anti-feature: Peer-to-peer agent chaos (centralized routing only)

**Estimated effort:** 3-4 weeks

### Phase 6: Fraud Detection Alert Triage (Demo 5)
**Rationale:** Uses vector patterns from Demo 1 but adds sentiment analysis. Defer until infrastructure mature due to complex features (graph analytics, SAR narrative generation).

**Delivers:**
- SvelteKit UI with alert prioritization dashboard and case similarity display
- Semantic search over fraud case history (vector embeddings of case narratives)
- OCI AI Language sentiment analysis (oci-ailanguage SDK module)
- Alert prioritization scoring with explainability
- Similar case retrieval ("67% similar to Case #1234 due to amount pattern, timing")
- Automated SAR narrative draft (if time permits)
- Synthetic fraud case database (Faker.js patterns matching fraud typologies)

**Addresses features:**
- Semantic search across fraud cases (differentiator)
- Automated SAR narrative generation (differentiator, stretch goal)

**Avoids pitfalls:**
- Pitfall 5: Fraud false positive tsunami (pre-tuned thresholds, curated demo scenarios, emphasize analyst productivity)
- Pitfall 6: Vector search relevance (hybrid search + reranking from Phase 2)
- Anti-feature: Autonomous fraud decisions (analyst approval required)

**Estimated effort:** 3-4 weeks

### Phase Ordering Rationale

- **Phase 1 first**: All demos depend on fsi-demo-utils and audit logging; build once, reuse everywhere; establishes compliance patterns
- **Phase 2 second**: RAG + citation pattern is most critical to prove; regulatory Q&A validates hallucination mitigation; patterns reused in Phases 5 and 6
- **Phases 3-4 parallel eligible**: Demo 2 (speech + NL2SQL) and Demo 3 (document processing) are independent; no shared dependencies beyond Phase 1
- **Phase 5 after Phase 2**: Multi-agent coordination requires stable single-agent patterns; A2A protocol is most complex architecture; defer until foundation proven
- **Phase 6 last**: Fraud detection uses vector patterns from Phase 2 but adds sentiment analysis; SAR generation is high-complexity differentiator; defer until infrastructure mature

### Research Flags

**Phases likely needing /gsd:research-phase during planning:**
- **Phase 5 (Demo 4)**: A2A protocol implementation details sparse; Google A2A spec is emerging standard; may need deeper research on agent communication patterns and coordination topologies
- **Phase 6 (Demo 5)**: SAR narrative generation is niche domain; automated Suspicious Activity Report text generation has regulatory implications; needs research on compliance requirements for AI-generated regulatory filings

**Phases with well-documented patterns (skip research-phase):**
- **Phase 1 (Foundation)**: Standard monorepo setup, audit logging patterns, synthetic data generation are well-established
- **Phase 2 (Demo 1)**: RAG with citations is well-documented; Vercel AI SDK patterns proven; Bayesian RAG research exists
- **Phase 3 (Demo 2)**: OCI Speech integration exists in provider; NL2SQL patterns documented in research
- **Phase 4 (Demo 3)**: OCI Document Understanding has official SDK documentation; extraction patterns straightforward

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | OCI services verified via official documentation; existing provider already integrates GenAI, Speech, Object Storage; new integrations (GenAI Agents, Document Understanding, Language Service) have official SDK support |
| Features | HIGH | Regulatory requirements verified via EU AI Act, FINRA 2026 Report, SEC guidance; table stakes features confirmed across multiple authoritative FSI sources; competitive analysis covers AWS Bedrock, Azure OpenAI, Google Vertex AI |
| Architecture | HIGH | Brownfield constraint (core immutability) is clear; layered extension pattern proven in existing codebase (oci-ai-chat, kyc-intelligence); A2A protocol is Google standard; pre-computed embeddings is established demo pattern |
| Pitfalls | HIGH | Eight critical pitfalls verified through academic research (RAG hallucination 17-33%, multi-agent coordination failures), regulatory documents (FINRA, SEC, GDPR, EU AI Act), and production case studies (HSBC fraud detection, Danske Bank false positive reduction) |

**Overall confidence:** HIGH

Research is comprehensive and based on authoritative sources. Stack choices are conservative extensions of proven infrastructure. Feature requirements are driven by regulatory mandates (not speculation). Architecture follows established patterns. Pitfalls are documented with prevention strategies.

### Gaps to Address

**Oracle Select AI vs. Custom NL2SQL**: Research identified Oracle Select AI for Demo 2 credit risk NL2SQL, but decision point: use Oracle 23ai Select AI (production-grade, requires Oracle DB) or build custom NL2SQL with SQLite (simpler demo setup, lower infrastructure cost). **Resolution**: Start with SQLite + custom NL2SQL in Phase 3 for demo simplicity; document Oracle Select AI as production path.

**A2A Protocol Implementation Maturity**: Google A2A protocol is emerging standard (published 2025); limited production implementations exist. Multi-agent coordination research highlights 30% abandonment rate for agentic AI projects. **Resolution**: Implement strict hierarchical topology in Phase 5 with 4-agent maximum; use fallback to single-agent if coordination fails; accept this is a research-y feature that may need significant iteration.

**Bayesian RAG Hallucination Reduction**: Research shows 27.8% hallucination reduction with Bayesian RAG (lambda 0.3-0.4), but implementation details for Vercel AI SDK integration not fully specified. **Resolution**: Phase 2 should experiment with confidence scoring approaches; pre-validated Q&A pairs provide fallback if Bayesian approach proves complex.

**Synthetic Data Realism vs. Compliance**: Demo data must look realistic (Faker.js patterns) but contain no PII and clearly be synthetic (compliance requirement). Balance between "realistic enough to demo" and "obviously not real customer data." **Resolution**: Use Faker.js with clearly synthetic patterns (account numbers starting with "DEMO-", unrealistic names like "Demo Customer 123"); include disclaimer in UI.

## Sources

### Primary (HIGH confidence)

**OCI Services:**
- [OCI Generative AI Agents Overview](https://docs.oracle.com/en-us/iaas/Content/generative-ai-agents/overview.htm) — RAG service, tool orchestration, A2A protocol
- [OCI Document Understanding](https://docs.oracle.com/en-us/iaas/Content/document-understanding/using/home.htm) — OCR, extraction, confidence scoring
- [OCI Speech Service](https://docs.oracle.com/en-us/iaas/Content/speech/using/speech.htm) — Realtime websocket API
- [OCI AI Language](https://docs.oracle.com/en-us/iaas/Content/language/using/overview.htm) — Sentiment analysis, NER
- [Oracle Database 23ai AI Vector Search](https://oracle-base.com/articles/23/ai-vector-search-23) — VECTOR data type
- [Oracle Select AI Users Guide 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/) — NL2SQL for Oracle DB

**Regulatory & Compliance:**
- [EU AI Act Financial Services Impact](https://www.consultancy.eu/news/11237/the-eu-ai-act-the-impact-on-financial-services-institutions) — High-risk AI requirements
- [EU AI Act Article 12 Logging Requirements](https://medium.com/@veritaschain/the-eu-ai-acts-logging-requirements-are-clear-27c5a600ef30) — Audit trail mandates
- [FINRA 2026 Regulatory Oversight Report](https://www.finra.org/media-center/newsreleases/2025/finra-publishes-2026-regulatory-oversight-report-empower-member-firm) — GenAI logging requirements
- [SR 11-7 Model Risk Management](https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm) — Federal Reserve guidance on explainability

**AI/ML Frameworks:**
- [Vercel AI SDK 6 Documentation](https://sdk.vercel.ai/docs/foundations/agents) — Agent class, tool calling
- [Google A2A Protocol](https://a2a-protocol.org/latest/) — Multi-agent communication standard

### Secondary (MEDIUM confidence)

**RAG and Hallucination Research:**
- [Legal RAG Hallucinations Study](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf) — RAG tools hallucinate 17-33% of responses
- [Bayesian RAG for Financial Services](https://public-pages-files-2025.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1668172/pdf) — 27.8% hallucination reduction
- [Citation Hallucination Detection](https://arxiv.org/pdf/2601.05866) — 25% of citations don't support answers

**Multi-Agent Systems:**
- [Why Multi-Agent LLM Systems Fail](https://arxiv.org/pdf/2503.13657) — Academic research on coordination failures
- [Escaping the 17x Error Trap](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) — Coordination overhead, credit assignment problem

**Security:**
- [Database Query-Based Prompt Injection Attacks](https://www.keysight.com/blogs/en/tech/nwvs/2025/07/31/db-query-based-prompt-injection) — P2SQL injection attack vector
- [Prompt Injection May Never Be Fixed](https://www.malwarebytes.com/blog/news/2025/12/prompt-injection-is-a-problem-that-may-never-be-fixed-warns-ncsc) — NCSC warning on NL2SQL risks

**Production Case Studies:**
- [HSBC AI Fraud Detection](https://www.ibm.com/think/topics/ai-fraud-detection-in-banking) — 60% false positive reduction in production
- [J.P. Morgan AI Fraud Detection](https://www.jpmorgan.com/insights/payments/security-trust/ai-payments-efficiency-fraud-reduction) — Production deployment results

### Tertiary (LOW confidence)

**Market Analysis:**
- [Project Purgatory: Avoiding AI Failures in Financial Services](https://www.financierworldwide.com/project-purgatory-avoiding-ai-failures-in-financial-services) — 80% of FSI AI projects fail to reach production (needs validation, single source)
- [Gartner Multi-Agent AI Prediction](referenced in multiple sources) — 30% of agentic AI projects abandoned after POC by end of 2025 (Gartner report not directly accessed, cited in secondary sources)

---
*Research completed: 2026-02-03*
*Ready for roadmap: yes*
