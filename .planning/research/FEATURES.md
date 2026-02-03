# Feature Research: FSI AI Demo Suite

**Domain:** Financial Services Industry AI Demonstrations
**Researched:** 2026-02-03
**Confidence:** HIGH (multiple authoritative sources, current regulatory requirements verified)

## Executive Summary

FSI AI demos in 2026 operate in a fundamentally different environment than general-purpose AI applications. The EU AI Act classifies credit scoring, fraud detection, and automated financial decisions as **high-risk AI systems** with strict requirements coming into force August 2, 2026. Table stakes features center on explainability, audit trails, and human oversight—not optional nice-to-haves, but regulatory requirements with penalties up to 7% of global turnover.

Differentiators for FSI prospects focus on **production-readiness indicators**: sub-second response times, <1% hallucination rates with citation verification, and governance frameworks that demonstrate EU AI Act compliance. The competitive landscape has shifted from "can AI do X?" to "can AI do X while satisfying my regulators?"

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = demo falls flat with FSI prospects.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Verifiable Citations with Source Links** | EU AI Act Article 13 requires explainability; compliance officers need to trace AI claims to source documents | MEDIUM | Link to specific regulatory section/paragraph, not just document name |
| **Confidence Scoring per Response** | FSI users must assess reliability; "hallucination risk" is a known concern in regulated environments | LOW | Display percentage or qualitative indicator (HIGH/MEDIUM/LOW) |
| **Audit Trail Logging** | EU AI Act Article 12 mandates automatic, tamper-resistant logging for high-risk AI systems | MEDIUM | Log every query, response, source retrieval, user action with timestamps |
| **Human-in-the-Loop Checkpoints** | GDPR Article 22 and EU AI Act require human intervention capability for automated decisions | LOW | Clear "flag for review" and "override" buttons on any AI recommendation |
| **Response Time Under 3 Seconds** | Industry benchmark; FSI users expect enterprise-grade performance | MEDIUM | Production RAG systems achieve <2s; slower feels like a toy |
| **Professional FSI-Appropriate UI** | Customer-facing quality bar; compliance officers distrust consumer-style interfaces | MEDIUM | Muted colors, clear typography, no whimsical elements, data tables |
| **Session Persistence** | Analysts work across multiple sessions; losing context is workflow-breaking | LOW | Already exists in agent-state package; ensure demos use it |
| **Error Handling with Graceful Degradation** | FSI users test edge cases; "crashed" demos destroy credibility | LOW | Show meaningful error messages, not stack traces |
| **Data Residency Visibility** | EU GDPR compliance; prospects will ask "where is my data?" | LOW | Display OCI region clearly; confirm no data leaves jurisdiction |
| **Role-Based Access Indicators** | FSI organizations have strict access controls; demos should reflect this | LOW | Show user role/permissions in UI; even if single-user demo |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but create "wow" moments.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Inline Regulatory Cross-References** | Shows which requirements relate to others (e.g., MiFID II vs GDPR overlap) | MEDIUM | Graph relationships between regulations; unexpected value-add |
| **Proactive Compliance Suggestions** | System suggests related regulations user should also consider | MEDIUM | "You asked about MiFID II Art. 24; you may also need to review Art. 25" |
| **Real-Time Speech-to-Query** | Loan officer speaks naturally, system transcribes and queries instantly | HIGH | Demo 2 feature; shows multimodal OCI capabilities |
| **Explainable Risk Scoring with Visual Breakdown** | Show WHY the AI reached a risk assessment, not just the score | MEDIUM | SHAP/LIME visualizations for credit risk; XAI is a 2026 competitive edge |
| **Multi-Agent Orchestration Visibility** | Show agents collaborating in real-time (Demo 4) | HIGH | FSI prospects understand "specialist teams"; agents mirror this |
| **Semantic Search Across Fraud Cases** | Find similar historical fraud patterns by meaning, not keywords | MEDIUM | Vector search demo; shows OCI AI Vector Search capabilities |
| **Automated SAR Narrative Generation** | System drafts Suspicious Activity Report text from case data | MEDIUM | Fraud analyst productivity; reduces 45 minutes to 5 minutes per case |
| **Document Extraction with Confidence Heatmaps** | Show which parts of scanned documents were extracted with high/low confidence | MEDIUM | Demo 3 differentiator; builds trust in automated extraction |
| **Multi-Regulation Query** | Ask one question, get answers synthesized from multiple regulations | HIGH | "What are my client communication requirements?" returns MiFID II, GDPR, FCA guidance |
| **Bayesian RAG with Uncertainty Quantification** | Show not just the answer, but the confidence interval | HIGH | Research shows 27.8% hallucination reduction; premium FSI feature |

### Anti-Features (Things FSI Prospects DON'T Want)

Features that seem good but create problems in FSI context.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Chatbot-Style Persona/Avatar** | Seems friendlier | Undermines professional credibility; compliance officers want tools, not assistants | Clean, professional interface without personality |
| **Real-Time Everything** | Sounds modern | Creates unnecessary complexity; audit requirements conflict with streaming | Buffer responses, then display with full logging |
| **Black-Box Risk Scores** | Simplifies UI | EU AI Act requires explainability; unexplainable scores are compliance risks | Always show contributing factors |
| **Autonomous Decisions Without Human Trigger** | Efficiency | GDPR/EU AI Act mandate human oversight; autonomous FSI decisions are regulatory violations | Human triggers required; AI recommends only |
| **Integration with Production Customer Data** | Realism | Demo environment only; real data creates security/compliance exposure | Curated synthetic data that looks realistic |
| **Multi-Language Detection/Translation** | EU has many languages | Scope creep; translation errors create compliance risk; defer to v2 | English-only with clear documentation |
| **LLM-Powered Search Without Retrieval** | Simpler architecture | Hallucination rates 30%+ without RAG; unacceptable for FSI | Always ground in retrieved documents |
| **Generic "AI Copilot" Positioning** | Trendy marketing | FSI prospects skeptical of vague AI promises; want specific problem solutions | Purpose-built solutions for specific workflows |
| **Real-Time Model Updates** | Always latest | Model drift in production FSI systems requires validation; continuous updates violate change management | Versioned models with documented validation |
| **Peer-to-Peer Agent Communication** | Decentralized = robust | Harder to audit; FSI needs traceable decision chains | Centralized orchestrator with clear authority |

---

## Per-Demo Feature Breakdown

### Demo 1: EU Regulatory Q&A Assistant

**Table Stakes:**
| Feature | Complexity | Implementation Notes |
|---------|------------|---------------------|
| Citation to specific regulatory article/paragraph | MEDIUM | Must cite "MiFID II Article 24(1)" not just "MiFID II" |
| Confidence indicator per answer | LOW | RAG retrieval confidence + generation confidence combined |
| Query history with audit trail | LOW | Log to SQLite via existing agent-state |
| Professional compliance UI | MEDIUM | Consider Oracle's regulatory patterns; data-dense layouts |
| Pre-loaded MiFID II, CRR/CRD IV, GDPR, EBA docs | HIGH | Document chunking, embedding, vector store setup |

**Differentiators:**
| Feature | Complexity | Value Proposition |
|---------|------------|-------------------|
| Cross-regulation linking | MEDIUM | "This MiFID II requirement relates to CRR Article X" |
| Proactive related requirements | MEDIUM | "You should also consider..." suggestions |
| Confidence heatmap on source documents | HIGH | Visual showing which sections contributed to answer |
| Multi-regulation synthesis | HIGH | Ask one question, get answer spanning multiple regulations |

**Anti-Features to Avoid:**
- No chatbot persona (use "System" not "Assistant")
- No speculative answers (must be grounded in retrieved text)
- No document upload in v1 (pre-loaded only)

---

### Demo 2: Real-Time Credit Risk Assessment

**Table Stakes:**
| Feature | Complexity | Implementation Notes |
|---------|------------|---------------------|
| Speech transcription accuracy >95% | HIGH | OCI Speech service; need noise handling |
| NL2SQL with correct query generation | HIGH | Financial data model requires schema awareness |
| Clear "what the system heard" display | LOW | Show transcription before query execution |
| Risk indicators (RED/YELLOW/GREEN) | LOW | Simple thresholds on credit metrics |
| Query explanation in plain language | MEDIUM | "I'm looking up debt-to-income ratio for this applicant" |

**Differentiators:**
| Feature | Complexity | Value Proposition |
|---------|------------|-------------------|
| Voice activity detection (VAD) | MEDIUM | Know when user finished speaking without button press |
| Explainable risk factors with SHAP visualization | HIGH | XAI is EU AI Act requirement for credit decisions |
| Comparison to portfolio benchmarks | MEDIUM | "This applicant's DTI is 15% above portfolio average" |
| Multi-turn voice conversation | HIGH | Follow-up questions in natural dialogue |

**Anti-Features to Avoid:**
- No automated credit decisions (human approval required)
- No real customer data (synthetic credit profiles)
- No black-box scoring (must explain all factors)

---

### Demo 3: Insurance Claims Document Processor

**Table Stakes:**
| Feature | Complexity | Implementation Notes |
|---------|------------|---------------------|
| Document upload (PDF, images) | LOW | Standard file upload; OCI Document Understanding |
| Structured data extraction | MEDIUM | Key-value pairs from forms; amounts, dates, policy numbers |
| Classification (claim type, urgency) | MEDIUM | Multi-label classification model |
| Confidence scores per extracted field | MEDIUM | OCI Document Understanding provides this |
| "Flag for manual review" capability | LOW | Human-in-the-loop for low-confidence extractions |

**Differentiators:**
| Feature | Complexity | Value Proposition |
|---------|------------|-------------------|
| Confidence heatmap overlay on document | HIGH | Visual showing extraction certainty by region |
| Fraud indicator flags | MEDIUM | Detect inconsistencies, suspicious patterns |
| Auto-population of claims form | MEDIUM | Extracted data → form fields with validation |
| Batch processing progress | LOW | Process multiple documents; show pipeline progress |

**Anti-Features to Avoid:**
- No fully autonomous claim decisions (recommendations only)
- No medical diagnosis interpretation (extract text, don't interpret)
- No cross-claim correlation (single-claim scope for v1)

---

### Demo 4: Financial Advisor Knowledge Assistant

**Table Stakes:**
| Feature | Complexity | Implementation Notes |
|---------|------------|---------------------|
| Multi-domain query handling | HIGH | Products, compliance, client history as separate knowledge bases |
| Citations to knowledge base sources | MEDIUM | Link to internal documents, product sheets, etc. |
| Clear agent activity indication | MEDIUM | Show which specialist agent is handling which part |
| Consolidated response synthesis | MEDIUM | Combine multiple agent responses coherently |
| Context retention across turns | LOW | Agent-state session management |

**Differentiators:**
| Feature | Complexity | Value Proposition |
|---------|------------|-------------------|
| A2A protocol visualization | HIGH | Real-time display of agents communicating |
| Agent handoff explanation | MEDIUM | "Routing to compliance agent because your question involves suitability" |
| Knowledge domain confidence | MEDIUM | Show which domains contributed most to answer |
| Advisor productivity metrics | LOW | Track time saved, queries handled |

**Anti-Features to Avoid:**
- No peer-to-peer agent chaos (centralized orchestrator)
- No client-facing deployment (advisor tool only)
- No investment recommendations (information only, no advice)

---

### Demo 5: Fraud Detection Alert Triage

**Table Stakes:**
| Feature | Complexity | Implementation Notes |
|---------|------------|---------------------|
| Semantic search over fraud case history | MEDIUM | Vector embeddings of case narratives |
| Alert prioritization scoring | MEDIUM | Risk-based ranking of incoming alerts |
| Similar case retrieval | MEDIUM | "Cases most similar to this alert" |
| Sentiment analysis on transaction notes | LOW | Flag negative/suspicious language patterns |
| Investigation workflow status | LOW | Open/In Progress/Closed/Escalated states |

**Differentiators:**
| Feature | Complexity | Value Proposition |
|---------|------------|-------------------|
| Automated SAR narrative draft | HIGH | Generate Suspicious Activity Report text |
| Fraud ring visualization | HIGH | Graph showing entity relationships |
| Behavioral anomaly explanation | MEDIUM | "This transaction is unusual because..." |
| Case similarity scoring with explanation | MEDIUM | "67% similar to Case #1234 due to amount pattern, timing" |

**Anti-Features to Avoid:**
- No autonomous fraud decisions (analyst approval required)
- No real transaction data (synthetic fraud scenarios)
- No deepfake detection (out of scope for v1; complex ML)

---

## Feature Dependencies

```
[Vector Store + Embeddings]
    └──requires──> [Document Chunking Pipeline]
                       └──requires──> [Pre-loaded Documents]

[Citation Display] ──requires──> [Vector Store Metadata]

[Confidence Scoring] ──requires──> [RAG Retrieval Scores] + [Generation Confidence]

[Audit Trail] ──requires──> [Session Persistence (agent-state)]

[NL2SQL] ──requires──> [Financial Data Model Schema] + [Sample Database]

[Multi-Agent Orchestration] ──requires──> [A2A Protocol] + [Individual Agent Implementations]

[Speech Transcription] ──requires──> [OCI Speech Service Integration]

[Document Extraction] ──requires──> [OCI Document Understanding Integration]

[Semantic Search] ──requires──> [Vector Store] + [Embedding Pipeline]
```

### Dependency Notes

- **Vector Store is foundational:** Demos 1, 4, 5 all require vector search infrastructure; build once, reuse
- **agent-state enables audit:** Existing package provides session persistence; extend for audit logging
- **OCI services require integration:** Speech, Document Understanding, GenAI require separate SDK integrations
- **A2A is complex:** Demo 4's multi-agent pattern is most architecturally sophisticated; schedule last

---

## MVP Definition

### Launch With (v1) - Demo 1: EU Regulatory Q&A

Minimum viable demo — validates the core RAG + citation pattern.

- [x] Vector store with chunked regulatory documents (MiFID II, CRR priority)
- [x] RAG retrieval with OCI GenAI embeddings
- [x] Citation display with document section links
- [x] Confidence indicator (retrieval score threshold)
- [x] Audit logging to SQLite
- [x] Professional web UI (SvelteKit, based on oci-ai-chat)
- [x] 5-10 curated question-answer pairs that work reliably
- [x] Human-in-the-loop "flag for review" button

**Effort estimate:** 2-3 weeks for solid Demo 1

### Add After Validation (v1.x) - Demos 2 & 3

Features to add once core RAG pattern is proven.

- [ ] Demo 2: Speech transcription + NL2SQL — Trigger: Customer interest in voice interfaces
- [ ] Demo 3: Document extraction — Trigger: Insurance-specific customer meetings
- [ ] Cross-regulation linking — Trigger: Demo 1 feedback requests related regulations

**Effort estimate:** 2-3 weeks each for Demos 2 and 3

### Future Consideration (v2+) - Demos 4 & 5

Features to defer until infrastructure is mature.

- [ ] Demo 4: Multi-agent orchestration — Why defer: A2A protocol complexity; requires stable single-agent first
- [ ] Demo 5: Fraud triage — Why defer: Graph analytics, SAR generation are high-complexity features
- [ ] Multi-language support — Why defer: EU languages require separate document corpora, translation validation
- [ ] Document upload for Demo 1 — Why defer: Document management UI is significant scope

**Effort estimate:** 3-4 weeks each for Demos 4 and 5

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Citations with source links | HIGH | MEDIUM | P1 |
| Confidence scoring | HIGH | LOW | P1 |
| Audit trail logging | HIGH | LOW | P1 |
| Professional UI | HIGH | MEDIUM | P1 |
| Pre-loaded regulatory docs | HIGH | HIGH | P1 |
| Human-in-the-loop checkpoints | HIGH | LOW | P1 |
| Response time <3s | HIGH | MEDIUM | P1 |
| Cross-regulation linking | MEDIUM | MEDIUM | P2 |
| Proactive suggestions | MEDIUM | MEDIUM | P2 |
| Speech-to-query (Demo 2) | HIGH | HIGH | P2 |
| Document extraction (Demo 3) | HIGH | HIGH | P2 |
| Explainable risk scoring | HIGH | HIGH | P2 |
| Multi-agent visibility (Demo 4) | MEDIUM | HIGH | P3 |
| SAR narrative generation (Demo 5) | MEDIUM | HIGH | P3 |
| Bayesian RAG uncertainty | LOW | HIGH | P3 |
| Fraud ring visualization | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for Demo 1 launch
- P2: Should have, add in Demos 2-3 phase
- P3: Nice to have, future consideration for Demos 4-5

---

## Competitor Feature Analysis

| Feature | AWS Bedrock + Lex | Azure OpenAI + Cognitive Services | Google Vertex AI | OCI GenAI (Our Approach) |
|---------|-------------------|-----------------------------------|------------------|--------------------------|
| RAG with citations | Built-in with Knowledge Bases | Azure AI Search integration | Vertex AI Search | OCI RAG Agents + Vector Search |
| Speech-to-text | Amazon Transcribe | Azure Speech Services | Cloud Speech-to-Text | OCI Speech Service |
| Document extraction | Amazon Textract | Azure Document Intelligence | Document AI | OCI Document Understanding |
| Multi-agent | Step Functions orchestration | Semantic Kernel | Vertex AI Agent Builder | A2A Protocol (emerging standard) |
| EU data residency | EU regions available | EU regions available | EU regions available | **OCI EU Sovereign Cloud** (differentiator) |
| FSI-specific compliance | Generic | Azure OpenAI compliance features | Generic | **OCI FSI Cloud** (differentiator) |
| Hallucination guardrails | Guardrails for Bedrock | Content Safety | Responsible AI toolkit | **Bayesian RAG** (differentiator) |

**Our Competitive Positioning:**
- Lead with **OCI EU Sovereign Cloud** for data residency concerns
- Emphasize **OCI FSI Cloud** for regulated workloads
- Demonstrate **A2A Protocol** as emerging multi-agent standard
- Show **Bayesian RAG** as hallucination mitigation (research-backed, 27.8% reduction)

---

## Security and Compliance Features

### EU AI Act Compliance (HIGH Priority)

| Requirement | Feature Implementation | Status |
|-------------|------------------------|--------|
| Article 12: Automatic logging | Audit trail in agent-state with tamper detection | Required for Demo 1 |
| Article 13: Transparency | Citation display, confidence scoring | Required for Demo 1 |
| Article 14: Human oversight | Flag for review, override capability | Required for all demos |
| Article 15: Accuracy | <1% hallucination target, citation verification | Required for all demos |
| Annex III: High-risk (credit scoring) | Full explainability for Demo 2 | Required for Demo 2 |

### GDPR Compliance (HIGH Priority)

| Requirement | Feature Implementation | Status |
|-------------|------------------------|--------|
| Article 22: Automated decisions | Human-in-the-loop checkpoints | Required for all demos |
| Data minimization | No unnecessary data retention; session-only storage | Required for all demos |
| Right to explanation | Explainable AI outputs | Required for Demos 2, 5 |
| Data residency | OCI EU region deployment | Required for all demos |

### Customer-Facing Polish Requirements

| Polish Element | Why It Matters | Implementation |
|----------------|---------------|----------------|
| Loading states | Empty screens feel broken | Skeleton loaders, progress indicators |
| Error messages | Stack traces destroy credibility | User-friendly messages with action suggestions |
| Keyboard navigation | Accessibility, power users | Tab order, keyboard shortcuts |
| Print-friendly output | Compliance officers print for records | Clean print CSS, export to PDF |
| Session timeout handling | Security expectation | Graceful re-authentication, state preservation |

---

## Sources

### Regulatory & Compliance
- [EU AI Act Financial Services Impact](https://www.consultancy.eu/news/11237/the-eu-ai-act-the-impact-on-financial-services-institutions)
- [EU AI Act Article 12 Logging Requirements](https://medium.com/@veritaschain/the-eu-ai-acts-logging-requirements-are-clear-27c5a600ef30)
- [Smarsh EU AI Act Provisions](https://www.smarsh.com/regulations/eu-ai-act)
- [Orrick EU AI Act 6 Steps Before August 2026](https://www.orrick.com/en/Insights/2025/11/The-EU-AI-Act-6-Steps-to-Take-Before-2-August-2026)
- [GDPR AI Document Processing 2026](https://www.extend.ai/resources/real-time-document-processing-financial-services)
- [AI Regulatory Compliance Priorities 2026](https://fintech.global/2026/01/08/ai-regulatory-compliance-priorities-financial-institutions-face-in-2026/)

### Credit Risk & NL2SQL
- [AI Credit Risk Assessment 2025](https://www.lyzr.ai/blog/ai-in-credit-risk-assessment/)
- [AI Agents for Credit Risk](https://www.xcubelabs.com/blog/ai-agents-for-credit-risk-assessment-reducing-loan-defaults-in-banking/)
- [FI-NL2PY2SQL Financial Industry Model](https://www.mdpi.com/1999-5903/17/1/12)
- [Credit Risk Assistant by GFT/Oliver Wyman](https://www.oliverwyman.com/our-expertise/insights/2025/mar/credit-risk-assistant-ai-driven-solution.html)

### Insurance Claims Processing
- [Top AI Insurance Claims Processing Software 2026](https://www.aptarro.com/insights/top-ai-insurance-claims-processing-software)
- [Insurance AI Operating System 2026 - SAS](https://www.sas.com/en_us/news/press-releases/2025/december/insurance-ai-operating-system.html)
- [Claims Processing Automation Guide 2026](https://www.flowforma.com/blog/claims-processing-automation)

### Wealth Management & Multi-Agent
- [Arta AI Wealth Platform](https://artafinance.com/global/insights/meet-arta-ai-private-wealth-guided-by-ai-agents)
- [AI Connected Wealth Report 2026 - Advisor360](https://www.advisor360.com/ai-connected-wealth-report-2026)
- [Multi-Agent AI Orchestration Enterprise Strategy 2025-2026](https://www.onabout.ai/p/mastering-multi-agent-orchestration-architectures-patterns-roi-benchmarks-for-2025-2026)
- [Agentic AI in Financial Services 2026 - AWS](https://aws.amazon.com/blogs/industries/agentic-ai-in-financial-services-choosing-the-right-pattern-for-multi-agent-systems/)
- [Banks Agentic AI Scale 2026 - Banking Dive](https://www.bankingdive.com/news/banks-agentic-ai-scale-2026-accenture/809585/)

### Fraud Detection
- [AI Fraud Detection Banking Complete Guide 2026](https://www.articsledge.com/post/ai-fraud-detection-banking)
- [Top Fraud Platforms 2026 - DataVisor](https://www.datavisor.com/blog/top-10-fraud-platforms-plus-evaluation-criteria-challenges-and-trends)
- [Banking Sentinels 2026 Fraud Detection](https://www.xcubelabs.com/blog/banking-sentinels-of-2026-how-ai-agents-detect-loan-fraud-in-real-time/)
- [Understanding AI Fraud Detection 2026 - DigitalOcean](https://www.digitalocean.com/resources/articles/ai-fraud-detection)

### RAG & Hallucination Mitigation
- [Bayesian RAG for Financial Services](https://public-pages-files-2025.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1668172/pdf)
- [RAG Orchestration Services Guide 2026](https://www.leanware.co/insights/rag-orchestration-services)
- [Citation Hallucination Detection](https://arxiv.org/pdf/2601.05866)

### Enterprise AI Patterns
- [AI Transformation Financial Services 2026 - Microsoft](https://www.microsoft.com/en-us/industry/blog/financial-services/2025/12/18/ai-transformation-in-financial-services-5-predictors-for-success-in-2026/)
- [Agentic AI Design Patterns 2026](https://venturebeat.com/infrastructure/agentic-design-patterns-the-missing-link-between-ai-demos-and-enterprise)
- [Best Practices AI Agent Implementations 2026](https://onereach.ai/blog/best-practices-for-ai-agent-implementations/)
- [AI System Design Patterns 2026](https://zenvanriel.nl/ai-engineer-blog/ai-system-design-patterns-2026/)

---

*Feature research for: FSI AI Demo Suite*
*Researched: 2026-02-03*
*Confidence: HIGH - Multiple authoritative sources, current regulatory requirements verified*
