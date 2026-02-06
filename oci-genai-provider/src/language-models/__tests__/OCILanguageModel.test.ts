import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { APICallError, NoSuchModelError } from '@ai-sdk/provider';
import { OCILanguageModel } from '../OCILanguageModel';
import type { AuthenticationDetailsProvider } from 'oci-common';
import type { OCIConfig } from '../../types';
import { createMockStreamChunks, createReadableStream } from '../../__tests__/utils/test-helpers';

// Mock functions that will be accessible in mocks
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

describe('OCILanguageModel', () => {
  const mockConfig = {
    region: 'eu-frankfurt-1',
    compartmentId: 'ocid1.compartment.oc1..test',
  };

  const mockAuthProvider: AuthenticationDetailsProvider = {
    getKeyId: mockAuthProviderGetKeyId,
    getPrivateKey: mockAuthProviderGetPrivateKey,
    getPassphrase: mockAuthProviderGetPassphrase,
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
        })}\n\n`,
      ]),
      headers: {
        entries: () => new Map<string, string>().entries(),
      },
    }));
  });

  describe('Authentication', () => {
    it('should initialize client with proper auth provider lazily', async () => {
      const config = {
        auth: 'config_file' as const,
        configPath: '~/.oci/config',
        compartmentId: 'ocid1.compartment.oc1..test',
      };

      const model = new OCILanguageModel('cohere.command-r-plus', config);

      // Verify model was created
      expect(model.modelId).toBe('cohere.command-r-plus');

      // Client should not be created yet - verify by checking mocks
      expect(mockCreateAuthProvider).not.toHaveBeenCalled();
      expect(mockGenerativeAiInferenceClientConstructor).not.toHaveBeenCalled();

      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      // Make API call which should trigger lazy client initialization
      await model.doGenerate(options);

      // Verify client was initialized with proper auth provider
      expect(mockCreateAuthProvider).toHaveBeenCalledWith(config);
      expect(mockCreateAuthProvider).toHaveBeenCalledTimes(1);
      expect(mockGenerativeAiInferenceClientConstructor).toHaveBeenCalledWith({
        authenticationDetailsProvider: mockAuthProvider,
      });
      expect(mockGenerativeAiInferenceClientConstructor).toHaveBeenCalledTimes(1);
    });

    it('should reuse client across multiple calls', async () => {
      const config = {
        auth: 'config_file' as const,
        configPath: '~/.oci/config',
        compartmentId: 'ocid1.compartment.oc1..test',
      };

      const model = new OCILanguageModel('cohere.command-r-plus', config);
      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      // Make first API call
      await model.doGenerate(options);

      // Make second API call
      await model.doGenerate(options);

      // Verify client was created only once (reused)
      expect(mockCreateAuthProvider).toHaveBeenCalledTimes(1);
      expect(mockGenerativeAiInferenceClientConstructor).toHaveBeenCalledTimes(1);

      // But chat should have been called twice
      expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('should throw helpful error if auth provider creation fails', async () => {
      const config = {
        auth: 'config_file' as const,
        configPath: '/nonexistent/config',
        compartmentId: 'ocid1.compartment.oc1..test',
      };

      // Mock auth provider to throw error for this test
      mockCreateAuthProvider.mockRejectedValue(new Error('Config file not found'));

      const model = new OCILanguageModel('meta.llama-3.1-70b-instruct', config);
      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      // Should throw helpful error message
      await expect(model.doGenerate(options)).rejects.toThrow(
        'Failed to initialize OCI client: Config file not found'
      );

      // Verify second call also throws (client initialization failed)
      await expect(model.doGenerate(options)).rejects.toThrow('Check your OCI configuration');
    });
  });

  describe('Construction', () => {
    it('should create model with valid model ID', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);
      expect(model.modelId).toBe('cohere.command-r-plus');
    });

    it('should throw error for invalid model ID', () => {
      expect(() => new OCILanguageModel('invalid.model', mockConfig)).toThrow(NoSuchModelError);
    });

    it('should have correct specification version', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);
      expect(model.specificationVersion).toBe('v3');
    });

    it('should have correct provider identifier', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);
      expect(model.provider).toBe('oci-genai');
    });

    it('should have tool default object generation mode', () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);
      expect(model.defaultObjectGenerationMode).toBe('tool');
    });
  });

  describe('doGenerate', () => {
    it('should return content from response', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.finishReason).toEqual({ unified: 'stop', raw: 'STOP' });
    });

    it('should return usage statistics', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(result.usage.inputTokens.total).toBe(15);
      expect(result.usage.outputTokens.total).toBe(10);
    });

    it('should include stringified messages in request body for observability', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test prompt' }] }],
      });

      // Verify request.body is a JSON string
      expect(result.request).toBeDefined();
      expect(typeof result.request?.body).toBe('string');

      // Verify it contains the converted messages
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsedBody = JSON.parse(result.request?.body as string);
      expect(Array.isArray(parsedBody)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsedBody[0]).toHaveProperty('role', 'USER');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsedBody[0]).toHaveProperty('content');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsedBody[0].content[0]).toHaveProperty('text', 'Test prompt');
    });
  });

  describe('Compartment ID validation', () => {
    it('should throw error when compartmentId is missing', async () => {
      const configWithoutCompartment = {
        region: 'eu-frankfurt-1',
      };

      // Mock getCompartmentId to throw error for missing compartmentId
      mockGetCompartmentId.mockImplementation(() => {
        throw new Error(
          'Compartment ID not found. Provide via config.compartmentId or OCI_COMPARTMENT_ID environment variable.'
        );
      });

      const model = new OCILanguageModel('cohere.command-r-plus', configWithoutCompartment);
      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      await expect(model.doGenerate(options)).rejects.toThrow(
        'Compartment ID not found. Provide via config.compartmentId or OCI_COMPARTMENT_ID environment variable.'
      );
    });

    it('should use compartmentId from config when provided', async () => {
      const configWithCompartment = {
        region: 'eu-frankfurt-1',
        compartmentId: 'ocid1.compartment.oc1..specific',
      };

      mockGetCompartmentId.mockReturnValue('ocid1.compartment.oc1..specific');

      const model = new OCILanguageModel('cohere.command-r-plus', configWithCompartment);
      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      await model.doGenerate(options);

      // Verify getCompartmentId was called with the config
      expect(mockGetCompartmentId).toHaveBeenCalledWith(configWithCompartment);

      // Verify chat was called with the validated compartmentId
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          chatDetails: expect.objectContaining({
            compartmentId: 'ocid1.compartment.oc1..specific',
          }),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should wrap 401 errors with APICallError and authentication context', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

      // Mock API to throw 401 error
      const authError = new Error('Unauthorized') as Error & { statusCode?: number };
      authError.statusCode = 401;
      mockChat.mockRejectedValue(authError);

      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      try {
        await model.doGenerate(options);
        throw new Error('Expected error to be thrown');
      } catch (error) {
        expect(APICallError.isInstance(error)).toBe(true);
        expect((error as APICallError).statusCode).toBe(401);
        expect(error).toHaveProperty('message');
        expect((error as Error).message).toContain('authentication');
      }
    });

    it('should wrap 429 errors with retryable flag', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

      // Mock API to throw 429 error
      const rateLimitError = new Error('Too Many Requests') as Error & { statusCode?: number };
      rateLimitError.statusCode = 429;
      mockChat.mockRejectedValue(rateLimitError);

      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      try {
        await model.doGenerate(options);
        throw new Error('Expected error to be thrown');
      } catch (error) {
        expect(APICallError.isInstance(error)).toBe(true);
        expect((error as APICallError).statusCode).toBe(429);
        expect((error as APICallError).isRetryable).toBe(true);
      }
    });

    it('should wrap streaming errors with APICallError', async () => {
      const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

      // Mock API to throw 500 error
      const serverError = new Error('Internal Server Error') as Error & { statusCode?: number };
      serverError.statusCode = 500;
      mockChat.mockRejectedValue(serverError);

      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      };

      try {
        const result = await model.doStream(options);
        // Try to consume stream - should error
        const reader = result.stream.getReader();
        await reader.read();
        throw new Error('Expected error to be thrown');
      } catch (error) {
        expect(APICallError.isInstance(error)).toBe(true);
        expect((error as APICallError).statusCode).toBe(500);
      }
    });
  });
});
