import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WebSocketAdapter, WebSocketReadyState } from '../WebSocketAdapter';

// Mock WebSocket for testing
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
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 10);
  }

  send = jest.fn();
  close = jest.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? '' });
  });

  // Helper to simulate receiving a message
  simulateMessage(data: string | ArrayBuffer): void {
    this.onmessage?.({ data });
  }

  // Helper to simulate an error
  simulateError(): void {
    this.onerror?.(new Event('error'));
  }
}

// Install mock
const originalWebSocket = globalThis.WebSocket;
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = MockWebSocket;
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = originalWebSocket;
});

describe('WebSocketAdapter', () => {
  describe('constructor', () => {
    it('should create adapter instance without auto-connecting', () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      // Should not be connecting yet (explicit connect() required)
      expect(ws.isClosed).toBe(true);

      ws.close();
    });

    it('should accept connection options', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws', {
        connectionTimeoutMs: 5000,
      });

      await ws.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(ws.isOpen).toBe(true);
      ws.close();
    });
  });

  describe('readyState', () => {
    it('should report CLOSED initially (before connect)', () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      expect(ws.readyState).toBe(WebSocketReadyState.CLOSED);
      ws.close();
    });

    it('should report OPEN after connection', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await ws.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(ws.readyState).toBe(WebSocketReadyState.OPEN);
      ws.close();
    });

    it('should report CLOSED after close', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await ws.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));

      ws.close();

      expect(ws.readyState).toBe(WebSocketReadyState.CLOSED);
    });
  });

  describe('convenience properties', () => {
    it('should have isConnecting property', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      // Before connect, should be closed
      expect(ws.isConnecting).toBe(false);

      // Start connection
      const connectPromise = ws.connect();

      // Should be connecting now
      expect(ws.isConnecting).toBe(true);

      await connectPromise;
      ws.close();
    });

    it('should have isOpen property', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await ws.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(ws.isOpen).toBe(true);
      ws.close();
    });

    it('should have isClosed property', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      ws.close();

      expect(ws.isClosed).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should emit open event when connected', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      const onOpen = jest.fn();
      ws.on('open', onOpen);

      await ws.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(onOpen).toHaveBeenCalled();
      ws.close();
    });

    it('should emit close event when closed', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      const onClose = jest.fn();
      ws.on('close', onClose);

      await new Promise((resolve) => setTimeout(resolve, 20));

      ws.close(1000, 'Normal closure');

      expect(onClose).toHaveBeenCalledWith(1000, expect.any(String));
    });

    it('should emit message event when receiving data', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      const onMessage = jest.fn();
      ws.on('message', onMessage);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the underlying mock and simulate a message
      const mockWs = (ws as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateMessage('test message');

      expect(onMessage).toHaveBeenCalledWith('test message');
      ws.close();
    });

    it('should emit error event on WebSocket error', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      const onError = jest.fn();
      ws.on('error', onError);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Simulate error
      const mockWs = (ws as unknown as { ws: MockWebSocket }).ws;
      mockWs.simulateError();

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      ws.close();
    });

    it('should support removing event listeners', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      const onOpen = jest.fn();
      ws.on('open', onOpen);
      ws.off('open', onOpen);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(onOpen).not.toHaveBeenCalled();
      ws.close();
    });
  });

  describe('send()', () => {
    it('should send string data', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await new Promise((resolve) => setTimeout(resolve, 20));

      ws.send('Hello, server!');

      const mockWs = (ws as unknown as { ws: MockWebSocket }).ws;
      expect(mockWs.send).toHaveBeenCalledWith('Hello, server!');
      ws.close();
    });

    it('should send ArrayBuffer data', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await new Promise((resolve) => setTimeout(resolve, 20));

      const buffer = new ArrayBuffer(8);
      ws.send(buffer);

      const mockWs = (ws as unknown as { ws: MockWebSocket }).ws;
      expect(mockWs.send).toHaveBeenCalledWith(buffer);
      ws.close();
    });

    it('should send Uint8Array data', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await new Promise((resolve) => setTimeout(resolve, 20));

      const data = new Uint8Array([1, 2, 3, 4]);
      ws.send(data);

      const mockWs = (ws as unknown as { ws: MockWebSocket }).ws;
      expect(mockWs.send).toHaveBeenCalled();
      ws.close();
    });

    it('should throw error if not connected', () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      ws.close();

      expect(() => ws.send('test')).toThrow('WebSocket is not connected');
    });
  });

  describe('close()', () => {
    it('should close with default code and reason', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await new Promise((resolve) => setTimeout(resolve, 20));

      ws.close();

      expect(ws.isClosed).toBe(true);
    });

    it('should close with custom code and reason', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');
      const onClose = jest.fn();
      ws.on('close', onClose);

      await new Promise((resolve) => setTimeout(resolve, 20));

      ws.close(1001, 'Going away');

      expect(onClose).toHaveBeenCalledWith(1001, expect.any(String));
    });

    it('should be safe to call multiple times', async () => {
      const ws = new WebSocketAdapter('wss://example.com/ws');

      await new Promise((resolve) => setTimeout(resolve, 20));

      ws.close();
      ws.close();
      ws.close();

      expect(ws.isClosed).toBe(true);
    });
  });
});

describe('WebSocketReadyState', () => {
  it('should have correct values', () => {
    expect(WebSocketReadyState.CONNECTING).toBe(0);
    expect(WebSocketReadyState.OPEN).toBe(1);
    expect(WebSocketReadyState.CLOSING).toBe(2);
    expect(WebSocketReadyState.CLOSED).toBe(3);
  });
});
