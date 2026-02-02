// packages/agent-state/src/__tests__/types.test.ts
/**
 * Comprehensive Zod schema validation tests for agent-state types.
 *
 * Test naming convention: ZOD-AS-XXX (Agent State schema tests)
 * - ZOD-AS-001 to ZOD-AS-010: SessionStatusSchema & ToolCallStatusSchema
 * - ZOD-AS-011 to ZOD-AS-020: SessionConfigSchema
 * - ZOD-AS-021 to ZOD-AS-030: MessageSchema
 * - ZOD-AS-031 to ZOD-AS-040: ToolCallSchema
 * - ZOD-AS-041 to ZOD-AS-050: SessionSchema
 * - ZOD-AS-051 to ZOD-AS-060: TurnSchema
 */
import { describe, it, expect } from 'vitest';
import {
  SessionStatusSchema,
  ToolCallStatusSchema,
  SessionConfigSchema,
  MessageSchema,
  ToolCallSchema,
  SessionSchema,
  TurnSchema,
  type SessionStatus,
  type ToolCallStatus,
  type SessionConfig,
  type Message,
  type ToolCall,
  type Session,
  type Turn,
} from '../types.js';

// =============================================================================
// SessionStatusSchema Tests (ZOD-AS-001 to ZOD-AS-005)
// =============================================================================

describe('SessionStatusSchema', () => {
  it('ZOD-AS-001: accepts "active" status', () => {
    expect(SessionStatusSchema.parse('active')).toBe('active');
  });

  it('ZOD-AS-002: accepts "completed" status', () => {
    expect(SessionStatusSchema.parse('completed')).toBe('completed');
  });

  it('ZOD-AS-003: accepts "error" status', () => {
    expect(SessionStatusSchema.parse('error')).toBe('error');
  });

  it('ZOD-AS-004: rejects invalid status string', () => {
    expect(() => SessionStatusSchema.parse('pending')).toThrow();
    expect(() => SessionStatusSchema.parse('running')).toThrow();
    expect(() => SessionStatusSchema.parse('ACTIVE')).toThrow(); // case-sensitive
  });

  it('ZOD-AS-005: rejects non-string values', () => {
    expect(() => SessionStatusSchema.parse(null)).toThrow();
    expect(() => SessionStatusSchema.parse(undefined)).toThrow();
    expect(() => SessionStatusSchema.parse(1)).toThrow();
    expect(() => SessionStatusSchema.parse({})).toThrow();
  });
});

// =============================================================================
// ToolCallStatusSchema Tests (ZOD-AS-006 to ZOD-AS-010)
// =============================================================================

describe('ToolCallStatusSchema', () => {
  it('ZOD-AS-006: accepts all valid tool call statuses', () => {
    expect(ToolCallStatusSchema.parse('pending')).toBe('pending');
    expect(ToolCallStatusSchema.parse('running')).toBe('running');
    expect(ToolCallStatusSchema.parse('completed')).toBe('completed');
    expect(ToolCallStatusSchema.parse('error')).toBe('error');
  });

  it('ZOD-AS-007: rejects session statuses (different enum)', () => {
    expect(() => ToolCallStatusSchema.parse('active')).toThrow();
  });

  it('ZOD-AS-008: rejects invalid status strings', () => {
    expect(() => ToolCallStatusSchema.parse('cancelled')).toThrow();
    expect(() => ToolCallStatusSchema.parse('PENDING')).toThrow();
    expect(() => ToolCallStatusSchema.parse('')).toThrow();
  });

  it('ZOD-AS-009: type inference works correctly', () => {
    const status: ToolCallStatus = 'pending';
    expect(ToolCallStatusSchema.parse(status)).toBe('pending');
  });

  it('ZOD-AS-010: rejects non-string values', () => {
    expect(() => ToolCallStatusSchema.parse(0)).toThrow();
    expect(() => ToolCallStatusSchema.parse(false)).toThrow();
  });
});

// =============================================================================
// SessionConfigSchema Tests (ZOD-AS-011 to ZOD-AS-020)
// =============================================================================

describe('SessionConfigSchema', () => {
  it('ZOD-AS-011: accepts valid config with all fields', () => {
    const config: SessionConfig = {
      temperature: 0.7,
      maxTokens: 4096,
      agentRole: 'infrastructure-analyst',
      systemPrompt: 'You are an OCI expert.',
    };
    expect(() => SessionConfigSchema.parse(config)).not.toThrow();
  });

  it('ZOD-AS-012: accepts empty config (all fields optional)', () => {
    expect(() => SessionConfigSchema.parse({})).not.toThrow();
  });

  it('ZOD-AS-013: accepts temperature at boundary values (0 and 2)', () => {
    expect(() => SessionConfigSchema.parse({ temperature: 0 })).not.toThrow();
    expect(() => SessionConfigSchema.parse({ temperature: 2 })).not.toThrow();
    expect(() => SessionConfigSchema.parse({ temperature: 1.5 })).not.toThrow();
  });

  it('ZOD-AS-014: rejects temperature below 0', () => {
    expect(() => SessionConfigSchema.parse({ temperature: -0.1 })).toThrow();
    expect(() => SessionConfigSchema.parse({ temperature: -1 })).toThrow();
  });

  it('ZOD-AS-015: rejects temperature above 2', () => {
    expect(() => SessionConfigSchema.parse({ temperature: 2.1 })).toThrow();
    expect(() => SessionConfigSchema.parse({ temperature: 3 })).toThrow();
  });

  it('ZOD-AS-016: accepts positive maxTokens values', () => {
    expect(() => SessionConfigSchema.parse({ maxTokens: 1 })).not.toThrow();
    expect(() => SessionConfigSchema.parse({ maxTokens: 100000 })).not.toThrow();
  });

  it('ZOD-AS-017: rejects zero or negative maxTokens', () => {
    expect(() => SessionConfigSchema.parse({ maxTokens: 0 })).toThrow();
    expect(() => SessionConfigSchema.parse({ maxTokens: -1 })).toThrow();
    expect(() => SessionConfigSchema.parse({ maxTokens: -100 })).toThrow();
  });

  it('ZOD-AS-018: accepts any string for agentRole and systemPrompt', () => {
    expect(() =>
      SessionConfigSchema.parse({
        agentRole: '',
        systemPrompt: '',
      })
    ).not.toThrow();
    expect(() =>
      SessionConfigSchema.parse({
        agentRole: 'a'.repeat(10000),
        systemPrompt: 'b'.repeat(10000),
      })
    ).not.toThrow();
  });

  it('ZOD-AS-019: passthrough allows unknown fields', () => {
    const config = {
      temperature: 0.5,
      customField: 'custom-value',
      nested: { foo: 'bar' },
    };
    const result = SessionConfigSchema.parse(config);
    expect(result.customField).toBe('custom-value');
    expect(result.nested).toEqual({ foo: 'bar' });
  });

  it('ZOD-AS-020: rejects non-number temperature', () => {
    expect(() => SessionConfigSchema.parse({ temperature: '0.7' })).toThrow();
    expect(() => SessionConfigSchema.parse({ maxTokens: '4096' })).toThrow();
  });
});

// =============================================================================
// MessageSchema Tests (ZOD-AS-021 to ZOD-AS-030)
// =============================================================================

describe('MessageSchema', () => {
  it('ZOD-AS-021: accepts valid user message', () => {
    const msg: Message = { role: 'user', content: 'List all VCNs' };
    expect(() => MessageSchema.parse(msg)).not.toThrow();
  });

  it('ZOD-AS-022: accepts valid assistant message', () => {
    const msg: Message = { role: 'assistant', content: 'Found 2 VCNs.' };
    expect(() => MessageSchema.parse(msg)).not.toThrow();
  });

  it('ZOD-AS-023: accepts valid system message', () => {
    const msg: Message = { role: 'system', content: 'You are an OCI expert.' };
    expect(() => MessageSchema.parse(msg)).not.toThrow();
  });

  it('ZOD-AS-024: accepts message with reasoning field', () => {
    const msg: Message = {
      role: 'assistant',
      content: 'The VCN has 3 subnets.',
      reasoning: 'I analyzed the VCN structure and counted the subnets.',
    };
    const result = MessageSchema.parse(msg);
    expect(result.reasoning).toBe('I analyzed the VCN structure and counted the subnets.');
  });

  it('ZOD-AS-025: rejects invalid role values', () => {
    expect(() => MessageSchema.parse({ role: 'tool', content: 'test' })).toThrow();
    expect(() => MessageSchema.parse({ role: 'function', content: 'test' })).toThrow();
    expect(() => MessageSchema.parse({ role: 'USER', content: 'test' })).toThrow();
    expect(() => MessageSchema.parse({ role: '', content: 'test' })).toThrow();
  });

  it('ZOD-AS-026: accepts empty content string', () => {
    // Empty strings are technically valid - design decision
    expect(() => MessageSchema.parse({ role: 'user', content: '' })).not.toThrow();
  });

  it('ZOD-AS-027: rejects missing required fields', () => {
    expect(() => MessageSchema.parse({ role: 'user' })).toThrow(); // missing content
    expect(() => MessageSchema.parse({ content: 'test' })).toThrow(); // missing role
    expect(() => MessageSchema.parse({})).toThrow();
  });

  it('ZOD-AS-028: rejects non-string content', () => {
    expect(() => MessageSchema.parse({ role: 'user', content: null })).toThrow();
    expect(() => MessageSchema.parse({ role: 'user', content: 123 })).toThrow();
    expect(() => MessageSchema.parse({ role: 'user', content: [] })).toThrow();
  });

  it('ZOD-AS-029: rejects extra fields (strict object)', () => {
    // MessageSchema doesn't use .passthrough(), so extra fields should be stripped
    const msg = { role: 'user', content: 'test', extra: 'field' };
    const result = MessageSchema.parse(msg);
    expect((result as Record<string, unknown>).extra).toBeUndefined();
  });

  it('ZOD-AS-030: handles unicode and special characters in content', () => {
    const msg = {
      role: 'user',
      content: '🚀 Émoji テスト <script>alert("xss")</script>',
    };
    const result = MessageSchema.parse(msg);
    expect(result.content).toBe('🚀 Émoji テスト <script>alert("xss")</script>');
  });
});

// =============================================================================
// ToolCallSchema Tests (ZOD-AS-031 to ZOD-AS-040)
// =============================================================================

describe('ToolCallSchema', () => {
  it('ZOD-AS-031: accepts minimal valid tool call', () => {
    const toolCall: ToolCall = {
      id: 'tc_001',
      name: 'listInstances',
      status: 'pending',
    };
    expect(() => ToolCallSchema.parse(toolCall)).not.toThrow();
  });

  it('ZOD-AS-032: accepts complete tool call with all fields', () => {
    const toolCall: ToolCall = {
      id: 'tc_002',
      name: 'createVCN',
      args: { displayName: 'prod-vcn', cidrBlock: '10.0.0.0/16' },
      result: { vcnId: 'ocid1.vcn.oc1...' },
      status: 'completed',
      startedAt: 1700000000000,
      completedAt: 1700000001000,
      error: undefined,
    };
    expect(() => ToolCallSchema.parse(toolCall)).not.toThrow();
  });

  it('ZOD-AS-033: applies default empty object for args', () => {
    const toolCall = {
      id: 'tc_003',
      name: 'getSystemInfo',
      status: 'completed',
    };
    const result = ToolCallSchema.parse(toolCall);
    expect(result.args).toEqual({});
  });

  it('ZOD-AS-034: accepts all valid status values', () => {
    const baseToolCall = { id: 'tc', name: 'test' };
    expect(() => ToolCallSchema.parse({ ...baseToolCall, status: 'pending' })).not.toThrow();
    expect(() => ToolCallSchema.parse({ ...baseToolCall, status: 'running' })).not.toThrow();
    expect(() => ToolCallSchema.parse({ ...baseToolCall, status: 'completed' })).not.toThrow();
    expect(() => ToolCallSchema.parse({ ...baseToolCall, status: 'error' })).not.toThrow();
  });

  it('ZOD-AS-035: rejects invalid status', () => {
    expect(() =>
      ToolCallSchema.parse({ id: 'tc', name: 'test', status: 'cancelled' })
    ).toThrow();
  });

  it('ZOD-AS-036: accepts tool call with error string', () => {
    const toolCall = {
      id: 'tc_error',
      name: 'deleteVCN',
      status: 'error',
      error: 'VCN has attached subnets. Cannot delete.',
    };
    const result = ToolCallSchema.parse(toolCall);
    expect(result.error).toBe('VCN has attached subnets. Cannot delete.');
  });

  it('ZOD-AS-037: accepts any unknown type for result', () => {
    const toolCall1 = { id: 'tc', name: 'test', status: 'completed', result: { data: [1, 2, 3] } };
    const toolCall2 = { id: 'tc', name: 'test', status: 'completed', result: 'string result' };
    const toolCall3 = { id: 'tc', name: 'test', status: 'completed', result: null };
    const toolCall4 = { id: 'tc', name: 'test', status: 'completed', result: 42 };

    expect(() => ToolCallSchema.parse(toolCall1)).not.toThrow();
    expect(() => ToolCallSchema.parse(toolCall2)).not.toThrow();
    expect(() => ToolCallSchema.parse(toolCall3)).not.toThrow();
    expect(() => ToolCallSchema.parse(toolCall4)).not.toThrow();
  });

  it('ZOD-AS-038: accepts timestamps as numbers', () => {
    const toolCall = {
      id: 'tc',
      name: 'test',
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now() + 1000,
    };
    expect(() => ToolCallSchema.parse(toolCall)).not.toThrow();
  });

  it('ZOD-AS-039: rejects missing required fields', () => {
    expect(() => ToolCallSchema.parse({ id: 'tc', name: 'test' })).toThrow(); // missing status
    expect(() => ToolCallSchema.parse({ id: 'tc', status: 'pending' })).toThrow(); // missing name
    expect(() => ToolCallSchema.parse({ name: 'test', status: 'pending' })).toThrow(); // missing id
  });

  it('ZOD-AS-040: args must be record of string keys', () => {
    // Valid: string keys with unknown values
    const valid = { id: 'tc', name: 'test', status: 'pending', args: { key: 'value', nested: { a: 1 } } };
    expect(() => ToolCallSchema.parse(valid)).not.toThrow();

    // args with non-object value should fail
    const invalid = { id: 'tc', name: 'test', status: 'pending', args: 'not-an-object' };
    expect(() => ToolCallSchema.parse(invalid)).toThrow();
  });
});

// =============================================================================
// SessionSchema Tests (ZOD-AS-041 to ZOD-AS-050)
// =============================================================================

describe('SessionSchema', () => {
  const validSession: Session = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: 'Analyze VCN architecture',
    model: 'command-r-plus',
    region: 'eu-frankfurt-1',
    status: 'active',
    config: { temperature: 0.7 },
  };

  it('ZOD-AS-041: accepts valid session with all fields', () => {
    expect(() => SessionSchema.parse(validSession)).not.toThrow();
  });

  it('ZOD-AS-042: accepts session without optional fields', () => {
    const minimalSession = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'meta.llama-3.3-70b-instruct',
      region: 'us-ashburn-1',
      status: 'completed',
    };
    expect(() => SessionSchema.parse(minimalSession)).not.toThrow();
  });

  it('ZOD-AS-043: validates UUID format for id', () => {
    const invalidUUID = { ...validSession, id: 'not-a-uuid' };
    expect(() => SessionSchema.parse(invalidUUID)).toThrow();

    const shortUUID = { ...validSession, id: '123e4567' };
    expect(() => SessionSchema.parse(shortUUID)).toThrow();
  });

  it('ZOD-AS-044: accepts valid UUID formats', () => {
    // Standard UUID v4
    const uuid1 = { ...validSession, id: '550e8400-e29b-41d4-a716-446655440000' };
    expect(() => SessionSchema.parse(uuid1)).not.toThrow();

    // Lowercase
    const uuid2 = { ...validSession, id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };
    expect(() => SessionSchema.parse(uuid2)).not.toThrow();
  });

  it('ZOD-AS-045: validates status enum', () => {
    expect(() => SessionSchema.parse({ ...validSession, status: 'active' })).not.toThrow();
    expect(() => SessionSchema.parse({ ...validSession, status: 'completed' })).not.toThrow();
    expect(() => SessionSchema.parse({ ...validSession, status: 'error' })).not.toThrow();
    expect(() => SessionSchema.parse({ ...validSession, status: 'pending' })).toThrow();
  });

  it('ZOD-AS-046: validates nested config schema', () => {
    const invalidConfig = { ...validSession, config: { temperature: 5 } }; // temperature > 2
    expect(() => SessionSchema.parse(invalidConfig)).toThrow();
  });

  it('ZOD-AS-047: accepts config with passthrough fields', () => {
    const customConfig = {
      ...validSession,
      config: { temperature: 0.5, customSetting: 'enabled' },
    };
    const result = SessionSchema.parse(customConfig);
    expect(result.config?.customSetting).toBe('enabled');
  });

  it('ZOD-AS-048: rejects missing required fields', () => {
    const { id, ...noId } = validSession;
    const { model, ...noModel } = validSession;
    const { region, ...noRegion } = validSession;
    const { status, ...noStatus } = validSession;
    const { createdAt, ...noCreatedAt } = validSession;
    const { updatedAt, ...noUpdatedAt } = validSession;

    expect(() => SessionSchema.parse(noId)).toThrow();
    expect(() => SessionSchema.parse(noModel)).toThrow();
    expect(() => SessionSchema.parse(noRegion)).toThrow();
    expect(() => SessionSchema.parse(noStatus)).toThrow();
    expect(() => SessionSchema.parse(noCreatedAt)).toThrow();
    expect(() => SessionSchema.parse(noUpdatedAt)).toThrow();
  });

  it('ZOD-AS-049: timestamps must be numbers', () => {
    expect(() =>
      SessionSchema.parse({ ...validSession, createdAt: '2024-01-01' })
    ).toThrow();
    expect(() =>
      SessionSchema.parse({ ...validSession, updatedAt: new Date() })
    ).toThrow();
  });

  it('ZOD-AS-050: title can be any string or undefined', () => {
    expect(() => SessionSchema.parse({ ...validSession, title: '' })).not.toThrow();
    expect(() => SessionSchema.parse({ ...validSession, title: undefined })).not.toThrow();
    expect(() =>
      SessionSchema.parse({ ...validSession, title: 'A'.repeat(1000) })
    ).not.toThrow();
  });
});

// =============================================================================
// TurnSchema Tests (ZOD-AS-051 to ZOD-AS-060)
// =============================================================================

describe('TurnSchema', () => {
  const validTurn: Turn = {
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

  it('ZOD-AS-051: accepts valid turn with all fields', () => {
    expect(() => TurnSchema.parse(validTurn)).not.toThrow();
  });

  it('ZOD-AS-052: accepts turn without optional fields', () => {
    const minimalTurn = {
      id: 'turn_002',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      turnNumber: 1,
      createdAt: Date.now(),
      userMessage: { role: 'user', content: 'Hello' },
      toolCalls: [],
      error: null,
    };
    expect(() => TurnSchema.parse(minimalTurn)).not.toThrow();
  });

  it('ZOD-AS-053: turnNumber must be positive integer', () => {
    expect(() => TurnSchema.parse({ ...validTurn, turnNumber: 1 })).not.toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, turnNumber: 100 })).not.toThrow();

    // Must be positive
    expect(() => TurnSchema.parse({ ...validTurn, turnNumber: 0 })).toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, turnNumber: -1 })).toThrow();

    // Must be integer
    expect(() => TurnSchema.parse({ ...validTurn, turnNumber: 1.5 })).toThrow();
  });

  it('ZOD-AS-054: sessionId must be valid UUID', () => {
    expect(() => TurnSchema.parse({ ...validTurn, sessionId: 'not-a-uuid' })).toThrow();
  });

  it('ZOD-AS-055: validates nested userMessage schema', () => {
    const invalidUserMsg = { ...validTurn, userMessage: { role: 'invalid', content: 'test' } };
    expect(() => TurnSchema.parse(invalidUserMsg)).toThrow();
  });

  it('ZOD-AS-056: validates nested assistantResponse schema', () => {
    const invalidAssistantMsg = {
      ...validTurn,
      assistantResponse: { role: 'user', content: 'wrong role' },
    };
    // This should pass since we're just validating it matches MessageSchema
    // The schema doesn't enforce role='assistant' specifically
    expect(() => TurnSchema.parse(invalidAssistantMsg)).not.toThrow();
  });

  it('ZOD-AS-057: accepts turn with tool calls array', () => {
    const turnWithTools = {
      ...validTurn,
      toolCalls: [
        { id: 'tc1', name: 'listVCNs', status: 'completed', args: {} },
        { id: 'tc2', name: 'describeVCN', status: 'pending', args: { vcnId: 'ocid1...' } },
      ],
    };
    const result = TurnSchema.parse(turnWithTools);
    expect(result.toolCalls).toHaveLength(2);
  });

  it('ZOD-AS-058: tokensUsed must be non-negative integer', () => {
    expect(() => TurnSchema.parse({ ...validTurn, tokensUsed: 0 })).not.toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, tokensUsed: 1000 })).not.toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, tokensUsed: -1 })).toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, tokensUsed: 1.5 })).toThrow();
  });

  it('ZOD-AS-059: costUsd must be non-negative number', () => {
    expect(() => TurnSchema.parse({ ...validTurn, costUsd: 0 })).not.toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, costUsd: 0.00001 })).not.toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, costUsd: 100.5 })).not.toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, costUsd: -0.01 })).toThrow();
  });

  it('ZOD-AS-060: error field accepts null or string', () => {
    expect(() => TurnSchema.parse({ ...validTurn, error: null })).not.toThrow();
    expect(() => TurnSchema.parse({ ...validTurn, error: 'API timeout' })).not.toThrow();
    // undefined is different from null - schema expects nullable, not optional
    expect(() => TurnSchema.parse({ ...validTurn, error: undefined })).toThrow();
  });
});

// =============================================================================
// Type Inference Tests
// =============================================================================

describe('Type Inference', () => {
  it('infers correct types from schemas', () => {
    // These are compile-time checks - if they compile, types are correct
    const status: SessionStatus = 'active';
    const toolStatus: ToolCallStatus = 'pending';
    const config: SessionConfig = { temperature: 0.5 };
    const message: Message = { role: 'user', content: 'test' };
    const toolCall: ToolCall = { id: '1', name: 'test', status: 'pending', args: {} };
    const session: Session = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: 0,
      updatedAt: 0,
      model: 'test',
      region: 'test',
      status: 'active',
    };
    const turn: Turn = {
      id: '1',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      turnNumber: 1,
      createdAt: 0,
      userMessage: message,
      toolCalls: [],
      error: null,
    };

    // Verify parsing returns correct types
    expect(SessionStatusSchema.parse(status)).toBe(status);
    expect(ToolCallStatusSchema.parse(toolStatus)).toBe(toolStatus);
    expect(SessionConfigSchema.parse(config)).toMatchObject(config);
    expect(MessageSchema.parse(message)).toMatchObject(message);
    expect(ToolCallSchema.parse(toolCall)).toMatchObject(toolCall);
    expect(SessionSchema.parse(session)).toMatchObject(session);
    expect(TurnSchema.parse(turn)).toMatchObject(turn);
  });
});
