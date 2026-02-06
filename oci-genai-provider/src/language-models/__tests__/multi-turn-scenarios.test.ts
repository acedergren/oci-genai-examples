/**
 * Advanced Multi-Turn Test Scenarios
 *
 * Tests streaming, tool use, and context management across:
 * - Grok (xAI) - Including reasoning models
 * - Llama (Meta) - Including vision models
 * - Gemini (Google) - Including reasoning models
 * - Cohere Command A - Including reasoning models
 *
 * These tests validate complex multi-step workflows that exercise
 * the full provider capabilities with realistic conversation patterns.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { OCILanguageModel } from '../OCILanguageModel';
import type { AuthenticationDetailsProvider } from 'oci-common';
import type { OCIConfig } from '../../types';
import type {
  LanguageModelV3FunctionTool,
  LanguageModelV3Prompt,
} from '@ai-sdk/provider';

// =============================================================================
// Test Configuration & Mocks
// =============================================================================

const mockAuthProvider: AuthenticationDetailsProvider = {
  getKeyId: jest.fn(() => Promise.resolve('mock-key-id')),
  getPrivateKey: jest.fn(() => '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----'),
  getPassphrase: jest.fn(() => null),
};

const mockCreateAuthProvider = jest.fn<
  (config: OCIConfig) => Promise<AuthenticationDetailsProvider>
>(() => Promise.resolve(mockAuthProvider));
const mockGetRegion = jest.fn<(config: OCIConfig) => string>(() => 'us-chicago-1');
const mockGetCompartmentId = jest.fn<(config: OCIConfig) => string>(
  (config) => config.compartmentId ?? 'ocid1.compartment.oc1..test'
);

jest.mock('../../auth/index.js', () => ({
  createAuthProvider: (config: OCIConfig) => mockCreateAuthProvider(config),
  getRegion: (config: OCIConfig) => mockGetRegion(config),
  getCompartmentId: (config: OCIConfig) => mockGetCompartmentId(config),
}));

jest.mock('oci-common', () => ({
  Region: {
    fromRegionId: jest.fn((regionId: string) => ({ regionId })),
  },
}));

const mockChat = jest.fn<any>();
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    region: undefined,
    endpoint: undefined,
  })),
}));

// Global beforeEach to ensure mock queue is cleared between tests
// Using a function to properly reset the mock state while preserving Jest mock interface
beforeEach(() => {
  // Reset clears implementation AND queued return values
  // This is necessary because mockResolvedValueOnce creates a queue
  // that persists across tests if not cleared
  mockChat.mockReset();
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates SSE stream data for text responses
 */
function createTextSSE(
  chunks: string[],
  options?: {
    finishReason?: string;
    promptTokens?: number;
    completionTokens?: number;
    reasoningTokens?: number;
  }
): string {
  const events = chunks.map(
    (text) => `event: message\ndata: ${JSON.stringify({
      message: { content: [{ type: 'TEXT', text }] },
    })}\n\n`
  );

  const finishEvent = `event: message\ndata: ${JSON.stringify({
    finishReason: options?.finishReason ?? 'STOP',
    usage: {
      promptTokens: options?.promptTokens ?? 10,
      completionTokens: options?.completionTokens ?? chunks.join('').length,
      ...(options?.reasoningTokens !== undefined
        ? { completionTokensDetails: { reasoningTokens: options.reasoningTokens } }
        : {}),
    },
  })}\n\n`;

  return events.join('') + finishEvent;
}

/**
 * Creates SSE stream data for tool call responses
 */
function createToolCallSSE(
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
  options?: { promptTokens?: number; completionTokens?: number }
): string {
  const toolCallEvent = `event: message\ndata: ${JSON.stringify({
    message: {
      content: [],
      toolCalls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'FUNCTION',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    },
  })}\n\n`;

  const finishEvent = `event: message\ndata: ${JSON.stringify({
    finishReason: 'TOOL_CALL',
    usage: {
      promptTokens: options?.promptTokens ?? 20,
      completionTokens: options?.completionTokens ?? 15,
    },
  })}\n\n`;

  return toolCallEvent + finishEvent;
}

/**
 * Creates SSE stream data for reasoning responses
 */
function createReasoningSSE(
  reasoningChunks: string[],
  textChunks: string[],
  options?: {
    reasoningTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
  }
): string {
  const reasoningEvents = reasoningChunks.map(
    (thinking) => `event: message\ndata: ${JSON.stringify({
      message: { content: [{ type: 'THINKING', thinking }] },
    })}\n\n`
  );

  const textEvents = textChunks.map(
    (text) => `event: message\ndata: ${JSON.stringify({
      message: { content: [{ type: 'TEXT', text }] },
    })}\n\n`
  );

  const totalCompletion = options?.completionTokens ?? 
    (reasoningChunks.join('').length + textChunks.join('').length);
  const reasoningTokens = options?.reasoningTokens ?? reasoningChunks.join('').length;

  const finishEvent = `event: message\ndata: ${JSON.stringify({
    finishReason: 'STOP',
    usage: {
      promptTokens: options?.promptTokens ?? 15,
      completionTokens: totalCompletion,
      completionTokensDetails: { reasoningTokens },
    },
  })}\n\n`;

  return reasoningEvents.join('') + textEvents.join('') + finishEvent;
}

/**
 * Creates a mock streaming Response
 */
function createMockStreamResponse(sseData: string): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    })
  ) as any;
}

/**
 * Reads all parts from a stream
 */
async function collectStreamParts(stream: ReadableStream<any>): Promise<any[]> {
  const reader = stream.getReader();
  const parts: any[] = [];
  let done = false;

  while (!done) {
    const { value, done: isDone } = await reader.read();
    done = isDone;
    if (value) parts.push(value);
  }

  return parts;
}

// =============================================================================
// Standard Tool Definitions
// =============================================================================

const weatherTool: LanguageModelV3FunctionTool = {
  type: 'function',
  name: 'get_weather',
  description: 'Get the current weather for a location',
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['location'],
  },
};

const searchTool: LanguageModelV3FunctionTool = {
  type: 'function',
  name: 'search_database',
  description: 'Search a database for records',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results' },
    },
    required: ['query'],
  },
};

const calculatorTool: LanguageModelV3FunctionTool = {
  type: 'function',
  name: 'calculate',
  description: 'Perform mathematical calculations',
  inputSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Math expression to evaluate' },
    },
    required: ['expression'],
  },
};

// =============================================================================
// Model IDs for Testing
// =============================================================================

const MODELS = {
  // Grok models
  GROK_4_FAST: 'xai.grok-4-fast-non-reasoning',
  GROK_4_REASONING: 'xai.grok-4-fast-reasoning',
  GROK_CODE: 'xai.grok-code-fast-1',
  
  // Llama models
  LLAMA_33_70B: 'meta.llama-3.3-70b-instruct',
  LLAMA_4_MAVERICK: 'meta.llama-4-maverick-17b-128e-instruct-fp8',
  LLAMA_32_VISION: 'meta.llama-3.2-90b-vision-instruct',
  
  // Gemini models
  GEMINI_25_FLASH: 'google.gemini-2.5-flash',
  GEMINI_25_PRO: 'google.gemini-2.5-pro',
  
  // Cohere models
  COHERE_COMMAND_A: 'cohere.command-a-03-2025',
  COHERE_COMMAND_A_REASONING: 'cohere.command-a-reasoning-08-2025',
  COHERE_COMMAND_R_PLUS: 'cohere.command-r-plus-08-2024',
};

const mockConfig: OCIConfig = {
  region: 'us-chicago-1',
  compartmentId: 'ocid1.compartment.oc1..test',
};

// =============================================================================
// Test Suites
// =============================================================================

describe('Multi-Turn Scenarios: Grok Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Streaming', () => {
    it('should stream text from Grok 4 Fast', async () => {
      const model = new OCILanguageModel(MODELS.GROK_4_FAST, mockConfig);
      const chunks = ['Hello', ', ', 'I am ', 'Grok!'];
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE(chunks))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const parts = await collectStreamParts(result.stream);
      
      const textDeltas = parts.filter((p) => p.type === 'text-delta');
      expect(textDeltas.map((p) => p.delta).join('')).toBe('Hello, I am Grok!');
      
      const finish = parts.find((p) => p.type === 'finish');
      expect(finish).toBeDefined();
      expect(finish.finishReason.unified).toBe('stop');
    });

    it('should stream reasoning from Grok 4 Reasoning model', async () => {
      const model = new OCILanguageModel(MODELS.GROK_4_REASONING, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createReasoningSSE(
          ['Let me think...', ' analyzing the problem...'],
          ['The answer is 42.'],
          { reasoningTokens: 30, completionTokens: 45 }
        ))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Complex question' }] }],
        providerOptions: { oci: { reasoningEffort: 'high' } },
      });

      const parts = await collectStreamParts(result.stream);
      
      const reasoningDeltas = parts.filter((p) => p.type === 'reasoning-delta');
      expect(reasoningDeltas.length).toBe(2);
      expect(reasoningDeltas[0].delta).toBe('Let me think...');
      
      const textDeltas = parts.filter((p) => p.type === 'text-delta');
      expect(textDeltas[0].delta).toBe('The answer is 42.');
      
      const finish = parts.find((p) => p.type === 'finish');
      expect(finish.usage.outputTokens.reasoning).toBe(30);
    });
  });

  describe('Tool Calling', () => {
    it('should handle single tool call with Grok Code', async () => {
      const model = new OCILanguageModel(MODELS.GROK_CODE, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'call_grok_1', name: 'calculate', arguments: { expression: '2 + 2' } }
        ]))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Calculate 2+2' }] }],
        tools: [calculatorTool],
      });

      const parts = await collectStreamParts(result.stream);
      
      const toolCall = parts.find((p) => p.type === 'tool-call');
      expect(toolCall).toBeDefined();
      expect(toolCall.toolName).toBe('calculate');
      expect(JSON.parse(toolCall.input)).toEqual({ expression: '2 + 2' });
      
      const finish = parts.find((p) => p.type === 'finish');
      expect(finish.finishReason.unified).toBe('tool-calls');
    });

    it('should handle multi-turn tool conversation with Grok 4', async () => {
      const model = new OCILanguageModel(MODELS.GROK_4_FAST, mockConfig);
      
      // Turn 1: User asks, model calls tool
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'call_weather_1', name: 'get_weather', arguments: { location: 'Tokyo' } }
        ]))
      );

      const turn1 = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Weather in Tokyo?' }] }],
        tools: [weatherTool],
      });

      const parts1 = await collectStreamParts(turn1.stream);
      const toolCall = parts1.find((p) => p.type === 'tool-call');
      expect(toolCall.toolName).toBe('get_weather');

      // Turn 2: Provide tool result, get final answer
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE([
          'Based on the weather data, ',
          'Tokyo is currently 22°C ',
          'with clear skies.'
        ]))
      );

      const turn2Prompt: LanguageModelV3Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'Weather in Tokyo?' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_weather_1',
              toolName: 'get_weather',
              input: { location: 'Tokyo' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_weather_1',
              toolName: 'get_weather',
              output: { type: 'text', value: '{"temp": 22, "condition": "clear"}' },
            },
          ],
        },
      ];

      const turn2 = await model.doStream({
        prompt: turn2Prompt,
        tools: [weatherTool],
      });

      const parts2 = await collectStreamParts(turn2.stream);
      const textDeltas = parts2.filter((p) => p.type === 'text-delta');
      const fullText = textDeltas.map((p) => p.delta).join('');
      
      expect(fullText).toContain('Tokyo');
      expect(fullText).toContain('22°C');
    });
  });

  describe('Context Management', () => {
    it('should handle long conversation context with Grok 4.1 (2M context)', async () => {
      const model = new OCILanguageModel('xai.grok-4-1-fast-non-reasoning', mockConfig);
      
      // Simulate a 10-turn conversation
      const longPrompt: LanguageModelV3Prompt = [];
      for (let i = 1; i <= 10; i++) {
        longPrompt.push({
          role: 'user',
          content: [{ type: 'text', text: `Turn ${i}: What is ${i} * ${i}?` }],
        });
        if (i < 10) {
          longPrompt.push({
            role: 'assistant',
            content: [{ type: 'text', text: `${i} * ${i} = ${i * i}` }],
          });
        }
      }

      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE(['10 * 10 = 100']))
      );

      const result = await model.doStream({ prompt: longPrompt });
      const parts = await collectStreamParts(result.stream);
      
      const textDeltas = parts.filter((p) => p.type === 'text-delta');
      expect(textDeltas[0].delta).toContain('100');
      
      // Verify all messages were passed
      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.messages.length).toBe(19); // 10 user + 9 assistant
    });
  });
});

describe('Multi-Turn Scenarios: Llama Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Streaming', () => {
    it('should stream text from Llama 3.3 70B', async () => {
      const model = new OCILanguageModel(MODELS.LLAMA_33_70B, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE([
          'Hello! ', "I'm Llama, ", 'your helpful assistant.'
        ]))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Introduce yourself' }] }],
      });

      const parts = await collectStreamParts(result.stream);
      
      const textDeltas = parts.filter((p) => p.type === 'text-delta');
      expect(textDeltas.length).toBe(3);
      expect(textDeltas.map((p) => p.delta).join('')).toContain('Llama');
    });

    it('should stream with temperature and topP from Llama 4 Maverick', async () => {
      const model = new OCILanguageModel(MODELS.LLAMA_4_MAVERICK, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE(['Creative response here!']))
      );

      await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Be creative' }] }],
        temperature: 0.9,
        topP: 0.95,
      });

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.temperature).toBe(0.9);
      expect(chatRequest.topP).toBe(0.95);
    });
  });

  describe('Tool Calling', () => {
    it('should handle parallel tool calls with Llama 3.3', async () => {
      const model = new OCILanguageModel(MODELS.LLAMA_33_70B, mockConfig);
      
      // Model decides to call two tools in parallel
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'call_1', name: 'get_weather', arguments: { location: 'New York' } },
          { id: 'call_2', name: 'get_weather', arguments: { location: 'London' } },
        ]))
      );

      const result = await model.doStream({
        prompt: [{ 
          role: 'user', 
          content: [{ type: 'text', text: 'Compare weather in NY and London' }] 
        }],
        tools: [weatherTool],
      });

      const parts = await collectStreamParts(result.stream);
      const toolCalls = parts.filter((p) => p.type === 'tool-call');
      
      expect(toolCalls.length).toBe(2);
      expect(toolCalls[0].toolName).toBe('get_weather');
      expect(toolCalls[1].toolName).toBe('get_weather');
    });

    it('should handle chained tool calls across turns', async () => {
      const model = new OCILanguageModel(MODELS.LLAMA_33_70B, mockConfig);
      
      // Turn 1: Search
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'search_1', name: 'search_database', arguments: { query: 'AI papers', limit: 5 } }
        ]))
      );

      // Turn 2: Calculate based on search results
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'calc_1', name: 'calculate', arguments: { expression: '5 * 100 / 3' } }
        ]))
      );

      // Turn 3: Final response
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE([
          'I found 5 papers, ',
          'with an average of ~167 citations.'
        ]))
      );

      // Execute turns
      const turn1 = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Find AI papers and average citations' }] }],
        tools: [searchTool, calculatorTool],
      });
      const parts1 = await collectStreamParts(turn1.stream);
      expect(parts1.find((p) => p.type === 'tool-call')?.toolName).toBe('search_database');

      const turn2 = await model.doStream({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Find AI papers and average citations' }] },
          { 
            role: 'assistant', 
            content: [{ type: 'tool-call', toolCallId: 'search_1', toolName: 'search_database', input: { query: 'AI papers' } }] 
          },
          {
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: 'search_1', toolName: 'search_database', output: { type: 'text', value: '[100, 200, 150, 50, 0]' } }],
          },
        ],
        tools: [searchTool, calculatorTool],
      });
      const parts2 = await collectStreamParts(turn2.stream);
      expect(parts2.find((p) => p.type === 'tool-call')?.toolName).toBe('calculate');
    });
  });

  describe('Vision (Multimodal)', () => {
    it('should handle image input with Llama 3.2 Vision', async () => {
      const model = new OCILanguageModel(MODELS.LLAMA_32_VISION, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE([
          'I can see ', 'a cat ', 'sitting on a couch.'
        ]))
      );

      const result = await model.doStream({
        prompt: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            { type: 'file', data: new Uint8Array([1, 2, 3, 4]), mediaType: 'image/jpeg' },
          ],
        }],
      });

      const parts = await collectStreamParts(result.stream);
      const text = parts.filter((p) => p.type === 'text-delta').map((p) => p.delta).join('');
      expect(text).toContain('cat');

      // Verify image was included in request
      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      const content = chatRequest.messages[0].content;
      expect(content.some((c: any) => c.type === 'IMAGE')).toBe(true);
    });
  });
});

describe('Multi-Turn Scenarios: Gemini Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Streaming', () => {
    it('should stream text from Gemini 2.5 Flash', async () => {
      const model = new OCILanguageModel(MODELS.GEMINI_25_FLASH, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE([
          'Gemini ', 'responds ', 'quickly!'
        ], { promptTokens: 5, completionTokens: 20 }))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Quick response please' }] }],
      });

      const parts = await collectStreamParts(result.stream);
      
      const finish = parts.find((p) => p.type === 'finish');
      expect(finish.usage.inputTokens.total).toBe(5);
      expect(finish.usage.outputTokens.total).toBe(20);
    });

    it('should stream reasoning from Gemini 2.5 Pro', async () => {
      const model = new OCILanguageModel(MODELS.GEMINI_25_PRO, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createReasoningSSE(
          ['Analyzing the problem...', ' considering options...'],
          ['The best approach is X.'],
          { reasoningTokens: 50, completionTokens: 70 }
        ))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Complex problem' }] }],
        providerOptions: { oci: { reasoningEffort: 'medium' } },
      });

      const parts = await collectStreamParts(result.stream);
      
      const reasoningStart = parts.find((p) => p.type === 'reasoning-start');
      expect(reasoningStart).toBeDefined();
      
      const reasoningDeltas = parts.filter((p) => p.type === 'reasoning-delta');
      expect(reasoningDeltas.length).toBe(2);
      
      const reasoningEnd = parts.find((p) => p.type === 'reasoning-end');
      expect(reasoningEnd).toBeDefined();
    });
  });

  describe('Tool Calling', () => {
    it('should handle tool choice "required" with Gemini', async () => {
      const model = new OCILanguageModel(MODELS.GEMINI_25_FLASH, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'gemini_calc_1', name: 'calculate', arguments: { expression: 'sqrt(144)' } }
        ]))
      );

      await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'What is sqrt(144)?' }] }],
        tools: [calculatorTool],
        toolChoice: { type: 'required' },
      });

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.toolChoice).toEqual({ type: 'REQUIRED' });
    });

    it('should handle specific tool choice with Gemini', async () => {
      const model = new OCILanguageModel(MODELS.GEMINI_25_FLASH, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'weather_forced', name: 'get_weather', arguments: { location: 'Paris' } }
        ]))
      );

      await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Tell me something' }] }],
        tools: [weatherTool, calculatorTool],
        toolChoice: { type: 'tool', toolName: 'get_weather' },
      });

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.toolChoice).toEqual({ 
        type: 'FUNCTION', 
        function: { name: 'get_weather' } 
      });
    });
  });

  describe('Vision with Tools', () => {
    it('should handle image + tool calling in single request', async () => {
      const model = new OCILanguageModel(MODELS.GEMINI_25_FLASH, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'search_img', name: 'search_database', arguments: { query: 'product XYZ' } }
        ]))
      );

      await model.doStream({
        prompt: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Find similar products to this' },
            { type: 'file', data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' },
          ],
        }],
        tools: [searchTool],
      });

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.tools).toBeDefined();
      expect(chatRequest.messages[0].content.length).toBe(2);
    });
  });
});

describe('Multi-Turn Scenarios: Cohere Command A Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Streaming', () => {
    it('should stream text from Cohere Command A', async () => {
      const model = new OCILanguageModel(MODELS.COHERE_COMMAND_A, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE([
          'Cohere ', 'Command A ', 'at your service!'
        ]))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const parts = await collectStreamParts(result.stream);
      
      // Verify COHERE apiFormat is used
      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.apiFormat).toBe('COHERE');
      
      const text = parts.filter((p) => p.type === 'text-delta').map((p) => p.delta).join('');
      expect(text).toContain('Cohere');
    });

    it('should stream reasoning from Cohere Command A Reasoning', async () => {
      const model = new OCILanguageModel(MODELS.COHERE_COMMAND_A_REASONING, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createReasoningSSE(
          ['First I will analyze...', ' then consider...'],
          ['My conclusion is Y.'],
          { reasoningTokens: 40, completionTokens: 60 }
        ))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Reason about this' }] }],
        providerOptions: { oci: { thinking: true, tokenBudget: 1500 } },
      });

      const parts = await collectStreamParts(result.stream);
      
      const reasoning = parts.filter((p) => p.type === 'reasoning-delta');
      expect(reasoning.length).toBe(2);
      
      const finish = parts.find((p) => p.type === 'finish');
      expect(finish.usage.outputTokens.reasoning).toBe(40);

      // Verify thinking config was set
      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.thinking).toEqual({ type: 'ENABLED', tokenBudget: 1500 });
    });
  });

  describe('Tool Calling', () => {
    it('should handle Cohere tool format correctly', async () => {
      const model = new OCILanguageModel(MODELS.COHERE_COMMAND_R_PLUS, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'cohere_tool_1', name: 'get_weather', arguments: { location: 'Sydney' } }
        ]))
      );

      await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Weather in Sydney?' }] }],
        tools: [weatherTool],
      });

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      
      // Cohere uses different tool format
      expect(chatRequest.apiFormat).toBe('COHERE');
      expect(chatRequest.tools[0]).toMatchObject({
        name: 'get_weather',
        description: 'Get the current weather for a location',
      });
    });

    it('should handle multi-step agentic workflow with Command A', async () => {
      const model = new OCILanguageModel(MODELS.COHERE_COMMAND_A, mockConfig);
      
      // Step 1: Search
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'step1', name: 'search_database', arguments: { query: 'revenue 2024' } }
        ]))
      );

      // Step 2: Calculate
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: 'step2', name: 'calculate', arguments: { expression: '1000000 * 1.15' } }
        ]))
      );

      // Step 3: Final answer
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE([
          'Based on my analysis, ',
          'projected revenue for 2025 is $1,150,000.'
        ]))
      );

      // Execute step 1
      const step1 = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Project 2025 revenue based on 2024 data' }] }],
        tools: [searchTool, calculatorTool],
      });
      const parts1 = await collectStreamParts(step1.stream);
      expect(parts1.find((p) => p.type === 'tool-call')?.toolName).toBe('search_database');

      // Execute step 2
      const step2 = await model.doStream({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Project 2025 revenue based on 2024 data' }] },
          { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'step1', toolName: 'search_database', input: { query: 'revenue 2024' } }] },
          { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'step1', toolName: 'search_database', output: { type: 'text', value: '{"revenue_2024": 1000000}' } }] },
        ],
        tools: [searchTool, calculatorTool],
      });
      const parts2 = await collectStreamParts(step2.stream);
      expect(parts2.find((p) => p.type === 'tool-call')?.toolName).toBe('calculate');

      // Execute step 3
      const step3 = await model.doStream({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Project 2025 revenue based on 2024 data' }] },
          { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'step1', toolName: 'search_database', input: { query: 'revenue 2024' } }] },
          { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'step1', toolName: 'search_database', output: { type: 'text', value: '{"revenue_2024": 1000000}' } }] },
          { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'step2', toolName: 'calculate', input: { expression: '1000000 * 1.15' } }] },
          { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'step2', toolName: 'calculate', output: { type: 'text', value: '1150000' } }] },
        ],
        tools: [searchTool, calculatorTool],
      });
      const parts3 = await collectStreamParts(step3.stream);
      const finalText = parts3.filter((p) => p.type === 'text-delta').map((p) => p.delta).join('');
      expect(finalText).toContain('1,150,000');
    });
  });

  describe('Context Management', () => {
    it('should handle system message with Cohere', async () => {
      const model = new OCILanguageModel(MODELS.COHERE_COMMAND_A, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE(['Certainly, user!']))
      );

      await model.doStream({
        prompt: [
          { role: 'system', content: 'You are a helpful assistant. Always be polite.' },
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ],
      });

      // System message should be converted appropriately for Cohere
      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest).toBeDefined();
    });
  });
});

describe('Cross-Model Consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should produce consistent stream part types across all models', async () => {
    const models = [
      MODELS.GROK_4_FAST,
      MODELS.LLAMA_33_70B,
      MODELS.GEMINI_25_FLASH,
      MODELS.COHERE_COMMAND_A,
    ];

    for (const modelId of models) {
      const model = new OCILanguageModel(modelId, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createTextSSE(['Hello']))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      });

      const parts = await collectStreamParts(result.stream);
      
      // All models should have these part types
      expect(parts.some((p) => p.type === 'stream-start')).toBe(true);
      expect(parts.some((p) => p.type === 'text-start')).toBe(true);
      expect(parts.some((p) => p.type === 'text-delta')).toBe(true);
      expect(parts.some((p) => p.type === 'text-end')).toBe(true);
      expect(parts.some((p) => p.type === 'finish')).toBe(true);
    }
  });

  it('should handle tool calling consistently across tool-capable models', async () => {
    const toolCapableModels = [
      MODELS.GROK_4_FAST,
      MODELS.LLAMA_33_70B,
      MODELS.GEMINI_25_FLASH,
      MODELS.COHERE_COMMAND_R_PLUS,
    ];

    for (const modelId of toolCapableModels) {
      const model = new OCILanguageModel(modelId, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createToolCallSSE([
          { id: `${modelId}_call`, name: 'calculate', arguments: { expression: '1+1' } }
        ]))
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Calculate 1+1' }] }],
        tools: [calculatorTool],
      });

      const parts = await collectStreamParts(result.stream);
      
      const toolCall = parts.find((p) => p.type === 'tool-call');
      expect(toolCall).toBeDefined();
      expect(toolCall.toolName).toBe('calculate');
      
      const finish = parts.find((p) => p.type === 'finish');
      expect(finish.finishReason.unified).toBe('tool-calls');
    }
  });

  it('should report reasoning tokens consistently across reasoning models', async () => {
    const reasoningModels = [
      MODELS.GROK_4_REASONING,
      MODELS.GEMINI_25_PRO,
      MODELS.COHERE_COMMAND_A_REASONING,
    ];

    for (const modelId of reasoningModels) {
      const model = new OCILanguageModel(modelId, mockConfig);
      
      mockChat.mockResolvedValueOnce(
        createMockStreamResponse(createReasoningSSE(
          ['Thinking...'],
          ['Answer'],
          { reasoningTokens: 25, completionTokens: 35 }
        ))
      );

      const providerOptions = modelId.includes('cohere')
        ? { oci: { thinking: true } }
        : { oci: { reasoningEffort: 'medium' as const } };

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Think' }] }],
        providerOptions,
      });

      const parts = await collectStreamParts(result.stream);
      
      const finish = parts.find((p) => p.type === 'finish');
      expect(finish.usage.outputTokens.reasoning).toBe(25);
      expect(finish.usage.outputTokens.total).toBe(35);
    }
  });
});

describe('Error Handling & Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle empty response stream gracefully', async () => {
    const model = new OCILanguageModel(MODELS.LLAMA_33_70B, mockConfig);
    
    // Empty stream with just finish
    mockChat.mockResolvedValueOnce(
      createMockStreamResponse(`event: message\ndata: ${JSON.stringify({
        finishReason: 'STOP',
        usage: { promptTokens: 5, completionTokens: 0 },
      })}\n\n`)
    );

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Generate nothing' }] }],
    });

    const parts = await collectStreamParts(result.stream);
    
    const textDeltas = parts.filter((p) => p.type === 'text-delta');
    expect(textDeltas.length).toBe(0);
    
    const finish = parts.find((p) => p.type === 'finish');
    expect(finish).toBeDefined();
    expect(finish.usage.outputTokens.total).toBe(0);
  });

  it('should handle max tokens limit', async () => {
    const model = new OCILanguageModel(MODELS.GEMINI_25_FLASH, mockConfig);
    
    mockChat.mockResolvedValueOnce(
      createMockStreamResponse(createTextSSE(
        ['This response is cut'],
        { finishReason: 'LENGTH', completionTokens: 100 }
      ))
    );

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Long response please' }] }],
      maxOutputTokens: 100,
    });

    const parts = await collectStreamParts(result.stream);
    
    const finish = parts.find((p) => p.type === 'finish');
    expect(finish.finishReason.unified).toBe('length');
    expect(finish.finishReason.raw).toBe('LENGTH');
  });

  it('should handle stop sequences', async () => {
    const model = new OCILanguageModel(MODELS.GROK_4_FAST, mockConfig);
    
    mockChat.mockResolvedValueOnce(
      createMockStreamResponse(createTextSSE(
        ['Hello world'],
        { finishReason: 'STOP' }
      ))
    );

    await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello' }] }],
      stopSequences: ['world', 'earth'],
    });

    const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
    expect(chatRequest.stop).toEqual(['world', 'earth']);
  });

  it('should warn when using tools with non-tool-supporting model', async () => {
    // Grok 3 Mini doesn't support tools
    const model = new OCILanguageModel('xai.grok-3-mini', mockConfig);
    
    mockChat.mockResolvedValueOnce(
      createMockStreamResponse(createTextSSE(['I cannot use tools']))
    );

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use a tool' }] }],
      tools: [calculatorTool],
    });

    const parts = await collectStreamParts(result.stream);
    
    const streamStart = parts.find((p) => p.type === 'stream-start');
    expect(streamStart.warnings).toContainEqual(
      expect.objectContaining({
        type: 'unsupported',
        feature: 'tools',
      })
    );
  });

  it('should warn when using reasoning with non-reasoning model', async () => {
    const model = new OCILanguageModel(MODELS.LLAMA_33_70B, mockConfig);
    
    mockChat.mockResolvedValueOnce(
      createMockStreamResponse(createTextSSE(['Normal response']))
    );

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Think hard' }] }],
      providerOptions: { oci: { reasoningEffort: 'high' } },
    });

    const parts = await collectStreamParts(result.stream);
    
    const streamStart = parts.find((p) => p.type === 'stream-start');
    expect(streamStart.warnings).toContainEqual(
      expect.objectContaining({
        type: 'unsupported',
        feature: 'reasoningEffort',
      })
    );
  });

  it('should handle seed parameter for reproducibility', async () => {
    const model = new OCILanguageModel(MODELS.COHERE_COMMAND_A, mockConfig);
    
    mockChat.mockResolvedValueOnce(
      createMockStreamResponse(createTextSSE(['Reproducible output']))
    );

    await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Generate' }] }],
      seed: 42,
    });

    const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
    expect(chatRequest.seed).toBe(42);
  });

  it('should include raw chunks when requested', async () => {
    const model = new OCILanguageModel(MODELS.GROK_CODE, mockConfig);
    
    mockChat.mockResolvedValueOnce(
      createMockStreamResponse(createTextSSE(['Code here']))
    );

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Write code' }] }],
      includeRawChunks: true,
    });

    const parts = await collectStreamParts(result.stream);
    
    const rawParts = parts.filter((p) => p.type === 'raw');
    expect(rawParts.length).toBeGreaterThan(0);
  });
});
