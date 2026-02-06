import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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
const mockGetCompartmentId = jest.fn<(config: OCIConfig) => string>();
const mockChat = jest.fn<() => Promise<unknown>>();
const mockGenerativeAiInferenceClientConstructor = jest.fn();
const mockFromRegionId = jest.fn<(regionId: string) => unknown>();

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

describe('OCILanguageModel - seed parameter', () => {
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
        })}

`,
      ]),
      headers: {
        entries: () => new Map<string, string>().entries(),
      },
    }));
  });

  it('should pass seed parameter in non-streaming requests', async () => {
    const model = new OCILanguageModel('meta.llama-3.1-405b-instruct', mockConfig);

    await model.doGenerate({
      prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello' }] }],
      seed: 42,
    });

    expect(mockChat).toHaveBeenCalledWith(
      expect.objectContaining({
        chatDetails: expect.objectContaining({
          chatRequest: expect.objectContaining({
            seed: 42,
          }),
        }),
      })
    );
  });

  it('should pass seed parameter in streaming requests', async () => {
    const model = new OCILanguageModel('meta.llama-3.1-405b-instruct', mockConfig);

    // Mock streaming response
    const mockStreamData = `data: {"chatResponse":{"choices":[{"message":{"content":[{"text":"Test"}]},"finishReason":"STOP"}],"usage":{"promptTokens":10,"completionTokens":5}}}\n\n`;
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(mockStreamData));
        controller.close();
      },
    });

    mockChat.mockResolvedValue(mockStream);

    const { stream } = await model.doStream({
      prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello' }] }],
      seed: 123,
    });

    // Consume the stream
    for await (const _ of stream) {
      // consume stream
    }

    expect(mockChat).toHaveBeenCalledWith(
      expect.objectContaining({
        chatDetails: expect.objectContaining({
          chatRequest: expect.objectContaining({
            seed: 123,
          }),
        }),
      })
    );
  });

  it('should not include seed parameter when not provided', async () => {
    const model = new OCILanguageModel('meta.llama-3.1-405b-instruct', mockConfig);

    await model.doGenerate({
      prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello' }] }],
    });

    // Verify seed is not in the request
    expect(mockChat).toHaveBeenCalled();
    const callArgs = mockChat.mock.calls[0] as any[];
    expect(callArgs[0]).toBeDefined();
    expect(callArgs[0].chatDetails.chatRequest).not.toHaveProperty('seed');
  });
});
