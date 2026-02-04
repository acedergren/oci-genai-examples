/**
 * OCI Realtime Speech Module
 *
 * Provides real-time speech-to-text transcription using OCI's
 * WebSocket-based realtime speech service.
 *
 * @example Event-based API
 * ```typescript
 * import { OCIRealtimeTranscription } from '@acedergren/oci-genai-provider';
 *
 * const session = new OCIRealtimeTranscription({
 *   region: 'us-phoenix-1',
 *   compartmentId: 'ocid1.compartment...',
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
 * import { OCIRealtimeTranscription } from '@acedergren/oci-genai-provider';
 *
 * const session = new OCIRealtimeTranscription(config);
 *
 * for await (const result of session.transcribe(audioStream)) {
 *   console.log(result.isFinal ? 'FINAL:' : 'PARTIAL:', result.text);
 * }
 * ```
 *
 * @example Via Provider
 * ```typescript
 * import { oci } from '@acedergren/oci-genai-provider';
 *
 * const session = oci.realtimeTranscription({
 *   language: 'en-US',
 *   model: 'ORACLE',
 * });
 *
 * await session.connect();
 * ```
 */

// ============================================================================
// Main Classes
// ============================================================================

export { OCIRealtimeTranscription } from './OCIRealtimeTranscription';
export { OCIRealtimeClient, type RealtimeClientEvents } from './OCIRealtimeClient';
export {
  WebSocketAdapter,
  WebSocketReadyState,
  type WebSocketAdapterEvents,
  type WebSocketAdapterOptions,
} from './WebSocketAdapter';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type {
  // Settings
  OCIRealtimeSettings,
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
  AudioAckDetails,

  // Connection State
  RealtimeConnectionState,
  RealtimeSessionInfo,

  // Errors
  RealtimeErrorCode,
  RealtimeError,

  // Internal Message Types (for advanced usage)
  RealtimeMessageBase,
  RealtimeAuthMessage,
  RealtimeConnectMessage,
  RealtimeResultMessage,
  RealtimeAckMessage,
  RealtimeErrorMessage,
  RealtimeSendFinalMessage,
  RealtimeServerMessage,
} from './types';
