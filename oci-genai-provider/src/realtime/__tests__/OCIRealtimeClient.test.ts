import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { OCIRealtimeClient } from '../OCIRealtimeClient';

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
    // Simulate CONNECT response after AUTH message
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
        // Not JSON, likely binary audio data
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
            tokens: [],
          },
        ],
      }),
    });
  }

  simulateError(code: string, message: string): void {
    this.onmessage?.({
      data: JSON.stringify({
        event: 'ERROR',
        code,
        message,
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

describe('OCIRealtimeClient', () => {
  describe('constructor', () => {
    it('should create client with config', () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      expect(client.state).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });
  });

  describe('connect()', () => {
    it('should connect to realtime service', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await client.connect();

      expect(client.state).toBe('connected');
      expect(client.isConnected).toBe(true);
      expect(client.currentSessionId).toBe('test-session-123');

      await client.close();
    });

    it('should emit state changes during connection', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const states: string[] = [];
      client.on('stateChange', (state) => states.push(state));

      await client.connect();

      expect(states).toContain('connecting');
      expect(states).toContain('authenticating');
      expect(states).toContain('connected');

      await client.close();
    });

    it('should emit authenticated event with session ID', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onAuthenticated = jest.fn();
      client.on('authenticated', onAuthenticated);

      await client.connect();

      expect(onAuthenticated).toHaveBeenCalledWith('test-session-123');

      await client.close();
    });

    it('should throw error if already connected', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await client.connect();

      await expect(client.connect()).rejects.toThrow('Already connected');

      await client.close();
    });

    it('should throw error if compartmentId is missing', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
      });

      await expect(client.connect()).rejects.toThrow('compartmentId is required');
    });

    it('should connect to correct regional endpoint', async () => {
      const client = new OCIRealtimeClient({
        region: 'eu-frankfurt-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await client.connect();

      expect(mockWsInstance?.url).toContain('eu-frankfurt-1');

      await client.close();
    });
  });

  describe('sendAudio()', () => {
    it('should send audio data to WebSocket', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await client.connect();

      const audioData = new Uint8Array([1, 2, 3, 4]);
      client.sendAudio(audioData);

      expect(mockWsInstance?.send).toHaveBeenCalled();

      await client.close();
    });

    it('should throw error if not connected', () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const audioData = new Uint8Array([1, 2, 3, 4]);
      expect(() => client.sendAudio(audioData)).toThrow('Not connected');
    });
  });

  describe('message handling', () => {
    it('should emit RESULT messages', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onMessage = jest.fn();
      client.on('message', onMessage);

      await client.connect();

      mockWsInstance?.simulateResult('Hello, world!', true);

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RESULT',
          transcriptions: expect.any(Array),
        })
      );

      await client.close();
    });

    it('should emit error for ERROR messages', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onError = jest.fn();
      client.on('error', onError);

      await client.connect();

      mockWsInstance?.simulateError('INVALID_AUDIO', 'Audio format not supported');

      expect(onError).toHaveBeenCalledWith(expect.any(Error));

      await client.close();
    });
  });

  describe('close()', () => {
    it('should close connection', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      await client.connect();
      await client.close();

      expect(client.state).toBe('closed');
      expect(client.isConnected).toBe(false);
    });

    it('should emit closed event', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onClosed = jest.fn();
      client.on('closed', onClosed);

      await client.connect();
      await client.close();

      expect(onClosed).toHaveBeenCalledWith(1000, expect.any(String));
    });
  });

  describe('event handling', () => {
    it('should support on/off pattern', async () => {
      const client = new OCIRealtimeClient({
        region: 'us-phoenix-1',
        compartmentId: 'ocid1.compartment.test',
      });

      const onStateChange = jest.fn();
      client.on('stateChange', onStateChange);
      client.off('stateChange', onStateChange);

      await client.connect();

      // Should not have been called after removal
      expect(onStateChange).not.toHaveBeenCalled();

      await client.close();
    });
  });
});
