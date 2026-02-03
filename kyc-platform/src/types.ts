// kyc-platform/src/types.ts

/**
 * Core domain types for the KYC Platform
 */

// ===== CUSTOMER MANAGEMENT =====

export type KYCStatus = 'pending' | 'in_progress' | 'verified' | 'rejected' | 'flagged';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Customer {
  id: string;
  created_at: number;
  updated_at: number;

  // Identity
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;

  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;

  // KYC Status
  kyc_status: KYCStatus;
  kyc_completed_at?: number;
  kyc_verified_by?: string;
  risk_level?: RiskLevel;

  // Business Information
  occupation?: string;
  employer?: string;
  annual_income?: number;
  net_worth?: number;

  // Embeddings
  profile_embedding?: Buffer;

  // Metadata
  source: string;
  tags?: string; // JSON array
  notes?: string;
}

// ===== KYC ONBOARDING =====

export type SessionStatus = 'started' | 'in_progress' | 'pending_review' | 'completed' | 'rejected' | 'expired';
export type SessionType = 'individual' | 'business' | 'joint';
export type Channel = 'web' | 'mobile' | 'branch' | 'phone';

export interface KYCSession {
  id: string;
  customer_id: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;

  // Workflow State
  status: SessionStatus;
  current_step: number;
  total_steps: number;

  // Session Metadata
  session_type: SessionType;
  channel: Channel;
  ip_address?: string;
  user_agent?: string;

  // Risk Assessment
  fraud_score?: number;
  duplicate_likelihood?: number;
  manual_review_needed: boolean;

  // Metadata
  config?: string; // JSON
  metadata?: string; // JSON
}

export type DocumentType =
  | 'passport'
  | 'drivers_license'
  | 'national_id'
  | 'utility_bill'
  | 'bank_statement'
  | 'tax_return'
  | 'other';

export type ExtractionMethod = 'ai' | 'manual' | 'hybrid';

export interface Document {
  id: string;
  customer_id: string;
  session_id?: string;
  created_at: number;

  // Document Info
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;

  // OCR Extraction
  extracted_data?: string; // JSON
  extraction_confidence?: number;
  extraction_method: ExtractionMethod;

  // Verification
  verified: boolean;
  verified_at?: number;
  verified_by?: string;
  verification_notes?: string;

  // Metadata
  document_embedding?: Buffer;
  metadata?: string; // JSON
}

export type StepType = 'data_entry' | 'document_upload' | 'verification' | 'review' | 'approval' | 'completion';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export interface WorkflowStep {
  id: string;
  session_id: string;
  created_at: number;
  completed_at?: number;

  // Step Info
  step_number: number;
  step_name: string;
  step_type: StepType;

  // Status
  status: StepStatus;

  // AI Processing
  ai_confidence?: number;
  ai_reasoning?: string;

  // Data
  input_data?: string; // JSON
  output_data?: string; // JSON
  validation_errors?: string; // JSON array
}

// ===== APPROVALS =====

export type RequestType = 'kyc_approval' | 'document_verification' | 'risk_review' | 'compliance_check' | 'other';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type Decision = 'approve' | 'reject' | 'request_more_info' | 'escalate';

export interface ApprovalRequest {
  id: string;
  created_at: number;
  resolved_at?: number;

  // Request Info
  request_type: RequestType;
  entity_type: string;
  entity_id: string;

  // Status
  status: ApprovalStatus;
  priority: Priority;

  // Assignment
  assigned_to?: string;
  assigned_at?: number;

  // Decision
  decision?: Decision;
  decision_notes?: string;
  decided_by?: string;

  // Context
  reason: string;
  supporting_data?: string; // JSON
  ai_recommendation?: string;
  ai_confidence?: number;
}

// ===== AUDIT =====

export type EventCategory = 'customer' | 'kyc' | 'document' | 'support' | 'system' | 'security';
export type Severity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type ActorType = 'user' | 'system' | 'ai' | 'api';

export interface AuditLog {
  id: string;
  created_at: number;

  // Event Info
  event_type: string;
  event_category: EventCategory;
  severity: Severity;

  // Actor
  actor_type: ActorType;
  actor_id?: string;

  // Target
  entity_type: string;
  entity_id: string;

  // Details
  description: string;
  changes?: string; // JSON
  metadata?: string; // JSON

  // Security
  ip_address?: string;
  user_agent?: string;
}

// ===== CUSTOMER SERVICE =====

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'waiting_internal' | 'resolved' | 'closed';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'angry';
export type TicketSource = 'web' | 'email' | 'phone' | 'chat' | 'social';

export interface SupportTicket {
  id: string;
  customer_id?: string;
  created_at: number;
  updated_at: number;
  resolved_at?: number;

  // Ticket Info
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;

  // Classification
  category?: string;
  subcategory?: string;

  // Assignment
  assigned_to?: string;
  assigned_at?: number;
  department?: string;

  // AI Analysis
  sentiment?: Sentiment;
  sentiment_score?: number;
  urgency_score?: number;
  ai_suggested_category?: string;
  ai_suggested_response?: string;

  // Resolution
  resolution_notes?: string;
  customer_satisfaction?: number;

  // Metadata
  source: TicketSource;
  tags?: string; // JSON array
  metadata?: string; // JSON
}

export type AuthorType = 'customer' | 'agent' | 'system' | 'ai';

export interface TicketMessage {
  id: string;
  ticket_id: string;
  created_at: number;

  // Message Info
  author_type: AuthorType;
  author_id?: string;
  author_name?: string;

  // Content
  message: string;
  is_internal: boolean;

  // AI Analysis
  sentiment?: Sentiment;
  contains_pii: boolean;

  // Attachments
  attachments?: string; // JSON array
}

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';

export interface KnowledgeBaseArticle {
  id: string;
  created_at: number;
  updated_at: number;
  published_at?: number;

  // Content
  title: string;
  content: string;
  summary?: string;

  // Classification
  category: string;
  subcategory?: string;
  tags?: string; // JSON array

  // Status
  status: ArticleStatus;

  // RAG Optimization
  content_embedding?: Buffer;
  chunk_count?: number;

  // Metadata
  author?: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  metadata?: string; // JSON
}

// ===== INTELLIGENCE =====

export type GenerationMethod = 'clustering' | 'rule_based' | 'hybrid' | 'manual';

export interface CustomerSegment {
  id: string;
  created_at: number;
  updated_at: number;

  // Segment Info
  name: string;
  description: string;

  // AI Generation
  generation_method: GenerationMethod;
  cluster_id?: number;

  // Characteristics
  characteristics: string; // JSON array
  typical_behavior?: string;

  // Statistics
  member_count: number;
  avg_customer_value?: number;
  risk_profile?: string;

  // Centroid
  centroid_embedding?: Buffer;

  // Metadata
  is_active: boolean;
  metadata?: string; // JSON
}

export interface CustomerSegmentMember {
  customer_id: string;
  segment_id: string;
  created_at: number;

  // Membership strength
  confidence: number; // 0-1
  distance?: number;
}

// ===== PROSPECTING =====

export type ProspectStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'disqualified';
export type ProspectSource = 'manual' | 'import' | 'referral' | 'inbound' | 'outbound';

export interface Prospect {
  id: string;
  created_at: number;
  updated_at: number;
  converted_at?: number;

  // Identity
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  job_title?: string;

  // Company Info
  company_size?: string;
  industry?: string;
  annual_revenue?: number;

  // Lead Status
  status: ProspectStatus;
  stage?: string;

  // Source
  source: ProspectSource;
  campaign?: string;

  // Assignment
  assigned_to?: string;
  assigned_at?: number;

  // Conversion
  converted_to_customer?: string;

  // Metadata
  tags?: string; // JSON array
  notes?: string;
  metadata?: string; // JSON
}

export type QualityTier = 'cold' | 'warm' | 'hot' | 'qualified';
export type ScoringMethod = 'ai' | 'rule_based' | 'hybrid' | 'manual';

export interface ProspectScore {
  id: string;
  prospect_id: string;
  created_at: number;

  // Overall Score
  overall_score: number; // 0-100
  quality_tier?: QualityTier;

  // Component Scores
  fit_score?: number;
  timing_score?: number;
  budget_score?: number;
  authority_score?: number;

  // AI Analysis
  reasoning?: string;
  key_signals?: string; // JSON array
  recommended_actions?: string; // JSON array

  // Confidence
  confidence?: number;

  // Model Info
  model_version?: string;
  scoring_method: ScoringMethod;
}

export interface ProspectEngagement {
  id: string;
  prospect_id: string;
  created_at: number;

  // Engagement Info
  engagement_type: string;
  engagement_value: number;

  // Details
  description?: string;
  metadata?: string; // JSON
}

// ===== UTILITY TYPES =====

/**
 * Embedding vector result from similarity search
 */
export interface EmbeddingSearchResult<T = unknown> {
  item: T;
  similarity: number;
  distance: number;
}

/**
 * Tool approval levels for AI agents
 */
export type ApprovalLevel = 'auto' | 'confirm' | 'danger';

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  confidence?: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  session_id: string;
  customer_id: string;
  current_step: number;
  metadata?: Record<string, unknown>;
}

/**
 * AI model configuration
 */
export interface ModelConfig {
  model: string;
  region: string;
  temperature?: number;
  maxTokens?: number;
}
