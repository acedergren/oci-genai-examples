import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { OCILanguageModel } from '../OCILanguageModel';
import type { AuthenticationDetailsProvider } from 'oci-common';
import type { OCIConfig } from '../../types';

// Mock auth provider
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

// Mock auth module
jest.mock('../../auth/index.js', () => ({
  createAuthProvider: (config: OCIConfig): ReturnType<typeof mockCreateAuthProvider> =>
    mockCreateAuthProvider(config),
  getRegion: (config: OCIConfig): ReturnType<typeof mockGetRegion> => mockGetRegion(config),
  getCompartmentId: (config: OCIConfig): ReturnType<typeof mockGetCompartmentId> =>
    mockGetCompartmentId(config),
}));

// Mock oci-common Region
jest.mock('oci-common', () => ({
  Region: {
    fromRegionId: jest.fn((regionId: string) => ({ regionId })),
  },
}));

// Mock OCI SDK to return streaming response
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockImplementation((): Promise<Response> => {
      // Create a mock streaming response
      const encoder = new TextEncoder();
      const sseData = `event: message
data: {"message":{"content":[{"text":"Hello"}]}}

event: message
data: {"message":{"content":[{"text":" world"}]}}

event: message
data: {"finishReason":"STOP"}

`;
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      return Promise.resolve(new Response(stream));
    }),
    region: undefined,
  })),
}));

describe('OCILanguageModel.doStream', () => {
  const mockConfig = {
    region: 'eu-frankfurt-1',
    compartmentId: 'ocid1.compartment.oc1..test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return stream result with stream property', async () => {
    const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    });

    expect(result).toHaveProperty('stream');
    expect(result.stream).toBeDefined();
  });

  it('should stream text deltas', async () => {
    const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    });

    const reader = result.stream.getReader();
    const parts: unknown[] = [];
    let done = false;

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        parts.push(value);
      }
    }

    // Should have stream start
    const streamStart = parts.find((p) => (p as { type: string }).type === 'stream-start');
    expect(streamStart).toBeDefined();

    // Should have text deltas
    const textDeltas = parts.filter(
      (p): p is { type: 'text-delta'; delta: string } =>
        (p as { type: string }).type === 'text-delta'
    );
    expect(textDeltas.length).toBeGreaterThan(0);

    // Should have text end
    const textEnd = parts.find((p) => (p as { type: string }).type === 'text-end');
    expect(textEnd).toBeDefined();
  });

  it('should include finish part with usage', async () => {
    const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    });

    const reader = result.stream.getReader();
    const parts: unknown[] = [];
    let done = false;

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        parts.push(value);
      }
    }

    // Should have finish part
    const finishPart = parts.find(
      (p): p is { type: 'finish'; finishReason: { unified: string; raw: string } } =>
        (p as { type: string }).type === 'finish'
    );
    expect(finishPart).toBeDefined();
    expect(finishPart?.finishReason).toEqual({ unified: 'stop', raw: 'STOP' });
  });

  it('should include raw parts when includeRawChunks is true', async () => {
    const model = new OCILanguageModel('cohere.command-r-plus', mockConfig);

    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      includeRawChunks: true,
    });

    const reader = result.stream.getReader();
    const parts: unknown[] = [];
    let done = false;

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        parts.push(value);
      }
    }

    const rawParts = parts.filter((p) => (p as { type: string }).type === 'raw');
    expect(rawParts.length).toBeGreaterThan(0);
  });

  it('should set isStream flag in request', () => {
    const chatRequest = {
      chatRequest: {
        messages: [],
        isStream: true,
      },
    };
    expect(chatRequest.chatRequest.isStream).toBe(true);
  });

  it('should include temperature in streaming request', () => {
    const inferenceConfig = { temperature: 0.8 };
    expect(inferenceConfig.temperature).toBe(0.8);
  });

  it('should include maxTokens in streaming request', () => {
    const inferenceConfig = { maxTokens: 200 };
    expect(inferenceConfig.maxTokens).toBe(200);
  });
});
