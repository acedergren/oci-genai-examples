// kyc-platform/src/repository.ts
import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type {
  Customer,
  KYCSession,
  Document,
  WorkflowStep,
  ApprovalRequest,
  AuditLog,
  SupportTicket,
  TicketMessage,
  KnowledgeBaseArticle,
  CustomerSegment,
  CustomerSegmentMember,
  Prospect,
  ProspectScore,
  ProspectEngagement,
  EmbeddingSearchResult,
} from './types.js';

/**
 * Repository for customer operations
 */
export class CustomerRepository {
  constructor(private db: Database.Database) {}

  create(data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Customer {
    const now = Date.now();
    const customer: Customer = {
      ...data,
      id: uuidv4(),
      created_at: now,
      updated_at: now,
      kyc_status: data.kyc_status || 'pending',
      source: data.source || 'direct',
    };

    this.db
      .prepare(
        `INSERT INTO customers (
          id, created_at, updated_at, email, first_name, last_name, phone, date_of_birth,
          address_line1, address_line2, city, state, postal_code, country,
          kyc_status, kyc_completed_at, kyc_verified_by, risk_level,
          occupation, employer, annual_income, net_worth, profile_embedding,
          source, tags, notes
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )`
      )
      .run(
        customer.id,
        customer.created_at,
        customer.updated_at,
        customer.email,
        customer.first_name,
        customer.last_name,
        customer.phone || null,
        customer.date_of_birth || null,
        customer.address_line1 || null,
        customer.address_line2 || null,
        customer.city || null,
        customer.state || null,
        customer.postal_code || null,
        customer.country || null,
        customer.kyc_status,
        customer.kyc_completed_at || null,
        customer.kyc_verified_by || null,
        customer.risk_level || null,
        customer.occupation || null,
        customer.employer || null,
        customer.annual_income || null,
        customer.net_worth || null,
        customer.profile_embedding || null,
        customer.source,
        customer.tags || null,
        customer.notes || null
      );

    return customer;
  }

  findById(id: string): Customer | null {
    return this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | null;
  }

  findByEmail(email: string): Customer | null {
    return this.db.prepare('SELECT * FROM customers WHERE email = ?').get(email) as Customer | null;
  }

  update(id: string, data: Partial<Omit<Customer, 'id' | 'created_at'>>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    updates.push('updated_at = ?');
    values.push(Date.now());

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    values.push(id);

    this.db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  updateEmbedding(id: string, embedding: Buffer): void {
    this.db.prepare('UPDATE customers SET profile_embedding = ?, updated_at = ? WHERE id = ?').run(embedding, Date.now(), id);
  }

  list(filters?: { kyc_status?: string; limit?: number; offset?: number }): Customer[] {
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.kyc_status) {
      query += ' AND kyc_status = ?';
      params.push(filters.kyc_status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    return this.db.prepare(query).all(...params) as Customer[];
  }

  /**
   * Find similar customers using cosine similarity on embeddings
   */
  findSimilar(embedding: Buffer, limit: number = 10): EmbeddingSearchResult<Customer>[] {
    // SQLite doesn't have native vector operations, so we fetch all customers with embeddings
    // and calculate similarity in-memory. For production, consider using a vector database.
    const customers = this.db
      .prepare('SELECT * FROM customers WHERE profile_embedding IS NOT NULL')
      .all() as Customer[];

    const queryVector = new Float32Array(embedding.buffer, embedding.byteOffset, embedding.byteLength / 4);

    const results = customers
      .map((customer) => {
        if (!customer.profile_embedding) return null;

        const customerVector = new Float32Array(
          customer.profile_embedding.buffer,
          customer.profile_embedding.byteOffset,
          customer.profile_embedding.byteLength / 4
        );

        const similarity = cosineSimilarity(queryVector, customerVector);

        return {
          item: customer,
          similarity,
          distance: 1 - similarity,
        };
      })
      .filter((r): r is EmbeddingSearchResult<Customer> => r !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }
}

/**
 * Repository for KYC session operations
 */
export class KYCSessionRepository {
  constructor(private db: Database.Database) {}

  create(data: Omit<KYCSession, 'id' | 'created_at' | 'updated_at'>): KYCSession {
    const now = Date.now();
    const session: KYCSession = {
      ...data,
      id: uuidv4(),
      created_at: now,
      updated_at: now,
      status: data.status || 'started',
      current_step: data.current_step || 1,
      total_steps: data.total_steps || 7,
      session_type: data.session_type || 'individual',
      channel: data.channel || 'web',
      manual_review_needed: data.manual_review_needed !== undefined ? data.manual_review_needed : false,
    };

    this.db
      .prepare(
        `INSERT INTO kyc_sessions (
          id, customer_id, created_at, updated_at, completed_at,
          status, current_step, total_steps,
          session_type, channel, ip_address, user_agent,
          fraud_score, duplicate_likelihood, manual_review_needed,
          config, metadata
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?
        )`
      )
      .run(
        session.id,
        session.customer_id,
        session.created_at,
        session.updated_at,
        session.completed_at || null,
        session.status,
        session.current_step,
        session.total_steps,
        session.session_type,
        session.channel,
        session.ip_address || null,
        session.user_agent || null,
        session.fraud_score || null,
        session.duplicate_likelihood || null,
        session.manual_review_needed ? 1 : 0,
        session.config || null,
        session.metadata || null
      );

    return session;
  }

  findById(id: string): KYCSession | null {
    return this.db.prepare('SELECT * FROM kyc_sessions WHERE id = ?').get(id) as KYCSession | null;
  }

  update(id: string, data: Partial<Omit<KYCSession, 'id' | 'created_at' | 'customer_id'>>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    updates.push('updated_at = ?');
    values.push(Date.now());

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'customer_id' && value !== undefined) {
        if (key === 'manual_review_needed' && typeof value === 'boolean') {
          updates.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    values.push(id);

    this.db.prepare(`UPDATE kyc_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  listByCustomer(customerId: string): KYCSession[] {
    return this.db.prepare('SELECT * FROM kyc_sessions WHERE customer_id = ? ORDER BY created_at DESC').all(customerId) as KYCSession[];
  }
}

/**
 * Repository for audit log operations
 */
export class AuditLogRepository {
  constructor(private db: Database.Database) {}

  log(data: Omit<AuditLog, 'id' | 'created_at'>): AuditLog {
    const auditLog: AuditLog = {
      id: uuidv4(),
      created_at: Date.now(),
      ...data,
    };

    this.db
      .prepare(
        `INSERT INTO audit_logs (
          id, created_at, event_type, event_category, severity,
          actor_type, actor_id, entity_type, entity_id,
          description, changes, metadata, ip_address, user_agent
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )`
      )
      .run(
        auditLog.id,
        auditLog.created_at,
        auditLog.event_type,
        auditLog.event_category,
        auditLog.severity,
        auditLog.actor_type,
        auditLog.actor_id || null,
        auditLog.entity_type,
        auditLog.entity_id,
        auditLog.description,
        auditLog.changes || null,
        auditLog.metadata || null,
        auditLog.ip_address || null,
        auditLog.user_agent || null
      );

    return auditLog;
  }

  query(filters: {
    entity_type?: string;
    entity_id?: string;
    event_category?: string;
    start_time?: number;
    end_time?: number;
    limit?: number;
  }): AuditLog[] {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filters.entity_type) {
      query += ' AND entity_type = ?';
      params.push(filters.entity_type);
    }

    if (filters.entity_id) {
      query += ' AND entity_id = ?';
      params.push(filters.entity_id);
    }

    if (filters.event_category) {
      query += ' AND event_category = ?';
      params.push(filters.event_category);
    }

    if (filters.start_time) {
      query += ' AND created_at >= ?';
      params.push(filters.start_time);
    }

    if (filters.end_time) {
      query += ' AND created_at <= ?';
      params.push(filters.end_time);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.db.prepare(query).all(...params) as AuditLog[];
  }
}

/**
 * Repository for customer segment operations
 */
export class SegmentRepository {
  constructor(private db: Database.Database) {}

  create(data: Omit<CustomerSegment, 'id' | 'created_at' | 'updated_at'>): CustomerSegment {
    const now = Date.now();
    const segment: CustomerSegment = {
      ...data,
      id: uuidv4(),
      created_at: now,
      updated_at: now,
      generation_method: data.generation_method || 'clustering',
      member_count: data.member_count || 0,
      is_active: data.is_active !== undefined ? data.is_active : true,
    };

    this.db
      .prepare(
        `INSERT INTO customer_segments (
          id, created_at, updated_at, name, description,
          generation_method, cluster_id, characteristics, typical_behavior,
          member_count, avg_customer_value, risk_profile,
          centroid_embedding, is_active, metadata
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )`
      )
      .run(
        segment.id,
        segment.created_at,
        segment.updated_at,
        segment.name,
        segment.description,
        segment.generation_method,
        segment.cluster_id || null,
        segment.characteristics,
        segment.typical_behavior || null,
        segment.member_count,
        segment.avg_customer_value || null,
        segment.risk_profile || null,
        segment.centroid_embedding || null,
        segment.is_active ? 1 : 0,
        segment.metadata || null
      );

    return segment;
  }

  findById(id: string): CustomerSegment | null {
    return this.db.prepare('SELECT * FROM customer_segments WHERE id = ?').get(id) as CustomerSegment | null;
  }

  listActive(): CustomerSegment[] {
    return this.db.prepare('SELECT * FROM customer_segments WHERE is_active = 1 ORDER BY member_count DESC').all() as CustomerSegment[];
  }

  addMember(customerId: string, segmentId: string, confidence: number, distance?: number): void {
    this.db
      .prepare(
        `INSERT INTO customer_segment_members (
          customer_id, segment_id, created_at, confidence, distance
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(customer_id, segment_id) DO UPDATE SET
          confidence = excluded.confidence,
          distance = excluded.distance
        `
      )
      .run(customerId, segmentId, Date.now(), confidence, distance || null);

    // Update member count
    this.db.prepare('UPDATE customer_segments SET member_count = (SELECT COUNT(*) FROM customer_segment_members WHERE segment_id = ?), updated_at = ? WHERE id = ?').run(segmentId, Date.now(), segmentId);
  }

  getCustomerSegments(customerId: string): Array<CustomerSegment & { confidence: number; distance?: number }> {
    return this.db
      .prepare(
        `SELECT s.*, m.confidence, m.distance
         FROM customer_segments s
         JOIN customer_segment_members m ON s.id = m.segment_id
         WHERE m.customer_id = ?
         ORDER BY m.confidence DESC`
      )
      .all(customerId) as Array<CustomerSegment & { confidence: number; distance?: number }>;
  }
}

/**
 * Utility function: Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Main repository class that provides access to all repositories
 */
export class Repository {
  public customers: CustomerRepository;
  public sessions: KYCSessionRepository;
  public auditLogs: AuditLogRepository;
  public segments: SegmentRepository;

  constructor(private db: Database.Database) {
    this.customers = new CustomerRepository(db);
    this.sessions = new KYCSessionRepository(db);
    this.auditLogs = new AuditLogRepository(db);
    this.segments = new SegmentRepository(db);
  }

  /**
   * Execute a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }
}

/**
 * Create a repository instance from a database connection
 */
export function createRepository(db: Database.Database): Repository {
  return new Repository(db);
}
