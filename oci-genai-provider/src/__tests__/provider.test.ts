import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NoSuchModelError } from '@ai-sdk/provider';
import { createOCI, oci } from '../index';
import { OCIGenAIProvider } from '../provider';

// Mock OCI SDK
jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => ({})),

  InstancePrincipalsAuthenticationDetailsProviderBuilder: jest.fn().mockImplementation(() => ({
    build: jest.fn().mockImplementation(() => Promise.resolve({})),
  })),
  ResourcePrincipalAuthenticationDetailsProvider: {
    builder: jest.fn().mockImplementation(() => ({})),
  },
}));

jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockImplementation(() =>
      Promise.resolve({
        chatResponse: {
          chatChoice: [{ message: { content: [{ text: 'Response' }] }, finishReason: 'STOP' }],
          usage: { promptTokens: 5, completionTokens: 3 },
        },
      })
    ),
  })),
}));

describe('createOCI Provider Factory (ProviderV3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.OCI_COMPARTMENT_ID = 'ocid1.compartment.oc1..test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Factory Creation', () => {
    it('should create provider with default config', () => {
      const provider = createOCI();
      expect(provider.specificationVersion).toBe('v3');
      expect(typeof provider.languageModel).toBe('function');
    });

    it('should create provider with Frankfurt region', () => {
      const provider = createOCI({ region: 'eu-frankfurt-1' });
      expect(provider.specificationVersion).toBe('v3');
    });

    it('should create provider with custom profile', () => {
      const provider = createOCI({ region: 'eu-frankfurt-1', profile: 'FRANKFURT' });
      expect(provider.specificationVersion).toBe('v3');
    });

    it('should create provider with compartment ID', () => {
      const provider = createOCI({ compartmentId: 'ocid1.compartment.oc1..test' });
      expect(provider.specificationVersion).toBe('v3');
    });

    it('should create provider with instance principal auth', () => {
      const provider = createOCI({ auth: 'instance_principal' });
      expect(provider.specificationVersion).toBe('v3');
    });
  });

  describe('Model Creation via languageModel()', () => {
    it('should create language model instance', () => {
      const provider = createOCI();
      const model = provider.languageModel('cohere.command-r-plus');
      expect(model.modelId).toBe('cohere.command-r-plus');
      expect(model.provider).toBe('oci-genai');
    });

    it('should create Grok model', () => {
      const provider = createOCI();
      const model = provider.languageModel('xai.grok-4');
      expect(model.modelId).toContain('grok');
    });

    it('should create Llama model', () => {
      const provider = createOCI();
      const model = provider.languageModel('meta.llama-3.3-70b-instruct');
      expect(model.modelId).toContain('llama');
    });

    it('should create Cohere model', () => {
      const provider = createOCI();
      const model = provider.languageModel('cohere.command-r-plus');
      expect(model.modelId).toContain('cohere');
    });

    it('should create Gemini model', () => {
      const provider = createOCI();
      const model = provider.languageModel('google.gemini-2.5-flash');
      expect(model.modelId).toContain('gemini');
    });

    it('should throw error for invalid model ID', () => {
      const provider = createOCI();
      expect(() => provider.languageModel('invalid.model')).toThrow(NoSuchModelError);
    });
  });

  describe('Configuration Cascade', () => {
    it('should prioritize config over environment', () => {
      process.env.OCI_REGION = 'us-ashburn-1';
      const provider = createOCI({ region: 'eu-frankfurt-1' });
      const model = provider.languageModel('cohere.command-r-plus');
      expect(model).toBeDefined();
    });

    it('should use environment when config not provided', () => {
      process.env.OCI_REGION = 'eu-stockholm-1';
      const provider = createOCI();
      expect(provider).toBeDefined();
    });

    it('should use Frankfurt as final default', () => {
      delete process.env.OCI_REGION;
      const provider = createOCI();
      expect(provider).toBeDefined();
    });
  });

  describe('oci default instance', () => {
    it('should export default provider instance', () => {
      expect(oci).toBeInstanceOf(OCIGenAIProvider);
      expect(oci.specificationVersion).toBe('v3');
    });

    it('should create language models from default instance', () => {
      const model = oci.languageModel('cohere.command-r-08-2024');
      expect(model).toBeDefined();
      expect(model.modelId).toBe('cohere.command-r-08-2024');
    });
  });
});

// ============================================================================
// OCIGenAIProvider Class Tests (ProviderV3)
// ============================================================================

describe('OCIGenAIProvider (ProviderV3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.OCI_COMPARTMENT_ID = 'ocid1.compartment.oc1..test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('specificationVersion', () => {
    it('should have specificationVersion V3', () => {
      const provider = new OCIGenAIProvider();
      expect(provider.specificationVersion).toBe('v3');
    });
  });

  describe('languageModel()', () => {
    it('should create language model with model ID', () => {
      const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
      const model = provider.languageModel('cohere.command-r-plus');

      expect(model).toBeDefined();
      expect(model.provider).toBe('oci-genai');
      expect(model.modelId).toBe('cohere.command-r-plus');
    });

    it('should pass config to language models', () => {
      const provider = new OCIGenAIProvider({
        region: 'eu-stockholm-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const model = provider.languageModel('meta.llama-3.3-70b-instruct');
      expect(model).toBeDefined();
    });

    it('should merge provider config with model-specific settings', () => {
      const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
      const model = provider.languageModel('cohere.command-r-08-2024', {
        region: 'us-ashburn-1', // Override provider region
        requestOptions: { timeoutMs: 60000 },
      });

      expect(model).toBeDefined();
    });

    it('should throw error for invalid model ID', () => {
      const provider = new OCIGenAIProvider();
      expect(() => provider.languageModel('invalid.model')).toThrow(NoSuchModelError);
    });
  });

  describe('embeddingModel()', () => {
    it('should create embedding model instance', () => {
      const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
      const model = provider.embeddingModel('cohere.embed-multilingual-v3.0');

      expect(model).toBeDefined();
      expect(model.provider).toBe('oci-genai');
      expect(model.modelId).toBe('cohere.embed-multilingual-v3.0');
    });

    it('should create different embedding models', () => {
      const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });

      const multilingual = provider.embeddingModel('cohere.embed-multilingual-v3.0');
      expect(multilingual.modelId).toContain('multilingual');

      const english = provider.embeddingModel('cohere.embed-english-v3.0');
      expect(english.modelId).toContain('english');

      const light = provider.embeddingModel('cohere.embed-english-light-v3.0');
      expect(light.modelId).toContain('light');
    });

    it('should merge provider config with embedding-specific settings', () => {
      const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
      const model = provider.embeddingModel('cohere.embed-english-light-v3.0', {
        dimensions: 384,
        truncate: 'START',
      });

      expect(model).toBeDefined();
    });

    it('should throw error for invalid embedding model ID', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.embeddingModel('invalid-model')).toThrow(NoSuchModelError);
    });
  });

  describe('imageModel()', () => {
    it('should throw NoSuchModelError - OCI does not support image generation', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.imageModel('dalle-3')).toThrow(NoSuchModelError);
    });

    it('should include helpful message about OCI limitations', () => {
      const provider = new OCIGenAIProvider();

      try {
        provider.imageModel('dalle-3');
        fail('Expected NoSuchModelError');
      } catch (error) {
        expect(error).toBeInstanceOf(NoSuchModelError);
        expect((error as NoSuchModelError).message).toContain('does not provide');
      }
    });
  });

  describe('transcriptionModel()', () => {
    it('should create transcription model with valid ID', () => {
      const provider = new OCIGenAIProvider({ region: 'us-phoenix-1' });
      const model = provider.transcriptionModel('WHISPER_MEDIUM');

      expect(model).toBeDefined();
      expect(model.provider).toBe('oci-genai');
      expect(model.modelId).toBe('WHISPER_MEDIUM');
    });

    it('should create Oracle transcription model', () => {
      const provider = new OCIGenAIProvider({ region: 'us-phoenix-1' });
      const model = provider.transcriptionModel('ORACLE');

      expect(model).toBeDefined();
      expect(model.modelId).toBe('ORACLE');
    });

    it('should throw error for invalid model ID', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.transcriptionModel('invalid-model')).toThrow(NoSuchModelError);
    });
  });

  describe('speechModel()', () => {
    it('should create speech model with valid ID', () => {
      const provider = new OCIGenAIProvider({ region: 'us-phoenix-1' });
      const model = provider.speechModel('TTS_2_NATURAL');

      expect(model).toBeDefined();
      expect(model.provider).toBe('oci-genai');
      expect(model.modelId).toBe('TTS_2_NATURAL');
    });

    it('should create TTS_1_STANDARD model', () => {
      const provider = new OCIGenAIProvider({ region: 'us-phoenix-1' });
      const model = provider.speechModel('TTS_1_STANDARD');

      expect(model).toBeDefined();
      expect(model.modelId).toBe('TTS_1_STANDARD');
    });

    it('should throw error for invalid model ID', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.speechModel('invalid-tts')).toThrow(NoSuchModelError);
    });
  });

  describe('rerankingModel()', () => {
    it('should create reranking model', () => {
      const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
      const model = provider.rerankingModel('cohere.rerank-v3.5');

      expect(model).toBeDefined();
      expect(model.provider).toBe('oci-genai');
      expect(model.modelId).toBe('cohere.rerank-v3.5');
    });

    it('should merge config with reranking-specific settings', () => {
      const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
      const model = provider.rerankingModel('cohere.rerank-v3.5', {
        topN: 5,
        returnDocuments: true,
      });

      expect(model).toBeDefined();
    });

    it('should throw for invalid reranking model ID', () => {
      const provider = new OCIGenAIProvider();

      expect(() => {
        provider.rerankingModel('invalid-model');
      }).toThrow(NoSuchModelError);
    });
  });

  describe('Integration Tests', () => {
    it('should create all model types successfully', () => {
      const provider = new OCIGenAIProvider({
        compartmentId: 'ocid1.compartment.oc1..test',
        region: 'eu-frankfurt-1',
      });

      // Language model
      expect(() => provider.languageModel('cohere.command-r-plus')).not.toThrow();

      // Embedding model
      expect(() => provider.embeddingModel('cohere.embed-multilingual-v3.0')).not.toThrow();

      // Reranking model
      expect(() => provider.rerankingModel('cohere.rerank-v3.5')).not.toThrow();

      // Speech model (requires us-phoenix-1 region)
      expect(() => provider.speechModel('TTS_2_NATURAL', { region: 'us-phoenix-1' })).not.toThrow();

      // Transcription model (requires us-phoenix-1 region)
      expect(() =>
        provider.transcriptionModel('WHISPER_MEDIUM', { region: 'us-phoenix-1' })
      ).not.toThrow();
    });

    it('should merge provider config with model-specific settings', () => {
      const provider = new OCIGenAIProvider({
        compartmentId: 'provider-compartment',
        region: 'eu-frankfurt-1',
      });

      // Create model with override settings
      const model = provider.languageModel('cohere.command-r-plus', {
        compartmentId: 'model-compartment', // Override provider config
      });

      expect(model).toBeDefined();
      expect(model.modelId).toBe('cohere.command-r-plus');
      expect(model.provider).toBe('oci-genai');
    });

    it('should merge embedding config with model-specific settings', () => {
      const provider = new OCIGenAIProvider({
        compartmentId: 'provider-compartment',
        region: 'eu-frankfurt-1',
      });

      const model = provider.embeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'embedding-compartment',
      });

      expect(model).toBeDefined();
      expect(model.modelId).toBe('cohere.embed-multilingual-v3.0');
    });

    it('should merge reranking config with model-specific settings', () => {
      const provider = new OCIGenAIProvider({
        compartmentId: 'provider-compartment',
        region: 'eu-frankfurt-1',
      });

      const model = provider.rerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'rerank-compartment',
        topN: 5,
      });

      expect(model).toBeDefined();
      expect(model.modelId).toBe('cohere.rerank-v3.5');
    });

    it('should throw NoSuchModelError for imageModel', () => {
      const provider = new OCIGenAIProvider({});

      expect(() => provider.imageModel('dalle-3')).toThrow(NoSuchModelError);
    });

    it('should include helpful error message for imageModel', () => {
      const provider = new OCIGenAIProvider({});

      try {
        provider.imageModel('dall-e');
        fail('Expected NoSuchModelError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NoSuchModelError);
        expect((error as NoSuchModelError).message).toContain('does not provide');
      }
    });

    it('should have all optional provider methods defined', () => {
      const provider = new OCIGenAIProvider({});

      expect(typeof provider.languageModel).toBe('function');
      expect(typeof provider.embeddingModel).toBe('function');
      expect(typeof provider.speechModel).toBe('function');
      expect(typeof provider.transcriptionModel).toBe('function');
      expect(typeof provider.rerankingModel).toBe('function');
      expect(typeof provider.imageModel).toBe('function');
    });

    it('should preserve provider config across multiple model creations', () => {
      const provider = new OCIGenAIProvider({
        compartmentId: 'shared-compartment',
        region: 'eu-frankfurt-1',
      });

      // Create multiple models
      const languageModel = provider.languageModel('cohere.command-r-plus');
      const embeddingModel = provider.embeddingModel('cohere.embed-multilingual-v3.0');
      const rerankingModel = provider.rerankingModel('cohere.rerank-v3.5');

      // All models should be created successfully
      expect(languageModel).toBeDefined();
      expect(embeddingModel).toBeDefined();
      expect(rerankingModel).toBeDefined();

      // Provider should still be usable
      expect(() => provider.languageModel('meta.llama-3.3-70b-instruct')).not.toThrow();
    });

    it('should allow region override in speech model creation', () => {
      const provider = new OCIGenAIProvider({
        region: 'eu-frankfurt-1',
      });

      // Speech models require us-phoenix-1 region
      expect(() => provider.speechModel('TTS_2_NATURAL', { region: 'us-phoenix-1' })).not.toThrow();
    });

    it('should allow region override in transcription model creation', () => {
      const provider = new OCIGenAIProvider({
        region: 'eu-frankfurt-1',
      });

      // Transcription models require us-phoenix-1 region
      expect(() =>
        provider.transcriptionModel('WHISPER_MEDIUM', {
          region: 'us-phoenix-1',
        })
      ).not.toThrow();
    });

    it('should support config merging for all model types with requestOptions', () => {
      const provider = new OCIGenAIProvider({
        region: 'eu-frankfurt-1',
      });

      const model = provider.languageModel('cohere.command-r-plus', {
        requestOptions: { timeoutMs: 60000 },
      });

      expect(model).toBeDefined();
    });

    it('should create speech model with voice configuration override', () => {
      const provider = new OCIGenAIProvider({
        region: 'us-phoenix-1',
      });

      const model = provider.speechModel('TTS_2_NATURAL', {
        voice: 'en-US-AriaNeural',
      });

      expect(model).toBeDefined();
      expect(model.modelId).toBe('TTS_2_NATURAL');
    });

    it('should handle empty provider config', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.languageModel('cohere.command-r-plus')).not.toThrow();
      expect(() => provider.embeddingModel('cohere.embed-multilingual-v3.0')).not.toThrow();
    });

    it('should throw for invalid language model ID format', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.languageModel('invalid-format')).toThrow(NoSuchModelError);
    });

    it('should throw for invalid embedding model ID format', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.embeddingModel('invalid-format')).toThrow(NoSuchModelError);
    });

    it('should throw for invalid speech model ID format', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.speechModel('invalid-id')).toThrow(NoSuchModelError);
    });

    it('should throw for invalid transcription model ID format', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.transcriptionModel('invalid-id')).toThrow(NoSuchModelError);
    });

    it('should throw for invalid reranking model ID format', () => {
      const provider = new OCIGenAIProvider();

      expect(() => provider.rerankingModel('invalid-model')).toThrow(NoSuchModelError);
    });
  });

  describe('realtimeTranscription()', () => {
    it('should create realtime transcription session', () => {
      const provider = new OCIGenAIProvider({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const session = provider.realtimeTranscription();

      expect(session).toBeDefined();
      expect(session.state).toBe('disconnected');
      expect(typeof session.connect).toBe('function');
      expect(typeof session.sendAudio).toBe('function');
      expect(typeof session.close).toBe('function');
      expect(typeof session.on).toBe('function');
    });

    it('should accept realtime-specific settings', () => {
      const provider = new OCIGenAIProvider({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const session = provider.realtimeTranscription({
        language: 'es-ES',
        model: 'WHISPER',
        partialResults: true,
      });

      expect(session).toBeDefined();
    });

    it('should merge provider config with realtime settings', () => {
      const provider = new OCIGenAIProvider({
        region: 'eu-frankfurt-1',
        compartmentId: 'provider-compartment',
      });

      const session = provider.realtimeTranscription({
        region: 'us-phoenix-1', // Override
        language: 'de-DE',
      });

      expect(session).toBeDefined();
    });

    it('should implement AsyncIterable', () => {
      const provider = new OCIGenAIProvider({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const session = provider.realtimeTranscription();

      expect(typeof session[Symbol.asyncIterator]).toBe('function');
    });
  });
});
