# Roadmap: FSI AI Demo Suite

## Overview

This roadmap delivers five production-quality AI demos showcasing OCI Generative AI for Financial Services Industry use cases. The journey follows a dependency-driven build order: shared foundation infrastructure first (audit logging, synthetic data, RAG utilities), then the primary RAG demo (EU Regulatory Q&A) to validate core patterns, followed by three independent demos (Credit Risk, Insurance Claims, Financial Advisor), concluding with the most complex orchestration (Fraud Detection Triage). Each demo targets a specific FSI pain point with production-ready indicators: explainability, audit trails, human oversight, and sub-3-second responses.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation Infrastructure** - Shared utilities, audit logging, synthetic data generation
- [ ] **Phase 2: EU Regulatory Q&A** - Demo 1: RAG-powered compliance assistant with citations
- [ ] **Phase 3: Real-Time Credit Risk Assessment** - Demo 2: Voice-to-SQL loan officer assistant
- [ ] **Phase 4: Insurance Claims Document Processor** - Demo 3: Document understanding with extraction
- [ ] **Phase 5: Financial Advisor Knowledge Assistant** - Demo 4: Multi-agent A2A coordination
- [ ] **Phase 6: Fraud Detection Alert Triage** - Demo 5: Semantic search with prioritization

## Phase Details

### Phase 1: Foundation Infrastructure
**Goal**: All demos can leverage shared audit logging, RAG utilities, and synthetic data without duplication
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. Developer can import fsi-demo-utils and access RAG chunking, citation formatting, and confidence scoring utilities
  2. All prompts and responses are logged to SQLite with timestamps, queryable for audit compliance
  3. Synthetic data generator produces realistic credit profiles, fraud alerts, and claims documents on demand
  4. Pre-embedded regulatory documents load from vector store in under 500ms
  5. OCI GenAI Agents instance is configured with isolated knowledge bases accessible by all demos
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD
- [ ] 01-03: TBD

### Phase 2: EU Regulatory Q&A
**Goal**: Compliance officers can get accurate, cited answers to EU regulatory questions in under 3 seconds
**Depends on**: Phase 1
**Requirements**: DEMO1-01, DEMO1-02, DEMO1-03, DEMO1-04, DEMO1-05, DEMO1-06, DEMO1-07, DEMO1-08, DEMO1-09, DEMO1-10
**Success Criteria** (what must be TRUE):
  1. User can ask natural language questions about MiFID II, CRR/CRD IV, GDPR, and EBA Guidelines and receive accurate answers
  2. Every answer displays citations to specific regulatory articles/paragraphs (e.g., "MiFID II Article 24(1)")
  3. Each answer shows a confidence indicator reflecting retrieval and generation certainty
  4. System proactively suggests related requirements and shows cross-regulation links when relevant
  5. Query history with full audit trail persists across sessions and is accessible for compliance review
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Real-Time Credit Risk Assessment
**Goal**: Loan officers can query credit data using natural speech and understand risk factors with explainable visualizations
**Depends on**: Phase 1
**Requirements**: DEMO2-01, DEMO2-02, DEMO2-03, DEMO2-04, DEMO2-05, DEMO2-06, DEMO2-07, DEMO2-08, DEMO2-09, DEMO2-10
**Success Criteria** (what must be TRUE):
  1. Loan officer can speak naturally and see accurate transcription displayed before any query executes
  2. System converts speech to SQL and displays the generated query for review before execution
  3. Risk indicators (RED/YELLOW/GREEN) display with explainable factors showing why the rating was assigned
  4. Results compare applicant metrics to portfolio benchmarks with natural language explanations
  5. Multi-turn voice conversation supports follow-up questions without restarting context
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Insurance Claims Document Processor
**Goal**: Claims processors can upload documents and see structured data extracted with confidence indicators and human review flags
**Depends on**: Phase 1
**Requirements**: DEMO3-01, DEMO3-02, DEMO3-03, DEMO3-04, DEMO3-05, DEMO3-06, DEMO3-07, DEMO3-08, DEMO3-09, DEMO3-10
**Success Criteria** (what must be TRUE):
  1. User can upload insurance claim documents (PDF, images) and see structured data extraction begin immediately
  2. Extracted fields (policy number, amounts, dates) display with per-field confidence scores
  3. Low-confidence extractions are automatically flagged and routed to a human review queue
  4. Claims are classified by type and urgency with fraud indicators highlighted
  5. Batch processing shows progress for multiple documents with extracted data auto-populating form fields
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Financial Advisor Knowledge Assistant
**Goal**: Wealth managers can query across product, compliance, client, and market domains with visible multi-agent coordination
**Depends on**: Phase 1, Phase 2 (uses RAG patterns)
**Requirements**: DEMO4-01, DEMO4-02, DEMO4-03, DEMO4-04, DEMO4-05, DEMO4-06, DEMO4-07, DEMO4-08, DEMO4-09, DEMO4-10
**Success Criteria** (what must be TRUE):
  1. User can ask questions spanning multiple knowledge domains and receive comprehensive answers
  2. UI shows which specialized agents are involved and their coordination sequence
  3. Citations link to internal knowledge base sources with section references
  4. Query routing intelligence sends questions to relevant agent subset (not all agents every time)
  5. System produces unified responses without conflicting information, with graceful fallback if an agent times out
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Fraud Detection Alert Triage
**Goal**: Fraud analysts can semantically search cases, see prioritized alerts with explainability, and find similar historical patterns
**Depends on**: Phase 1, Phase 2 (uses vector search patterns)
**Requirements**: DEMO5-01, DEMO5-02, DEMO5-03, DEMO5-04, DEMO5-05, DEMO5-06, DEMO5-07, DEMO5-08, DEMO5-09, DEMO5-10
**Success Criteria** (what must be TRUE):
  1. Analyst can query historical fraud cases using semantic search (by meaning, not keywords)
  2. Dashboard displays alerts prioritized by urgency with recommended actions and reason codes
  3. Vector search finds similar past cases with resolution outcomes displayed
  4. Hybrid search combines vector similarity with structured filters (amount, geography, segment)
  5. SAR narrative draft generation provides regulatory filing starting points based on case data
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phases 3 and 4 could run in parallel as they share only Phase 1 dependency)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Infrastructure | 0/TBD | Not started | - |
| 2. EU Regulatory Q&A | 0/TBD | Not started | - |
| 3. Real-Time Credit Risk Assessment | 0/TBD | Not started | - |
| 4. Insurance Claims Document Processor | 0/TBD | Not started | - |
| 5. Financial Advisor Knowledge Assistant | 0/TBD | Not started | - |
| 6. Fraud Detection Alert Triage | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-03*
*Requirements coverage: 55/55 (100%)*
