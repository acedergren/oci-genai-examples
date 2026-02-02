// packages/agent-state/src/__tests__/schema.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema, SCHEMA_VERSION } from '../schema.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Schema Initialization', () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
    db = new Database(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('creates sessions table', () => {
    initializeSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string;
    }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('sessions');
  });

  it('creates turns table', () => {
    initializeSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string;
    }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('turns');
  });

  it('creates schema_version table', () => {
    initializeSchema(db);
    const version = db.prepare('SELECT version FROM schema_version').get() as
      | { version: number }
      | undefined;
    expect(version?.version).toBe(SCHEMA_VERSION);
  });

  it('is idempotent (safe to call multiple times)', () => {
    initializeSchema(db);
    initializeSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.length).toBeGreaterThan(0);
  });
});
