// packages/agent-state/src/__tests__/repository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { StateRepository } from '../repository.js';
import { initializeSchema } from '../schema.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('StateRepository', () => {
  let db: Database.Database;
  let repo: StateRepository;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-repo-${Date.now()}.db`);
    db = new Database(dbPath);
    initializeSchema(db);
    repo = new StateRepository(db);
  });

  afterEach(() => {
    // Checkpoint WAL to main db before closing
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Ignore if already closed
    }
    db.close();
    // Clean up db file and WAL files
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(dbPath + '-wal')) {
      fs.unlinkSync(dbPath + '-wal');
    }
    if (fs.existsSync(dbPath + '-shm')) {
      fs.unlinkSync(dbPath + '-shm');
    }
  });

  describe('Sessions', () => {
    it('creates a session', () => {
      const session = repo.createSession({
        model: 'llama-3.3-70b',
        region: 'eu-frankfurt-1',
      });

      expect(session.id).toBeDefined();
      expect(session.model).toBe('llama-3.3-70b');
      expect(session.region).toBe('eu-frankfurt-1');
      expect(session.status).toBe('active');
    });

    it('gets a session by id', () => {
      const created = repo.createSession({
        model: 'llama-3.3-70b',
        region: 'eu-frankfurt-1',
        title: 'Test session',
      });

      const fetched = repo.getSession(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe('Test session');
    });

    it('lists sessions ordered by updated_at', () => {
      repo.createSession({ model: 'model-1', region: 'region-1' });
      const session2 = repo.createSession({ model: 'model-2', region: 'region-2' });

      // Update session2 to ensure it has a later updated_at timestamp
      repo.updateSession(session2.id, { title: 'Updated' });

      const sessions = repo.listSessions();
      expect(sessions.length).toBe(2);
      expect(sessions[0].model).toBe('model-2'); // Most recent first
    });

    it('updates session status', () => {
      const session = repo.createSession({
        model: 'llama-3.3-70b',
        region: 'eu-frankfurt-1',
      });

      const updated = repo.updateSession(session.id, { status: 'completed' });
      expect(updated!.status).toBe('completed');
    });
  });

  describe('Turns', () => {
    it('adds a turn to session', () => {
      const session = repo.createSession({
        model: 'llama-3.3-70b',
        region: 'eu-frankfurt-1',
      });

      const turn = repo.addTurn(session.id, {
        turnNumber: 1,
        userMessage: { role: 'user', content: 'Hello' },
      });

      expect(turn.id).toMatch(/^turn_/);
      expect(turn.turnNumber).toBe(1);
      expect(turn.userMessage.content).toBe('Hello');
    });

    it('updates turn with assistant response', () => {
      const session = repo.createSession({
        model: 'llama-3.3-70b',
        region: 'eu-frankfurt-1',
      });

      const turn = repo.addTurn(session.id, {
        turnNumber: 1,
        userMessage: { role: 'user', content: 'Hello' },
      });

      const updated = repo.updateTurn(turn.id, {
        assistantResponse: { role: 'assistant', content: 'Hi there!' },
        tokensUsed: 50,
      });

      expect(updated!.assistantResponse?.content).toBe('Hi there!');
      expect(updated!.tokensUsed).toBe(50);
    });

    it('gets all turns for a session', () => {
      const session = repo.createSession({
        model: 'llama-3.3-70b',
        region: 'eu-frankfurt-1',
      });

      repo.addTurn(session.id, {
        turnNumber: 1,
        userMessage: { role: 'user', content: 'First' },
      });

      repo.addTurn(session.id, {
        turnNumber: 2,
        userMessage: { role: 'user', content: 'Second' },
      });

      const turns = repo.getSessionTurns(session.id);
      expect(turns.length).toBe(2);
      expect(turns[0].turnNumber).toBe(1);
      expect(turns[1].turnNumber).toBe(2);
    });
  });

  describe('Session Resume', () => {
    it('getMostRecentSession returns most recent active session', () => {
      // Create first session (will be older)
      repo.createSession({
        model: 'model-1',
        region: 'region-1',
      });

      const session2 = repo.createSession({
        model: 'model-2',
        region: 'region-2',
      });

      // Update session2 to ensure it has a later updated_at timestamp
      repo.updateSession(session2.id, { title: 'Updated' });

      const mostRecent = repo.getMostRecentSession();
      expect(mostRecent).not.toBeNull();
      expect(mostRecent!.id).toBe(session2.id);
    });

    it('getMostRecentSession ignores completed sessions', () => {
      const session1 = repo.createSession({
        model: 'model-1',
        region: 'region-1',
      });

      const session2 = repo.createSession({
        model: 'model-2',
        region: 'region-2',
      });

      // Complete the most recent
      repo.updateSession(session2.id, { status: 'completed' });

      const mostRecent = repo.getMostRecentSession();
      expect(mostRecent).not.toBeNull();
      expect(mostRecent!.id).toBe(session1.id);
    });

    it('getMostRecentSession returns null when no active sessions', () => {
      const session = repo.createSession({
        model: 'model-1',
        region: 'region-1',
      });
      repo.updateSession(session.id, { status: 'completed' });

      const mostRecent = repo.getMostRecentSession();
      expect(mostRecent).toBeNull();
    });

    it('restoreSession returns session with all turns', () => {
      const session = repo.createSession({
        model: 'llama-3.3-70b',
        region: 'eu-frankfurt-1',
      });

      const turn1 = repo.addTurn(session.id, {
        turnNumber: 1,
        userMessage: { role: 'user', content: 'First message' },
      });
      repo.updateTurn(turn1.id, {
        assistantResponse: { role: 'assistant', content: 'First response' },
      });

      const turn2 = repo.addTurn(session.id, {
        turnNumber: 2,
        userMessage: { role: 'user', content: 'Second message' },
      });
      repo.updateTurn(turn2.id, {
        assistantResponse: { role: 'assistant', content: 'Second response' },
      });

      const restored = repo.restoreSession(session.id);
      expect(restored).not.toBeNull();
      expect(restored!.session.id).toBe(session.id);
      expect(restored!.turns.length).toBe(2);
      expect(restored!.turns[0].userMessage.content).toBe('First message');
      expect(restored!.turns[1].userMessage.content).toBe('Second message');
    });

    it('restoreSession returns null for non-existent session', () => {
      const restored = repo.restoreSession('non-existent-id');
      expect(restored).toBeNull();
    });
  });
});
