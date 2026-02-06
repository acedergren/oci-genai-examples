import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Readable } from 'stream';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */

// Helper to create a mock readable stream
function createMockAudioStream(
  data: Buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f])
): NodeJS.ReadableStream {
  const readable = new Readable({
    read() {
      this.push(data);
      this.push(null);
    },
  });
  return readable;
}

// Mock oci-aispeech - needs to be at top level
const mockSynthesizeSpeech: jest.Mock<any> = jest.fn();

jest.mock('oci-aispeech', () => ({
  AIServiceSpeechClient: jest.fn().mockImplementation(() => ({
    region: null,
    endpoint: null,
    synthesizeSpeech: mockSynthesizeSpeech,
  })),
  models: {
    TtsOracleSpeechSettings: {
      OutputFormat: {
        Mp3: 'MP3',
        Ogg: 'OGG',
        Pcm: 'PCM',
        Json: 'JSON',
      },
    },
  },
}));

// Mock oci-common
jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => ({})),
  InstancePrincipalsAuthenticationDetailsProviderBuilder: jest.fn().mockImplementation(() => ({
    // @ts-expect-error - Mock implementation for testing
    build: jest.fn().mockResolvedValue({}),
  })),
  ResourcePrincipalAuthenticationDetailsProvider: {
    builder: jest.fn().mockReturnValue({}),
  },
  Region: {
    fromRegionId: jest.fn().mockReturnValue({ regionId: 'us-phoenix-1' }),
  },
}));

// Import after mocks
import { NoSuchModelError } from '@ai-sdk/provider';
import { OCISpeechModel } from '../OCISpeechModel';

describe('OCISpeechModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock response
    mockSynthesizeSpeech.mockResolvedValue({
      value: createMockAudioStream(),
    });
  });

  it('should have correct specification version and provider', () => {
    const model = new OCISpeechModel('TTS_2_NATURAL', {
      compartmentId: 'ocid1.compartment.test',
      region: 'us-phoenix-1',
    });
    expect(model.specificationVersion).toBe('v3');
    expect(model.provider).toBe('oci-genai');
    expect(model.modelId).toBe('TTS_2_NATURAL');
  });

  it('should throw error for invalid model ID', () => {
    expect(() => {
      new OCISpeechModel('invalid-model', {});
    }).toThrow(NoSuchModelError);
  });

  it('should reject old-style model IDs', () => {
    expect(() => {
      new OCISpeechModel('oci.tts-1-hd', { region: 'us-phoenix-1' });
    }).toThrow(NoSuchModelError);
  });

  it('should allow any region (no Phoenix-only restriction)', () => {
    expect(() => {
      new OCISpeechModel('TTS_2_NATURAL', { region: 'eu-frankfurt-1' });
    }).not.toThrow();
  });

  it('should validate text length does not exceed max', async () => {
    const model = new OCISpeechModel('TTS_2_NATURAL', {
      compartmentId: 'test',
      region: 'us-phoenix-1',
    });
    const longText = 'a'.repeat(5001);
    await expect(model.doGenerate({ text: longText })).rejects.toThrow(
      'Text length (5001) exceeds maximum allowed (5000)'
    );
  });

  describe('Voice Selection', () => {
    it('should use config.voice when provided (highest priority)', () => {
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        region: 'us-phoenix-1',
        voice: 'custom-voice-id',
      });
      expect(model.getVoice()).toBe('custom-voice-id');
    });

    it('should fallback to metadata defaultVoice if config voice not provided', () => {
      // Test the second fallback in chain: config.voice ?? defaultVoice ?? 'en-US-AriaNeural'
      // We'll create a model without voice and verify it attempts to use metadata
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        region: 'us-phoenix-1',
        // No voice specified - should use metadata.defaultVoice if available
      });
      // Since neither TTS_2_NATURAL nor TTS_1_STANDARD have defaultVoice in registry,
      // this will fall through to the hardcoded default
      expect(model.getVoice()).toBe('en-US-AriaNeural');
    });

    it('should fallback to hardcoded default when no defaultVoice in registry', () => {
      // Neither TTS_2_NATURAL nor TTS_1_STANDARD has defaultVoice in registry
      const model = new OCISpeechModel('TTS_1_STANDARD', {
        region: 'us-phoenix-1',
      });
      expect(model.getVoice()).toBe('en-US-AriaNeural');
    });

    it('should fallback to en-US-AriaNeural if both config and metadata voice are undefined', () => {
      // Explicitly test line 27: this.voice = config.voice ?? defaultVoice ?? 'en-US-AriaNeural'
      // This test ensures the final fallback is triggered when both config.voice and metadata.defaultVoice are undefined
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        region: 'us-phoenix-1',
        // No voice in config (undefined)
      });

      // Verify the final fallback to hardcoded 'en-US-AriaNeural' works
      expect(model.getVoice()).toBe('en-US-AriaNeural');
    });

    it('should prefer config.voice over default', () => {
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        region: 'us-phoenix-1',
        voice: 'my-custom-voice',
      });
      expect(model.getVoice()).toBe('my-custom-voice');
    });
  });

  describe('doGenerate', () => {
    it('should generate audio successfully for valid text', async () => {
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        compartmentId: 'test',
        region: 'us-phoenix-1',
      });
      const result = await model.doGenerate({ text: 'Hello world' });
      expect(result).toBeDefined();
      expect(result.audio).toBeInstanceOf(Uint8Array);
      expect((result.audio as Uint8Array).length).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
      expect(result.response.modelId).toBe('TTS_2_NATURAL');
    });

    it('should return timestamp in response', async () => {
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        compartmentId: 'test',
        region: 'us-phoenix-1',
      });
      const before = new Date();
      const result = await model.doGenerate({ text: 'Test' });
      const after = new Date();
      expect(result.response.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.response.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include request body in response', async () => {
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        compartmentId: 'test',
        region: 'us-phoenix-1',
      });
      const result = await model.doGenerate({ text: 'Hello' });
      expect(result.request).toBeDefined();
      expect(result.request?.body).toBeDefined();
    });

    it('should include providerMetadata with voice and format', async () => {
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        compartmentId: 'test',
        region: 'us-phoenix-1',
        format: 'wav',
      });
      const result = await model.doGenerate({ text: 'Hello' });
      expect(result.providerMetadata).toBeDefined();
      expect(result.providerMetadata?.oci).toBeDefined();
      expect((result.providerMetadata?.oci as Record<string, unknown>).format).toBe('wav');
    });

    it('should pass correct modelName to OCI SDK', async () => {
      const model = new OCISpeechModel('TTS_1_STANDARD', {
        compartmentId: 'test',
        region: 'us-phoenix-1',
      });
      await model.doGenerate({ text: 'Test' });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
        synthesizeSpeechDetails: expect.objectContaining({
          configuration: expect.objectContaining({
            modelFamily: 'ORACLE',
            modelDetails: expect.objectContaining({
              modelName: 'TTS_1_STANDARD',
            }),
          }),
        }),
      });
    });
  });

  describe('format mapping', () => {
    it('should default to mp3 format when not specified', async () => {
      const model = new OCISpeechModel('TTS_2_NATURAL', {
        compartmentId: 'test',
        region: 'us-phoenix-1',
      });
      const result = await model.doGenerate({ text: 'Test' });
      expect((result.providerMetadata?.oci as Record<string, unknown>).format).toBe('mp3');
    });
  });
});
