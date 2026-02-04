import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { OCIRealtimeTranscription } from '../OCIRealtimeTranscription';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  binaryType: 'blob' | 'arraybuffer' = 'blob';
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 10);
  }

  send = jest.fn((data: string | ArrayBuffer) => {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.event === 'AUTHENTICATE') {
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                event: 'CONNECT',
                sessionId: 'test-session-123',
              }),
            });
          }, 10);
        }
      } catch {
        // Binary data
      }
    }
  });

  close = jest.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? '' });
  });

  simulateResult(transcription: string, isFinal = true): void {
    this.onmessage?.({
      data: JSON.stringify({
        event: 'RESULT',
        transcriptions: [
          {
            transcription,
            isFinal,
            startTimeInMs: 0,
            endTimeInMs: 1000,
            confidence: 0.95,
            trailingSilence: 100,
            tokens: [
              {
                token: transcription,
                startTimeInMs: 0,
                endTimeInMs: 1000,
                confidence: 0.95,
              },
            ],
          },
        ],
      }),
    });
  }
}

// Mock OCI SDK
jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn(() => ({})),
  InstancePrincipalsAuthenticationDetailsProviderBuilder: jest.fn(() => ({
    build: jest.fn(() => Promise.resolve({})),
  })),
  ResourcePrincipalAuthenticationDetailsProvider: {
    builder: jest.fn(() => Promise.resolve({})),
  },
  ConfigFileReader: {
    DEFAULT_FILE_PATH: '~/.oci/config',
  },
}));

jest.mock('oci-aispeech', () => ({
  AIServiceSpeechClient: jest.fn(() => ({
    createRealtimeSessionToken: jest.fn(() =>
      Promise.resolve({
        realtimeSessionToken: {
          token: 'mock-jwt-token',
          sessionId: 'test-session-123',
          compartmentId: 'ocid1.compartment.test',
        },
      })
    ),
    set regionId(_regionId: string) {
      // Mock setter
    },
  })),
}));

// Install mock
const originalWebSocket = globalThis.WebSocket;
let mockWsInstance: MockWebSocket | null = null;

beforeEach(() => {
  mockWsInstance = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      mockWsInstance = this;
    }
  };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = originalWebSocket;
  jest.clearAllMocks();
});

describe('OCIRealtimeTranscription', () => {
  describe('constructor', () => {
    it('should create session with config', () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      expect(session.state).toBe('disconnected');
      expect(session.isConnected).toBe(false);
    });

    it('should merge config and settings', () => {
      const session = new OCIRealtimeTranscription(
        { region: 'us-phoenix-1' },
        { compartmentId: 'ocid1.compartment.test', language: 'es-ES' }
      );

      expect(session.state).toBe('disconnected');
    });
  });

  describe('connect()', () => {
    it('should connect to realtime service', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect();

      expect(session.state).toBe('connected');
      expect(session.isConnected).toBe(true);

      await session.close();
    });

    it('should emit connected event', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onConnected = jest.fn();
      session.on('connected', onConnected);

      await session.connect();

      expect(onConnected).toHaveBeenCalledWith('test-session-123');

      await session.close();
    });

    it('should support override settings', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect({ language: 'de-DE' });

      expect(session.isConnected).toBe(true);

      await session.close();
    });
  });

  describe('event-based API', () => {
    it('should emit partial events', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onPartial = jest.fn();
      session.on('partial', onPartial);

      await session.connect();

      mockWsInstance?.simulateResult('Hello', false);

      expect(onPartial).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello',
          isFinal: false,
        })
      );

      await session.close();
    });

    it('should emit final events', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onFinal = jest.fn();
      session.on('final', onFinal);

      await session.connect();

      mockWsInstance?.simulateResult('Hello, world!', true);

      expect(onFinal).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello, world!',
          isFinal: true,
          confidence: 0.95,
        })
      );

      await session.close();
    });

    it('should emit result event for final results', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onResult = jest.fn();
      session.on('result', onResult);

      await session.connect();

      mockWsInstance?.simulateResult('Test', true);

      expect(onResult).toHaveBeenCalled();

      await session.close();
    });

    it('should support chained on() calls', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const result = session
        .on('partial', jest.fn())
        .on('final', jest.fn())
        .on('connected', jest.fn());

      expect(result).toBe(session);

      await session.close();
    });

    it('should support off() for removing listeners', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onFinal = jest.fn();
      session.on('final', onFinal);
      session.off('final', onFinal);

      await session.connect();

      mockWsInstance?.simulateResult('Test', true);

      expect(onFinal).not.toHaveBeenCalled();

      await session.close();
    });
  });

  describe('sendAudio()', () => {
    it('should send audio data', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect();

      const audio = new Uint8Array([1, 2, 3, 4]);
      session.sendAudio(audio);

      expect(mockWsInstance?.send).toHaveBeenCalled();

      await session.close();
    });

    it('should track audio duration', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect();

      const audio = new Uint8Array(32000); // ~1 second at 16kHz
      session.sendAudio(audio, 1000);

      expect(session.sessionInfo.audioDurationMs).toBe(1000);

      await session.close();
    });

    it('should throw if not connected', () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const audio = new Uint8Array([1, 2, 3, 4]);

      expect(() => session.sendAudio(audio)).toThrow();
    });
  });

  describe('async iterator API', () => {
    it('should implement AsyncIterable', () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      expect(typeof session[Symbol.asyncIterator]).toBe('function');
    });

    it('should yield results via for-await-of', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect();

      // Simulate results in background
      setTimeout(() => {
        mockWsInstance?.simulateResult('First', false);
        mockWsInstance?.simulateResult('First result', true);
        setTimeout(() => session.close(false), 50);
      }, 10);

      const results: string[] = [];
      for await (const result of session) {
        results.push(result.text);
        if (results.length >= 2) break;
      }

      expect(results).toContain('First');
      expect(results).toContain('First result');
    });
  });

  describe('sessionInfo', () => {
    it('should provide session information', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect();

      const info = session.sessionInfo;

      expect(info.sessionId).toBe('test-session-123');
      expect(info.state).toBe('connected');
      expect(info.connectedAt).toBeInstanceOf(Date);
      expect(info.audioDurationMs).toBe(0);
      expect(info.resultCount).toBe(0);

      await session.close();
    });

    it('should track result count', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect();

      mockWsInstance?.simulateResult('One', true);
      mockWsInstance?.simulateResult('Two', true);

      expect(session.sessionInfo.resultCount).toBe(2);

      await session.close();
    });
  });

  describe('close()', () => {
    it('should close connection', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await session.connect();
      await session.close();

      expect(session.isConnected).toBe(false);
    });

    it('should emit disconnected event', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onDisconnected = jest.fn();
      session.on('disconnected', onDisconnected);

      await session.connect();
      await session.close();

      expect(onDisconnected).toHaveBeenCalledWith('Session closed');
    });
  });

  describe('normalized results', () => {
    it('should normalize OCI result format', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onFinal = jest.fn();
      session.on('final', onFinal);

      await session.connect();

      mockWsInstance?.simulateResult('Normalized', true);

      expect(onFinal).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Normalized',
          isFinal: true,
          confidence: expect.any(Number),
          startTimeMs: expect.any(Number),
          endTimeMs: expect.any(Number),
          trailingSilenceMs: expect.any(Number),
          tokens: expect.any(Array),
          sessionId: 'test-session-123',
          sequenceNumber: expect.any(Number),
        })
      );

      await session.close();
    });

    it('should include token information', async () => {
      const session = new OCIRealtimeTranscription({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onFinal = jest.fn();
      session.on('final', onFinal);

      await session.connect();

      mockWsInstance?.simulateResult('With tokens', true);

      const result = onFinal.mock.calls[0][0] as { tokens: Array<Record<string, unknown>> };
      expect(result.tokens).toBeInstanceOf(Array);
      expect(result.tokens[0]).toEqual(
        expect.objectContaining({
          token: expect.any(String),
          startTimeMs: expect.any(Number),
          endTimeMs: expect.any(Number),
          confidence: expect.any(Number),
        })
      );

      await session.close();
    });
  });
});
