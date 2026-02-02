/**
 * Request options for configuring retry and timeout behavior.
 */
export interface RequestOptions {
  /**
   * Request timeout in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number;

  /**
   * Retry configuration for transient failures.
   */
  retry?: {
    /**
     * Enable automatic retry on transient failures.
     * @default true
     */
    enabled?: boolean;

    /**
     * Maximum number of retry attempts.
     * @default 3
     */
    maxRetries?: number;

    /**
     * Base delay in milliseconds for exponential backoff.
     * @default 100
     */
    baseDelayMs?: number;

    /**
     * Maximum delay in milliseconds between retries.
     * @default 10000
     */
    maxDelayMs?: number;
  };
}

/**
 * Serving mode for OCI GenAI inference.
 */
export type OCIServingType = 'ON_DEMAND' | 'DEDICATED';

export interface OCIServingMode {
  /** Serving type for OCI inference. */
  type: OCIServingType;
  /** Model OCID for on-demand serving. */
  modelId?: string;
  /** Endpoint OCID for dedicated serving. */
  endpointId?: string;
}

/**
 * Provider options for OCI-specific overrides per call.
 */
export interface OCIProviderOptions {
  /** Override compartment OCID for the call. */
  compartmentId?: string;
  /** Override client endpoint for the call. */
  endpoint?: string;
  /** Override serving mode (on-demand vs dedicated). */
  servingMode?: OCIServingMode;
  /** Override request timeout/retry behavior. */
  requestOptions?: RequestOptions;
  /** Constrains effort on reasoning for reasoning models (Generic format). */
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  /** Enable reasoning/thinking for Cohere models. */
  thinking?: boolean;
  /** Token budget for reasoning/thinking (Cohere models). */
  tokenBudget?: number;
}

/**
 * Authentication method for OCI
 */
export type OCIAuthMethod =
  | 'config_file' // API key from ~/.oci/config
  | 'instance_principal' // OCI Compute instance
  | 'resource_principal'; // OCI Functions

/**
 * OCI GenAI Provider Configuration
 *
 * @example
 * ```typescript
 * const provider = createOCI({
 *   compartmentId: 'ocid1.compartment...',
 *   region: 'eu-frankfurt-1',
 *   requestOptions: {
 *     timeoutMs: 30000,
 *     retry: { enabled: true, maxRetries: 3 }
 *   }
 * });
 * ```
 *
 * @remarks
 * The seed parameter is supported for deterministic generation.
 * OCI provides "best effort" determinism - responses with the same seed
 * are similar but not guaranteed to be byte-for-byte identical.
 */
export interface OCIConfig {
  /**
   * OCI region (e.g., 'eu-frankfurt-1')
   * @default 'eu-frankfurt-1'
   */
  region?: string;

  /**
   * OCI config profile name
   * @default 'DEFAULT'
   */
  profile?: string;

  /**
   * Authentication method
   * @default 'config_file'
   */
  auth?: OCIAuthMethod;

  /**
   * Path to OCI config file
   * @default '~/.oci/config'
   */
  configPath?: string;

  /**
   * Compartment OCID for API calls
   * If not provided, will be read from config or environment
   */
  compartmentId?: string;

  /**
   * Custom endpoint URL (for testing/dedicated clusters)
   */
  endpoint?: string;

  /**
   * Serving mode for inference (on-demand or dedicated endpoint).
   */
  servingMode?: OCIServingMode;

  /**
   * Default request options for retry and timeout behavior.
   * These can be overridden per-request.
   */
  requestOptions?: RequestOptions;
}

/**
 * OCI GenAI supported regions
 */
export type OCIGenAIRegion =
  | 'us-chicago-1'
  | 'eu-frankfurt-1'
  | 'ap-osaka-1'
  | 'uk-london-1'
  | 'us-ashburn-1'
  | 'ap-mumbai-1'
  | 'us-sanjose-1'
  | 'ap-singapore-1'
  | 'ap-seoul-1'
  | 'sa-saopaulo-1'
  | 'ap-sydney-1'
  | 'ap-tokyo-1'
  | 'ca-toronto-1';

/**
 * Model metadata for dynamic selection
 */
export interface ModelMetadata {
  id: string;
  name: string;
  family: 'grok' | 'llama' | 'cohere' | 'gemini' | 'openai';
  capabilities: {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    /** Whether the model supports reasoning/thinking traces */
    reasoning?: boolean;
  };
  contextWindow: number;
  speed: 'very-fast' | 'fast' | 'medium' | 'slow';
  /** Regions where this model is available (undefined = all regions) */
  regions?: OCIGenAIRegion[];
  /** Whether the model is only available on dedicated AI clusters */
  dedicatedOnly?: boolean;
  /** Recommended for coding agents (pre-selected in setup wizard) */
  codingRecommended?: boolean;
  /** Notes about coding suitability (e.g., "No tool support") */
  codingNote?: string;
}

// ============================================================================
// ProviderV3 Model-Specific Settings
// ============================================================================

/** Settings for language models. Currently identical to OCIConfig. */
export type OCILanguageModelSettings = OCIConfig;

/**
 * Settings for embedding models
 */
export interface OCIEmbeddingSettings extends OCIConfig {
  /** Embedding dimensions (384 for light, 1024 for standard) */
  dimensions?: 384 | 1024;
  /** How to truncate input text if it exceeds model limits */
  truncate?: 'START' | 'END' | 'NONE';
  /** Input type optimization for embeddings */
  inputType?: 'SEARCH_QUERY' | 'SEARCH_DOCUMENT' | 'CLASSIFICATION' | 'CLUSTERING' | 'IMAGE';
}

/**
 * Settings for speech models (TTS)
 */
export interface OCISpeechSettings extends OCIConfig {
  /** Voice ID */
  voice?: string;
  /** Speech speed multiplier (0.5 to 2.0) */
  speed?: number;
  /** Audio output format */
  format?: 'mp3' | 'wav' | 'pcm';
}

/**
 * Settings for transcription models (STT)
 */
export interface OCITranscriptionSettings extends OCIConfig {
  /** Language code (e.g., 'en', 'es', 'de') */
  language?: string;
  /** Transcription model to use (maps to OCI TranscriptionModelDetails.modelType) */
  model?: 'ORACLE' | 'WHISPER_MEDIUM' | 'WHISPER_LARGE_V2';
  /** Custom vocabulary words */
  vocabulary?: string[];
  /**
   * Object Storage bucket for audio uploads and transcription results storage.
   *
   * REQUIRED for transcription operations. The OCI Speech service uses Object Storage
   * to store both input audio files and the transcription result JSON files.
   *
   * @default 'oci-speech-transcription' if not specified
   *
   * @example
   * ```typescript
   * const settings = {
   *   transcriptionBucket: 'my-transcription-bucket',
   *   compartmentId: 'ocid1.compartment.oc1...',
   * };
   * const model = new OCITranscriptionModel('ORACLE', settings);
   * ```
   *
   * The bucket must:
   * - Already exist in your OCI Object Storage
   * - Have appropriate permissions configured for the authenticating principal
   * - Have sufficient space for audio files and result JSON files
   *
   * Result files are stored with prefix: `results-{timestamp}/{input_filename}.json`
   */
  transcriptionBucket?: string;
}

/**
 * Settings for reranking models
 */
export interface OCIRerankingSettings extends OCIConfig {
  /** Return only top N results */
  topN?: number;
  /** Include document text in response */
  returnDocuments?: boolean;
}

// Re-export OCIRealtimeSettings from the realtime module for convenience
export type { OCIRealtimeSettings } from './realtime/types';
