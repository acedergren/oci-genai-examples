import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { APICallError } from '@ai-sdk/provider';
import { OCILanguageModel } from '../OCILanguageModel';
import type { AuthenticationDetailsProvider } from 'oci-common';
import type { OCIConfig } from '../../types';
import { createMockStreamChunks, createReadableStream } from '../../__tests__/utils/test-helpers';

// Mock functions
const mockAuthProviderGetKeyId = jest.fn(() =>
  Promise.resolve('ocid1.tenancy.oc1..test/ocid1.user.oc1..test/fingerprint')
);
const mockAuthProviderGetPrivateKey = jest.fn(
  () => '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----'
);
const mockAuthProviderGetPassphrase = jest.fn(() => null);

const mockCreateAuthProvider =
  jest.fn<(config: OCIConfig) => Promise<AuthenticationDetailsProvider>>();
const mockGetRegion = jest.fn<(config: OCIConfig) => string>();
const mockChat = jest.fn<() => Promise<unknown>>();
const mockGenerativeAiInferenceClientConstructor = jest.fn();
const mockFromRegionId = jest.fn<(regionId: string) => unknown>();
const mockGetCompartmentId = jest.fn<(config: OCIConfig) => string>();

// Mock auth module
jest.mock('../../auth/index.js', () => ({
  createAuthProvider: (config: OCIConfig): ReturnType<typeof mockCreateAuthProvider> =>
    mockCreateAuthProvider(config),
  getRegion: (config: OCIConfig): ReturnType<typeof mockGetRegion> => mockGetRegion(config),
  getCompartmentId: (config: OCIConfig): ReturnType<typeof mockGetCompartmentId> =>
    mockGetCompartmentId(config),
}));

// Mock OCI SDK
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation((config: unknown) => {
    mockGenerativeAiInferenceClientConstructor(config);
    return {
      chat: mockChat,
      region: undefined,
    };
  }),
}));

// Mock oci-common Region
jest.mock('oci-common', () => ({
  Region: {
    fromRegionId: (regionId: string): ReturnType<typeof mockFromRegionId> =>
      mockFromRegionId(regionId),
  },
}));

describe('OCILanguageModel Retry and Timeout Integration', () => {
  const mockConfig: OCIConfig = {
    region: 'eu-frankfurt-1',
    compartmentId: 'ocid1.compartment.oc1..test',
  };

  const mockAuthProvider: AuthenticationDetailsProvider = {
    getKeyId: mockAuthProviderGetKeyId,
    getPrivateKey: mockAuthProviderGetPrivateKey,
    getPassphrase: mockAuthProviderGetPassphrase,
  };

  const createMockSuccessResponse = (text = 'Success response') => ({
    body: createReadableStream([
      ...createMockStreamChunks([text]),
      `data: ${JSON.stringify({
        finishReason: 'STOP',
        usage: { promptTokens: 10, completionTokens: 5 },
      })}\n\n`,
    ]),
    headers: {
      entries: () => new Map<string, string>().entries(),
    },
  });

  const callOptions = {
    prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    mockCreateAuthProvider.mockResolvedValue(mockAuthProvider);
    mockGetRegion.mockReturnValue('eu-frankfurt-1');
    mockGetCompartmentId.mockReturnValue('ocid1.compartment.oc1..test');
    mockFromRegionId.mockReturnValue({ regionId: 'eu-frankfurt-1' });
    mockChat.mockImplementation(async () => ({
      body: createReadableStream([
        ...createMockStreamChunks(['Generated response']),
        `data: ${JSON.stringify({
          finishReason: 'STOP',
          usage: { promptTokens: 15, completionTokens: 10 },
        })}

`,
      ]),
      headers: {
        entries: () => new Map<string, string>().entries(),
      },
    }));
  });

  describe('Retry behavior', () => {
    it('should retry on transient 500 errors and eventually succeed', async () => {
      // Fail twice with 500, then succeed
      mockChat
        .mockRejectedValueOnce(
          Object.assign(new Error('Internal Server Error'), { statusCode: 500 })
        )
        .mockRejectedValueOnce(
          Object.assign(new Error('Internal Server Error'), { statusCode: 500 })
        )
        .mockImplementationOnce(async () => createMockSuccessResponse());

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 3, baseDelayMs: 1 }, // Fast retries for testing
        },
      });

      const result = await model.doGenerate(callOptions);

      expect(result.content[0]).toEqual({ type: 'text', text: 'Success response' });
      expect(mockChat).toHaveBeenCalledTimes(3);
    });

    it('should retry on 429 rate limit errors', async () => {
      // Fail once with 429, then succeed
      mockChat
        .mockRejectedValueOnce(Object.assign(new Error('Rate Limited'), { statusCode: 429 }))
        .mockImplementationOnce(async () => createMockSuccessResponse());

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 3, baseDelayMs: 1 },
        },
      });

      const result = await model.doGenerate(callOptions);

      expect(result.content[0]).toEqual({ type: 'text', text: 'Success response' });
      expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('should retry on network errors (ECONNRESET)', async () => {
      // Fail with network error, then succeed
      mockChat
        .mockRejectedValueOnce(Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' }))
        .mockImplementationOnce(async () => createMockSuccessResponse());

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 3, baseDelayMs: 1 },
        },
      });

      const result = await model.doGenerate(callOptions);

      expect(result.content[0]).toEqual({ type: 'text', text: 'Success response' });
      expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 401 authentication errors', async () => {
      mockChat.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 3, baseDelayMs: 1 },
        },
      });

      await expect(model.doGenerate(callOptions)).rejects.toThrow();
      expect(mockChat).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should NOT retry on 400 bad request errors', async () => {
      mockChat.mockRejectedValue(Object.assign(new Error('Bad Request'), { statusCode: 400 }));

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 3, baseDelayMs: 1 },
        },
      });

      await expect(model.doGenerate(callOptions)).rejects.toThrow();
      expect(mockChat).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should exhaust retries and throw final error', async () => {
      // Always fail with 500
      mockChat.mockRejectedValue(
        Object.assign(new Error('Internal Server Error'), { statusCode: 500 })
      );

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 2, baseDelayMs: 1 },
        },
      });

      await expect(model.doGenerate(callOptions)).rejects.toThrow();
      expect(mockChat).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should respect retry.enabled = false', async () => {
      mockChat.mockRejectedValue(
        Object.assign(new Error('Internal Server Error'), { statusCode: 500 })
      );

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { enabled: false },
        },
      });

      await expect(model.doGenerate(callOptions)).rejects.toThrow();
      expect(mockChat).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Timeout behavior', () => {
    it('should timeout on slow requests', async () => {
      // Mock a request that takes too long
      mockChat.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockSuccessResponse()), 100))
      );

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          timeoutMs: 10, // Very short timeout
          retry: { enabled: false }, // Disable retry to test timeout in isolation
        },
      });

      await expect(model.doGenerate(callOptions)).rejects.toThrow('timed out');
    });

    it('should succeed if request completes within timeout', async () => {
      // Mock a fast request
      mockChat.mockImplementation(async () => createMockSuccessResponse());

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          timeoutMs: 200,
          retry: { enabled: false },
        },
      });

      const result = await model.doGenerate(callOptions);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Success response' });
    });
  });

  describe('Configuration options', () => {
    it('should use default options when none provided', async () => {
      mockChat.mockImplementation(async () => createMockSuccessResponse());

      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);
      await model.doGenerate(callOptions);

      // Verify defaults were applied (hard to verify exact timeout, but we check chat was called)
      expect(mockChat).toHaveBeenCalled();
    });

    it('should merge config options with defaults', async () => {
      mockChat.mockImplementation(async () => createMockSuccessResponse());

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: { timeoutMs: 5000 },
      });
      await model.doGenerate(callOptions);

      expect(mockChat).toHaveBeenCalled();
    });

    it('should allow custom timeout values', async () => {
      mockChat.mockImplementation(async () => createMockSuccessResponse());

      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);
      await model.doGenerate({
        ...callOptions,
        providerOptions: {
          oci: {
            requestOptions: { timeoutMs: 1000 },
          },
        },
      });

      expect(mockChat).toHaveBeenCalled();
    });
  });

  describe('Streaming with retry', () => {
    it('should retry connection establishment for streaming', async () => {
      // Create a simple mock response that mimics a Response with readable stream
      const mockStreamResponse = {
        body: new ReadableStream({
          start(controller): void {
            controller.enqueue(
              new TextEncoder().encode('data: {"type":"text","text":"Hello"}\n\n')
            );
            controller.close();
          },
        }),
      };

      // Fail once, then succeed
      mockChat
        .mockRejectedValueOnce(Object.assign(new Error('Connection Error'), { code: 'ECONNRESET' }))
        .mockResolvedValueOnce(mockStreamResponse);

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 3, baseDelayMs: 1 },
        },
      });

      const result = await model.doStream(callOptions);
      expect(result.stream).toBeDefined();
      expect(mockChat).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling integration', () => {
    it('should wrap errors with APICallError after retry exhaustion', async () => {
      mockChat.mockRejectedValue(
        Object.assign(new Error('Internal Server Error'), { statusCode: 500 })
      );

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 1, baseDelayMs: 1 },
        },
      });

      try {
        await model.doGenerate(callOptions);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(APICallError.isInstance(error)).toBe(true);
        expect((error as APICallError).statusCode).toBe(500);
        expect((error as APICallError).isRetryable).toBe(true);
      }
    });

    it('should preserve original error message after retries', async () => {
      const originalMessage = 'Service temporarily unavailable';
      mockChat.mockRejectedValue(Object.assign(new Error(originalMessage), { statusCode: 503 }));

      const model = new OCILanguageModel('cohere.command-r-plus', {
        ...mockConfig,
        requestOptions: {
          retry: { maxRetries: 1, baseDelayMs: 1 },
        },
      });

      try {
        await model.doGenerate(callOptions);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain(originalMessage);
      }
    });
  });
});
