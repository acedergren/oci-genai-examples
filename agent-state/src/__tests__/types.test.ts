// packages/agent-state/src/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import { SessionSchema, TurnSchema, ToolCallSchema } from '../types.js';

describe('Agent State Types', () => {
  it('validates a valid session', () => {
    const session = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: 'Analyze VCN architecture',
      model: 'command-r-plus',
      region: 'eu-frankfurt-1',
      status: 'active',
      config: { temperature: 0.7 },
    };
    expect(() => SessionSchema.parse(session)).not.toThrow();
  });

  it('rejects session with invalid status', () => {
    const session = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'command-r-plus',
      region: 'eu-frankfurt-1',
      status: 'invalid-status',
    };
    expect(() => SessionSchema.parse(session)).toThrow();
  });

  it('validates a tool call', () => {
    const toolCall = {
      id: 'tc_001',
      name: 'listVCNs',
      args: { compartmentId: 'ocid1.compartment...' },
      result: { vcns: [{ name: 'prod-vcn' }] },
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
    };
    expect(() => ToolCallSchema.parse(toolCall)).not.toThrow();
  });

  it('validates a turn with tool calls', () => {
    const turn = {
      id: 'turn_001',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      turnNumber: 1,
      createdAt: Date.now(),
      userMessage: { role: 'user', content: 'List all VCNs' },
      assistantResponse: { role: 'assistant', content: 'Found 2 VCNs.' },
      toolCalls: [],
      tokensUsed: 150,
      costUsd: 0.003,
      error: null,
    };
    expect(() => TurnSchema.parse(turn)).not.toThrow();
  });
});
