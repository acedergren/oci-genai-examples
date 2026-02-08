# Oracle AI Database 26AI — Advanced Features Research

> Deep analysis of Oracle 26AI features for maximizing ROI in the OCI Self-Service Portal

## Executive Summary — Top 5 Highest-ROI Features

| Rank | Feature                                            | ROI    | Complexity | Why                                                                                                          |
| ---- | -------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | **JSON Relational Duality Views**                  | HIGH   | Medium     | Eliminate the entire repository layer for CRUD — expose tables as JSON documents with automatic consistency  |
| 2    | **Select AI + Select AI Agent**                    | HIGH   | Medium     | Natural language → SQL directly in the database; build agentic workflows that combine private data with LLMs |
| 3    | **DBMS_VECTOR_CHAIN (In-DB Chunking + Embedding)** | HIGH   | Low        | Move chunking and embedding generation from Node.js to the database — single INSERT does chunk+embed+store   |
| 4    | **Hybrid Vector Index (HNSW)**                     | HIGH   | Low        | Replace IVF index with HNSW + hybrid text/vector — single index replaces two separate indexes (002 + 007)    |
| 5    | **Data Annotations + SQL Domains**                 | MEDIUM | Low        | Teach AI agents about your schema semantics — improves Select AI accuracy dramatically                       |

These five features compound: Duality Views simplify the API, Select AI enables natural language queries, DBMS_VECTOR handles RAG pipelines in-DB, HNSW hybrid search replaces two indexes with one, and annotations make everything AI-aware.

**Also notable**: JavaScript MLE (MEDIUM-HIGH ROI), Data Redaction (MEDIUM-HIGH for multi-tenant security), ADB built-in MCP Server (MEDIUM), and Select AI Agent (MEDIUM-HIGH for agentic workflows).

---

## What We Already Have (Baseline)

Before diving into new features, here's what's already implemented:

| Feature                               | Migration           | Status   |
| ------------------------------------- | ------------------- | -------- |
| Vector search (VECTOR(1536, FLOAT32)) | 002-vector.sql      | Deployed |
| Oracle Text (CTXSYS.CONTEXT)          | 007-ai-features.sql | Deployed |
| Blockchain audit table                | 007-ai-features.sql | Deployed |
| SQL/PGQ Property Graph                | 008-graph.sql       | Deployed |
| MERGE INTO atomic upserts             | rate_limiter.ts     | Deployed |
| IS JSON constraints                   | Multiple migrations | Deployed |
| Connection pooling (oracledb)         | connection.ts       | Deployed |

---

## Feature Analysis

### 1. JSON Relational Duality Views

**What it does**: Exposes relational tables as JSON document collections with full CRUD support. The data lives in normalized tables but can be accessed as nested JSON documents — with automatic consistency guarantees.

**Project use case**: Replace the entire repository layer for standard CRUD operations. Instead of writing `sessionRepository.create()`, `sessionRepository.getById()`, etc., a Duality View over `chat_sessions` + `chat_turns` + `tool_executions` would expose a single JSON document containing the session and all its children.

```sql
CREATE JSON RELATIONAL DUALITY VIEW chat_session_view AS
SELECT JSON {
    '_id': s.id,
    'title': s.title,
    'model': s.model,
    'createdAt': s.created_at,
    'turns': [
        SELECT JSON {
            'id': t.id,
            'userMessage': t.user_message,
            'assistantResponse': t.assistant_response,
            'createdAt': t.created_at
        }
        FROM chat_turns t WITH UPDATE
        WHERE t.session_id = s.id
    ]
}
FROM chat_sessions s WITH INSERT UPDATE DELETE;
```

**Concrete benefits**:

- Eliminates ~500 lines of repository boilerplate (session, audit, workflow repos)
- Automatic optimistic locking via ETags
- MongoDB-compatible API access (if ORDS enabled)
- REST API auto-generated via ORDS AutoREST
- Fastify v1 API could query Duality Views directly

**Complexity**: Medium — requires rethinking repository pattern, but migration is incremental (one view per entity)

**ROI**: HIGH — reduces code, eliminates bugs in manual SQL, provides built-in API

**Prerequisites**: Available on ADB 26AI. Works with existing tables.

---

### 2. Select AI + Select AI Agent

**What it does**:

- **Select AI**: Converts natural language to SQL using LLMs, aware of your schema
- **Select AI Agent**: Runs agentic AI workflows inside the database with tools (SQL, REST, MCP)

**Project use case**:

_Select AI_: The chat interface already has 60+ OCI tools. Adding Select AI means users can ask questions about their own portal data in natural language: "Show me all failed tool executions in the last week" → generates and runs SQL automatically.

_Select AI Agent_: Build AI agents that combine database queries with OCI GenAI calls — e.g., "Analyze my spending trends and suggest cost optimizations" would query audit tables, call OCI billing APIs, and generate a summary.

```sql
-- Setup AI profile pointing to OCI GenAI
BEGIN
    DBMS_CLOUD_AI.CREATE_PROFILE(
        profile_name => 'portal_ai',
        attributes   => '{
            "provider": "oci",
            "model": "cohere.command-r-plus",
            "oci_credential_name": "OCI$RESOURCE_PRINCIPAL"
        }'
    );
    DBMS_CLOUD_AI.SET_PROFILE(profile_name => 'portal_ai');
END;

-- Natural language query
SELECT AI SHOWSQL Tell me which tools are used most by admin users;

-- Agent with tools
SELECT AI AGENT
    USING TOOLS (sql_tool, oci_billing_tool)
    What are the top cost drivers for org 'acme-corp'?;
```

**Concrete benefits**:

- Natural language data exploration for portal admins
- Agentic workflows for complex multi-step analyses
- Reduces need for custom analytics endpoints
- Database-native MCP server — our portal becomes an MCP client

**Complexity**: Medium — profile setup + schema annotations needed for accuracy

**ROI**: HIGH — transforms the portal from "tool runner" to "data analyst"

**Prerequisites**: ADB Serverless. OCI GenAI service enabled. DBMS_CLOUD_AI package.

---

### 3. DBMS_VECTOR_CHAIN — In-Database Chunking + Embedding

**What it does**: Performs document chunking, embedding generation, and vector storage in a single SQL statement — no external API calls needed for the embedding pipeline.

**Project use case**: Currently, embedding generation happens in Node.js (calling OCI GenAI embedding endpoint) and then we INSERT the vector. With DBMS_VECTOR_CHAIN, we can:

```sql
-- Single INSERT that chunks + embeds + stores
INSERT INTO conversation_embeddings (session_id, turn_id, content_type, text_content, embedding)
SELECT
    :session_id,
    :turn_id,
    'user_message',
    chunk_text,
    TO_VECTOR(DBMS_VECTOR_CHAIN.UTL_TO_EMBEDDING(
        chunk_text,
        JSON('{"provider":"ocigenai","model":"cohere.embed-english-v3.0"}')
    ))
FROM TABLE(DBMS_VECTOR_CHAIN.UTL_TO_CHUNKS(
    :user_message,
    JSON('{"max_size":"500","split":"sentence"}')
));
```

**Concrete benefits**:

- Eliminates embedding API calls from Node.js layer
- Automatic chunking strategy (sentence, paragraph, token-based)
- Hybrid search: combine VECTOR_DISTANCE() with Oracle Text CONTAINS()
- ONNX model upload — embed locally without API calls
- End-to-end RAG pipeline in SQL

**Enhanced hybrid search example**:

```sql
-- Hybrid keyword + vector search (already have Text index from 007)
SELECT t.user_message, t.assistant_response,
       VECTOR_DISTANCE(e.embedding, :query_vector, COSINE) AS semantic_score,
       SCORE(1) AS keyword_score
FROM chat_turns t
JOIN conversation_embeddings e ON e.turn_id = t.id
WHERE CONTAINS(t.user_message, :keyword_query, 1) > 0
ORDER BY (0.7 * (1 - VECTOR_DISTANCE(e.embedding, :query_vector, COSINE))
        + 0.3 * SCORE(1)) DESC
FETCH FIRST 10 ROWS ONLY;
```

**Complexity**: Low — SQL-only changes, no new infrastructure

**ROI**: HIGH — simplifies architecture, reduces external API calls, enables hybrid search

**Prerequisites**: ADB 26AI. OCI GenAI credential or ONNX model uploaded.

---

### 4. Hybrid Vector Index (HNSW)

**What it does**: Oracle 26AI's `CREATE HYBRID VECTOR INDEX` combines full-text search (Oracle Text) with vector similarity search (HNSW) into a single index. Queries automatically fuse keyword matches with semantic similarity using reciprocal rank fusion.

**Project use case**: We currently have **two separate indexes** on different tables:

- Migration 002: `idx_embeddings_vector` — IVF vector index on `conversation_embeddings(embedding)`
- Migration 007: `idx_chat_turns_text` — Oracle Text CTXSYS.CONTEXT on `chat_turns(user_message)`

These require separate queries + manual score merging in Node.js. A Hybrid Vector Index replaces both with a single index that also upgrades IVF → HNSW (faster in-memory graph-based search).

```sql
-- Replace both indexes with a single hybrid index
DROP INDEX idx_embeddings_vector;

CREATE HYBRID VECTOR INDEX idx_embeddings_hybrid
    ON conversation_embeddings(text_content)
    PARAMETERS ('
        VECTOR COLUMN embedding
        DISTANCE COSINE
        VECTOR INDEX TYPE HNSW
        NEIGHBORS 32
        EFCONSTRUCTION 200
        ACCURACY 95
    ');

-- Single query: automatic keyword + semantic fusion
SELECT id, text_content, session_id,
       VECTOR_DISTANCE(embedding, TO_VECTOR(:queryVec, 1536, FLOAT32), COSINE) AS vec_score
FROM conversation_embeddings
WHERE CONTAINS(text_content, :keyword, 1) > 0
ORDER BY VECTOR_DISTANCE(embedding, TO_VECTOR(:queryVec, 1536, FLOAT32), COSINE) ASC
FETCH FIRST 10 ROWS ONLY;
```

**Concrete benefits**:

- Replaces two indexes with one
- HNSW is significantly faster than IVF for similarity search
- Automatic reciprocal rank fusion (no manual score merging)
- Better search quality — combines exact keyword matches with semantic understanding

**Complexity**: Low — DDL changes to replace indexes, update queries in embedding-repository.ts

**ROI**: HIGH — better search quality + faster performance + simpler code

**Prerequisites**: ADB 26AI. Sufficient memory for HNSW (ADB manages automatically).

---

### 5. JavaScript MLE (Multilingual Engine)

**What it does**: Runs JavaScript (GraalVM-based, Node.js-compatible APIs) directly inside the Oracle database as stored procedures. Uses `mle-js-oracledb` API that mirrors `node-oracledb`.

**Project use case**: Move validation, transformation, and complex business logic into the database:

```sql
-- Create a JS module for workflow validation
CREATE MLE MODULE workflow_validator LANGUAGE JAVASCRIPT AS
import oracledb from "mle-js-oracledb";

export function validateWorkflowDefinition(definitionJson) {
    const def = JSON.parse(definitionJson);
    const errors = [];

    // Validate node connections
    for (const node of def.nodes) {
        if (node.type === 'condition' && !node.data.trueTarget) {
            errors.push(`Condition node ${node.id} missing trueTarget`);
        }
    }

    // Cycle detection (Kahn's algorithm — same as our executor)
    const inDegree = new Map();
    // ... topology validation ...

    return JSON.stringify({ valid: errors.length === 0, errors });
}
/

-- Call from SQL
CREATE FUNCTION validate_workflow(p_definition CLOB) RETURN CLOB
AS MLE MODULE workflow_validator SIGNATURE 'validateWorkflowDefinition(string)';

-- Use in CHECK constraint or trigger
ALTER TABLE workflow_definitions ADD CONSTRAINT chk_valid_workflow
    CHECK (JSON_VALUE(validate_workflow(definition), '$.valid' RETURNING NUMBER) = 1);
```

**Concrete benefits**:

- Share validation logic between API (Zod schemas) and database (MLE constraints)
- Complex JSON transformations without PL/SQL
- Reuse existing TypeScript patterns (our camelCase ↔ snake_case converters)
- Server-side computed columns
- Eliminate round-trips for multi-step validations

**Complexity**: Medium — requires learning MLE module packaging and deployment

**ROI**: MEDIUM-HIGH — reduces round-trips, ensures consistency, but requires new deployment workflow

**Prerequisites**: ADB 26AI. MLE enabled (default on ADB).

---

### 5. Data Annotations + SQL Domains

**What it does**:

- **Data Annotations**: Metadata that describes the purpose, semantics, and characteristics of data columns — helping AI models understand your schema
- **SQL Domains**: Named, reusable column constraints with semantic meaning

**Project use case**: Make Select AI dramatically more accurate by annotating our schema:

```sql
-- SQL Domains for semantic types
CREATE DOMAIN email_address AS VARCHAR2(255)
    CONSTRAINT email_format CHECK (REGEXP_LIKE(VALUE, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'))
    DISPLAY 'Email Address'
    ANNOTATIONS (description 'User email address for authentication and notifications');

CREATE DOMAIN org_identifier AS VARCHAR2(36)
    ANNOTATIONS (description 'Organization ID - every user belongs to exactly one org');

CREATE DOMAIN oci_region AS VARCHAR2(30)
    ANNOTATIONS (
        description 'OCI region identifier',
        values 'eu-frankfurt-1, us-ashburn-1, us-phoenix-1, uk-london-1'
    );

-- Annotate existing tables for AI
ALTER TABLE tool_executions
    ANNOTATIONS (
        description 'Records every OCI tool execution. Each row = one CLI command.',
        title 'Tool Executions'
    );
ALTER TABLE tool_executions MODIFY tool_name
    ANNOTATIONS (
        description 'OCI CLI tool name like compute-list-instances, os-list-buckets'
    );
ALTER TABLE tool_executions MODIFY approval_level
    ANNOTATIONS (
        description 'Tool risk level: safe (read-only), moderate (state-changing), dangerous (destructive)',
        values 'safe, moderate, dangerous'
    );
```

**Concrete benefits**:

- Select AI becomes 5-10x more accurate with annotated schema
- AI agents understand business context (not just column names)
- Domains enforce constraints at the type level (like Zod but for SQL)
- Self-documenting schema — annotations visible in data dictionary
- Future-proofs for any AI feature that reads schema metadata

**Complexity**: Low — pure DDL, no code changes

**ROI**: MEDIUM — essential enabler for Select AI and agentic features

**Prerequisites**: ADB 26AI. No additional licensing.

---

### 6. Oracle Data Redaction (DBMS_REDACT)

**What it does**: Dynamically masks sensitive data at query time based on user context (role, IP, application). Data stays intact; only the query result is redacted.

**Project use case**: Multi-tenant data isolation + PII protection:

```sql
-- Redact email for non-admin users
BEGIN
    DBMS_REDACT.ADD_POLICY(
        object_schema => 'PORTAL',
        object_name   => 'USERS',
        column_name   => 'EMAIL',
        policy_name   => 'redact_user_email',
        function_type => DBMS_REDACT.PARTIAL,
        function_parameters => 'VVVVVVVVVV,VVVVVVVVVV,*,1,5',
        expression    => 'SYS_CONTEXT(''PORTAL_CTX'',''ROLE'') != ''admin'''
    );
END;
```

**Concrete benefits**:

- Database-level PII protection (defense in depth beyond RBAC)
- Different views of same data for different roles
- Audit queries see redacted results unless admin
- No application code changes needed — transparent to queries

**Complexity**: Medium — requires session context setup and policy design

**ROI**: MEDIUM — important for compliance but project already has RBAC

**Prerequisites**: ADB with Advanced Security Option (included in ADB by default).

---

### 7. ADB MCP Server (Built-in)

**What it does**: Oracle Autonomous AI Database has a built-in MCP server that exposes Select AI Agent tools. External AI clients (Claude Desktop, our portal) can connect via MCP to query the database.

**Project use case**: Our portal already builds an MCP server (Phase 8). The ADB built-in MCP server would complement it:

```
Portal MCP Server → exposes OCI tools to external AI clients
ADB MCP Server    → exposes database queries + Select AI to external AI clients
```

Combined, an AI agent could:

1. Query portal data via ADB MCP (Select AI)
2. Execute OCI operations via Portal MCP (tool registry)
3. Store results back via ADB MCP

**Concrete benefits**:

- Zero infrastructure — MCP server is built into ADB Serverless
- Enterprise-grade auth (Database Identity)
- AI agents get direct, governed access to data
- Complements our existing MCP server

**Complexity**: Low — configuration only, no code

**ROI**: MEDIUM — enables external AI integration patterns

**Prerequisites**: ADB Serverless with Select AI Agent configured.

---

### 8. ORDS AutoREST + Duality Views

**What it does**: ORDS automatically generates REST APIs for tables/views. Combined with Duality Views, you get full CRUD REST APIs with zero code.

**Project use case**: Replace the entire Fastify v1 API layer for standard CRUD:

```sql
-- Enable AutoREST on a duality view
BEGIN
    ORDS.ENABLE_OBJECT(
        p_enabled      => TRUE,
        p_schema       => 'PORTAL',
        p_object       => 'CHAT_SESSION_VIEW',
        p_object_type  => 'VIEW',
        p_object_alias => 'sessions'
    );
END;

-- Auto-generates:
-- GET    /ords/portal/sessions/           → list sessions
-- GET    /ords/portal/sessions/:id        → get session
-- POST   /ords/portal/sessions/           → create session
-- PUT    /ords/portal/sessions/:id        → update session
-- DELETE /ords/portal/sessions/:id        → delete session
```

**Concrete benefits**:

- Eliminates handwritten REST endpoints for CRUD operations
- Auto-generated OpenAPI spec
- Pagination, filtering, sorting out of the box
- Combined with Duality Views = full nested JSON CRUD

**Complexity**: Medium — ORDS deployment on ADB, auth integration with Better Auth

**ROI**: MEDIUM — saves significant code but auth integration adds complexity

**Prerequisites**: ORDS enabled on ADB (available on ADB Serverless).

---

### 9. True Cache

**What it does**: In-memory, consistent, automatically managed SQL cache. Reads from cache, writes go to primary — with automatic redo-apply to keep cache consistent.

**Project use case**: Cache frequently accessed data closer to the application:

- RBAC permission lookups (called on every request)
- Organization metadata
- Tool registry metadata
- Rate limit counters

**Concrete benefits**:

- Sub-millisecond reads for hot data
- Automatic consistency (no cache invalidation bugs)
- Reduces load on primary ADB
- Row or columnar format

**Complexity**: High — requires separate True Cache compute instance

**ROI**: LOW-MEDIUM — our current pool handles load fine; premature optimization

**Prerequisites**: Separate compute. Additional cost.

---

### 10. Oracle Machine Learning (OML)

**What it does**: In-database ML for classification, regression, clustering, anomaly detection — without moving data out.

**Project use case**:

- **Anomaly detection**: Flag unusual tool execution patterns (potential security threats)
- **Classification**: Auto-categorize chat sessions by topic
- **Clustering**: Group similar users for analytics dashboards

```sql
-- Train anomaly detection model on tool executions
BEGIN
    DBMS_DATA_MINING.CREATE_MODEL(
        model_name     => 'tool_anomaly_detector',
        mining_function => DBMS_DATA_MINING.CLASSIFICATION,
        data_table_name => 'tool_executions',
        target_column_name => 'is_anomalous'
    );
END;

-- Score new executions
SELECT te.*,
       PREDICTION(tool_anomaly_detector USING *) AS is_anomalous,
       PREDICTION_PROBABILITY(tool_anomaly_detector, 1 USING *) AS anomaly_score
FROM tool_executions te
WHERE te.created_at > SYSTIMESTAMP - INTERVAL '1' HOUR;
```

**Complexity**: High — requires training data, model tuning

**ROI**: LOW-MEDIUM — interesting for security analytics but premature

**Prerequisites**: ADB with ML enabled. Training data.

---

### 11. Property Graph Enhancements (26AI)

**What it does**: 26AI adds JSON column support for graphs, improved GRAPH_TABLE performance, and better integration with AI Vector Search.

**Project use case**: Our existing `portal_graph` (008-graph.sql) already covers relationships. 26AI enhancements let us:

```sql
-- Graph + Vector hybrid query: "Find users similar to me who used different tools"
SELECT gt.user_name, gt.tool_name,
       VECTOR_DISTANCE(e.embedding, :my_embedding, COSINE) AS similarity
FROM GRAPH_TABLE (portal_graph
    MATCH (u1 IS person) -[IS member_of]-> (o IS organization)
          <-[IS member_of]- (u2 IS person) -[IS created_workflow]-> (w IS workflow)
    WHERE u1.id = :my_user_id AND u2.id != :my_user_id
    COLUMNS (u2.display_name AS user_name, w.name AS tool_name, u2.id AS user_id)
) gt
JOIN conversation_embeddings e ON e.session_id IN (
    SELECT cs.id FROM chat_sessions cs WHERE cs.user_id = gt.user_id
)
ORDER BY similarity ASC
FETCH FIRST 10 ROWS ONLY;
```

**Complexity**: Low — builds on existing graph

**ROI**: MEDIUM — enables sophisticated recommendations and impact analysis

---

## Implementation Roadmap

### Phase A: Foundation (1-2 weeks) — Low complexity, high ROI

| Task | Feature                          | Migration               | Est.   |
| ---- | -------------------------------- | ----------------------- | ------ |
| A1   | Data Annotations on all tables   | 010-annotations.sql     | 2 days |
| A2   | SQL Domains for common types     | 010-annotations.sql     | 1 day  |
| A3   | DBMS_VECTOR_CHAIN chunking setup | 011-vector-chain.sql    | 2 days |
| A4   | Hybrid search (Text + Vector)    | embedding-repository.ts | 2 days |

### Phase B: API Simplification (2-3 weeks) — Medium complexity, high ROI

| Task | Feature                                    | Files                 | Est.   |
| ---- | ------------------------------------------ | --------------------- | ------ |
| B1   | Duality View: chat sessions                | 012-duality-views.sql | 3 days |
| B2   | Duality View: workflows                    | 012-duality-views.sql | 2 days |
| B3   | Duality View: audit/activity               | 012-duality-views.sql | 2 days |
| B4   | Refactor repositories to use Duality Views | All repos             | 3 days |
| B5   | Select AI profile setup                    | 013-select-ai.sql     | 2 days |

### Phase C: AI-Native Features (2-3 weeks) — Medium complexity, high ROI

| Task | Feature                            | Files               | Est.   |
| ---- | ---------------------------------- | ------------------- | ------ |
| C1   | Select AI natural language queries | New API endpoint    | 3 days |
| C2   | Select AI Agent with tools         | 013-select-ai.sql   | 3 days |
| C3   | ADB MCP Server configuration       | Infrastructure      | 2 days |
| C4   | JavaScript MLE validation modules  | 014-mle-modules.sql | 3 days |

### Phase D: Security & Analytics (2-3 weeks) — Medium-high complexity

| Task | Feature                       | Files              | Est.   |
| ---- | ----------------------------- | ------------------ | ------ |
| D1   | Data Redaction policies       | 015-redaction.sql  | 3 days |
| D2   | Graph + Vector hybrid queries | graph-analytics.ts | 3 days |
| D3   | In-DB anomaly detection (OML) | 016-oml-models.sql | 4 days |

### Phase E: Future (evaluate later)

| Task | Feature                | Notes                                       |
| ---- | ---------------------- | ------------------------------------------- |
| E1   | ORDS AutoREST          | Evaluate after Fastify migration stabilizes |
| E2   | True Cache             | Only if performance becomes an issue        |
| E3   | ADB MCP as primary MCP | After Select AI Agent is mature             |

---

## Architecture: How Features Interconnect

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  SvelteKit Frontend │ External AI Agents │ MCP Clients          │
└──────────┬──────────┴────────┬───────────┴──────────┬───────────┘
           │                   │                       │
           ▼                   ▼                       ▼
┌──────────────────┐  ┌───────────────┐  ┌────────────────────────┐
│  Fastify v1 API  │  │ Portal MCP    │  │ ADB MCP Server         │
│  (REST + Auth)   │  │ Server        │  │ (Built-in, zero-code)  │
└────────┬─────────┘  └──────┬────────┘  └───────────┬────────────┘
         │                   │                        │
         ▼                   ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORACLE ADB 26AI                               │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Duality Views   │  │ Select AI    │  │ DBMS_VECTOR_CHAIN │  │
│  │ (JSON ↔ Tables) │  │ (NL → SQL)   │  │ (Chunk + Embed)   │  │
│  └────────┬────────┘  └──────┬───────┘  └────────┬──────────┘  │
│           │                  │                    │              │
│           ▼                  ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              RELATIONAL TABLES (Existing)                │    │
│  │  users │ orgs │ sessions │ turns │ workflows │ audit    │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌──────────┐  ┌──────────┴──────┐  ┌────────────────────┐     │
│  │ SQL/PGQ  │  │ Data Redaction  │  │ JS MLE Modules     │     │
│  │ Graph    │  │ (DBMS_REDACT)   │  │ (Validation/Xform) │     │
│  └──────────┘  └─────────────────┘  └────────────────────┘     │
│                                                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ Data Annot.    │  │ SQL Domains  │  │ Blockchain Tables │   │
│  │ (AI Metadata)  │  │ (Type Safety)│  │ (Audit Ledger)    │   │
│  └────────────────┘  └──────────────┘  └───────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost / Licensing Notes

| Feature            | Included in ADB? | Notes                                          |
| ------------------ | ---------------- | ---------------------------------------------- |
| JSON Duality Views | Yes              | Base feature                                   |
| Select AI          | Yes              | ADB Serverless only                            |
| DBMS_VECTOR_CHAIN  | Yes              | May incur GenAI API costs for remote embedding |
| JavaScript MLE     | Yes              | Base feature                                   |
| Data Annotations   | Yes              | Base feature                                   |
| SQL Domains        | Yes              | Base feature                                   |
| Data Redaction     | Yes              | Included in ADB (Advanced Security)            |
| SQL/PGQ Graphs     | Yes              | Base feature                                   |
| True Cache         | Extra            | Requires additional compute                    |
| OML                | Yes              | Basic ML included in ADB                       |
| ORDS               | Yes              | Included in ADB                                |
| ADB MCP Server     | Yes              | ADB Serverless feature                         |

---

## Sources

- [Oracle AI Database 26ai New Features Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/nfcoa/)
- [Introducing Oracle AI Database 26ai](https://blogs.oracle.com/database/oracle-announces-oracle-ai-database-26ai)
- [JSON Relational Duality Views](https://docs.oracle.com/en/database/oracle/oracle-database/26/jsnvu/overview-json-relational-duality-views.html)
- [Select AI for Natural Language](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/sql-generation-ai-autonomous.html)
- [DBMS_VECTOR_CHAIN](https://docs.oracle.com/en/database/oracle/oracle-database/26/arpls/dbms_vector_chain1.html)
- [JavaScript MLE in Oracle 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/overview-multilingual-engine-javascript.html)
- [Oracle True Cache](https://docs.oracle.com/en/database/oracle/oracle-database/26/odbtc/overview-oracle-true-cache.html)
- [Data Redaction Enhancements](https://oracle-base.com/articles/23/data-redaction-dbms_redact-enhancements-23)
- [SQL/PGQ Property Graphs](https://oracle-base.com/articles/23/sql-property-graphs-and-sql-pgq-23)
- [ADB MCP Server](https://blogs.oracle.com/machinelearning/announcing-the-oracle-autonomous-ai-database-mcp-server)
- [Select AI Agent](https://blogs.oracle.com/machinelearning/build-your-agentic-solution-using-oracle-adb-select-ai-agent)
- [ORDS AutoREST](https://oracle-base.com/articles/misc/oracle-rest-data-services-ords-autorest)
- [AI Vector Search in Oracle 26ai](https://oracle-base.com/articles/23/ai-vector-search-23)
