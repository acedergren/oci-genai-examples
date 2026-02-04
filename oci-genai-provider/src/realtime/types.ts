/**
 * OCI Realtime Speech Types
 *
 * TypeScript interfaces for real-time speech transcription using OCI's
 * WebSocket-based realtime speech service.
 */

import type { OCIConfig } from '../types';

// ============================================================================
// Audio Configuration
// ============================================================================

/**
 * Supported audio encodings for realtime transcription.
 * Maps to OCI's RealtimeParameters.encoding options.
 */
export type RealtimeAudioEncoding =
  | 'audio/raw;rate=16000' // 16kHz PCM (default, recommended)
  | 'audio/raw;rate=8000' // 8kHz PCM
  | 'audio/raw;rate=8000;codec=mulaw' // 8kHz µ-law
  | 'audio/raw;rate=8000;codec=alaw'; // 8kHz A-law

/**
 * Stability level for partial transcription results.
 * Higher stability means more confident partial results but slower updates.
 */
export type PartialResultStability = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Model domain for specialized transcription contexts.
 */
export type RealtimeModelDomain = 'GENERIC' | 'MEDICAL';

/**
 * Punctuation mode for transcription output.
 */
export type RealtimePunctuation = 'NONE' | 'SPOKEN' | 'AUTO';

/**
 * Model types available for realtime transcription.
 */
export type RealtimeModelType = 'ORACLE' | 'WHISPER';

// ============================================================================
// Settings and Configuration
// ============================================================================

/**
 * Settings for realtime transcription sessions.
 * Extends OCIConfig with realtime-specific options.
 */
export interface OCIRealtimeSettings extends OCIConfig {
  /**
   * Audio encoding format.
   * @default 'audio/raw;rate=16000'
   */
  encoding?: RealtimeAudioEncoding;

  /**
   * Language code for transcription.
   * - Oracle model: locale-specific (e.g., 'en-US', 'es-ES', 'de-DE')
   * - Whisper model: language-only (e.g., 'en', 'es', 'de', or 'auto' for detection)
   * @default 'en-US'
   */
  language?: string;

  /**
   * Transcription model to use.
   * @default 'ORACLE'
   */
  model?: RealtimeModelType;

  /**
   * Model domain for specialized contexts.
   * @default 'GENERIC'
   */
  modelDomain?: RealtimeModelDomain;

  /**
   * Enable partial (interim) transcription results.
   * When enabled, you receive incremental results as speech is processed.
   * @default true
   */
  partialResults?: boolean;

  /**
   * Stability level for partial results.
   * Higher stability = more confident but slower partial updates.
   * Only supported for Oracle model.
   * @default 'MEDIUM'
   */
  partialResultStability?: PartialResultStability;

  /**
   * Silence threshold for partial results (milliseconds).
   * Only supported for Oracle model.
   */
  partialSilenceThresholdMs?: number;

  /**
   * Silence threshold for final results (milliseconds).
   * Only supported for Oracle model.
   */
  finalSilenceThresholdMs?: number;

  /**
   * Enable acknowledgment messages for audio chunks.
   * @default false
   */
  ackEnabled?: boolean;

  /**
   * Punctuation mode for transcription output.
   * @default 'AUTO'
   */
  punctuation?: RealtimePunctuation;

  /**
   * Custom vocabulary words to improve recognition.
   * Only supported for Oracle model with customizations.
   */
  customizations?: Array<{
    customizationId: string;
    weight?: number;
  }>;

  /**
   * Ignore invalid customizations instead of failing.
   * @default true
   */
  ignoreInvalidCustomizations?: boolean;

  /**
   * WebSocket connection timeout (milliseconds).
   * @default 30000
   */
  connectionTimeoutMs?: number;

  /**
   * Enable automatic reconnection on connection loss.
   * @default true
   */
  autoReconnect?: boolean;

  /**
   * Maximum reconnection attempts.
   * @default 3
   */
  maxReconnectAttempts?: number;
}

// ============================================================================
// Transcription Results
// ============================================================================

/**
 * Individual word/token from transcription with timing info.
 */
export interface TranscriptionToken {
  /** The transcribed word or punctuation */
  token: string;
  /** Start time in milliseconds */
  startTimeMs: number;
  /** End time in milliseconds */
  endTimeMs: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Token type (word, punctuation, etc.) */
  type?: string;
}

/**
 * A single transcription result (partial or final).
 */
export interface RealtimeTranscriptionResult {
  /** Transcribed text */
  text: string;
  /** Whether this is a final (complete) result or partial (interim) */
  isFinal: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Start time in milliseconds */
  startTimeMs: number;
  /** End time in milliseconds */
  endTimeMs: number;
  /** Trailing silence in milliseconds */
  trailingSilenceMs: number;
  /** Individual tokens with timing */
  tokens: TranscriptionToken[];
  /** Session ID for tracking */
  sessionId?: string;
  /** Result sequence number */
  sequenceNumber?: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the realtime transcription session.
 */
export interface RealtimeTranscriptionEvents {
  /** Emitted when a partial (interim) transcription is received */
  partial: (result: RealtimeTranscriptionResult) => void;
  /** Emitted when a final transcription is received */
  final: (result: RealtimeTranscriptionResult) => void;
  /** Alias for 'final' - matches AI SDK pattern */
  result: (result: RealtimeTranscriptionResult) => void;
  /** Emitted when WebSocket connection is established */
  connected: (sessionId: string) => void;
  /** Emitted when connection is closed */
  disconnected: (reason?: string) => void;
  /** Emitted when an error occurs */
  error: (error: Error) => void;
  /** Emitted when audio acknowledgment is received (if ackEnabled) */
  audioAck: (details: AudioAckDetails) => void;
  /** Emitted when attempting to reconnect */
  reconnecting: (attempt: number, maxAttempts: number) => void;
}

/**
 * Audio acknowledgment details.
 */
export interface AudioAckDetails {
  /** Number of audio frames acknowledged */
  frameCount: number;
  /** Timestamp of acknowledgment */
  timestamp: number;
}

// ============================================================================
// Connection State
// ============================================================================

/**
 * Current state of the realtime connection.
 */
export type RealtimeConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed';

/**
 * Session information for an active realtime transcription.
 */
export interface RealtimeSessionInfo {
  /** OCI session ID */
  sessionId: string;
  /** Compartment OCID */
  compartmentId: string;
  /** Connection state */
  state: RealtimeConnectionState;
  /** Connection establishment time */
  connectedAt?: Date;
  /** Total audio duration sent (ms) */
  audioDurationMs: number;
  /** Number of results received */
  resultCount: number;
}

// ============================================================================
// WebSocket Messages (Internal)
// ============================================================================

/**
 * Base WebSocket message structure.
 */
export interface RealtimeMessageBase {
  event: string;
  sessionId?: string;
}

/**
 * Authentication message sent to initiate session.
 */
export interface RealtimeAuthMessage extends RealtimeMessageBase {
  event: 'AUTHENTICATE';
  authenticationType: 'TOKEN';
  token: string;
  realtimeModelDetails?: {
    domain?: RealtimeModelDomain;
    languageCode?: string;
  };
  customizations?: Array<{
    customizationId: string;
    weight?: number;
  }>;
  parameters?: {
    encoding?: string;
    isAckEnabled?: boolean;
    partialSilenceThresholdInMs?: number;
    finalSilenceThresholdInMs?: number;
    stabilizePartialResults?: PartialResultStability;
    modelType?: RealtimeModelType;
    modelDomain?: RealtimeModelDomain;
    languageCode?: string;
    punctuation?: RealtimePunctuation;
  };
}

/**
 * Connection acknowledgment from server.
 */
export interface RealtimeConnectMessage extends RealtimeMessageBase {
  event: 'CONNECT';
  sessionId: string;
}

/**
 * Transcription result message from server.
 */
export interface RealtimeResultMessage extends RealtimeMessageBase {
  event: 'RESULT';
  transcriptions: Array<{
    transcription: string;
    isFinal: boolean;
    startTimeInMs: number;
    endTimeInMs: number;
    confidence: number;
    trailingSilence: number;
    tokens: Array<{
      token: string;
      startTimeInMs: number;
      endTimeInMs: number;
      confidence: number;
      type?: string;
    }>;
  }>;
}

/**
 * Audio acknowledgment message from server.
 */
export interface RealtimeAckMessage extends RealtimeMessageBase {
  event: 'ACKAUDIO';
  audioDetails: {
    frameCount: number;
  };
}

/**
 * Error message from server.
 */
export interface RealtimeErrorMessage extends RealtimeMessageBase {
  event: 'ERROR';
  code: string;
  message: string;
}

/**
 * Request for final results before closing.
 */
export interface RealtimeSendFinalMessage extends RealtimeMessageBase {
  event: 'SEND_FINAL_RESULT';
}

/**
 * Union of all possible server messages.
 */
export type RealtimeServerMessage =
  | RealtimeConnectMessage
  | RealtimeResultMessage
  | RealtimeAckMessage
  | RealtimeErrorMessage;

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes specific to realtime transcription.
 */
export type RealtimeErrorCode =
  | 'CONNECTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'CONNECTION_LOST'
  | 'RECONNECTION_FAILED'
  | 'INVALID_AUDIO'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

/**
 * Custom error for realtime transcription failures.
 */
export class RealtimeError extends Error {
  constructor(
    message: string,
    public readonly code: RealtimeErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RealtimeError';
  }
}
