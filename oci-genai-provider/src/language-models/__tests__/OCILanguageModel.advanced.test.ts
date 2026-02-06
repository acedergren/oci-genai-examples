import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { OCILanguageModel } from '../OCILanguageModel';
import type { AuthenticationDetailsProvider } from 'oci-common';
import type { OCIConfig } from '../../types';
import { createReadableStream } from '../../__tests__/utils/test-helpers';

// Mock functions
const mockAuthProvider: AuthenticationDetailsProvider = {
  getKeyId: jest.fn(() => Promise.resolve('mock-key-id')),
  getPrivateKey: jest.fn(() => '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----'),
  getPassphrase: jest.fn(() => null),
};

const mockCreateAuthProvider = jest.fn<
  (config: OCIConfig) => Promise<AuthenticationDetailsProvider>
>(() => Promise.resolve(mockAuthProvider));
const mockGetRegion = jest.fn<(config: OCIConfig) => string>(() => 'us-phoenix-1');
const mockGetCompartmentId = jest.fn<(config: OCIConfig) => string>(
  (config) => config.compartmentId ?? 'ocid1.compartment.oc1..test'
);

// Mock auth module
jest.mock('../../auth/index.js', () => ({
  createAuthProvider: (config: OCIConfig) => mockCreateAuthProvider(config),
  getRegion: (config: OCIConfig) => mockGetRegion(config),
  getCompartmentId: (config: OCIConfig) => mockGetCompartmentId(config),
}));

// Mock oci-common Region
jest.mock('oci-common', () => ({
  Region: {
    fromRegionId: jest.fn((regionId: string) => ({ regionId })),
  },
}));

// Mock OCI SDK
const mockChat = jest.fn<any>();
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    region: undefined,
    endpoint: undefined,
  })),
}));

describe('OCILanguageModel - Advanced V3 Features', () => {
  const mockConfig: OCIConfig = {
    region: 'us-phoenix-1',
    compartmentId: 'ocid1.compartment.oc1..test',
  };

  const createMockResponse = (
    options: {
      text?: string;
      reasoning?: string;
      usage?: { promptTokens: number; completionTokens: number; reasoningTokens?: number };
    } = {}
  ) => ({
    body: createReadableStream([
      `data: ${JSON.stringify({
        message: {
          content: options.text ? [{ type: 'TEXT', text: options.text }] : [],
          reasoningContent: options.reasoning,
        },
      })}\n\n`,
      `data: ${JSON.stringify({
        finishReason: 'STOP',
        usage: {
          promptTokens: options.usage?.promptTokens ?? 10,
          completionTokens: options.usage?.completionTokens ?? 5,
          completionTokensDetails: options.usage?.reasoningTokens
            ? { reasoningTokens: options.usage.reasoningTokens }
            : undefined,
        },
      })}\n\n`,
    ]),
    headers: {
      entries: () => new Map<string, string>().entries(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Vision (Multimodal)', () => {
    it('should convert file parts (images) to OCI format for Generic models', async () => {
      const model = new OCILanguageModel('google.gemini-2.5-flash', mockConfig);

      mockChat.mockImplementation(async () => createMockResponse({ text: 'I see a cat' }));

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              {
                type: 'file',
                data: new Uint8Array([1, 2, 3]),
                mediaType: 'image/png',
              },
            ],
          },
        ],
      });

      // Verify request structure
      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.messages[0].content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'TEXT', text: 'What is in this image?' }),
          expect.objectContaining({
            type: 'IMAGE',
            imageUrl: expect.objectContaining({
              url: expect.stringContaining('data:image/png;base64,'),
            }),
          }),
        ])
      );
    });

    it('should convert file parts (images) to OCI format for Cohere V2 models', async () => {
      const model = new OCILanguageModel('cohere.command-a-vision-07-2025', mockConfig);

      mockChat.mockImplementation(async () => createMockResponse({ text: 'I see a dog' }));

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'file', data: new Uint8Array([4, 5, 6]), mediaType: 'image/jpeg' }],
          },
        ],
      });

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.apiFormat).toBe('COHEREV2');
      expect(chatRequest.messages[0].content).toContainEqual(
        expect.objectContaining({
          type: 'IMAGE_URL',
          imageUrl: expect.objectContaining({
            url: expect.stringContaining('data:image/jpeg;base64,'),
          }),
        })
      );
    });
  });

  describe('Reasoning', () => {
    it('should support reasoning settings for Generic models', async () => {
      const model = new OCILanguageModel('google.gemini-2.5-pro', mockConfig);

      mockChat.mockImplementation(async () =>
        createMockResponse({
          text: 'Final answer',
          reasoning: 'Thinking process...',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            reasoningTokens: 15,
          },
        })
      );

      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
        providerOptions: {
          oci: { reasoningEffort: 'high' as const },
        },
      };

      const result = await model.doGenerate(options);

      expect(result.content).toContainEqual({ type: 'reasoning', text: 'Thinking process...' });
      expect(result.usage.outputTokens.reasoning).toBe(15);

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.reasoningEffort).toBe('HIGH');
    });

    it('should support reasoning settings for Cohere models', async () => {
      const model = new OCILanguageModel('cohere.command-a-reasoning-08-2025', mockConfig);

      mockChat.mockImplementation(async () => ({
        body: createReadableStream([
          `data: ${JSON.stringify({
            message: {
              content: [{ type: 'THINKING', thinking: 'I am reasoning...' }],
            },
          })}\n\n`,
          `data: ${JSON.stringify({
            message: {
              content: [{ type: 'TEXT', text: 'Result' }],
            },
          })}\n\n`,
          `data: ${JSON.stringify({
            finishReason: 'COMPLETE',
            usage: {
              promptTokens: 5,
              completionTokens: 30,
              completionTokensDetails: { reasoningTokens: 25 },
            },
          })}\n\n`,
        ]),
        headers: {
          entries: () => new Map<string, string>().entries(),
        },
      }));

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Think hard' }] }],
        providerOptions: { oci: { thinking: true, tokenBudget: 2000 } },
      });

      expect(result.content).toContainEqual({ type: 'reasoning', text: 'I am reasoning...' });
      expect(result.content).toContainEqual({ type: 'text', text: 'Result' });

      const chatRequest = (mockChat.mock.calls[0][0] as any).chatDetails.chatRequest;
      expect(chatRequest.thinking).toEqual({ type: 'ENABLED', tokenBudget: 2000 });

      expect(result.content).toContainEqual(
        expect.objectContaining({ type: 'reasoning', text: 'I am reasoning...' })
      );
    });

    it('should stream reasoning deltas', async () => {
      const model = new OCILanguageModel('cohere.command-a-reasoning-08-2025', mockConfig);

      const encoder = new TextEncoder();
      const sseData = `event: message
data: {"message":{"content":[{"type":"THINKING","thinking":"Thinking"}]}}

event: message
data: {"message":{"content":[{"type":"THINKING","thinking":" step"}]}}

event: message
data: {"message":{"content":[{"type":"TEXT","text":"Result"}]}}

event: message
data: {"finishReason":"COMPLETE","usage":{"completionTokensDetails":{"reasoningTokens":10}}}
`;

      mockChat.mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(sseData));
              controller.close();
            },
          })
        ) as any
      );

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Stream thinking' }] }],
      });

      const reader = result.stream.getReader();
      const parts: any[] = [];
      let done = false;
      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) parts.push(value);
      }

      const reasoningDeltas = parts.filter((p) => p.type === 'reasoning-delta');
      expect(reasoningDeltas).toHaveLength(2);
      expect(reasoningDeltas[0].delta).toBe('Thinking');
      expect(reasoningDeltas[1].delta).toBe(' step');
    });
  });
});
