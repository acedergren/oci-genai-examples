import {
  ProviderV3,
  LanguageModelV3,
  EmbeddingModelV3,
  ImageModelV3,
  TranscriptionModelV3,
  SpeechModelV3,
  RerankingModelV3,
  NoSuchModelError,
} from '@ai-sdk/provider';
import { OCILanguageModel } from './language-models/OCILanguageModel';
import { MODEL_CATALOG } from './language-models/registry';
import { OCIEmbeddingModel } from './embedding-models/OCIEmbeddingModel';
import { OCISpeechModel } from './speech-models/OCISpeechModel';
import { OCIRerankingModel } from './reranking-models/OCIRerankingModel';
import { OCITranscriptionModel } from './transcription-models/OCITranscriptionModel';
import { OCIRealtimeTranscription } from './realtime/OCIRealtimeTranscription';
import type {
  OCIConfig,
  OCILanguageModelSettings,
  OCIEmbeddingSettings,
  OCISpeechSettings,
  OCITranscriptionSettings,
  OCIRerankingSettings,
} from './types';
import type { OCIRealtimeSettings } from './realtime/types';

/**
 * OCI GenAI Provider implementing ProviderV3 interface.
 *
 * Supports:
 * - Language Models (16+ models including Cohere, Llama, Grok, Gemini)
 * - Embeddings (coming in Plan 2)
 * - Speech/TTS (coming in Plan 3)
 * - Transcription/STT (coming in Plan 4)
 * - Reranking (coming in Plan 5)
 */
export class OCIGenAIProvider implements ProviderV3 {
  readonly specificationVersion = 'v3' as const;

  constructor(private readonly config: OCIConfig = {}) {}

  get models(): Record<string, any> {
    const models: Record<string, any> = {};
    for (const model of MODEL_CATALOG) {
      models[model.id] = {
        modelId: model.id,
        ...model,
      };
    }
    return models;
  }

  /**
   * Create a language model instance for chat/completion.
   *
   * @param modelId - OCI model identifier (e.g., 'cohere.command-r-plus')
   * @param settings - Optional model-specific settings that override provider config
   * @returns Language model instance
   *
   * @example
   * ```typescript
   * const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
   * const model = provider.languageModel('cohere.command-r-plus');
   * ```
   */
  languageModel(modelId: string, settings?: OCILanguageModelSettings): LanguageModelV3 {
    const mergedConfig: OCIConfig = { ...this.config, ...settings };
    return new OCILanguageModel(modelId, mergedConfig);
  }

  /**
   * Create a language model instance for chat/completion.
   * Alias for `languageModel`.
   *
   * @param modelId - OCI model identifier
   * @param settings - Optional model-specific settings
   */
  chat(modelId: string, settings?: OCILanguageModelSettings): LanguageModelV3 {
    return this.languageModel(modelId, settings);
  }

  /**
   * Create an embedding model instance.
   *
   * @param modelId - OCI embedding model identifier (e.g., 'cohere.embed-multilingual-v3.0')
   * @param settings - Optional model-specific settings that override provider config
   * @returns Embedding model instance
   *
   * @example
   * ```typescript
   * const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
   * const model = provider.embeddingModel('cohere.embed-multilingual-v3.0');
   * ```
   */
  embeddingModel(modelId: string, settings?: OCIEmbeddingSettings): EmbeddingModelV3 {
    const mergedConfig: OCIConfig = { ...this.config, ...settings };
    return new OCIEmbeddingModel(modelId, mergedConfig);
  }

  /**
   * Image generation is not supported by OCI GenAI.
   *
   * @throws {NoSuchModelError} Always throws - OCI does not provide image generation
   */
  imageModel(modelId: string): ImageModelV3 {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'OCI does not provide image generation models.',
    });
  }

  /**
   * Create a transcription model instance (STT).
   *
   * @throws {NoSuchModelError} Not yet implemented - coming in Plan 4
   */
  transcriptionModel(modelId: string, settings?: OCITranscriptionSettings): TranscriptionModelV3 {
    const mergedConfig: OCIConfig = { ...this.config, ...settings };
    return new OCITranscriptionModel(modelId, mergedConfig);
  }

  /**
   * Create a speech model instance (TTS).
   *
   * @param modelId - OCI speech model identifier (e.g., 'TTS_2_NATURAL')
   * @param settings - Optional model-specific settings that override provider config
   * @returns Speech model instance
   *
   * @example
   * ```typescript
   * const provider = new OCIGenAIProvider({ region: 'us-phoenix-1' });
   * const model = provider.speechModel('TTS_2_NATURAL');
   * ```
   */
  speechModel(modelId: string, settings?: OCISpeechSettings): SpeechModelV3 {
    const mergedConfig: OCIConfig = { ...this.config, ...settings };
    return new OCISpeechModel(modelId, mergedConfig);
  }

  /**
   * Create a reranking model instance.
   *
   * @param modelId - OCI reranking model identifier (e.g., 'cohere.rerank-v3.5')
   * @param settings - Optional model-specific settings that override provider config
   * @returns Reranking model instance
   *
   * @example
   * ```typescript
   * const provider = new OCIGenAIProvider({ region: 'eu-frankfurt-1' });
   * const model = provider.rerankingModel('cohere.rerank-v3.5');
   * ```
   */
  rerankingModel(modelId: string, settings?: OCIRerankingSettings): RerankingModelV3 {
    const mergedConfig: OCIConfig = { ...this.config, ...settings };
    return new OCIRerankingModel(modelId, mergedConfig);
  }

  /**
   * Create a realtime transcription session for low-latency streaming STT.
   *
   * Unlike the batch `transcriptionModel()`, this uses OCI's WebSocket-based
   * realtime speech service for sub-second latency streaming transcription.
   *
   * @param settings - Realtime transcription settings
   * @returns Realtime transcription session
   *
   * @example Event-based API
   * ```typescript
   * const session = oci.realtimeTranscription({
   *   language: 'en-US',
   *   model: 'ORACLE',
   * });
   *
   * session.on('partial', (result) => console.log('Partial:', result.text));
   * session.on('final', (result) => console.log('Final:', result.text));
   *
   * await session.connect();
   * session.sendAudio(audioChunk);
   * await session.close();
   * ```
   *
   * @example Async Iterator API
   * ```typescript
   * const session = oci.realtimeTranscription({ language: 'en-US' });
   *
   * for await (const result of session.transcribe(audioStream)) {
   *   console.log(result.isFinal ? 'FINAL:' : 'PARTIAL:', result.text);
   * }
   * ```
   */
  realtimeTranscription(settings?: OCIRealtimeSettings): OCIRealtimeTranscription {
    return new OCIRealtimeTranscription(this.config, settings);
  }
}
