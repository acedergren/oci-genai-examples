# Phase 1: Foundation Infrastructure - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Build shared utilities and infrastructure that all five FSI demos will leverage. This includes audit logging for compliance transparency, RAG utilities for document retrieval and citation, synthetic data generation for realistic demo scenarios, and pre-embedded regulatory documents in OCI GenAI Agents vector store. This phase establishes patterns that Phases 2-6 will consume.

</domain>

<decisions>
## Implementation Decisions

### Audit Logging Design
- **Dual purpose**: Compliance evidence (SOC 2, GDPR Article 30) AND demo transparency for prospects
- **Verbosity**: Full context logging - every prompt, retrieved chunk, full responses, all metadata for complete replay capability
- **Query interface**: Both SQL access (technical users) and Web UI (filtered views with CSV export for business users)
- **Retention**: Demo-friendly ephemeral storage - logs clear between demo runs or after 30 days (no long-term storage burden)

### RAG Utility API Surface
- **Chunking**: Claude's discretion - choose between semantic (section-aware) or fixed-size based on FSI document characteristics
- **Citation format**: Claude's discretion - balance between regulatory style (Article references) and prospect usability
- **Confidence scoring**: Multi-factor composite score incorporating document authority, citation count, answer coherence, and retrieval quality
- **Consistency**: Shared patterns across all demos - same chunking, citation format, confidence logic for maintainability and UX consistency

### Synthetic Data Quality
- **Realism level**: Demo-realistic (plausible) - data looks real at first glance, doesn't need deep business rule validation
- **Data types to generate**:
  - Credit applicant profiles (names, scores, income, debt ratios for Demo 2)
  - Insurance claims documents (PDFs with policy numbers, amounts, incidents for Demo 3)
  - Fraud alert records (transaction patterns, risk flags, outcomes for Demo 5)
  - Financial advisor knowledge base (product specs, compliance rules, scenarios for Demo 4)
- **Volume**: Realistic scale (1000+ records per demo) to demonstrate performance, search, filtering, and aggregations
- **Refresh strategy**: Hybrid approach - source real datasets from Kaggle as foundation, augment with synthetic variations on demand

### Vector Store & Document Loading
- **Pre-embedded documents**: All four EU regulatory frameworks
  - MiFID II (investor protection, transaction reporting)
  - CRR/CRD IV (capital requirements, liquidity, leverage)
  - GDPR (data privacy, consent, breach notification)
  - EBA Guidelines (risk management, governance, outsourcing)
- **Knowledge base architecture**: Shared vector store with demo tags - single OCI GenAI Agents instance, filter by demo_id
- **Document updates**: Claude's discretion - choose between static snapshot for v1 simplicity or manual re-embedding process
- **Load time target**: Claude's discretion - optimize for demo UX (sub-500ms ideal, under 2s acceptable)

</decisions>

<specifics>
## Specific Ideas

- Use Kaggle datasets as foundation for synthetic data - provides authentic patterns, augment with variations for demo scenarios
- Audit log serves dual audience: technical users query SQL directly, compliance officers use filtered Web UI with export
- All five demos share RAG patterns established here - consistency matters for prospect experience across demos

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-02-03*
