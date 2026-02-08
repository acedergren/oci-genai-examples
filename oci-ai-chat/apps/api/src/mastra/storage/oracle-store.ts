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

// ── MemoryOracle (Phase 9.6 stub) ────────────────────────────────────────

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

  async getThreadById(_args: { threadId: string }) {
    throw new Error("MemoryOracle.getThreadById: Not implemented (Phase 9.6)");
    return null as never;
  }

  async saveThread(_args: { thread: unknown }) {
    throw new Error("MemoryOracle.saveThread: Not implemented (Phase 9.6)");
    return null as never;
  }

  async updateThread(_args: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }) {
    throw new Error("MemoryOracle.updateThread: Not implemented (Phase 9.6)");
    return null as never;
  }

  async deleteThread(_args: { threadId: string }): Promise<void> {
    throw new Error("MemoryOracle.deleteThread: Not implemented (Phase 9.6)");
  }

  async listThreads(_args: unknown) {
    throw new Error("MemoryOracle.listThreads: Not implemented (Phase 9.6)");
    return null as never;
  }

  async listMessages(_args: unknown) {
    throw new Error("MemoryOracle.listMessages: Not implemented (Phase 9.6)");
    return null as never;
  }

  async listMessagesById(_args: { messageIds: string[] }) {
    throw new Error(
      "MemoryOracle.listMessagesById: Not implemented (Phase 9.6)",
    );
    return null as never;
  }

  async saveMessages(_args: { messages: unknown[] }) {
    throw new Error("MemoryOracle.saveMessages: Not implemented (Phase 9.6)");
    return null as never;
  }

  async updateMessages(_args: { messages: unknown[] }) {
    throw new Error("MemoryOracle.updateMessages: Not implemented (Phase 9.6)");
    return null as never;
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
