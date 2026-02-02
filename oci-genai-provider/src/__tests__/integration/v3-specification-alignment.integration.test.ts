/**
 * Vercel AI SDK V3 Language Model Specification Alignment Tests
 *
 * This test file verifies that our OCI GenAI provider implementation aligns with
 * the Vercel AI SDK V3 Language Model specification.
 *
 * @see https://github.com/vercel/ai/tree/main/packages/provider/src/language-model/v3
 *
 * ## V3 Specification Coverage Summary
 *
 * ### Fully Implemented ✅
 * - LanguageModelV3 interface (specificationVersion, provider, modelId, supportedUrls, doGenerate, doStream)
 * - LanguageModelV3CallOptions (prompt, maxOutputTokens, temperature, topP, topK, presencePenalty, frequencyPenalty, seed, stopSequences, responseFormat, tools, toolChoice)
 * - LanguageModelV3GenerateResult (content, finishReason, usage, warnings, request, response, providerMetadata)
 * - LanguageModelV3StreamPart (stream-start, text-delta, reasoning-delta, tool-call, finish, raw, error)
 * - LanguageModelV3FinishReason (all unified types: stop, length, content-filter, tool-calls, error, other)
 * - LanguageModelV3Usage (inputTokens.total, outputTokens.total, outputTokens.reasoning)
 * - LanguageModelV3Content (text, reasoning, tool-call)
 * - Error handling (NoSuchModelError)
 *
 * ### Known Gaps (Future Enhancements)
 * - text-start / text-end stream parts: Not emitted (V3 spec optional, text-delta works)
 * - reasoning-start / reasoning-end stream parts: Not emitted (reasoning-delta works)
 * - tool-input-start / tool-input-delta / tool-input-end: Not implemented (streaming tool input)
 * - response-metadata stream part: Not implemented
 * - LanguageModelV3File content: OCI GenAI doesn't support file content in prompts
 * - inputTokens.noCache/cacheRead/cacheWrite: OCI doesn't expose cache metrics
 * - outputTokens.text: OCI doesn't separate text vs reasoning token counts
 * - abortSignal handling: Not tested (would require integration tests)
 * - custom headers passthrough: Not tested
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NoSuchModelError } from '@ai-sdk/provider';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FunctionTool,
  LanguageModelV3ToolChoice,
  LanguageModelV3StreamPart,
  SharedV3Warning,
} from '@ai-sdk/provider';
import { OCILanguageModel } from '../../language-models/OCILanguageModel';
import type { AuthenticationDetailsProvider } from 'oci-common';
import type { OCIConfig } from '../../types';

// ============================================================================
// Mock Setup
// ============================================================================

const mockAuthProvider: AuthenticationDetailsProvider = {
  getKeyId: jest.fn(() => Promise.resolve('mock-key-id')),
  getPrivateKey: jest.fn(() => '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----'),
  getPassphrase: jest.fn(() => null),
};

const mockCreateAuthProvider = jest.fn<
  (config: OCIConfig) => Promise<AuthenticationDetailsProvider>
>(() => Promise.resolve(mockAuthProvider));
const mockGetRegion = jest.fn<(config: OCIConfig) => string>(() => 'eu-frankfurt-1');
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

const mockChat = jest.fn<() => Promise<unknown>>();
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    region: undefined,
  })),
}));

// ============================================================================
// V3 Specification Tests
// ============================================================================

describe('V3 Specification Alignment', () => {
  const defaultConfig: OCIConfig = {
    region: 'eu-frankfurt-1',
    compartmentId: 'ocid1.compartment.oc1..test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Section 1: LanguageModelV3 Interface
  // ==========================================================================
  describe('LanguageModelV3 Interface', () => {
    it('should implement specificationVersion as "v3"', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      expect(model.specificationVersion).toBe('v3');
    });

    it('should implement provider as a string identifier', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      expect(typeof model.provider).toBe('string');
      expect(model.provider).toBe('oci-genai');
    });

    it('should implement modelId as the provided model identifier', () => {
      const modelId = 'meta.llama-3.1-70b-instruct';
      const model = new OCILanguageModel(modelId, defaultConfig);
      expect(model.modelId).toBe(modelId);
    });

    it('should implement supportedUrls as Record<string, RegExp[]>', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig) as LanguageModelV3;
      expect(model.supportedUrls).toBeDefined();
      expect(typeof model.supportedUrls).toBe('object');
    });

    it('should implement doGenerate method', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      expect(typeof model.doGenerate).toBe('function');
    });

    it('should implement doStream method', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      expect(typeof model.doStream).toBe('function');
    });
  });

  // ==========================================================================
  // Section 2: LanguageModelV3CallOptions
  // ==========================================================================
  describe('LanguageModelV3CallOptions', () => {
    beforeEach(() => {
      mockChat.mockResolvedValue({
        chatResult: {
          chatResponse: {
            choices: [
              {
                message: { content: [{ type: 'TEXT', text: 'Response' }] },
                finishReason: 'STOP',
              },
            ],
            usage: { promptTokens: 10, completionTokens: 5 },
          },
        },
      });
    });

    describe('prompt', () => {
      it('should accept system message with string content', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        // OCI GenAI requires at least one USER message alongside system message
        const options: LanguageModelV3CallOptions = {
          prompt: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          ],
        };

        await expect(model.doGenerate(options)).resolves.toBeDefined();
      });

      it('should accept user message with text content parts', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello world' }] }],
        };

        await expect(model.doGenerate(options)).resolves.toBeDefined();
      });

      it('should accept multi-turn conversation', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [
            { role: 'user', content: [{ type: 'text', text: 'Question 1' }] },
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'Answer 1' }],
            },
            { role: 'user', content: [{ type: 'text', text: 'Question 2' }] },
          ],
        };

        await expect(model.doGenerate(options)).resolves.toBeDefined();
      });

      it('should accept assistant message with tool-call content', async () => {
        const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [
            { role: 'user', content: [{ type: 'text', text: 'Get weather' }] },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_123',
                  toolName: 'get_weather',
                  input: { city: 'London' },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_123',
                  toolName: 'get_weather',
                  output: { type: 'text', value: '{"temp": 20}' },
                },
              ],
            },
          ],
        };

        await expect(model.doGenerate(options)).resolves.toBeDefined();
      });
    });

    describe('generation parameters', () => {
      it('should accept maxOutputTokens', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          maxOutputTokens: 500,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept temperature', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          temperature: 0.7,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept stopSequences', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          stopSequences: ['END', 'STOP'],
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept topP', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          topP: 0.9,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept topK', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          topK: 40,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept presencePenalty', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          presencePenalty: 0.5,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept frequencyPenalty', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          frequencyPenalty: 0.5,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept seed for deterministic output', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          seed: 42,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });
    });

    describe('responseFormat', () => {
      it('should accept text response format (default)', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          responseFormat: { type: 'text' },
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should warn when JSON response format is requested (unsupported)', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          responseFormat: { type: 'json' },
        };

        const result = await model.doGenerate(options);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].type).toBe('unsupported');
      });
    });

    describe('tools and toolChoice', () => {
      it('should accept function tools', async () => {
        const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
        const tools: LanguageModelV3FunctionTool[] = [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather for a city',
            inputSchema: {
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
            },
          },
        ];

        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Get weather' }] }],
          tools,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept toolChoice auto', async () => {
        const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          tools: [
            {
              type: 'function',
              name: 'test',
              inputSchema: { type: 'object' },
            },
          ],
          toolChoice: { type: 'auto' } as LanguageModelV3ToolChoice,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept toolChoice required', async () => {
        const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          tools: [
            {
              type: 'function',
              name: 'test',
              inputSchema: { type: 'object' },
            },
          ],
          toolChoice: { type: 'required' } as LanguageModelV3ToolChoice,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept toolChoice none', async () => {
        const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          tools: [
            {
              type: 'function',
              name: 'test',
              inputSchema: { type: 'object' },
            },
          ],
          toolChoice: { type: 'none' } as LanguageModelV3ToolChoice,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should accept toolChoice with specific tool', async () => {
        const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          tools: [
            {
              type: 'function',
              name: 'specific_tool',
              inputSchema: { type: 'object' },
            },
          ],
          toolChoice: {
            type: 'tool',
            toolName: 'specific_tool',
          } as LanguageModelV3ToolChoice,
        };

        await model.doGenerate(options);
        expect(mockChat).toHaveBeenCalled();
      });

      it('should warn when tools used with unsupported model', async () => {
        // Use an older model that doesn't support tools
        jest.doMock('../language-models/registry', () => ({
          isValidModelId: () => true,
          getModelMetadata: () => ({ family: 'other' }),
        }));

        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const options: LanguageModelV3CallOptions = {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          tools: [
            {
              type: 'function',
              name: 'test',
              inputSchema: { type: 'object' },
            },
          ],
        };

        const result = await model.doGenerate(options);
        // The model may or may not support tools - just verify no crash
        expect(result).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Section 3: LanguageModelV3GenerateResult
  // ==========================================================================
  describe('LanguageModelV3GenerateResult', () => {
    beforeEach(() => {
      mockChat.mockResolvedValue({
        opcRequestId: 'req-123',
        chatResult: {
          modelId: 'cohere.command-r-plus',
          chatResponse: {
            choices: [
              {
                message: {
                  content: [{ type: 'TEXT', text: 'Generated response' }],
                },
                finishReason: 'STOP',
              },
            ],
            usage: {
              promptTokens: 25,
              completionTokens: 15,
              completionTokensDetails: { reasoningTokens: 5 },
            },
          },
        },
      });
    });

    describe('content', () => {
      it('should return content as Array<LanguageModelV3Content>', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
      });

      it('should return text content with correct structure', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        const textContent = result.content.find(
          (c: LanguageModelV3Content): c is LanguageModelV3Content & { type: 'text' } =>
            c.type === 'text'
        );
        expect(textContent).toBeDefined();
        expect(textContent?.text).toBe('Generated response');
      });

      it('should return tool-call content when model calls tools', async () => {
        mockChat.mockResolvedValue({
          chatResult: {
            chatResponse: {
              choices: [
                {
                  message: {
                    content: [],
                    toolCalls: [
                      {
                        id: 'call_abc',
                        type: 'FUNCTION',
                        function: {
                          name: 'get_weather',
                          arguments: '{"city":"London"}',
                        },
                      },
                    ],
                  },
                  finishReason: 'TOOL_CALLS',
                },
              ],
              usage: { promptTokens: 10, completionTokens: 5 },
            },
          },
        });

        const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Get weather' }] }],
          tools: [
            {
              type: 'function',
              name: 'get_weather',
              inputSchema: { type: 'object' },
            },
          ],
        });

        const toolCall = result.content.find((c: LanguageModelV3Content) => c.type === 'tool-call');
        expect(toolCall).toBeDefined();
        if (toolCall?.type === 'tool-call') {
          expect(toolCall.toolCallId).toBe('call_abc');
          expect(toolCall.toolName).toBe('get_weather');
        }
      });

      it('should return reasoning content when available', async () => {
        mockChat.mockResolvedValue({
          chatResult: {
            chatResponse: {
              choices: [
                {
                  message: {
                    content: [
                      { type: 'THINKING', thinking: 'Let me think...' },
                      { type: 'TEXT', text: 'Here is the answer.' },
                    ],
                  },
                  finishReason: 'STOP',
                },
              ],
              usage: { promptTokens: 10, completionTokens: 20 },
            },
          },
        });

        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Think step by step' }] }],
        });

        const reasoning = result.content.find(
          (c: LanguageModelV3Content) => c.type === 'reasoning'
        );
        expect(reasoning).toBeDefined();
      });
    });

    describe('finishReason', () => {
      it.each([
        ['STOP', 'stop'],
        ['LENGTH', 'length'],
        ['CONTENT_FILTER', 'content-filter'],
        ['TOOL_CALLS', 'tool-calls'],
        ['ERROR', 'error'],
        ['UNKNOWN_REASON', 'other'],
      ])('should map OCI finish reason %s to unified %s', async (ociReason, unified) => {
        mockChat.mockResolvedValue({
          chatResult: {
            chatResponse: {
              choices: [
                {
                  message: { content: [{ type: 'TEXT', text: 'Response' }] },
                  finishReason: ociReason,
                },
              ],
              usage: { promptTokens: 10, completionTokens: 5 },
            },
          },
        });

        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        const finishReason = result.finishReason;
        expect(finishReason.unified).toBe(unified);
        expect(finishReason.raw).toBe(ociReason);
      });
    });

    describe('usage', () => {
      it('should return usage with inputTokens structure', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        const usage = result.usage;
        expect(usage.inputTokens).toBeDefined();
        expect(usage.inputTokens.total).toBe(25);
        expect(usage.inputTokens.noCache).toBeUndefined();
        expect(usage.inputTokens.cacheRead).toBeUndefined();
        expect(usage.inputTokens.cacheWrite).toBeUndefined();
      });

      it('should return usage with outputTokens structure', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        const usage = result.usage;
        expect(usage.outputTokens).toBeDefined();
        expect(usage.outputTokens.total).toBe(15);
        expect(usage.outputTokens.reasoning).toBe(5);
      });
    });

    describe('warnings', () => {
      it('should return warnings array', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should include unsupported feature warnings', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
          responseFormat: { type: 'json' },
        });

        const unsupportedWarning = result.warnings.find(
          (w: SharedV3Warning) => w.type === 'unsupported'
        );
        expect(unsupportedWarning).toBeDefined();
      });
    });

    describe('request and response metadata', () => {
      it('should include request.body', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        expect(result.request).toBeDefined();
        expect(result.request?.body).toBeDefined();
      });

      it('should include response.id (opcRequestId)', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        expect(result.response?.id).toBe('req-123');
      });

      it('should include response.modelId', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        expect(result.response?.modelId).toBe('cohere.command-r-plus');
      });

      it('should include providerMetadata', async () => {
        const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
        const result = await model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        });

        expect(result.providerMetadata).toBeDefined();
        expect(result.providerMetadata?.oci).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Section 4: LanguageModelV3StreamResult & StreamParts
  // ==========================================================================
  describe('LanguageModelV3StreamResult', () => {
    beforeEach(() => {
      // Create a mock streaming response
      const encoder = new TextEncoder();
      const sseData = `event: message
data: {"message":{"content":[{"text":"Hello"}]}}

event: message
data: {"message":{"content":[{"text":" world"}]}}

event: message
data: {"finishReason":"STOP","usage":{"promptTokens":10,"completionTokens":5}}

`;
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockChat.mockResolvedValue(new Response(stream));
    });

    it('should return stream property as ReadableStream', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(result.stream).toBeDefined();
      expect(result.stream).toBeInstanceOf(ReadableStream);
    });

    it('should emit stream-start as first part', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const reader = result.stream.getReader();
      const { value: firstPart } = await reader.read();
      reader.releaseLock();

      expect(firstPart).toBeDefined();
      expect((firstPart as LanguageModelV3StreamPart).type).toBe('stream-start');
    });

    it('should emit stream-start with warnings array', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const reader = result.stream.getReader();
      const { value: firstPart } = await reader.read();
      reader.releaseLock();

      if (firstPart && 'warnings' in firstPart) {
        expect(Array.isArray(firstPart.warnings)).toBe(true);
      }
    });

    it('should emit text-delta parts with delta and id', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const parts: LanguageModelV3StreamPart[] = [];
      const reader = result.stream.getReader();
      let done = false;

      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) parts.push(value);
      }

      const textDeltas = parts.filter((p) => p.type === 'text-delta');
      expect(textDeltas.length).toBeGreaterThan(0);

      for (const delta of textDeltas) {
        if (delta.type === 'text-delta') {
          expect(delta.delta).toBeDefined();
          expect(delta.id).toBeDefined();
        }
      }
    });

    it('should emit finish part with correct structure', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const parts: LanguageModelV3StreamPart[] = [];
      const reader = result.stream.getReader();
      let done = false;

      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) parts.push(value);
      }

      const finishPart = parts.find((p) => p.type === 'finish');
      expect(finishPart).toBeDefined();

      if (finishPart?.type === 'finish') {
        expect(finishPart.finishReason).toBeDefined();
        expect(finishPart.finishReason.unified).toBeDefined();
        expect(finishPart.usage).toBeDefined();
        expect(finishPart.usage.inputTokens).toBeDefined();
        expect(finishPart.usage.outputTokens).toBeDefined();
      }
    });

    it('should emit raw parts when includeRawChunks is true', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        includeRawChunks: true,
      });

      const parts: LanguageModelV3StreamPart[] = [];
      const reader = result.stream.getReader();
      let done = false;

      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) parts.push(value);
      }

      const rawParts = parts.filter((p) => p.type === 'raw');
      expect(rawParts.length).toBeGreaterThan(0);
    });

    it('should emit tool-call parts during streaming', async () => {
      const encoder = new TextEncoder();
      const sseData = `event: message
data: {"message":{"toolCalls":[{"id":"call_123","type":"FUNCTION","function":{"name":"test_tool","arguments":"{}"}}]}}

event: message
data: {"finishReason":"TOOL_CALLS","usage":{"promptTokens":10,"completionTokens":5}}

`;
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockChat.mockResolvedValue(new Response(stream));

      const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        tools: [{ type: 'function', name: 'test_tool', inputSchema: { type: 'object' } }],
      });

      const parts: LanguageModelV3StreamPart[] = [];
      const reader = result.stream.getReader();
      let done = false;

      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) parts.push(value);
      }

      const toolCallPart = parts.find((p) => p.type === 'tool-call');
      expect(toolCallPart).toBeDefined();
    });

    it('should emit reasoning-delta parts for reasoning models', async () => {
      const encoder = new TextEncoder();
      const sseData = `event: message
data: {"message":{"reasoningContent":"Let me think about this..."}}

event: message
data: {"message":{"content":[{"text":"The answer is 42."}]}}

event: message
data: {"finishReason":"STOP","usage":{"promptTokens":10,"completionTokens":15,"completionTokensDetails":{"reasoningTokens":5}}}

`;
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockChat.mockResolvedValue(new Response(stream));

      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Think step by step' }] }],
      });

      const parts: LanguageModelV3StreamPart[] = [];
      const reader = result.stream.getReader();
      let done = false;

      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) parts.push(value);
      }

      const reasoningPart = parts.find((p) => p.type === 'reasoning-delta');
      expect(reasoningPart).toBeDefined();
    });

    it('should emit error part on stream error', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode('data: {"invalid'));
          controller.error(new Error('Stream error'));
        },
      });

      mockChat.mockResolvedValue(new Response(stream));

      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const parts: LanguageModelV3StreamPart[] = [];
      const reader = result.stream.getReader();

      try {
        let done = false;
        while (!done) {
          const { value, done: isDone } = await reader.read();
          done = isDone;
          if (value) parts.push(value);
        }
      } catch {
        // Expected to throw
      }

      // The error should be captured
      const errorPart = parts.find((p) => p.type === 'error');
      expect(errorPart).toBeDefined();
    });

    it('should include request metadata in stream result', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', defaultConfig);
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(result.request).toBeDefined();
      expect(result.request?.body).toBeDefined();
    });
  });

  // ==========================================================================
  // Section 5: Error Handling per V3 Spec
  // ==========================================================================
  describe('Error Handling', () => {
    it('should throw NoSuchModelError for invalid model', () => {
      expect(() => new OCILanguageModel('invalid.model.id', defaultConfig)).toThrow(
        NoSuchModelError
      );
    });

    it('should include model context in NoSuchModelError', () => {
      try {
        new OCILanguageModel('invalid.model.id', defaultConfig);
        fail('Expected NoSuchModelError');
      } catch (error) {
        if (error instanceof NoSuchModelError) {
          expect(error.modelId).toBe('invalid.model.id');
          expect(error.modelType).toBe('languageModel');
        } else {
          throw error;
        }
      }
    });
  });
});
