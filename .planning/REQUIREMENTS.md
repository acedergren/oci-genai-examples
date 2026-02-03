# Requirements: FSI AI Demo Suite

**Defined:** 2026-02-03
**Core Value:** FSI prospects can see concrete, production-ready examples of how OCI GenAI solves real compliance, risk, and operational challenges in their industry.

## v1 Requirements

Requirements for initial demo suite release. Each maps to roadmap phases.

### Foundation Infrastructure

- [ ] **FOUND-01**: System logs all prompts and responses with timestamps to SQLite for audit compliance (FINRA 2026 mandate)
- [ ] **FOUND-02**: Synthetic FSI data generator creates realistic credit profiles, fraud alerts, and claims documents
- [ ] **FOUND-03**: Shared `fsi-demo-utils` package provides RAG chunking, citation formatting, and confidence scoring utilities
- [ ] **FOUND-04**: Vector store pre-embeds regulatory documents at build time (not runtime) for <3s response guarantee
- [ ] **FOUND-05**: All demos run on single shared OCI GenAI Agents instance with isolated knowledge bases

### Demo 1: EU Regulatory Q&A

- [ ] **DEMO1-01**: User can ask natural language questions about MiFID II, CRR/CRD IV, GDPR (FSI aspects), EBA Guidelines
- [ ] **DEMO1-02**: System returns answers with citations to specific regulatory articles/paragraphs (e.g., "MiFID II Article 24(1)")
- [ ] **DEMO1-03**: Each answer includes confidence indicator (% certainty based on retrieval + generation scores)
- [ ] **DEMO1-04**: System proactively suggests related requirements ("You should also consider CRR Article X...")
- [ ] **DEMO1-05**: Cross-regulation linking shows how requirements in different regulations relate
- [ ] **DEMO1-06**: Confidence heatmap overlay visualizes which source sections contributed to answer
- [ ] **DEMO1-07**: Query history with full audit trail persists to SQLite via agent-state
- [ ] **DEMO1-08**: Professional FSI-appropriate UI design (data-dense, no chatbot persona)
- [ ] **DEMO1-09**: System responds in under 3 seconds for 95% of queries
- [ ] **DEMO1-10**: 5-10 curated question-answer pairs validated for demo reliability (<1% hallucination rate via NLI verification)

### Demo 2: Real-Time Credit Risk Assessment

- [ ] **DEMO2-01**: Loan officer speaks naturally and system transcribes with >95% accuracy using OCI Speech
- [ ] **DEMO2-02**: System converts natural language to SQL queries (NL2SQL via Oracle Select AI)
- [ ] **DEMO2-03**: System displays transcription text before executing query (transparency/safety)
- [ ] **DEMO2-04**: Generated SQL queries execute against synthetic credit database in read-only mode
- [ ] **DEMO2-05**: Risk indicators displayed as RED/YELLOW/GREEN based on credit metric thresholds
- [ ] **DEMO2-06**: Query explanation in plain language ("Looking up debt-to-income ratio for this applicant")
- [ ] **DEMO2-07**: Voice activity detection (VAD) knows when user finished speaking without button press
- [ ] **DEMO2-08**: Explainable risk factors with SHAP visualization (EU AI Act XAI requirement)
- [ ] **DEMO2-09**: Results compare applicant to portfolio benchmarks ("DTI is 15% above average")
- [ ] **DEMO2-10**: Multi-turn voice conversation supports follow-up questions in natural dialogue

### Demo 3: Insurance Claims Document Processor

- [ ] **DEMO3-01**: User can upload insurance claim documents (PDF, images) via web UI
- [ ] **DEMO3-02**: System extracts structured data (policy number, amounts, dates) using OCI Document Understanding
- [ ] **DEMO3-03**: System classifies claim type and urgency using multi-label classification
- [ ] **DEMO3-04**: Each extracted field shows confidence score from OCI Document Understanding API
- [ ] **DEMO3-05**: Low-confidence extractions automatically flagged for manual review (human-in-the-loop)
- [ ] **DEMO3-06**: Confidence heatmap overlay visualizes extraction certainty by document region
- [ ] **DEMO3-07**: Fraud indicator flags detect inconsistencies and suspicious patterns
- [ ] **DEMO3-08**: Extracted data auto-populates claims form fields with validation
- [ ] **DEMO3-09**: Batch processing shows progress for multiple documents in pipeline
- [ ] **DEMO3-10**: System achieves 70-85% automation rate with realistic accuracy expectations

### Demo 4: Financial Advisor Knowledge Assistant

- [ ] **DEMO4-01**: Wealth manager queries product info, compliance rules, and client history in single question
- [ ] **DEMO4-02**: Multiple specialized agents coordinate via A2A protocol (max 4 agents)
- [ ] **DEMO4-03**: Each agent has specific domain (products, compliance, client data, market research)
- [ ] **DEMO4-04**: Structured agent topology (supervisor orchestrates, not peer-to-peer)
- [ ] **DEMO4-05**: System provides comprehensive answers spanning multiple knowledge domains
- [ ] **DEMO4-06**: Citations link to internal knowledge base sources with section references
- [ ] **DEMO4-07**: Agent coordination visible in UI (which agents involved, in what order)
- [ ] **DEMO4-08**: Per-agent timeouts prevent cascade failures (fallback if agent doesn't respond)
- [ ] **DEMO4-09**: Query routing intelligence sends questions to relevant agent subset (not all 4 every time)
- [ ] **DEMO4-10**: Multi-agent synthesis creates unified response from agent outputs (no conflicting info)

### Demo 5: Fraud Detection Alert Triage

- [ ] **DEMO5-01**: Fraud analyst can query historical fraud cases using semantic search (not keyword)
- [ ] **DEMO5-02**: System uses Oracle DB 23ai/26ai vector search for similarity matching
- [ ] **DEMO5-03**: Sentiment analysis summarizes and prioritizes fraud alerts (urgency scoring)
- [ ] **DEMO5-04**: Dashboard displays alert prioritization with recommended actions
- [ ] **DEMO5-05**: Vector search finds similar past cases with resolution outcomes
- [ ] **DEMO5-06**: Each alert shows explainability (reason codes for prioritization)
- [ ] **DEMO5-07**: Hybrid approach combines vector search with structured filters (amount, geography, customer segment)
- [ ] **DEMO5-08**: SAR (Suspicious Activity Report) narrative generation drafts regulatory filings
- [ ] **DEMO5-09**: Fraud ring visualization maps connections between related alerts
- [ ] **DEMO5-10**: Curated demo data with known correct prioritization validates algorithm accuracy

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Capabilities

- **ENH-01**: Real-time model updates with A/B testing framework
- **ENH-02**: Multi-language support (French, German, Italian, Spanish for EU markets)
- **ENH-03**: Mobile-optimized interfaces for all demos
- **ENH-04**: Integration with production IAM systems (OAuth2, SAML)
- **ENH-05**: Document upload for regulatory Q&A (extend beyond pre-loaded docs)
- **ENH-06**: Automated claim decisions with human override (beyond recommendations)
- **ENH-07**: Cross-claim correlation for fraud ring detection across multiple claims
- **ENH-08**: Real-time streaming responses with incremental citations

### Advanced Analytics

- **ANALYTICS-01**: Demo usage analytics dashboard (query patterns, response times, accuracy metrics)
- **ANALYTICS-02**: A/B testing framework for prompt engineering experiments
- **ANALYTICS-03**: Hallucination detection monitoring with automated alerts
- **ANALYTICS-04**: Cost optimization recommendations based on usage patterns

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| **Multi-tenancy** | Single-tenant demo environment only; production multi-tenancy adds auth/isolation complexity not needed for demos |
| **Production customer data integration** | Security/compliance risk; synthetic data sufficient for demo impact without regulatory exposure |
| **Real-time model training** | Demos use pre-trained models; online learning creates regulatory validation burden (EU AI Act) |
| **Chatbot personas/avatars** | FSI prospects want professional tools, not friendly assistants; undermines credibility |
| **Autonomous decisions without human triggers** | EU AI Act requires human oversight; autonomous FSI decisions are regulatory violations |
| **Generic "AI copilot" positioning** | FSI skeptical of vague AI promises; purpose-built solutions for specific workflows resonate better |
| **LLM-powered search without RAG** | 30%+ hallucination rate without retrieval grounding is unacceptable for FSI content |
| **Peer-to-peer agent communication** | Harder to audit than centralized orchestrator; FSI needs traceable decision chains |
| **US regulatory frameworks (Dodd-Frank, etc.)** | EU focus for v1; US regulations deferred to avoid regulatory complexity sprawl |
| **Medical diagnosis interpretation** | Demo 3 extracts text from medical records but doesn't interpret diagnoses (liability risk) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| *(Empty - populated by roadmapper)* | | |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 0 (roadmap not created yet)
- Unmapped: 55 ⚠️

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after research synthesis*
