// packages/agent-state/src/__tests__/connection.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getConnection,
  closeConnection,
  resetConnection,
  getDatabasePath,
  getConnectionPath,
} from '../connection.js';

describe('Connection Manager', () => {
  const testDbDir = path.join(os.tmpdir(), 'agent-state-test');
  const testDbPath = path.join(testDbDir, 'test.db');

  beforeEach(() => {
    resetConnection();
    // Ensure clean test directory exists
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDbDir, { recursive: true });
    process.env.AGENT_STATE_DB_PATH = testDbPath;
  });

  afterEach(() => {
    closeConnection();
    delete process.env.AGENT_STATE_DB_PATH;
    // Clean up entire test directory recursively
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  it('creates database file at specified path', () => {
    getConnection();
    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  it('creates parent directories if missing', () => {
    const deepPath = path.join(os.tmpdir(), 'deep', 'nested', 'dir', 'test.db');
    process.env.AGENT_STATE_DB_PATH = deepPath;
    resetConnection();

    getConnection();
    expect(fs.existsSync(deepPath)).toBe(true);

    // Cleanup
    closeConnection();
    fs.unlinkSync(deepPath);
    fs.rmdirSync(path.dirname(deepPath));
    fs.rmdirSync(path.dirname(path.dirname(deepPath)));
    fs.rmdirSync(path.dirname(path.dirname(path.dirname(deepPath))));
  });

  it('returns same connection on subsequent calls (singleton)', () => {
    const conn1 = getConnection();
    const conn2 = getConnection();
    expect(conn1).toBe(conn2);
  });

  it('enables WAL mode', () => {
    const conn = getConnection();
    const result = conn.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(result[0].journal_mode).toBe('wal');
  });

  it('initializes schema automatically', () => {
    const conn = getConnection();
    const tables = conn
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('turns');
  });

  it('getDatabasePath returns env var when set', () => {
    expect(getDatabasePath()).toBe(testDbPath);
  });

  it('getConnectionPath returns null before connection', () => {
    expect(getConnectionPath()).toBeNull();
  });

  it('getConnectionPath returns path after connection', () => {
    getConnection();
    expect(getConnectionPath()).toBe(testDbPath);
  });

  it('throws error when requesting different path after connection exists', () => {
    getConnection(); // Connect to testDbPath
    const differentPath = path.join(testDbDir, 'different.db');

    expect(() => getConnection(differentPath)).toThrow(
      /Connection already exists.*Cannot connect.*Call resetConnection/
    );
  });

  it('allows same path after connection exists', () => {
    const conn1 = getConnection();
    const conn2 = getConnection(testDbPath); // Same path, should work
    expect(conn1).toBe(conn2);
  });

  it('resetConnection clears path, allowing new connection', () => {
    getConnection();
    expect(getConnectionPath()).toBe(testDbPath);

    resetConnection();
    expect(getConnectionPath()).toBeNull();

    // Now can connect to a different path
    const newPath = path.join(testDbDir, 'new.db');
    getConnection(newPath);
    expect(getConnectionPath()).toBe(newPath);
  });
});
