/**
 * Oracle ADB 26AI storage adapter for Mastra.
 *
 * Implements all 3 required Mastra storage domains (Memory, Workflows, Scores)
 * backed by Oracle Autonomous Database tables created in migration 010.
 *
 * Phase 9.4 implements WorkflowsOracle fully.
 * MemoryOracle and ScoresOracle are stubbed — completed in Phases 9.6 and 9.7.
 */

import {
  MastraCompositeStore,
  type MastraCompositeStoreConfig,
  type WorkflowRun,
  type WorkflowRuns,
  type StorageListWorkflowRunsInput,
  type UpdateWorkflowStateOptions,
  normalizePerPage,
  calculatePagination,
} from "@mastra/core/storage";
import { WorkflowsStorage } from "@mastra/core/storage";
import { MemoryStorage } from "@mastra/core/storage";
import { ScoresStorage } from "@mastra/core/storage";
import type { WorkflowRunState, StepResult } from "@mastra/core/workflows";
import type { OracleConnection } from "../../plugins/oracle.js";

// ── Helpers ───────────────────────────────────────────────────────────────

type WithConnectionFn = <T>(
  fn: (conn: OracleConnection) => Promise<T>,
) => Promise<T>;

/** Convert Oracle UPPERCASE row keys to camelCase object. */
function fromOracleRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key
      .toLowerCase()
      .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  }
  return result as T;
}

/** Parse a CLOB/string JSON field, returning null on failure. */
function parseJSON<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/** Convert Oracle TIMESTAMP to JS Date. */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return new Date();
}

// ── WorkflowsOracle ──────────────────────────────────────────────────────

interface OracleWorkflowRow {
  WORKFLOW_NAME: string;
  RUN_ID: string;
  RESOURCE_ID: string | null;
  SNAPSHOT: string;
  CREATED_AT: Date | string;
  UPDATED_AT: Date | string;
}

export class WorkflowsOracle extends WorkflowsStorage {
  private withConnection: WithConnectionFn;

  constructor(withConnection: WithConnectionFn) {
    super();
    this.withConnection = withConnection;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.withConnection(async (conn) => {
      await conn.execute("DELETE FROM mastra_workflow_snapshots");
      await conn.commit();
    });
  }

  async persistWorkflowSnapshot(args: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const now = new Date();
    await this.withConnection(async (conn) => {
      await conn.execute(
        `MERGE INTO mastra_workflow_snapshots t
         USING (SELECT :workflowName AS workflow_name, :runId AS run_id FROM DUAL) s
         ON (t.workflow_name = s.workflow_name AND t.run_id = s.run_id)
         WHEN MATCHED THEN UPDATE SET
           t.snapshot = :snapshot,
           t.resource_id = :resourceId,
           t.updated_at = :updatedAt
         WHEN NOT MATCHED THEN INSERT (workflow_name, run_id, resource_id, snapshot, created_at, updated_at)
         VALUES (:workflowName, :runId, :resourceId, :snapshot, :createdAt, :updatedAt)`,
        {
          workflowName: args.workflowName,
          runId: args.runId,
          resourceId: args.resourceId ?? null,
          snapshot: JSON.stringify(args.snapshot),
          createdAt: args.createdAt ?? now,
          updatedAt: args.updatedAt ?? now,
        },
      );
      await conn.commit();
    });
  }

  async loadWorkflowSnapshot(args: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.withConnection(async (conn) => {
      const result = await conn.execute<OracleWorkflowRow>(
        `SELECT snapshot FROM mastra_workflow_snapshots
         WHERE workflow_name = :workflowName AND run_id = :runId`,
        { workflowName: args.workflowName, runId: args.runId },
      );
      const row = result.rows?.[0];
      if (!row) return null;
      return parseJSON<WorkflowRunState>(row.SNAPSHOT);
    });
  }

  async getWorkflowRunById(args: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    return this.withConnection(async (conn) => {
      let sql = `SELECT workflow_name, run_id, resource_id, snapshot, created_at, updated_at
                 FROM mastra_workflow_snapshots WHERE run_id = :runId`;
      const binds: Record<string, unknown> = { runId: args.runId };

      if (args.workflowName) {
        sql += " AND workflow_name = :workflowName";
        binds.workflowName = args.workflowName;
      }

      const result = await conn.execute<OracleWorkflowRow>(sql, binds);
      const row = result.rows?.[0];
      if (!row) return null;
      return this.rowToWorkflowRun(row);
    });
  }

  async listWorkflowRuns(
    args?: StorageListWorkflowRunsInput,
  ): Promise<WorkflowRuns> {
    return this.withConnection(async (conn) => {
      const conditions: string[] = [];
      const binds: Record<string, unknown> = {};

      if (args?.workflowName) {
        conditions.push("workflow_name = :workflowName");
        binds.workflowName = args.workflowName;
      }
      if (args?.resourceId) {
        conditions.push("resource_id = :resourceId");
        binds.resourceId = args.resourceId;
      }
      if (args?.fromDate) {
        conditions.push("created_at >= :fromDate");
        binds.fromDate = args.fromDate;
      }
      if (args?.toDate) {
        conditions.push("created_at <= :toDate");
        binds.toDate = args.toDate;
      }
      // Status filter requires parsing snapshot JSON — use JSON_VALUE
      if (args?.status) {
        conditions.push("JSON_VALUE(snapshot, '$.status') = :status");
        binds.status = args.status;
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Count total
      const countResult = await conn.execute<{ CNT: number }>(
        `SELECT COUNT(*) AS CNT FROM mastra_workflow_snapshots ${where}`,
        binds,
      );
      const total = countResult.rows?.[0]?.CNT ?? 0;

      // Paginated query
      let dataSql = `SELECT workflow_name, run_id, resource_id, snapshot, created_at, updated_at
                     FROM mastra_workflow_snapshots ${where}
                     ORDER BY created_at DESC`;

      if (args?.perPage !== undefined && args?.page !== undefined) {
        const normalizedPerPage = normalizePerPage(args.perPage, 100);
        const { offset } = calculatePagination(
          args.page,
          args.perPage,
          normalizedPerPage,
        );
        dataSql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = normalizedPerPage;
      }

      const result = await conn.execute<OracleWorkflowRow>(dataSql, binds);
      const runs = (result.rows ?? []).map((row) => this.rowToWorkflowRun(row));

      return { runs, total };
    });
  }

  async deleteWorkflowRunById(args: {
    runId: string;
    workflowName: string;
  }): Promise<void> {
    await this.withConnection(async (conn) => {
      await conn.execute(
        `DELETE FROM mastra_workflow_snapshots
         WHERE workflow_name = :workflowName AND run_id = :runId`,
        { workflowName: args.workflowName, runId: args.runId },
      );
      await conn.commit();
    });
  }

  async updateWorkflowResults(args: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<unknown, unknown, unknown, unknown>;
    requestContext: Record<string, unknown>;
  }): Promise<Record<string, StepResult<unknown, unknown, unknown, unknown>>> {
    return this.withConnection(async (conn) => {
      // Load current snapshot
      const snapshot = await this.loadWorkflowSnapshot({
        workflowName: args.workflowName,
        runId: args.runId,
      });

      if (!snapshot) {
        throw new Error(
          `Workflow snapshot not found: ${args.workflowName}/${args.runId}`,
        );
      }

      // Merge step result into context
      snapshot.context = snapshot.context ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (snapshot.context as Record<string, any>)[args.stepId] = args.result;

      // Update requestContext
      snapshot.requestContext = {
        ...snapshot.requestContext,
        ...args.requestContext,
      };

      // Persist
      await conn.execute(
        `UPDATE mastra_workflow_snapshots
         SET snapshot = :snapshot, updated_at = :updatedAt
         WHERE workflow_name = :workflowName AND run_id = :runId`,
        {
          snapshot: JSON.stringify(snapshot),
          updatedAt: new Date(),
          workflowName: args.workflowName,
          runId: args.runId,
        },
      );
      await conn.commit();

      return snapshot.context as Record<
        string,
        StepResult<unknown, unknown, unknown, unknown>
      >;
    });
  }

  async updateWorkflowState(args: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    return this.withConnection(async (conn) => {
      const snapshot = await this.loadWorkflowSnapshot({
        workflowName: args.workflowName,
        runId: args.runId,
      });

      if (!snapshot) return undefined;

      // Apply state updates
      snapshot.status = args.opts.status;
      if (args.opts.error !== undefined) snapshot.error = args.opts.error;
      if (args.opts.result !== undefined) {
        snapshot.result = snapshot.result ?? {};
        Object.assign(snapshot.result, args.opts.result);
      }
      if (args.opts.suspendedPaths !== undefined)
        snapshot.suspendedPaths = args.opts.suspendedPaths;
      if (args.opts.waitingPaths !== undefined)
        snapshot.waitingPaths = args.opts.waitingPaths;
      if (args.opts.resumeLabels !== undefined)
        snapshot.resumeLabels = args.opts.resumeLabels;
      snapshot.timestamp = Date.now();

      await conn.execute(
        `UPDATE mastra_workflow_snapshots
         SET snapshot = :snapshot, updated_at = :updatedAt
         WHERE workflow_name = :workflowName AND run_id = :runId`,
        {
          snapshot: JSON.stringify(snapshot),
          updatedAt: new Date(),
          workflowName: args.workflowName,
          runId: args.runId,
        },
      );
      await conn.commit();

      return snapshot;
    });
  }

  private rowToWorkflowRun(row: OracleWorkflowRow): WorkflowRun {
    return {
      workflowName: row.WORKFLOW_NAME,
      runId: row.RUN_ID,
      resourceId: row.RESOURCE_ID ?? undefined,
      snapshot: parseJSON<WorkflowRunState>(row.SNAPSHOT) ?? row.SNAPSHOT,
      createdAt: toDate(row.CREATED_AT),
      updatedAt: toDate(row.UPDATED_AT),
    };
  }
}

// ── MemoryOracle ─────────────────────────────────────────────────────────

import type {
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListMessagesByResourceIdInput,
  StorageResourceType,
} from "@mastra/core/storage";
import type { StorageThreadType } from "@mastra/core/memory";
import type { MastraDBMessage, MastraMessageContentV2 } from "@mastra/core/agent";

interface OracleThreadRow {
  ID: string;
  RESOURCE_ID: string;
  TITLE: string | null;
  METADATA: string | null;
  CREATED_AT: Date | string;
  UPDATED_AT: Date | string;
}

interface OracleMessageRow {
  ID: string;
  THREAD_ID: string;
  ROLE: string;
  TYPE: string | null;
  CONTENT: string;
  RESOURCE_ID: string | null;
  CREATED_AT: Date | string;
}

interface OracleResourceRow {
  ID: string;
  WORKING_MEMORY: string | null;
  METADATA: string | null;
  CREATED_AT: Date | string;
  UPDATED_AT: Date | string;
}

export class MemoryOracle extends MemoryStorage {
  private withConnection: WithConnectionFn;

  constructor(withConnection: WithConnectionFn) {
    super();
    this.withConnection = withConnection;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.withConnection(async (conn) => {
      await conn.execute("DELETE FROM mastra_messages");
      await conn.execute("DELETE FROM mastra_threads");
      await conn.execute("DELETE FROM mastra_resources");
      await conn.commit();
    });
  }

  // ── Thread Methods ────────────────────────────────────────────────────

  async getThreadById(args: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    return this.withConnection(async (conn) => {
      const result = await conn.execute<OracleThreadRow>(
        `SELECT id, resource_id, title, metadata, created_at, updated_at
         FROM mastra_threads WHERE id = :threadId`,
        { threadId: args.threadId },
      );
      const row = result.rows?.[0];
      if (!row) return null;
      return this.rowToThread(row);
    });
  }

  async saveThread(args: {
    thread: StorageThreadType;
  }): Promise<StorageThreadType> {
    return this.withConnection(async (conn) => {
      const now = new Date();
      await conn.execute(
        `INSERT INTO mastra_threads (id, resource_id, title, metadata, created_at, updated_at)
         VALUES (:id, :resourceId, :title, :metadata, :createdAt, :updatedAt)`,
        {
          id: args.thread.id,
          resourceId: args.thread.resourceId,
          title: args.thread.title ?? null,
          metadata: args.thread.metadata
            ? JSON.stringify(args.thread.metadata)
            : null,
          createdAt: args.thread.createdAt ?? now,
          updatedAt: args.thread.updatedAt ?? now,
        },
      );
      await conn.commit();
      return args.thread;
    });
  }

  async updateThread(args: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    return this.withConnection(async (conn) => {
      const now = new Date();
      await conn.execute(
        `UPDATE mastra_threads
         SET title = :title, metadata = :metadata, updated_at = :updatedAt
         WHERE id = :id`,
        {
          id: args.id,
          title: args.title,
          metadata: JSON.stringify(args.metadata),
          updatedAt: now,
        },
      );
      await conn.commit();

      // Return updated thread
      const result = await conn.execute<OracleThreadRow>(
        `SELECT id, resource_id, title, metadata, created_at, updated_at
         FROM mastra_threads WHERE id = :id`,
        { id: args.id },
      );
      const row = result.rows?.[0];
      if (!row) {
        throw new Error(`Thread not found after update: ${args.id}`);
      }
      return this.rowToThread(row);
    });
  }

  async deleteThread(args: { threadId: string }): Promise<void> {
    await this.withConnection(async (conn) => {
      await conn.execute(`DELETE FROM mastra_threads WHERE id = :threadId`, {
        threadId: args.threadId,
      });
      await conn.commit();
    });
  }

  async listThreads(
    args: StorageListThreadsInput,
  ): Promise<StorageListThreadsOutput> {
    return this.withConnection(async (conn) => {
      const conditions: string[] = [];
      const binds: Record<string, unknown> = {};

      // Filter by resourceId
      if (args.filter?.resourceId) {
        conditions.push("resource_id = :resourceId");
        binds.resourceId = args.filter.resourceId;
      }

      // Filter by metadata (JSON exact match on each key)
      if (args.filter?.metadata) {
        Object.entries(args.filter.metadata).forEach(([key, value], i) => {
          conditions.push(
            `JSON_VALUE(metadata, '$.${key}') = :metaValue${i}`,
          );
          binds[`metaValue${i}`] = JSON.stringify(value);
        });
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Count total
      const countResult = await conn.execute<{ CNT: number }>(
        `SELECT COUNT(*) AS CNT FROM mastra_threads ${where}`,
        binds,
      );
      const total = countResult.rows?.[0]?.CNT ?? 0;

      // Ordering
      const { field, direction } = this.parseOrderBy(
        args.orderBy,
        "DESC" as const,
      );
      const orderByClause = `ORDER BY ${field === "createdAt" ? "created_at" : "updated_at"} ${direction}`;

      // Paginated query
      let dataSql = `SELECT id, resource_id, title, metadata, created_at, updated_at
                     FROM mastra_threads ${where} ${orderByClause}`;

      const perPage = args.perPage === false ? false : args.perPage ?? 100;
      const page = args.page ?? 0;

      if (perPage !== false) {
        const normalizedPerPage = normalizePerPage(perPage, 100);
        const { offset } = calculatePagination(page, perPage, normalizedPerPage);
        dataSql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = normalizedPerPage;
      }

      const result = await conn.execute<OracleThreadRow>(dataSql, binds);
      const threads = (result.rows ?? []).map((row) => this.rowToThread(row));

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: perPage === false ? false : page * perPage + threads.length < total,
      };
    });
  }

  // ── Message Methods ───────────────────────────────────────────────────

  async listMessages(
    args: StorageListMessagesInput,
  ): Promise<StorageListMessagesOutput> {
    return this.withConnection(async (conn) => {
      const conditions: string[] = [];
      const binds: Record<string, unknown> = {};

      // Thread filter
      if (typeof args.threadId === "string") {
        conditions.push("thread_id = :threadId");
        binds.threadId = args.threadId;
      } else if (Array.isArray(args.threadId)) {
        const threadConditions = args.threadId.map(
          (_, i) => `:threadId${i}`,
        );
        conditions.push(`thread_id IN (${threadConditions.join(", ")})`);
        args.threadId.forEach((tid, i) => {
          binds[`threadId${i}`] = tid;
        });
      }

      // Resource filter
      if (args.resourceId) {
        conditions.push("resource_id = :resourceId");
        binds.resourceId = args.resourceId;
      }

      // Date range
      if (args.filter?.dateRange?.start) {
        const op = args.filter.dateRange.startExclusive ? ">" : ">=";
        conditions.push(`created_at ${op} :startDate`);
        binds.startDate = args.filter.dateRange.start;
      }
      if (args.filter?.dateRange?.end) {
        const op = args.filter.dateRange.endExclusive ? "<" : "<=";
        conditions.push(`created_at ${op} :endDate`);
        binds.endDate = args.filter.dateRange.end;
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Count total
      const countResult = await conn.execute<{ CNT: number }>(
        `SELECT COUNT(*) AS CNT FROM mastra_messages ${where}`,
        binds,
      );
      const total = countResult.rows?.[0]?.CNT ?? 0;

      // Ordering
      const direction = args.orderBy?.direction ?? "ASC";
      const orderByClause = `ORDER BY created_at ${direction}`;

      // Paginated query
      let dataSql = `SELECT id, thread_id, role, type, content, resource_id, created_at
                     FROM mastra_messages ${where} ${orderByClause}`;

      const perPage = args.perPage === false ? false : args.perPage ?? 40;
      const page = args.page ?? 0;

      if (perPage !== false) {
        const normalizedPerPage = normalizePerPage(perPage, 100);
        const { offset } = calculatePagination(page, perPage, normalizedPerPage);
        dataSql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = normalizedPerPage;
      }

      const result = await conn.execute<OracleMessageRow>(dataSql, binds);
      const messages = (result.rows ?? []).map((row) => this.rowToMessage(row));

      return {
        messages,
        total,
        page,
        perPage,
        hasMore: perPage === false ? false : page * perPage + messages.length < total,
      };
    });
  }

  async listMessagesByResourceId(
    args: StorageListMessagesByResourceIdInput,
  ): Promise<StorageListMessagesOutput> {
    return this.withConnection(async (conn) => {
      const conditions: string[] = ["resource_id = :resourceId"];
      const binds: Record<string, unknown> = { resourceId: args.resourceId };

      // Date range
      if (args.filter?.dateRange?.start) {
        const op = args.filter.dateRange.startExclusive ? ">" : ">=";
        conditions.push(`created_at ${op} :startDate`);
        binds.startDate = args.filter.dateRange.start;
      }
      if (args.filter?.dateRange?.end) {
        const op = args.filter.dateRange.endExclusive ? "<" : "<=";
        conditions.push(`created_at ${op} :endDate`);
        binds.endDate = args.filter.dateRange.end;
      }

      const where = `WHERE ${conditions.join(" AND ")}`;

      // Count total
      const countResult = await conn.execute<{ CNT: number }>(
        `SELECT COUNT(*) AS CNT FROM mastra_messages ${where}`,
        binds,
      );
      const total = countResult.rows?.[0]?.CNT ?? 0;

      // Ordering
      const direction = args.orderBy?.direction ?? "ASC";
      const orderByClause = `ORDER BY created_at ${direction}`;

      // Paginated query
      let dataSql = `SELECT id, thread_id, role, type, content, resource_id, created_at
                     FROM mastra_messages ${where} ${orderByClause}`;

      const perPage = args.perPage === false ? false : args.perPage ?? 40;
      const page = args.page ?? 0;

      if (perPage !== false) {
        const normalizedPerPage = normalizePerPage(perPage, 100);
        const { offset } = calculatePagination(page, perPage, normalizedPerPage);
        dataSql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = normalizedPerPage;
      }

      const result = await conn.execute<OracleMessageRow>(dataSql, binds);
      const messages = (result.rows ?? []).map((row) => this.rowToMessage(row));

      return {
        messages,
        total,
        page,
        perPage,
        hasMore: perPage === false ? false : page * perPage + messages.length < total,
      };
    });
  }

  async listMessagesById(args: {
    messageIds: string[];
  }): Promise<{ messages: MastraDBMessage[] }> {
    return this.withConnection(async (conn) => {
      if (args.messageIds.length === 0) {
        return { messages: [] };
      }

      // Oracle doesn't support array bind variables — use numbered binds
      // Limit to 1000 IDs for reasonable batch size
      const ids = args.messageIds.slice(0, 1000);
      const binds: Record<string, unknown> = {};
      const idPlaceholders = ids.map((id, i) => {
        binds[`id${i}`] = id;
        return `:id${i}`;
      });

      const sql = `SELECT id, thread_id, role, type, content, resource_id, created_at
                   FROM mastra_messages
                   WHERE id IN (${idPlaceholders.join(", ")})
                   ORDER BY created_at ASC`;

      const result = await conn.execute<OracleMessageRow>(sql, binds);
      const messages = (result.rows ?? []).map((row) => this.rowToMessage(row));

      return { messages };
    });
  }

  async saveMessages(args: {
    messages: MastraDBMessage[];
  }): Promise<{ messages: MastraDBMessage[] }> {
    await this.withConnection(async (conn) => {
      if (args.messages.length === 0) return;

      // Insert each message individually (Oracle doesn't have nice multi-row INSERT syntax)
      for (const msg of args.messages) {
        await conn.execute(
          `INSERT INTO mastra_messages (id, thread_id, role, type, content, resource_id, created_at)
           VALUES (:id, :threadId, :role, :type, :content, :resourceId, :createdAt)`,
          {
            id: msg.id,
            threadId: msg.threadId ?? null,
            role: msg.role,
            type: msg.type ?? null,
            content: JSON.stringify(msg.content),
            resourceId: msg.resourceId ?? null,
            createdAt: msg.createdAt ?? new Date(),
          },
        );
      }
      await conn.commit();
    });

    return { messages: args.messages };
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, "createdAt">> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2["metadata"];
        content?: MastraMessageContentV2["content"];
      };
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.withConnection(async (conn) => {
      const updatedMessages: MastraDBMessage[] = [];

      for (const update of args.messages) {
        // Load current message
        const currentResult = await conn.execute<OracleMessageRow>(
          `SELECT id, thread_id, role, type, content, resource_id, created_at
           FROM mastra_messages WHERE id = :id`,
          { id: update.id },
        );
        const currentRow = currentResult.rows?.[0];
        if (!currentRow) {
          throw new Error(`Message not found for update: ${update.id}`);
        }

        const current = this.rowToMessage(currentRow);

        // Merge updates
        const updated: MastraDBMessage = {
          ...current,
          role: update.role ?? current.role,
          type: update.type ?? current.type,
          threadId: update.threadId ?? current.threadId,
          resourceId: update.resourceId ?? current.resourceId,
        };

        // Merge content updates if provided
        if (update.content) {
          updated.content = {
            ...current.content,
            metadata: update.content.metadata ?? current.content.metadata,
            content: update.content.content ?? current.content.content,
          };
        }

        // Update in DB
        await conn.execute(
          `UPDATE mastra_messages
           SET role = :role, type = :type, content = :content,
               thread_id = :threadId, resource_id = :resourceId
           WHERE id = :id`,
          {
            id: updated.id,
            role: updated.role,
            type: updated.type,
            content: JSON.stringify(updated.content),
            threadId: updated.threadId ?? null,
            resourceId: updated.resourceId ?? null,
          },
        );

        updatedMessages.push(updated);
      }

      await conn.commit();
      return updatedMessages;
    });
  }

  // ── Resource Methods ──────────────────────────────────────────────────

  async getResourceById(args: {
    resourceId: string;
  }): Promise<StorageResourceType | null> {
    return this.withConnection(async (conn) => {
      const result = await conn.execute<OracleResourceRow>(
        `SELECT id, working_memory, metadata, created_at, updated_at
         FROM mastra_resources WHERE id = :resourceId`,
        { resourceId: args.resourceId },
      );
      const row = result.rows?.[0];
      if (!row) return null;
      return this.rowToResource(row);
    });
  }

  async saveResource(args: {
    resource: StorageResourceType;
  }): Promise<StorageResourceType> {
    return this.withConnection(async (conn) => {
      const now = new Date();
      await conn.execute(
        `MERGE INTO mastra_resources t
         USING (SELECT :id AS id FROM DUAL) s
         ON (t.id = s.id)
         WHEN MATCHED THEN UPDATE SET
           t.working_memory = :workingMemory,
           t.metadata = :metadata,
           t.updated_at = :updatedAt
         WHEN NOT MATCHED THEN INSERT (id, working_memory, metadata, created_at, updated_at)
         VALUES (:id, :workingMemory, :metadata, :createdAt, :updatedAt)`,
        {
          id: args.resource.id,
          workingMemory: args.resource.workingMemory ?? null,
          metadata: args.resource.metadata
            ? JSON.stringify(args.resource.metadata)
            : null,
          createdAt: args.resource.createdAt ?? now,
          updatedAt: args.resource.updatedAt ?? now,
        },
      );
      await conn.commit();
      return args.resource;
    });
  }

  async updateResource(args: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    return this.withConnection(async (conn) => {
      const now = new Date();

      // Build update SET clause dynamically
      const setClauses: string[] = ["updated_at = :updatedAt"];
      const binds: Record<string, unknown> = {
        resourceId: args.resourceId,
        updatedAt: now,
      };

      if (args.workingMemory !== undefined) {
        setClauses.push("working_memory = :workingMemory");
        binds.workingMemory = args.workingMemory;
      }
      if (args.metadata !== undefined) {
        setClauses.push("metadata = :metadata");
        binds.metadata = JSON.stringify(args.metadata);
      }

      await conn.execute(
        `UPDATE mastra_resources SET ${setClauses.join(", ")} WHERE id = :resourceId`,
        binds,
      );
      await conn.commit();

      // Return updated resource
      const result = await conn.execute<OracleResourceRow>(
        `SELECT id, working_memory, metadata, created_at, updated_at
         FROM mastra_resources WHERE id = :resourceId`,
        { resourceId: args.resourceId },
      );
      const row = result.rows?.[0];
      if (!row) {
        throw new Error(`Resource not found after update: ${args.resourceId}`);
      }
      return this.rowToResource(row);
    });
  }

  // ── Row Converters ────────────────────────────────────────────────────

  private rowToThread(row: OracleThreadRow): StorageThreadType {
    return {
      id: row.ID,
      resourceId: row.RESOURCE_ID,
      title: row.TITLE ?? undefined,
      metadata: parseJSON<Record<string, unknown>>(row.METADATA) ?? undefined,
      createdAt: toDate(row.CREATED_AT),
      updatedAt: toDate(row.UPDATED_AT),
    };
  }

  private rowToMessage(row: OracleMessageRow): MastraDBMessage {
    return {
      id: row.ID,
      threadId: row.THREAD_ID,
      role: row.ROLE as "user" | "assistant" | "system",
      type: row.TYPE ?? undefined,
      content:
        parseJSON<MastraMessageContentV2>(row.CONTENT) ??
        ({ format: 2, parts: [] } as MastraMessageContentV2),
      resourceId: row.RESOURCE_ID ?? undefined,
      createdAt: toDate(row.CREATED_AT),
    };
  }

  private rowToResource(row: OracleResourceRow): StorageResourceType {
    return {
      id: row.ID,
      workingMemory: row.WORKING_MEMORY ?? undefined,
      metadata: parseJSON<Record<string, unknown>>(row.METADATA) ?? undefined,
      createdAt: toDate(row.CREATED_AT),
      updatedAt: toDate(row.UPDATED_AT),
    };
  }
}

// ── ScoresOracle (Phase 9.7 stub) ────────────────────────────────────────

export class ScoresOracle extends ScoresStorage {
  private withConnection: WithConnectionFn;

  constructor(withConnection: WithConnectionFn) {
    super();
    this.withConnection = withConnection;
  }

  override async dangerouslyClearAll(): Promise<void> {
    await this.withConnection(async (conn) => {
      await conn.execute("DELETE FROM mastra_scores");
      await conn.commit();
    });
  }

  async getScoreById(_args: { id: string }) {
    throw new Error("ScoresOracle.getScoreById: Not implemented (Phase 9.7)");
    return null as never;
  }

  async saveScore(_score: unknown) {
    throw new Error("ScoresOracle.saveScore: Not implemented (Phase 9.7)");
    return null as never;
  }

  async listScoresByScorerId(_args: unknown) {
    throw new Error(
      "ScoresOracle.listScoresByScorerId: Not implemented (Phase 9.7)",
    );
    return null as never;
  }

  async listScoresByRunId(_args: unknown) {
    throw new Error(
      "ScoresOracle.listScoresByRunId: Not implemented (Phase 9.7)",
    );
    return null as never;
  }

  async listScoresByEntityId(_args: unknown) {
    throw new Error(
      "ScoresOracle.listScoresByEntityId: Not implemented (Phase 9.7)",
    );
    return null as never;
  }
}

// ── OracleStore (Composite) ──────────────────────────────────────────────

export interface OracleStoreConfig {
  withConnection: WithConnectionFn;
  /** Skip automatic init (tables managed by migrations). Default: true */
  disableInit?: boolean;
}

export class OracleStore extends MastraCompositeStore {
  constructor(config: OracleStoreConfig) {
    const workflows = new WorkflowsOracle(config.withConnection);
    const memory = new MemoryOracle(config.withConnection);
    const scores = new ScoresOracle(config.withConnection);

    const compositeConfig: MastraCompositeStoreConfig = {
      id: "oracle-adb-26ai",
      name: "OracleStore",
      disableInit: config.disableInit ?? true, // migrations handle DDL
    };

    super(compositeConfig);

    // Set domain stores directly (same pattern as @mastra/pg)
    this.stores = { workflows, memory, scores };
  }
}
