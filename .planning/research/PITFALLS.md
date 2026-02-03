# Pitfalls Research: FSI AI Demo Suite

**Domain:** Financial Services AI Demos (Regulatory Q&A, Credit Risk, Document Processing, Multiagent, Fraud Detection)
**Researched:** 2026-02-03
**Confidence:** HIGH (verified through multiple authoritative sources including FINRA, SEC, academic research, and production case studies)

## Critical Pitfalls

These mistakes cause demo failures, compliance issues, or project abandonment. Each pitfall is mapped to specific FSI demo components.

---

### Pitfall 1: RAG Hallucination on Regulatory Content

**What goes wrong:**
RAG systems claim to "ground" responses in documents, but research shows RAG tools from major providers still hallucinate 17-33% of responses. In financial regulatory contexts, a single hallucinated requirement (e.g., fabricating a MiFID II obligation) can destroy credibility with compliance-savvy FSI prospects.

**Why it happens:**
- Overconfidence in RAG's grounding capabilities (vendors oversell "elimination" of hallucinations)
- Embedding models retrieving semantically similar but factually wrong passages
- LLM synthesizing plausible-but-wrong text when retrieval gaps exist
- No verification layer between retrieval and generation

**How to avoid:**
1. **Implement citation verification**: Every answer MUST link to specific document sections with page/paragraph numbers
2. **Use confidence scoring**: Bayesian RAG approaches (lambda 0.3-0.4 for high-risk) flag low-confidence responses
3. **Add hallucination detection layer**: Chain-of-Thought validation can reduce hallucination rates by 75% (from 4% to 1%)
4. **Curate demo Q&A pairs**: For the 5-10 demo questions, pre-validate all expected answers against source documents
5. **Display "unable to verify" rather than hallucinating**: Better to admit uncertainty than fabricate compliance advice

**Warning signs:**
- Answers lack specific citations ("According to MiFID II..." without article numbers)
- Responses confident despite vague or contradictory retrieval
- System answers questions about regulations not in the knowledge base
- Subtle factual errors that sound plausible (wrong threshold amounts, incorrect dates)

**FSI compliance implications:**
- SEC and FCA require AI outputs to be traceable and auditable
- FINRA's 2026 Report mandates prompt/output logging for compliance-related AI
- Hallucinated regulatory guidance could expose clients to compliance violations

**Phase to address:**
**Demo 1 (Regulatory Q&A)** - Core requirement. Implement citation verification as acceptance criteria for every response.

---

### Pitfall 2: NL2SQL Prompt Injection / Dangerous Query Generation

**What goes wrong:**
Natural language to SQL systems can be manipulated through prompt injection to generate malicious queries. Unlike traditional SQL injection, the malicious payload is in plain English and bypasses WAFs. In FSI contexts, this can lead to unauthorized data access, data exfiltration, or database corruption.

**Why it happens:**
- LLMs follow instructions literally, including malicious ones embedded in queries
- Traditional security measures (WAFs, input sanitization) don't flag natural language
- Demos often auto-execute generated SQL without human review
- Inadequate permission scoping on database connections

**How to avoid:**
1. **NEVER auto-execute SQL in demos**: Always show generated query and require confirmation
2. **Read-only database connections**: Demo database user should have SELECT-only permissions
3. **Query allowlisting**: Pre-approve query patterns; reject queries outside expected structure
4. **Parameterized outputs**: Generate parameterized queries, not raw SQL with interpolated values
5. **Scope to specific tables**: Database connection should only see demo-appropriate tables
6. **Input sanitization at semantic level**: Detect and reject queries requesting system tables, user info, or data modification

**Warning signs:**
- Queries accessing unexpected tables (system catalogs, user tables)
- Queries with UNION, DROP, INSERT, UPDATE, DELETE
- Queries returning more data than visually displayed
- Long query generation times (may indicate complex injected logic)

**FSI compliance implications:**
- Data breach from injection = regulatory reporting requirements (72 hours under GDPR)
- Unauthorized access to credit data violates FCRA and similar regulations
- Demo environment breaches damage prospect trust irreparably

**Phase to address:**
**Demo 2 (Credit Risk NL2SQL)** - Critical security requirement. Implement query review + read-only DB as non-negotiable guardrails.

---

### Pitfall 3: Multiagent Coordination Failures (The "17x Error Trap")

**What goes wrong:**
Multi-agent systems exhibit emergent failure modes unpredictable from testing individual agents. Research shows accuracy gains saturate beyond 4 agents, and Gartner predicts 30% of agentic AI projects will be abandoned after proof-of-concept by end of 2025. Inter-agent misalignment causes cascading failures that are "incredibly difficult to diagnose."

**Why it happens:**
- "Bag of agents" architecture without structured coordination topology
- Credit assignment problem: unclear which agent caused the failure
- Coordination overhead adds 10-15% to processing time per validation layer
- Agents sharing state/memory create unpredictable side effects
- Error propagation across the agent network

**How to avoid:**
1. **Strict topology design**: Use hierarchical (supervisor) or sequential (pipeline) patterns, not free-form collaboration
2. **4-agent maximum**: Research shows coordination benefits plateau at 4 agents
3. **Clear responsibility boundaries**: Each agent owns specific knowledge domain with no overlap
4. **Timeouts per agent**: Individual agent failures must not block the entire system
5. **Fallback responses**: If coordination fails, gracefully degrade to single-agent response
6. **Human checkpoint before execution**: A2A protocol should include approval gate for actions

**Warning signs:**
- Response times exceeding 3-second SLA (coordination overhead)
- Inconsistent answers to same question (agent ordering effects)
- Agents citing each other instead of primary sources
- System hangs during multi-domain queries
- Difficulty reproducing failures in testing

**FSI compliance implications:**
- FINRA recommends "narrow scope, permissions, audit trails" for AI agents
- Unpredictable agent behavior conflicts with explainability requirements
- Slow responses (>3s) make demos unusable for prospect meetings

**Phase to address:**
**Demo 4 (Financial Advisor Multiagent)** - Architecture decision. Design agent topology upfront; limit to 3-4 specialized agents with clear handoff protocols.

---

### Pitfall 4: Document Extraction "Near-Human Accuracy" Myth

**What goes wrong:**
IDP vendors claim "near-human accuracy" but real-world performance on messy, handwritten, or industry-specific documents falls significantly short. Insurance claim forms with handwritten notes, medical records with specialized terminology, and damaged/photographed receipts create extraction failures that require manual review—negating the automation value proposition.

**Why it happens:**
- Vendor benchmarks use clean, structured test documents
- FSI documents have high variance (handwritten forms, faxed copies, multi-format attachments)
- Domain-specific terminology (medical codes, policy jargon) not in training data
- OCR confidence thresholds set too low, passing garbage to downstream processing
- No feedback loop for extraction errors

**How to avoid:**
1. **Set realistic accuracy expectations**: Plan for 70-85% automation rate, not 99%+
2. **Build confidence thresholds**: Flag low-confidence extractions for human review
3. **Document-type routing**: Different extraction models for different document types
4. **Validation rules**: Cross-reference extracted data against business rules (e.g., claim amount vs. policy limits)
5. **Clear "requires review" workflow**: Demo should show the human-in-loop path, not hide it
6. **Curate demo documents**: Use high-quality sample documents for demos; acknowledge real-world variance

**Warning signs:**
- High confidence scores on obviously wrong extractions
- Extraction failures on handwritten sections
- Medical/policy codes extracted as garbage text
- Processing time variance (some documents take 10x longer)
- Repeated manual corrections for same error types

**FSI compliance implications:**
- Incorrect claim data extraction can lead to improper denials (regulatory action)
- PII mishandling in extraction pipeline violates GDPR/CCPA
- Audit trails must capture extraction decisions and confidence levels

**Phase to address:**
**Demo 3 (Claims Document Processor)** - UX design decision. Build "human review queue" into the demo UI; don't pretend 100% automation.

---

### Pitfall 5: Fraud Detection False Positive Tsunami

**What goes wrong:**
Rule-based fraud systems generate excessive false positives, overwhelming analyst queues and degrading customer experience. Legacy systems show 90%+ false positive rates on some alert types. While AI reduces false positives by 60% in production deployments (HSBC, Danske Bank), demo systems without proper tuning can exhibit worse performance than rules.

**Why it happens:**
- Models trained on historical fraud patterns miss novel attack vectors
- Threshold calibration requires production transaction volume to tune
- Demo data lacks the statistical distribution of real fraud (too balanced)
- Alert prioritization models need domain-specific training
- No feedback loop from analyst decisions

**How to avoid:**
1. **Use pre-tuned thresholds**: For demos, hard-code sensible thresholds rather than dynamic calibration
2. **Curate demo scenarios**: Create specific fraud cases with known correct prioritization
3. **Show true positive rate, not just alerts**: Demo should highlight successful detections, not alert volume
4. **Include similar case retrieval**: Vector search for similar past cases adds value even if raw detection isn't tuned
5. **Emphasize analyst productivity**: Frame as "analyst gets to high-priority cases faster," not "system catches all fraud"
6. **Avoid real-time scoring in demo**: Pre-compute fraud scores for demo transactions

**Warning signs:**
- Alert queue fills with obvious false positives (legitimate customer transactions)
- Model flags same customer repeatedly for normal behavior patterns
- High-value fraud scenarios not prioritized above low-value alerts
- Response time varies wildly based on transaction complexity
- Cannot explain why a transaction was flagged

**FSI compliance implications:**
- Excessive false positives can constitute unfair customer treatment (regulatory concern)
- Missed fraud exposes institution to losses and regulatory penalties
- Fraud detection decisions must be explainable under SR 11-7 model risk framework

**Phase to address:**
**Demo 5 (Fraud Detection Triage)** - Data curation priority. Create balanced demo dataset with clear fraud/non-fraud examples and pre-validated prioritization.

---

### Pitfall 6: Vector Search Relevance Failures

**What goes wrong:**
Single-vector embeddings hit fundamental limitations with complex queries. Queries requiring "compare," "and," or "both" fail because embedding models cannot represent combinatorial relevance. Changing embedding models invalidates existing vector stores. Benchmark performance doesn't translate to production relevance.

**Why it happens:**
- Embedding models map documents to single points that can't capture multiple relevance facets
- Academic benchmarks test narrow query types, not real-world complexity
- Embedding model updates create incompatible vector spaces (cosine similarity becomes meaningless)
- Chunking strategy mismatches query patterns (too large = diluted embeddings, too small = lost context)

**How to avoid:**
1. **Hybrid search mandatory**: Combine vector similarity with keyword BM25 for FSI queries
2. **Reranking layer**: Use OCI reranking model to improve top-K relevance before LLM
3. **Lock embedding model version**: Don't upgrade embedding model without full reindexing plan
4. **Query decomposition**: Break complex queries into simple sub-queries
5. **Metadata filtering**: Use structured filters (document type, date range, regulation name) before vector search
6. **Internal benchmarks**: Create FSI-specific test queries; don't rely on vendor benchmarks

**Warning signs:**
- "Compare X and Y" queries return documents about X OR Y, not both
- Highly relevant documents not in top-10 results
- Relevance degrades after embedding model update
- Search quality varies dramatically by query phrasing
- Users must try multiple query variations to find documents

**FSI compliance implications:**
- Missing relevant regulatory requirements due to search failures = compliance risk
- Inconsistent search results undermine trust in knowledge system
- Audit requirement: demonstrate search returned relevant documents

**Phase to address:**
**Demo 1 (Regulatory Q&A)** and **Demo 5 (Fraud Detection)** - Search infrastructure. Implement hybrid search + reranking from the start; don't rely on pure vector search.

---

### Pitfall 7: Missing Audit Trails for FSI Compliance

**What goes wrong:**
Demo systems built without audit logging fail FSI security reviews. FINRA's 2026 Report explicitly requires prompt/output logging, version tracking, and access controls. SEC requires "complete decision-making chain" documentation. Systems without these capabilities cannot progress from demo to pilot.

**Why it happens:**
- Demos prioritize features over compliance infrastructure
- Logging adds latency (10-50ms) that impacts 3-second SLA
- Storage costs for full prompt/response logs
- "It's just a demo" mentality ignores that demos inform architecture
- Retrofit audit logging is 3-5x harder than building in from the start

**How to avoid:**
1. **Audit logging from day 1**: Log all prompts, responses, model versions, user actions
2. **Structured log format**: JSON with timestamp, session ID, user ID, action type, inputs, outputs
3. **Separate audit store**: Don't mix audit logs with application logs
4. **Include model metadata**: Log which model version, temperature, system prompt was used
5. **Human decision capture**: Log when human reviews/approves AI outputs
6. **Async logging**: Don't block response path; log asynchronously to meet SLA

**Warning signs:**
- Cannot reproduce how a specific answer was generated
- No record of which document versions were in knowledge base at query time
- System prompt changes not version-controlled
- User sessions not linkable to specific interactions
- "We can add logging later" appears in design discussions

**FSI compliance implications:**
- FINRA: Prompt/output logs classified as records for supervision/recommendations
- SEC: Time-stamped audit trails of all AI-driven activities required
- EU AI Act: High-risk systems must maintain logs throughout lifecycle
- Missing audit trails = demo cannot progress to pilot with compliance review

**Phase to address:**
**All Demos** - Infrastructure requirement. Implement audit logging infrastructure in Phase 1; use across all demos.

---

### Pitfall 8: Citation Accuracy Theater

**What goes wrong:**
Systems display citations that don't actually support the generated answer. Research shows 25% of citations in RAG systems don't support the response they're attached to. In FSI demos, a compliance officer will verify citations—fake or inaccurate citations are worse than no citations.

**Why it happens:**
- Citations generated separately from answer (not verified against actual content)
- Retrieved chunks used for answer generation but different text displayed as citation
- Page numbers invented or approximated rather than extracted from retrieval
- Multiple documents chunked without preserving source attribution
- Citation formatting prioritized over citation accuracy

**How to avoid:**
1. **Verify citation supports claim**: NLI model check that citation text entails the answer
2. **Show retrieved text**: Display actual text that generated the answer, not paraphrased citation
3. **Precise source attribution**: Include document name, section, page, paragraph
4. **Click-to-verify**: Demo should allow clicking citation to see source document
5. **Citation confidence score**: Flag low-confidence citations for human verification
6. **Pre-validate demo citations**: For curated Q&A pairs, manually verify all citations

**Warning signs:**
- Citations point to correct document but wrong section
- Page numbers don't exist in source document
- Citation text doesn't mention the specific claim it supports
- Multiple answers use identical generic citation
- Citations only at document level, not section/paragraph level

**FSI compliance implications:**
- Compliance officers will check citations—inaccurate citations destroy trust
- Regulatory guidance must be traceable to official source
- False citations on compliance questions create liability

**Phase to address:**
**Demo 1 (Regulatory Q&A)** - Core requirement. Citation verification is non-negotiable for regulatory content.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems in FSI AI systems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip audit logging | Faster development, simpler architecture | Cannot pass FSI compliance review; 3-5x retrofit cost | **Never** in FSI context |
| Auto-execute SQL from NL2SQL | Smoother demo flow | Security vulnerability; regulatory violation if breached | **Never** - always show query first |
| Single embedding model without version pinning | Easier updates | Index invalidation; relevance regression | Never for production; acceptable for POC only |
| Trust RAG without citation verification | Simpler implementation | Hallucinations damage credibility; compliance risk | Never for regulatory content |
| Hard-code demo credentials | Quick setup | Security breach if code shared; bad practice propagates | Development only; never in demo environment |
| Skip confidence scoring | Cleaner UI | Users trust incorrect answers; no way to flag uncertainty | Never - always show confidence indicator |
| Ignore response time SLA (3s) | Feature completeness | Demo unusable in customer meetings; perception of poor performance | Acceptable during early development only |

## Integration Gotchas

Common mistakes when connecting FSI AI demos to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OCI GenAI API | Using synchronous calls for streaming responses | Use SSE streaming with eventsource-parser; handle partial responses |
| Vector Database | Updating embedding model without reindexing | Pin embedding model version; plan reindex before model change |
| SQLite (agent-state) | WAL mode disabled; concurrent access failures | Enable WAL mode (already done in codebase); use connection pooling |
| Document Understanding | Assuming all document types supported | Check supported formats; pre-convert unsupported types (e.g., HEIC to JPEG) |
| OCI Object Storage | Large file uploads blocking main thread | Use presigned URLs for direct upload; async processing for extraction |
| TanStack Query | Cache invalidation on model/prompt changes | Include model version in query keys; invalidate on config changes |
| A2A Protocol (multiagent) | No timeout on agent communication | Implement per-agent timeouts; fallback to single-agent response |

## Performance Traps

Patterns that work at demo scale but fail in customer-facing scenarios.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous embedding generation | Response time spikes on first query | Pre-generate embeddings at index time; cache common query embeddings | First query after cold start |
| Unbounded context window | Long regulatory docs exceed model limits | Implement smart chunking; use map-reduce for long documents | Documents > 100K tokens |
| Single-threaded agent orchestration | Multiagent response times 3-5x single agent | Parallelize independent agent queries; use async/await properly | > 2 concurrent agent calls |
| Full document retrieval | Memory exhaustion; slow response | Retrieve chunks, not full documents; stream large results | Documents > 1MB; > 10 concurrent users |
| Unoptimized vector search | Search latency > 500ms | Use HNSW indexing; implement caching layer; filter before search | > 100K vectors; complex queries |
| Blocking audit logging | Response time degraded by 50-100ms | Async logging; batch writes; separate audit database | High-frequency interactions |

## Security Mistakes

FSI-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging PII in audit trails | GDPR/CCPA violation; regulatory fines | PII redaction before logging; separate PII-free logs for debugging |
| Demo data containing real customer info | Data breach; regulatory reporting required | Use synthetic data only; automated PII detection in test data |
| Shared credentials across demo users | Cannot attribute actions; audit trail compromised | Per-user authentication even in demos; session isolation |
| Prompt injection via uploaded documents | System prompt leakage; unauthorized actions | Sanitize document content; restrict document-sourced instructions |
| Exposing model confidence internals | Gaming fraud detection thresholds | Show human-readable confidence only; hide raw scores |
| Unencrypted data at rest (SQLite) | Data exposure if demo machine compromised | Encrypt agent-state database; use OCI Vault for credentials |
| Third-party AI tool data leakage | Sensitive data in vendor training sets | Use only OCI GenAI (no external providers); validate data handling |

## UX Pitfalls

Common user experience mistakes that undermine FSI demo credibility.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hiding confidence levels | Users trust incorrect answers | Always display confidence indicator; explain what it means |
| Generic error messages | User cannot diagnose issue; appears broken | Specific error messages with suggested actions ("Try rephrasing your question") |
| No loading indicators for slow operations | User thinks system crashed | Show progress indicator; explain what system is doing ("Searching 5,000 regulatory documents...") |
| Forcing immediate answer without "I don't know" | System makes up answers to appear capable | Allow "I cannot find information about that" responses |
| Cluttered citation display | Key sources buried in noise | Prioritize citations by relevance; show top 3 with "show more" |
| No explanation of limitations | User expects more than system can deliver | Clear scope statement ("This system covers EU MiFID II and CRR/CRD IV regulations") |
| Desktop-only responsive failures | Demo fails when prospect uses tablet in meeting | Responsive design even if mobile not required; test tablet viewport |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces for FSI demos.

- [ ] **RAG Q&A**: Often missing citation verification — verify citations actually support the generated answer using NLI
- [ ] **NL2SQL**: Often missing query preview — verify user sees and approves SQL before execution
- [ ] **Document Extraction**: Often missing confidence thresholds — verify low-confidence extractions route to human review
- [ ] **Multiagent**: Often missing timeout handling — verify graceful degradation when agent fails or hangs
- [ ] **Fraud Detection**: Often missing explainability — verify each alert includes reason codes/contributing factors
- [ ] **All Demos**: Often missing audit logging — verify all interactions logged with session, timestamp, model version
- [ ] **All Demos**: Often missing error handling — verify graceful error messages for network/API failures
- [ ] **All Demos**: Often missing response time monitoring — verify 3-second SLA tracked and alerted

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RAG hallucination discovered in demo | LOW | Acknowledge error; show how citations help detect; add to curated Q&A validation |
| NL2SQL generates dangerous query | MEDIUM | Show query wasn't executed; explain guardrails; demonstrate read-only protection |
| Multiagent timeout during demo | LOW | Explain distributed nature; show fallback single-agent response; continue demo |
| Document extraction error | LOW | Show human review workflow; explain confidence-based routing; frame as feature not bug |
| Audit logs missing for compliance question | HIGH | Retrofit logging immediately; rerun affected demos to populate logs; document gap |
| Citation inaccuracy discovered | MEDIUM | Acknowledge; show verification process; update citation for that Q&A pair |
| Security vulnerability identified | HIGH | Immediate disclosure to stakeholders; patch and re-test; security review before resuming |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RAG Hallucination | Demo 1 (Regulatory Q&A) | All demo responses have verified citations with section/page numbers |
| NL2SQL Injection | Demo 2 (Credit Risk) | Query preview required; read-only DB connection; injection test suite passes |
| Multiagent Coordination | Demo 4 (Financial Advisor) | Response time < 3s with 4 agents; graceful degradation on agent failure |
| Document Extraction Accuracy | Demo 3 (Claims Processor) | Human review queue exists; confidence thresholds configured; accuracy reported |
| Fraud False Positives | Demo 5 (Fraud Triage) | Curated demo data with known correct prioritization; explainability for each alert |
| Vector Search Relevance | Demo 1 + Demo 5 | Hybrid search implemented; reranking enabled; internal benchmark passes |
| Missing Audit Trails | Phase 1 Infrastructure | All demos share audit logging; logs include session, timestamp, model version |
| Citation Accuracy | Demo 1 (Regulatory Q&A) | NLI verification for citations; click-to-verify shows source text |

## Sources

**Industry Analysis & Statistics:**
- [Project Purgatory: Avoiding AI Failures in Financial Services](https://www.financierworldwide.com/project-purgatory-avoiding-ai-failures-in-financial-services) - 80% of FSI AI projects fail to reach production
- [Insights into 2025 AI Challenges in Financial Services](https://www.bai.org/banking-strategies/insights-into-2025-ai-and-api-challenges-in-financial-services/) - Latency and performance concerns

**RAG and Hallucination Research:**
- [Legal RAG Hallucinations Study](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf) - RAG tools hallucinate 17-33% of responses
- [Mitigating LLM Hallucination in Banking](https://dspace.mit.edu/bitstream/handle/1721.1/162944/sert-dsert-meng-eecs-2025-thesis.pdf) - MIT thesis on banking domain
- [LLM Hallucinations: Implications for Financial Institutions](https://biztechmagazine.com/article/2025/08/llm-hallucinations-what-are-implications-financial-institutions) - 41% hallucination rate in finance queries

**Security & Injection:**
- [Database Query-Based Prompt Injection Attacks](https://www.keysight.com/blogs/en/tech/nwvs/2025/07/31/db-query-based-prompt-injection) - P2SQL injection attack vector
- [Prompt Injection May Never Be Fixed](https://www.malwarebytes.com/blog/news/2025/12/prompt-injection-is-a-problem-that-may-never-be-fixed-warns-ncsc) - NCSC warning

**Regulatory Frameworks:**
- [SR 11-7 Model Risk Management](https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm) - Federal Reserve guidance
- [SR 11-7 AI Governance](https://www.modelop.com/ai-governance/ai-regulations-standards/sr-11-7) - Explainability requirements
- [FINRA 2026 Regulatory Oversight Report](https://www.finra.org/media-center/newsreleases/2025/finra-publishes-2026-regulatory-oversight-report-empower-member-firm) - GenAI logging requirements
- [GenAI in Financial Services: Compliance Playbook](https://www.shumaker.com/insight/client-alert-generative-artificial-intelligence-in-financial-services-a-practical-compliance-playbook-for-2026/) - Practical compliance guidance

**Multiagent Systems:**
- [Why Multi-Agent LLM Systems Fail](https://arxiv.org/pdf/2503.13657) - Academic research on failure modes
- [Escaping the 17x Error Trap](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) - Coordination failures
- [Multi-Agent Coordination Strategies](https://galileo.ai/blog/multi-agent-coordination-strategies) - Prevention approaches

**Document Processing & IDP:**
- [IDP Market Statistics 2025](https://www.docsumo.com/blogs/intelligent-document-processing/intelligent-document-processing-market-report-2025) - Market and accuracy data
- [IDP Accuracy in Claims Processing](https://indicodata.ai/blog/improving-accuracy-in-claims-processing-with-intelligent-document-processing/) - Real-world accuracy challenges

**Fraud Detection:**
- [AI Fraud Prevention: Hidden Risks](https://thepaymentsassociation.org/article/ai-and-fraud-prevention-the-hidden-risks-of-false-positives-and-black-box-models/) - False positive and explainability risks
- [J.P. Morgan AI Fraud Detection](https://www.jpmorgan.com/insights/payments/security-trust/ai-payments-efficiency-fraud-reduction) - Production deployment results
- [HSBC AI Fraud Results](https://www.ibm.com/think/topics/ai-fraud-detection-in-banking) - 60% false positive reduction

**Vector Search:**
- [Vector Search Bottleneck Study](https://venturebeat.com/ai/new-deepmind-study-reveals-a-hidden-bottleneck-in-vector-search-that-breaks) - DeepMind research on limitations
- [When Good Models Go Bad](https://weaviate.io/blog/when-good-models-go-bad) - Embedding model compatibility issues

**Citation Accuracy:**
- [LLM Citation Generation 2025](https://medium.com/@prestonblckbrn/exploring-llm-citation-generation-in-2025-4ac7c8980794) - Citation accuracy research
- [LLM-CITE Verification Method](https://openreview.net/pdf?id=qb2QRoE4W3) - Citation verification approach

---
*Pitfalls research for: FSI AI Demo Suite*
*Researched: 2026-02-03*
*Confidence: HIGH - Verified through regulatory documents, academic research, and production case studies*
