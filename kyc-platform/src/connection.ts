// kyc-platform/src/connection.ts
import Database from 'better-sqlite3';
import { initializeSchema } from './schema.js';
import { resolve } from 'path';

/**
 * Database connection manager
 */
export class DatabaseConnection {
  private db: Database.Database | null = null;
  private readonly path: string;

  constructor(path: string = ':memory:') {
    this.path = path;
  }

  /**
   * Get or create database connection
   */
  getConnection(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.path, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      });

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Initialize schema
      initializeSchema(this.db);
    }

    return this.db;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Begin a transaction
   */
  transaction<T>(fn: (db: Database.Database) => T): T {
    const db = this.getConnection();
    const txn = db.transaction(fn);
    return txn(db);
  }
}

/**
 * Create a database connection
 * @param path Database file path (default: ./data/kyc-platform.db)
 */
export function createConnection(path?: string): DatabaseConnection {
  const dbPath = path || resolve(process.cwd(), 'data', 'kyc-platform.db');
  return new DatabaseConnection(dbPath);
}

/**
 * Singleton database instance for server-side usage
 */
let instance: DatabaseConnection | null = null;

export function getDatabase(): DatabaseConnection {
  if (!instance) {
    instance = createConnection();
  }
  return instance;
}

export function closeDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
