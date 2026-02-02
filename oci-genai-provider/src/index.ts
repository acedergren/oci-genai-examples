/**
 * OCI Generative AI Provider for Vercel AI SDK
 *
 * Complete ProviderV3 implementation supporting:
 * - Language Models (16+ models including Cohere, Llama, Grok, Gemini)
 * - Embeddings (coming in v0.2.0)
 * - Speech/Transcription (coming in v0.3.0)
 * - Reranking (coming in v0.4.0)
 *
 * @example
 * ```typescript
 * import { oci, createOCI } from '@acedergren/oci-genai-provider';
 *
 * // Use default provider instance
 * const model = oci.languageModel('cohere.command-r-plus');
 *
 * // Or create custom provider
 * const provider = createOCI({ region: 'eu-frankfurt-1' });
 * const customModel = provider.languageModel('meta.llama-3.3-70b-instruct');
 * ```
 */

import { OCIGenAIProvider } from './provider';
import type { OCIConfig } from './types';

// ============================================================================
// Provider Exports
// ============================================================================

export { OCIGenAIProvider } from './provider';

/**
 * Create a new OCI provider instance with custom configuration.
 *
 * @param config - Optional provider configuration
 * @returns OCI provider instance implementing ProviderV3
 *
 * @example
 * ```typescript
 * const provider = createOCI({
 *   region: 'eu-frankfurt-1',
 *   compartmentId: 'ocid1.compartment...',
 * });
 *
 * const model = provider.languageModel('cohere.command-r-plus');
 * ```
 */
export function createOCI(config: OCIConfig = {}): OCIGenAIProvider {
  return new OCIGenAIProvider(config);
}

/**
 * Default OCI provider instance.
 * Uses environment variables or OCI config file for configuration.
 *
 * @example
 * ```typescript
 * import { oci } from '@acedergren/oci-genai-provider';
 *
 * const model = oci.languageModel('cohere.command-r-plus');
 * const embedding = oci.embeddingModel('cohere.embed-multilingual-v3.0'); // Coming soon
 * ```
 */
export const oci = createOCI();

// ============================================================================
// Type Exports
// ============================================================================

export type {
  OCIConfig,
  OCIAuthMethod,
  OCILanguageModelSettings,
  OCIEmbeddingSettings,
  OCISpeechSettings,
  OCITranscriptionSettings,
  OCIRerankingSettings,
  OCIRealtimeSettings,
  ModelMetadata,
  RequestOptions,
  OCIGenAIRegion,
} from './types';

// ============================================================================
// Language Model Exports
// ============================================================================

export { OCILanguageModel } from './language-models/OCILanguageModel';
export {
  isValidModelId,
  getModelMetadata,
  getAllModels,
  getModelsByFamily,
  getModelsByRegion,
  getCodingRecommendedModels,
  isCodingSuitable,
  supportsReasoning,
} from './language-models/registry';

// ============================================================================
// Embedding Model Exports
// ============================================================================

export { OCIEmbeddingModel } from './embedding-models/OCIEmbeddingModel';
export {
  getEmbeddingModelMetadata,
  isValidEmbeddingModelId,
  getAllEmbeddingModels,
} from './embedding-models/registry';
export type { EmbeddingModelMetadata } from './embedding-models/registry';

// ============================================================================
// Transcription Model Exports
export { OCITranscriptionModel } from './transcription-models/OCITranscriptionModel';
export {
  getTranscriptionModelMetadata,
  isValidTranscriptionModelId,
  getAllTranscriptionModels,
  getSupportedLanguages,
} from './transcription-models/registry';
export type {
  TranscriptionModelMetadata,
  SupportedLanguage,
} from './transcription-models/registry';

// Reranking Model Exports
// ============================================================================

export { OCIRerankingModel } from './reranking-models/OCIRerankingModel';
export {
  getRerankingModelMetadata,
  isValidRerankingModelId,
  getAllRerankingModels,
} from './reranking-models/registry';
export type { RerankingModelMetadata } from './reranking-models/registry';

// ============================================================================
// Speech Model Exports (TTS)
// ============================================================================

export { OCISpeechModel } from './speech-models/OCISpeechModel';
export {
  getSpeechModelMetadata,
  isValidSpeechModelId,
  getAllSpeechModels,
  getAllVoices,
} from './speech-models/registry';
export type { SpeechModelMetadata } from './speech-models/registry';

// ============================================================================
// Error Exports
// ============================================================================

export {
  OCIGenAIError,
  NetworkError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
  isRetryableStatusCode,
  handleOCIError,
} from './shared/errors';

export type {
  OCIGenAIErrorOptions,
  NetworkErrorOptions,
  RateLimitErrorOptions,
  AuthenticationErrorOptions,
} from './shared/errors';

// ============================================================================
// Utility Exports
// ============================================================================

export { withRetry, withTimeout, TimeoutError, isRetryableError } from './shared/utils';

export type { RetryOptions } from './shared/utils';

// ============================================================================
// Validation Schema Exports
// ============================================================================

export {
  CompartmentIdSchema,
  RegionSchema,
  ConfigProfileSchema,
  ServingModeSchema,
  EndpointIdSchema,
  OCIProviderSettingsSchema,
  ModelIdSchema,
  OCIChatModelIdSchema,
  validateProviderSettings,
  parseProviderSettings,
  OCIProviderOptionsSchema,
  parseProviderOptions,
} from './shared/schemas';

export type {
  OCIProviderSettingsInput,
  OCIProviderSettingsValidated,
  OCIChatModelId,
  OCIProviderOptions,
  OCIProviderOptionsInput,
} from './shared/schemas';

// ============================================================================
// Realtime Transcription Exports (Streaming STT)
// ============================================================================

export {
  OCIRealtimeTranscription,
  OCIRealtimeClient,
  WebSocketAdapter,
  WebSocketReadyState,
} from './realtime';

export type {
  // Settings
  RealtimeAudioEncoding,
  PartialResultStability,
  RealtimeModelDomain,
  RealtimePunctuation,
  RealtimeModelType,
  // Results
  RealtimeTranscriptionResult,
  TranscriptionToken,
  // Events
  RealtimeTranscriptionEvents,
  RealtimeClientEvents,
  AudioAckDetails,
  // State
  RealtimeConnectionState,
  RealtimeSessionInfo,
  // Errors
  RealtimeErrorCode,
  RealtimeError,
} from './realtime';
