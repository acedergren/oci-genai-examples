import Database from 'better-sqlite3';
import { StateRepository, initializeSchema } from '@acedergren/agent-state';
import type { Session, Turn, Message } from '@acedergren/agent-state';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const DATA_DIR = join(homedir(), '.oci-tui');
const DB_PATH = join(DATA_DIR, 'sessions.db');

let repository: StateRepository | null = null;

/**
 * Initialize the persistence layer
 */
export function initPersistence(): StateRepository {
  if (repository) return repository;

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Open database and initialize schema
  const db = new Database(DB_PATH);
  initializeSchema(db);

  repository = new StateRepository(db);
  return repository;
}

/**
 * Get the repository instance
 */
export function getRepository(): StateRepository {
  if (!repository) {
    return initPersistence();
  }
  return repository;
}

/**
 * Create a new session
 */
export function createSession(model: string, region: string): Session {
  const repo = getRepository();
  return repo.createSession({
    model,
    region,
    status: 'active',
  });
}

/**
 * Get or create the most recent session
 */
export function getOrCreateSession(
  model: string,
  region: string
): { session: Session; isNew: boolean } {
  const repo = getRepository();

  const recent = repo.getMostRecentSession();
  if (recent) {
    return { session: recent, isNew: false };
  }

  const session = createSession(model, region);
  return { session, isNew: true };
}

/**
 * Resume a specific session by ID
 */
export function resumeSession(sessionId: string): {
  session: Session;
  turns: Turn[];
} | null {
  const repo = getRepository();
  return repo.restoreSession(sessionId);
}

/**
 * List recent sessions
 */
export function listSessions(limit: number = 10): Session[] {
  const repo = getRepository();
  return repo.listSessions({ limit });
}

/**
 * Add a turn to a session
 */
export function addTurn(
  sessionId: string,
  turnNumber: number,
  userMessage: Message
): Turn {
  const repo = getRepository();
  return repo.addTurn(sessionId, { turnNumber, userMessage });
}

/**
 * Update a turn with assistant response
 */
export function updateTurn(
  turnId: string,
  assistantResponse: Message,
  tokensUsed?: number,
  costUsd?: number
): Turn | null {
  const repo = getRepository();
  return repo.updateTurn(turnId, {
    assistantResponse,
    tokensUsed,
    costUsd,
  });
}

/**
 * Mark turn as error
 */
export function markTurnError(turnId: string, error: string): Turn | null {
  const repo = getRepository();
  return repo.updateTurn(turnId, { error });
}

/**
 * Update session title (often based on first message)
 */
export function updateSessionTitle(
  sessionId: string,
  title: string
): Session | null {
  const repo = getRepository();
  return repo.updateSession(sessionId, { title });
}

/**
 * Mark session as completed
 */
export function completeSession(sessionId: string): Session | null {
  const repo = getRepository();
  return repo.updateSession(sessionId, { status: 'completed' });
}

export type { Session, Turn, Message };
