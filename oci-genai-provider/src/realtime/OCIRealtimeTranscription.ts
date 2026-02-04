/**
 * OCI Realtime Transcription Session
 *
 * High-level API for real-time speech transcription using OCI's
 * WebSocket-based realtime speech service.
 *
 * Supports both event-based and async iterator patterns.
 */

import { OCIRealtimeClient } from './OCIRealtimeClient';
import {
  RealtimeError,
  type OCIRealtimeSettings,
  type RealtimeTranscriptionResult,
  type RealtimeTranscriptionEvents,
  type RealtimeConnectionState,
  type RealtimeSessionInfo,
  type RealtimeResultMessage,
  type TranscriptionToken,
  type RealtimeErrorCode,
} from './types';
import type { OCIConfig } from '../types';

/**
 * Create a RealtimeError with proper typing.
 */
function createRealtimeError(
  message: string,
  code: RealtimeErrorCode,
  cause?: Error
): RealtimeError {
  return new RealtimeError(message, code, cause);
}

/**
 * Convert OCI transcription result to our normalized format.
 */
function normalizeTranscriptionResult(
  ociResult: RealtimeResultMessage['transcriptions'][0],
  sessionId?: string,
  sequenceNumber?: number
): RealtimeTranscriptionResult {
  return {
    text: ociResult.transcription,
    isFinal: ociResult.isFinal,
    confidence: ociResult.confidence,
    startTimeMs: ociResult.startTimeInMs,
    endTimeMs: ociResult.endTimeInMs,
    trailingSilenceMs: ociResult.trailingSilence,
    tokens: ociResult.tokens.map(
      (t): TranscriptionToken => ({
        token: t.token,
        startTimeMs: t.startTimeInMs,
        endTimeMs: t.endTimeInMs,
        confidence: t.confidence,
        type: t.type,
      })
    ),
    sessionId,
    sequenceNumber,
  };
}

/**
 * OCI Realtime Transcription Session
 *
 * Provides a high-level API for real-time speech-to-text transcription.
 * Supports both event-based and async iterator patterns for flexibility.
 *
 * @example Event-based API
 * ```typescript
 * const session = new OCIRealtimeTranscription({
 *   region: 'us-phoenix-1',
 *   compartmentId: 'ocid1.compartment...',
 * });
 *
 * session.on('partial', (result) => {
 *   console.log('Partial:', result.text);
 * });
 *
 * session.on('final', (result) => {
 *   console.log('Final:', result.text);
 * });
 *
 * await session.connect();
 * session.sendAudio(audioChunk);
 * await session.close();
 * ```
 *
 * @example Async Iterator API
 * ```typescript
 * const session = new OCIRealtimeTranscription(config);
 * await session.connect();
 *
 * // Stream audio from microphone or file
 * streamAudioTo(session);
 *
 * // Process results as they arrive
 * for await (const result of session) {
 *   console.log(result.isFinal ? 'FINAL:' : 'PARTIAL:', result.text);
 * }
 * ```
 *
 * @example With transcribe() helper
 * ```typescript
 * const session = new OCIRealtimeTranscription(config);
 *
 * for await (const result of session.transcribe(audioStream)) {
 *   console.log(result.text);
 * }
 * ```
 */
export class OCIRealtimeTranscription implements AsyncIterable<RealtimeTranscriptionResult> {
  private client: OCIRealtimeClient;
  private settings: OCIRealtimeSettings;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private resultQueue: RealtimeTranscriptionResult[] = [];
  private resultResolvers: Array<{
    resolve: (value: IteratorResult<RealtimeTranscriptionResult>) => void;
    reject: (error: Error) => void;
  }> = [];
  private iteratorDone = false;
  private resultSequence = 0;
  private audioDurationMs = 0;
  private resultCount = 0;
  private connectedAt: Date | null = null;
  private storedError: Error | null = null;

  /**
   * Create a new realtime transcription session.
   *
   * @param config - Base OCI configuration
   * @param settings - Realtime-specific settings (merged with config)
   */
  constructor(config: OCIConfig, settings: OCIRealtimeSettings = {}) {
    this.settings = { ...config, ...settings };
    this.client = new OCIRealtimeClient(config);
    this.setupClientHandlers();
  }

  /**
   * Get the current connection state.
   */
  get state(): RealtimeConnectionState {
    return this.client.state;
  }

  /**
   * Check if the session is connected and ready.
   */
  get isConnected(): boolean {
    return this.client.isConnected;
  }

  /**
   * Get session information.
   */
  get sessionInfo(): RealtimeSessionInfo {
    return {
      sessionId: this.client.currentSessionId ?? '',
      compartmentId: this.settings.compartmentId ?? '',
      state: this.state,
      connectedAt: this.connectedAt ?? undefined,
      audioDurationMs: this.audioDurationMs,
      resultCount: this.resultCount,
    };
  }

  /**
   * Register an event listener.
   *
   * @param event - Event name
   * @param callback - Callback function
   */
  on<K extends keyof RealtimeTranscriptionEvents>(
    event: K,
    callback: RealtimeTranscriptionEvents[K]
  ): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Remove an event listener.
   *
   * @param event - Event name
   * @param callback - Callback function
   */
  off<K extends keyof RealtimeTranscriptionEvents>(
    event: K,
    callback: RealtimeTranscriptionEvents[K]
  ): this {
    this.listeners.get(event)?.delete(callback as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Connect to the realtime transcription service.
   *
   * @param settings - Optional settings to override the constructor settings
   */
  async connect(settings?: Partial<OCIRealtimeSettings>): Promise<void> {
    const mergedSettings = { ...this.settings, ...settings };
    this.settings = mergedSettings;

    try {
      await this.client.connect(mergedSettings);
      this.connectedAt = new Date();
      this.emit('connected', this.client.currentSessionId ?? '');
    } catch (error) {
      const realtimeError = createRealtimeError(
        'Failed to connect to realtime service',
        'CONNECTION_FAILED',
        error instanceof Error ? error : undefined
      );
      this.emit('error', realtimeError);
      throw realtimeError;
    }
  }

  /**
   * Send audio data to the transcription service.
   *
   * @param audio - Audio data as Uint8Array, ArrayBuffer, or Buffer
   * @param durationMs - Optional duration in milliseconds for tracking
   */
  sendAudio(audio: Uint8Array | ArrayBuffer, durationMs?: number): void {
    if (!this.isConnected) {
      throw createRealtimeError('Not connected to realtime service', 'CONNECTION_FAILED');
    }

    this.client.sendAudio(audio);

    // Track audio duration for session info
    if (durationMs !== undefined) {
      this.audioDurationMs += durationMs;
    } else {
      // Estimate based on 16kHz 16-bit mono audio (default encoding)
      const byteLength = audio instanceof ArrayBuffer ? audio.byteLength : audio.byteLength;
      this.audioDurationMs += (byteLength / 32000) * 1000; // 16kHz * 2 bytes = 32000 bytes/sec
    }
  }

  /**
   * Request final transcription results.
   * Call this when you've finished sending audio.
   */
  async requestFinalResult(): Promise<void> {
    await this.client.requestFinalResult();
  }

  /**
   * Close the transcription session.
   *
   * @param waitForFinal - Wait for final results before closing (default: true)
   * @param finalTimeoutMs - Maximum time to wait for final result (default: 5000ms)
   */
  async close(waitForFinal = true, finalTimeoutMs = 5000): Promise<void> {
    if (waitForFinal && this.isConnected) {
      // Request final result and wait for the 'final' event or timeout
      await this.requestFinalResult();

      // Wait for actual 'final' event with timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          const handler = () => {
            this.off('final', handler);
            resolve();
          };
          this.on('final', handler);
        }),
        new Promise<void>((resolve) => setTimeout(resolve, finalTimeoutMs)),
      ]);
    }

    await this.client.close();
    this.markIteratorDone();
    this.emit('disconnected', 'Session closed');
  }

  /**
   * Transcribe an audio stream using the async iterator pattern.
   *
   * This method handles connecting, streaming audio, and closing.
   *
   * @param audioSource - Async iterable of audio chunks
   * @param settings - Optional settings override
   * @yields Transcription results as they arrive
   *
   * @example
   * ```typescript
   * async function* getAudioChunks() {
   *   // Yield audio chunks from microphone, file, etc.
   *   yield new Uint8Array([...]);
   * }
   *
   * for await (const result of session.transcribe(getAudioChunks())) {
   *   console.log(result.text);
   * }
   * ```
   */
  async *transcribe(
    audioSource: AsyncIterable<Uint8Array | ArrayBuffer>,
    settings?: Partial<OCIRealtimeSettings>
  ): AsyncGenerator<RealtimeTranscriptionResult> {
    // Connect if not already connected
    if (!this.isConnected) {
      await this.connect(settings);
    }

    // Start consuming audio in the background
    const audioPromise = this.consumeAudioSource(audioSource);

    // Yield results as they arrive
    try {
      for await (const result of this) {
        yield result;
      }
    } finally {
      // Ensure audio consumption is complete
      await audioPromise;
    }
  }

  /**
   * Implement AsyncIterable for for-await-of support.
   */
  [Symbol.asyncIterator](): AsyncIterator<RealtimeTranscriptionResult> {
    return {
      next: () => this.nextResult(),
    };
  }

  /**
   * Get the next transcription result.
   * Used internally by the async iterator.
   */
  private nextResult(): Promise<IteratorResult<RealtimeTranscriptionResult>> {
    // Check if there's a stored error and propagate it
    if (this.storedError) {
      return Promise.reject(this.storedError);
    }

    // Check if we have queued results
    if (this.resultQueue.length > 0) {
      const result = this.resultQueue.shift()!;
      return Promise.resolve({ value: result, done: false });
    }

    // Check if iteration is complete
    if (this.iteratorDone) {
      return Promise.resolve({ value: undefined as never, done: true });
    }

    // Wait for the next result
    return new Promise((resolve, reject) => {
      this.resultResolvers.push({ resolve, reject });
    });
  }

  /**
   * Add a result to the queue or resolve a waiting promise.
   */
  private enqueueResult(result: RealtimeTranscriptionResult): void {
    if (this.resultResolvers.length > 0) {
      const { resolve } = this.resultResolvers.shift()!;
      resolve({ value: result, done: false });
    } else {
      this.resultQueue.push(result);
    }
  }

  /**
   * Mark the iterator as done and resolve any waiting promises.
   */
  private markIteratorDone(): void {
    this.iteratorDone = true;
    while (this.resultResolvers.length > 0) {
      const { resolve } = this.resultResolvers.shift()!;
      resolve({ value: undefined as never, done: true });
    }
  }

  /**
   * Consume audio from an async iterable source.
   */
  private async consumeAudioSource(
    audioSource: AsyncIterable<Uint8Array | ArrayBuffer>
  ): Promise<void> {
    try {
      for await (const chunk of audioSource) {
        if (!this.isConnected) {
          break;
        }
        this.sendAudio(chunk);
      }

      // Request final result when audio source is exhausted
      if (this.isConnected) {
        await this.requestFinalResult();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.storedError = err;

      // Reject any waiting resolvers
      while (this.resultResolvers.length > 0) {
        const { reject } = this.resultResolvers.shift()!;
        reject(err);
      }

      this.emit('error', err);
    }
  }

  /**
   * Set up event handlers for the underlying client.
   */
  private setupClientHandlers(): void {
    this.client.on('message', (message) => {
      if (message.event === 'RESULT') {
        this.handleResultMessage(message);
      } else if (message.event === 'ACKAUDIO') {
        this.emit('audioAck', {
          frameCount:
            (message as { audioDetails?: { frameCount?: number } }).audioDetails?.frameCount ?? 0,
          timestamp: Date.now(),
        });
      }
    });

    this.client.on('stateChange', (state) => {
      if (state === 'reconnecting') {
        this.emit('reconnecting', 1, this.settings.maxReconnectAttempts ?? 3);
      }
    });

    this.client.on('error', (error) => {
      this.emit('error', error);
    });

    this.client.on('closed', (code, reason) => {
      this.markIteratorDone();
      if (code !== 1000) {
        this.emit('disconnected', reason || 'Connection lost');
      }
    });
  }

  /**
   * Handle transcription result messages.
   */
  private handleResultMessage(message: RealtimeResultMessage): void {
    for (const transcription of message.transcriptions) {
      this.resultSequence++;
      this.resultCount++;

      const result = normalizeTranscriptionResult(
        transcription,
        this.client.currentSessionId ?? undefined,
        this.resultSequence
      );

      // Emit appropriate events
      if (result.isFinal) {
        this.emit('final', result);
        this.emit('result', result);
      } else {
        this.emit('partial', result);
      }

      // Add to iterator queue
      this.enqueueResult(result);
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit<K extends keyof RealtimeTranscriptionEvents>(
    event: K,
    ...args: Parameters<RealtimeTranscriptionEvents[K]>
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(...args);
        } catch (error) {
          // Use separate arguments for safe logging
          console.error('Error in transcription handler:', event, error);
        }
      }
    }
  }
}
