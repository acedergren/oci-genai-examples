// packages/agent-state/src/__tests__/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { StateRepository } from '../repository.js';
import { initializeSchema } from '../schema.js';
import { ToolCall } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Integration: Multi-turn Conversation with Tool Calls', () => {
  let db: Database.Database;
  let repo: StateRepository;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `integration-test-${Date.now()}.db`);
    db = new Database(dbPath);
    initializeSchema(db);
    repo = new StateRepository(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('simulates a complete agent conversation with tool calls', () => {
    // 1. Create session
    const session = repo.createSession({
      model: 'meta.llama-3.3-70b-instruct',
      region: 'eu-frankfurt-1',
      title: 'VCN Architecture Review',
      config: { temperature: 0.7 },
    });

    expect(session.status).toBe('active');
    expect(session.title).toBe('VCN Architecture Review');

    // 2. Turn 1: User asks to list VCNs
    const turn1 = repo.addTurn(session.id, {
      turnNumber: 1,
      userMessage: {
        role: 'user',
        content: 'List all VCNs in my compartment',
      },
    });

    // Simulate tool call for listing VCNs
    const toolCall: ToolCall = {
      id: 'tc_001',
      name: 'listVCNs',
      args: { compartmentId: 'ocid1.compartment.oc1..example' },
      result: {
        vcns: [
          { id: 'vcn-1', displayName: 'prod-vcn', cidrBlock: '10.0.0.0/16' },
          { id: 'vcn-2', displayName: 'dev-vcn', cidrBlock: '172.16.0.0/16' },
        ],
      },
      status: 'completed',
      startedAt: Date.now() - 500,
      completedAt: Date.now(),
    };

    repo.updateTurn(turn1.id, {
      assistantResponse: {
        role: 'assistant',
        content:
          'Found 2 VCNs in your compartment:\n1. prod-vcn (10.0.0.0/16)\n2. dev-vcn (172.16.0.0/16)',
      },
      toolCalls: [toolCall],
      tokensUsed: 250,
      costUsd: 0.0005,
    });

    // 3. Turn 2: User asks for details
    const turn2 = repo.addTurn(session.id, {
      turnNumber: 2,
      userMessage: {
        role: 'user',
        content: 'Show me the subnets in prod-vcn',
      },
    });

    const toolCall2: ToolCall = {
      id: 'tc_002',
      name: 'listSubnets',
      args: { vcnId: 'vcn-1' },
      result: {
        subnets: [
          { id: 'subnet-1', displayName: 'public-subnet', cidrBlock: '10.0.0.0/24' },
          { id: 'subnet-2', displayName: 'private-subnet', cidrBlock: '10.0.1.0/24' },
        ],
      },
      status: 'completed',
      startedAt: Date.now() - 300,
      completedAt: Date.now(),
    };

    repo.updateTurn(turn2.id, {
      assistantResponse: {
        role: 'assistant',
        content:
          'prod-vcn has 2 subnets:\n1. public-subnet (10.0.0.0/24)\n2. private-subnet (10.0.1.0/24)',
      },
      toolCalls: [toolCall2],
      tokensUsed: 180,
      costUsd: 0.0004,
    });

    // 4. Mark session as completed
    repo.updateSession(session.id, { status: 'completed' });

    // 5. Verify session restoration
    const restored = repo.restoreSession(session.id);
    expect(restored).not.toBeNull();
    expect(restored!.session.status).toBe('completed');
    expect(restored!.turns.length).toBe(2);

    // Verify turn 1 details
    const restoredTurn1 = restored!.turns[0];
    expect(restoredTurn1.userMessage.content).toBe('List all VCNs in my compartment');
    expect(restoredTurn1.assistantResponse?.content).toContain('Found 2 VCNs');
    expect(restoredTurn1.toolCalls.length).toBe(1);
    expect(restoredTurn1.toolCalls[0].name).toBe('listVCNs');
    expect(restoredTurn1.tokensUsed).toBe(250);

    // Verify turn 2 details
    const restoredTurn2 = restored!.turns[1];
    expect(restoredTurn2.userMessage.content).toBe('Show me the subnets in prod-vcn');
    expect(restoredTurn2.toolCalls[0].name).toBe('listSubnets');

    // 6. Verify total cost
    const totalCost = restored!.turns.reduce((sum, t) => sum + (t.costUsd ?? 0), 0);
    expect(totalCost).toBeCloseTo(0.0009, 4);
  });

  it('handles session continuation (--continue flag scenario)', () => {
    // Create multiple sessions
    const session1 = repo.createSession({
      model: 'model-1',
      region: 'eu-frankfurt-1',
    });

    const session2 = repo.createSession({
      model: 'model-2',
      region: 'eu-frankfurt-1',
    });

    // Add turn to session2 (makes it most recently updated)
    repo.addTurn(session2.id, {
      turnNumber: 1,
      userMessage: { role: 'user', content: 'Hello' },
    });

    // Complete session1
    repo.updateSession(session1.id, { status: 'completed' });

    // Get most recent active session (should be session2)
    const mostRecent = repo.getMostRecentSession();
    expect(mostRecent).not.toBeNull();
    expect(mostRecent!.id).toBe(session2.id);

    // Continue the session with another turn
    repo.addTurn(mostRecent!.id, {
      turnNumber: 2,
      userMessage: { role: 'user', content: 'Continue from where we left off' },
    });

    // Verify turn count
    const turns = repo.getSessionTurns(mostRecent!.id);
    expect(turns.length).toBe(2);
  });

  it('handles error scenarios gracefully', () => {
    const session = repo.createSession({
      model: 'llama-3.3-70b',
      region: 'eu-frankfurt-1',
    });

    const turn = repo.addTurn(session.id, {
      turnNumber: 1,
      userMessage: { role: 'user', content: 'Do something risky' },
    });

    // Simulate an error during tool execution
    const failedToolCall: ToolCall = {
      id: 'tc_err',
      name: 'riskyOperation',
      args: { param: 'value' },
      status: 'error',
      startedAt: Date.now() - 100,
      error: 'Permission denied: insufficient privileges',
    };

    repo.updateTurn(turn.id, {
      toolCalls: [failedToolCall],
      error: 'Tool execution failed',
    });

    // Update session to error state
    repo.updateSession(session.id, { status: 'error' });

    // Verify error is persisted
    const restored = repo.restoreSession(session.id);
    expect(restored!.session.status).toBe('error');
    expect(restored!.turns[0].error).toBe('Tool execution failed');
    expect(restored!.turns[0].toolCalls[0].status).toBe('error');
    expect(restored!.turns[0].toolCalls[0].error).toContain('Permission denied');
  });
});
