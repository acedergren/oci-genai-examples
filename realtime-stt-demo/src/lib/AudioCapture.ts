/**
 * Browser Audio Capture
 *
 * Handles microphone capture using the Web Audio API and MediaRecorder.
 * Provides audio data in PCM format suitable for OCI realtime transcription.
 */

export interface AudioCaptureOptions {
  /** Sample rate (Hz). OCI supports 8000 or 16000. */
  sampleRate?: 8000 | 16000;
  /** Callback for audio data chunks */
  onAudioData?: (data: Uint8Array) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Callback for state changes */
  onStateChange?: (state: AudioCaptureState) => void;
}

export type AudioCaptureState = 'inactive' | 'requesting' | 'active' | 'error';

/**
 * Browser audio capture using MediaRecorder.
 *
 * @example
 * ```typescript
 * const capture = new AudioCapture({
 *   sampleRate: 16000,
 *   onAudioData: (data) => session.sendAudio(data),
 *   onError: (err) => console.error(err),
 * });
 *
 * await capture.start();
 * // ... recording ...
 * capture.stop();
 * ```
 */
export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private _state: AudioCaptureState = 'inactive';

  constructor(private options: AudioCaptureOptions = {}) {}

  get state(): AudioCaptureState {
    return this._state;
  }

  get isActive(): boolean {
    return this._state === 'active';
  }

  /**
   * Start capturing audio from the microphone.
   */
  async start(): Promise<void> {
    if (this._state === 'active') {
      return;
    }

    this.setState('requesting');

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.options.sampleRate ?? 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Create audio context
      const sampleRate = this.options.sampleRate ?? 16000;
      this.audioContext = new AudioContext({ sampleRate });

      // Create source from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Create processor node for raw audio data
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // AudioWorklet would be the modern replacement
      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (event) => {
        if (this._state !== 'active') return;

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convert Float32Array to 16-bit PCM
        const pcmData = this.float32ToPCM16(inputData);

        // Send to callback
        this.options.onAudioData?.(pcmData);
      };

      // Connect the audio graph
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.setState('active');
    } catch (error) {
      this.setState('error');
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onError?.(err);
      throw err;
    }
  }

  /**
   * Stop capturing audio.
   */
  stop(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.setState('inactive');
  }

  /**
   * Convert Float32 audio samples to 16-bit PCM.
   */
  private float32ToPCM16(float32Array: Float32Array): Uint8Array {
    const pcm16 = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and scale to 16-bit range
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    // Return as Uint8Array (raw bytes)
    return new Uint8Array(pcm16.buffer);
  }

  /**
   * Update state and notify listener.
   */
  private setState(state: AudioCaptureState): void {
    if (this._state !== state) {
      this._state = state;
      this.options.onStateChange?.(state);
    }
  }
}

/**
 * Check if the browser supports audio capture.
 */
export function isAudioCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof AudioContext !== 'undefined'
  );
}
