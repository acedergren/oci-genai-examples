// kyc-platform/src/schema.ts
import Database from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

/**
 * Initialize the complete KYC platform database schema
 * Covers all 4 use cases: Onboarding, Customer Service, Intelligence, Prospecting
 */
export function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );

    -- ===== CUSTOMER MANAGEMENT =====

    -- Unified customer profiles
    CREATE TABLE IF NOT EXISTS customers (
      id                    TEXT PRIMARY KEY,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL,

      -- Identity
      email                 TEXT UNIQUE NOT NULL,
      first_name            TEXT NOT NULL,
      last_name             TEXT NOT NULL,
      phone                 TEXT,
      date_of_birth         TEXT,

      -- Address
      address_line1         TEXT,
      address_line2         TEXT,
      city                  TEXT,
      state                 TEXT,
      postal_code           TEXT,
      country               TEXT,

      -- KYC Status
      kyc_status            TEXT DEFAULT 'pending' CHECK(kyc_status IN ('pending', 'in_progress', 'verified', 'rejected', 'flagged')),
      kyc_completed_at      INTEGER,
      kyc_verified_by       TEXT,
      risk_level            TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),

      -- Business Information
      occupation            TEXT,
      employer              TEXT,
      annual_income         REAL,
      net_worth             REAL,

      -- Profile Embeddings for similarity search
      profile_embedding     BLOB,

      -- Metadata
      source                TEXT DEFAULT 'direct',
      tags                  TEXT, -- JSON array
      notes                 TEXT,

      UNIQUE(email)
    );

    -- ===== KYC ONBOARDING =====

    -- KYC sessions track multi-step onboarding workflows
    CREATE TABLE IF NOT EXISTS kyc_sessions (
      id                    TEXT PRIMARY KEY,
      customer_id           TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL,
      completed_at          INTEGER,

      -- Workflow State
      status                TEXT DEFAULT 'started' CHECK(status IN ('started', 'in_progress', 'pending_review', 'completed', 'rejected', 'expired')),
      current_step          INTEGER DEFAULT 1,
      total_steps           INTEGER DEFAULT 7,

      -- Session Metadata
      session_type          TEXT DEFAULT 'individual' CHECK(session_type IN ('individual', 'business', 'joint')),
      channel               TEXT DEFAULT 'web' CHECK(channel IN ('web', 'mobile', 'branch', 'phone')),
      ip_address            TEXT,
      user_agent            TEXT,

      -- Risk Assessment
      fraud_score           REAL,
      duplicate_likelihood  REAL,
      manual_review_needed  INTEGER DEFAULT 0,

      -- Metadata
      config                TEXT, -- JSON configuration
      metadata              TEXT  -- JSON metadata
    );

    -- Documents uploaded during KYC
    CREATE TABLE IF NOT EXISTS documents (
      id                    TEXT PRIMARY KEY,
      customer_id           TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      session_id            TEXT REFERENCES kyc_sessions(id) ON DELETE CASCADE,
      created_at            INTEGER NOT NULL,

      -- Document Info
      document_type         TEXT NOT NULL CHECK(document_type IN ('passport', 'drivers_license', 'national_id', 'utility_bill', 'bank_statement', 'tax_return', 'other')),
      file_name             TEXT NOT NULL,
      file_path             TEXT NOT NULL,
      file_size             INTEGER NOT NULL,
      mime_type             TEXT NOT NULL,

      -- OCR Extraction
      extracted_data        TEXT, -- JSON structured data
      extraction_confidence REAL,
      extraction_method     TEXT DEFAULT 'ai', -- 'ai', 'manual', 'hybrid'

      -- Verification
      verified              INTEGER DEFAULT 0,
      verified_at           INTEGER,
      verified_by           TEXT,
      verification_notes    TEXT,

      -- Metadata
      document_embedding    BLOB, -- For duplicate detection
      metadata              TEXT  -- JSON metadata
    );

    -- Workflow steps track progress through multi-step processes
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id                    TEXT PRIMARY KEY,
      session_id            TEXT NOT NULL REFERENCES kyc_sessions(id) ON DELETE CASCADE,
      created_at            INTEGER NOT NULL,
      completed_at          INTEGER,

      -- Step Info
      step_number           INTEGER NOT NULL,
      step_name             TEXT NOT NULL,
      step_type             TEXT NOT NULL CHECK(step_type IN ('data_entry', 'document_upload', 'verification', 'review', 'approval', 'completion')),

      -- Status
      status                TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),

      -- AI Processing
      ai_confidence         REAL,
      ai_reasoning          TEXT,

      -- Data
      input_data            TEXT, -- JSON input
      output_data           TEXT, -- JSON output
      validation_errors     TEXT, -- JSON array of errors

      UNIQUE(session_id, step_number)
    );

    -- ===== HUMAN-IN-THE-LOOP APPROVALS =====

    -- Approval requests for flagged cases
    CREATE TABLE IF NOT EXISTS approval_requests (
      id                    TEXT PRIMARY KEY,
      created_at            INTEGER NOT NULL,
      resolved_at           INTEGER,

      -- Request Info
      request_type          TEXT NOT NULL CHECK(request_type IN ('kyc_approval', 'document_verification', 'risk_review', 'compliance_check', 'other')),
      entity_type           TEXT NOT NULL, -- 'customer', 'document', 'session', 'ticket'
      entity_id             TEXT NOT NULL,

      -- Status
      status                TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'escalated')),
      priority              TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),

      -- Assignment
      assigned_to           TEXT,
      assigned_at           INTEGER,

      -- Decision
      decision              TEXT CHECK(decision IN ('approve', 'reject', 'request_more_info', 'escalate')),
      decision_notes        TEXT,
      decided_by            TEXT,

      -- Context
      reason                TEXT NOT NULL,
      supporting_data       TEXT, -- JSON
      ai_recommendation     TEXT,
      ai_confidence         REAL
    );

    -- ===== AUDIT & COMPLIANCE =====

    -- Comprehensive audit trail
    CREATE TABLE IF NOT EXISTS audit_logs (
      id                    TEXT PRIMARY KEY,
      created_at            INTEGER NOT NULL,

      -- Event Info
      event_type            TEXT NOT NULL, -- 'customer_created', 'kyc_approved', 'document_uploaded', etc.
      event_category        TEXT NOT NULL CHECK(event_category IN ('customer', 'kyc', 'document', 'support', 'system', 'security')),
      severity              TEXT DEFAULT 'info' CHECK(severity IN ('debug', 'info', 'warning', 'error', 'critical')),

      -- Actor
      actor_type            TEXT NOT NULL CHECK(actor_type IN ('user', 'system', 'ai', 'api')),
      actor_id              TEXT,

      -- Target
      entity_type           TEXT NOT NULL,
      entity_id             TEXT NOT NULL,

      -- Details
      description           TEXT NOT NULL,
      changes               TEXT, -- JSON before/after
      metadata              TEXT, -- JSON additional context

      -- Security
      ip_address            TEXT,
      user_agent            TEXT
    );

    -- ===== CUSTOMER SERVICE =====

    -- Support tickets
    CREATE TABLE IF NOT EXISTS support_tickets (
      id                    TEXT PRIMARY KEY,
      customer_id           TEXT REFERENCES customers(id) ON DELETE SET NULL,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL,
      resolved_at           INTEGER,

      -- Ticket Info
      subject               TEXT NOT NULL,
      description           TEXT NOT NULL,
      status                TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed')),
      priority              TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),

      -- Classification
      category              TEXT, -- 'account', 'billing', 'technical', 'kyc', 'general'
      subcategory           TEXT,

      -- Assignment
      assigned_to           TEXT,
      assigned_at           INTEGER,
      department            TEXT, -- 'support', 'compliance', 'technical', 'billing'

      -- AI Analysis
      sentiment             TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative', 'angry')),
      sentiment_score       REAL,
      urgency_score         REAL,
      ai_suggested_category TEXT,
      ai_suggested_response TEXT,

      -- Resolution
      resolution_notes      TEXT,
      customer_satisfaction REAL, -- 1-5 rating

      -- Metadata
      source                TEXT DEFAULT 'web' CHECK(source IN ('web', 'email', 'phone', 'chat', 'social')),
      tags                  TEXT, -- JSON array
      metadata              TEXT
    );

    -- Ticket messages (conversation thread)
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id                    TEXT PRIMARY KEY,
      ticket_id             TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      created_at            INTEGER NOT NULL,

      -- Message Info
      author_type           TEXT NOT NULL CHECK(author_type IN ('customer', 'agent', 'system', 'ai')),
      author_id             TEXT,
      author_name           TEXT,

      -- Content
      message               TEXT NOT NULL,
      is_internal           INTEGER DEFAULT 0,

      -- AI Analysis
      sentiment             TEXT,
      contains_pii          INTEGER DEFAULT 0,

      -- Attachments
      attachments           TEXT  -- JSON array of attachment metadata
    );

    -- Knowledge base articles for RAG
    CREATE TABLE IF NOT EXISTS knowledge_base_articles (
      id                    TEXT PRIMARY KEY,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL,
      published_at          INTEGER,

      -- Content
      title                 TEXT NOT NULL,
      content               TEXT NOT NULL,
      summary               TEXT,

      -- Classification
      category              TEXT NOT NULL,
      subcategory           TEXT,
      tags                  TEXT, -- JSON array

      -- Status
      status                TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'published', 'archived')),

      -- RAG Optimization
      content_embedding     BLOB, -- For similarity search
      chunk_count           INTEGER, -- For large articles split into chunks

      -- Metadata
      author                TEXT,
      view_count            INTEGER DEFAULT 0,
      helpful_count         INTEGER DEFAULT 0,
      not_helpful_count     INTEGER DEFAULT 0,
      metadata              TEXT
    );

    -- ===== INTELLIGENCE & SEGMENTATION =====

    -- AI-generated customer segments
    CREATE TABLE IF NOT EXISTS customer_segments (
      id                    TEXT PRIMARY KEY,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL,

      -- Segment Info
      name                  TEXT NOT NULL,
      description           TEXT NOT NULL,

      -- AI Generation
      generation_method     TEXT DEFAULT 'clustering' CHECK(generation_method IN ('clustering', 'rule_based', 'hybrid', 'manual')),
      cluster_id            INTEGER,

      -- Characteristics
      characteristics       TEXT NOT NULL, -- JSON array of defining features
      typical_behavior      TEXT,

      -- Statistics
      member_count          INTEGER DEFAULT 0,
      avg_customer_value    REAL,
      risk_profile          TEXT,

      -- Centroid for clustering
      centroid_embedding    BLOB,

      -- Metadata
      is_active             INTEGER DEFAULT 1,
      metadata              TEXT
    );

    -- Customer segment membership
    CREATE TABLE IF NOT EXISTS customer_segment_members (
      customer_id           TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      segment_id            TEXT NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
      created_at            INTEGER NOT NULL,

      -- Membership strength
      confidence            REAL NOT NULL, -- 0-1 how strongly customer fits segment
      distance              REAL, -- Distance from segment centroid

      PRIMARY KEY(customer_id, segment_id)
    );

    -- ===== PROSPECTING & LEAD MANAGEMENT =====

    -- Prospect leads
    CREATE TABLE IF NOT EXISTS prospects (
      id                    TEXT PRIMARY KEY,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL,
      converted_at          INTEGER,

      -- Identity
      email                 TEXT UNIQUE NOT NULL,
      first_name            TEXT,
      last_name             TEXT,
      phone                 TEXT,
      company               TEXT,
      job_title             TEXT,

      -- Company Info
      company_size          TEXT, -- 'startup', 'smb', 'mid_market', 'enterprise'
      industry              TEXT,
      annual_revenue        REAL,

      -- Lead Status
      status                TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'disqualified')),
      stage                 TEXT, -- Sales funnel stage

      -- Source
      source                TEXT NOT NULL, -- 'manual', 'import', 'referral', 'inbound', 'outbound'
      campaign              TEXT,

      -- Assignment
      assigned_to           TEXT,
      assigned_at           INTEGER,

      -- Conversion
      converted_to_customer TEXT REFERENCES customers(id),

      -- Metadata
      tags                  TEXT, -- JSON array
      notes                 TEXT,
      metadata              TEXT
    );

    -- AI lead scoring
    CREATE TABLE IF NOT EXISTS prospect_scores (
      id                    TEXT PRIMARY KEY,
      prospect_id           TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
      created_at            INTEGER NOT NULL,

      -- Overall Score
      overall_score         REAL NOT NULL, -- 0-100
      quality_tier          TEXT CHECK(quality_tier IN ('cold', 'warm', 'hot', 'qualified')),

      -- Component Scores
      fit_score             REAL, -- How well prospect fits ICP
      timing_score          REAL, -- Likelihood to buy soon
      budget_score          REAL, -- Budget availability
      authority_score       REAL, -- Decision-maker access

      -- AI Analysis
      reasoning             TEXT, -- AI explanation of score
      key_signals           TEXT, -- JSON array of positive/negative signals
      recommended_actions   TEXT, -- JSON array of next steps

      -- Confidence
      confidence            REAL, -- AI confidence in scoring

      -- Model Info
      model_version         TEXT,
      scoring_method        TEXT DEFAULT 'ai' CHECK(scoring_method IN ('ai', 'rule_based', 'hybrid', 'manual'))
    );

    -- Prospect engagement tracking
    CREATE TABLE IF NOT EXISTS prospect_engagements (
      id                    TEXT PRIMARY KEY,
      prospect_id           TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
      created_at            INTEGER NOT NULL,

      -- Engagement Info
      engagement_type       TEXT NOT NULL, -- 'email_opened', 'link_clicked', 'meeting_scheduled', 'document_viewed', etc.
      engagement_value      REAL DEFAULT 0, -- Weighted value for scoring

      -- Details
      description           TEXT,
      metadata              TEXT -- JSON additional context
    );

    -- ===== INDEXES FOR PERFORMANCE =====

    -- Customer indexes
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_kyc_status ON customers(kyc_status);
    CREATE INDEX IF NOT EXISTS idx_customers_risk_level ON customers(risk_level);
    CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at DESC);

    -- KYC session indexes
    CREATE INDEX IF NOT EXISTS idx_kyc_sessions_customer ON kyc_sessions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_kyc_sessions_status ON kyc_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_kyc_sessions_updated ON kyc_sessions(updated_at DESC);

    -- Document indexes
    CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
    CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

    -- Workflow step indexes
    CREATE INDEX IF NOT EXISTS idx_workflow_steps_session ON workflow_steps(session_id, step_number);
    CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);

    -- Approval request indexes
    CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status, priority);
    CREATE INDEX IF NOT EXISTS idx_approval_requests_assigned ON approval_requests(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON approval_requests(entity_type, entity_id);

    -- Audit log indexes
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(event_category);

    -- Support ticket indexes
    CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, priority);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);

    -- Ticket message indexes
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

    -- Knowledge base indexes
    CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON knowledge_base_articles(status);
    CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON knowledge_base_articles(category);
    CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON knowledge_base_articles(published_at DESC);

    -- Segment indexes
    CREATE INDEX IF NOT EXISTS idx_customer_segments_active ON customer_segments(is_active);
    CREATE INDEX IF NOT EXISTS idx_segment_members_customer ON customer_segment_members(customer_id);
    CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON customer_segment_members(segment_id);

    -- Prospect indexes
    CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
    CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
    CREATE INDEX IF NOT EXISTS idx_prospects_assigned ON prospects(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_prospects_created ON prospects(created_at DESC);

    -- Prospect score indexes
    CREATE INDEX IF NOT EXISTS idx_prospect_scores_prospect ON prospect_scores(prospect_id);
    CREATE INDEX IF NOT EXISTS idx_prospect_scores_tier ON prospect_scores(quality_tier);
    CREATE INDEX IF NOT EXISTS idx_prospect_scores_score ON prospect_scores(overall_score DESC);

    -- Engagement indexes
    CREATE INDEX IF NOT EXISTS idx_prospect_engagements_prospect ON prospect_engagements(prospect_id, created_at DESC);
  `);

  // Insert or update schema version
  const existing = db.prepare('SELECT version FROM schema_version').get();
  if (!existing) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
  }
}

export function getSchemaVersion(db: Database.Database): number {
  const row = db.prepare('SELECT version FROM schema_version').get() as
    | { version: number }
    | undefined;
  return row?.version ?? 0;
}

/**
 * Migrate schema to a specific version
 */
export function migrateSchema(db: Database.Database, targetVersion: number): void {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion === targetVersion) {
    return;
  }

  if (currentVersion > targetVersion) {
    throw new Error('Downgrade not supported');
  }

  // Future migrations will go here
  // for (let version = currentVersion + 1; version <= targetVersion; version++) {
  //   applyMigration(db, version);
  // }
}
