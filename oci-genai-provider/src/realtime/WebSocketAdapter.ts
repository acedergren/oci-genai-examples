/**
 * Cross-Platform WebSocket Adapter
 *
 * Provides a unified WebSocket interface that works in both Node.js and browser
 * environments. Uses the native WebSocket API which is available in:
 * - All modern browsers
 * - Node.js 18+ (global WebSocket)
 * - Deno, Bun, and other modern runtimes
 */

/**
 * WebSocket ready state constants.
 * Matches the native WebSocket.readyState values.
 */
export const WebSocketReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

export type WebSocketReadyState = (typeof WebSocketReadyState)[keyof typeof WebSocketReadyState];

/**
 * Events emitted by the WebSocket adapter.
 */
export interface WebSocketAdapterEvents {
  open: () => void;
  message: (data: string | ArrayBuffer) => void;
  close: (code: number, reason: string) => void;
  error: (error: Error) => void;
}

/**
 * Options for creating a WebSocket connection.
 */
export interface WebSocketAdapterOptions {
  /** Connection timeout in milliseconds */
  connectionTimeoutMs?: number;
  /** Custom headers for the WebSocket handshake (Node.js only) */
  headers?: Record<string, string>;
}

/**
 * Type guard to check if we're in a Node.js environment with 'ws' package.
 * This handles the case where native WebSocket isn't available.
 */
function isNodeWithoutNativeWS(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions?.node !== undefined &&
    typeof globalThis.WebSocket === 'undefined'
  );
}

/**
 * Cross-platform WebSocket adapter.
 *
 * This adapter provides a consistent interface regardless of the environment:
 * - In browsers: Uses native WebSocket
 * - In Node.js 18+: Uses native global WebSocket
 * - In older Node.js: Falls back to 'ws' package if available
 *
 * @example
 * ```typescript
 * const ws = new WebSocketAdapter('wss://example.com/ws');
 *
 * ws.on('open', () => console.log('Connected!'));
 * ws.on('message', (data) => console.log('Received:', data));
 * ws.on('error', (err) => console.error('Error:', err));
 * ws.on('close', (code, reason) => console.log('Closed:', code, reason));
 *
 * // Send text
 * ws.send('Hello, server!');
 *
 * // Send binary
 * ws.send(new Uint8Array([1, 2, 3]));
 *
 * // Close connection
 * ws.close();
 * ```
 */
export class WebSocketAdapter {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private _readyState: WebSocketReadyState = WebSocketReadyState.CONNECTING;

  /**
   * Create a new WebSocket adapter instance.
   *
   * Important: Call connect() after attaching event listeners to avoid
   * missing events that fire during connection establishment.
   *
   * @param url - Secure WebSocket URL (wss://)
   * @param options - Connection options
   *
   * @example
   * ```typescript
   * const adapter = new WebSocketAdapter('wss://example.com');
   * adapter.on('open', () => console.log('Connected'));
   * adapter.on('message', (data) => console.log(data));
   * await adapter.connect();
   * ```
   */
  constructor(
    private readonly url: string,
    private readonly options: WebSocketAdapterOptions = {}
  ) {
    // Connection must be initiated explicitly by calling connect()
  }

  /**
   * Get the current connection state.
   */
  get readyState(): WebSocketReadyState {
    return (this.ws?.readyState as WebSocketReadyState) ?? this._readyState;
  }

  /**
   * Check if the connection is open and ready to send data.
   */
  get isOpen(): boolean {
    return this.readyState === WebSocketReadyState.OPEN;
  }

  /**
   * Check if the connection is in the process of connecting.
   */
  get isConnecting(): boolean {
    return this.readyState === WebSocketReadyState.CONNECTING;
  }

  /**
   * Check if the connection is closed or closing.
   */
  get isClosed(): boolean {
    return (
      this.readyState === WebSocketReadyState.CLOSED ||
      this.readyState === WebSocketReadyState.CLOSING
    );
  }

  /**
   * Register an event listener.
   *
   * @param event - Event name ('open', 'message', 'close', 'error')
   * @param callback - Callback function
   */
  on<K extends keyof WebSocketAdapterEvents>(event: K, callback: WebSocketAdapterEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: unknown[]) => void);
  }

  /**
   * Remove an event listener.
   *
   * @param event - Event name
   * @param callback - Callback function to remove
   */
  off<K extends keyof WebSocketAdapterEvents>(event: K, callback: WebSocketAdapterEvents[K]): void {
    this.listeners.get(event)?.delete(callback as (...args: unknown[]) => void);
  }

  /**
   * Send data through the WebSocket.
   *
   * @param data - String, ArrayBuffer, or Uint8Array to send
   * @throws Error if connection is not open
   */
  send(data: string | ArrayBuffer | Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocketReadyState.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    // Convert Uint8Array to ArrayBuffer for consistent handling
    if (data instanceof Uint8Array) {
      this.ws.send(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    } else {
      this.ws.send(data);
    }
  }

  /**
   * Close the WebSocket connection.
   *
   * @param code - Status code (default: 1000 = normal closure)
   * @param reason - Human-readable reason for closing
   */
  close(code = 1000, reason = 'Normal closure'): void {
    this.clearConnectionTimeout();

    if (this.ws) {
      this._readyState = WebSocketReadyState.CLOSING;
      try {
        this.ws.close(code, reason);
      } catch {
        // Ignore close errors and let onclose handler set final state
      }
      // Let onclose handler set final CLOSED state and clear ws reference
    } else {
      // Already closed or never opened
      this._readyState = WebSocketReadyState.CLOSED;
    }
  }

  /**
   * Establish the WebSocket connection.
   *
   * Call this after attaching event listeners to ensure you don't miss
   * any events that fire during connection establishment.
   *
   * @returns Promise that resolves when connection attempt completes
   *          (either successfully or with an error emitted via 'error' event)
   */
  async connect(): Promise<void> {
    this._readyState = WebSocketReadyState.CONNECTING;

    // Set up connection timeout
    const timeoutMs = this.options.connectionTimeoutMs ?? 30000;
    this.connectionTimeout = setTimeout(() => {
      this.emit('error', new Error(`Connection timeout after ${timeoutMs}ms`));
      this.close(1006, 'Connection timeout');
    }, timeoutMs);

    try {
      // Create WebSocket - use native or polyfill
      this.ws = await this.createWebSocket();

      // Handle binary data as ArrayBuffer
      this.ws.binaryType = 'arraybuffer';

      // Set up event handlers
      this.ws.onopen = () => {
        this.clearConnectionTimeout();
        this._readyState = WebSocketReadyState.OPEN;
        this.emit('open');
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.emit('message', event.data);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.clearConnectionTimeout();
        this._readyState = WebSocketReadyState.CLOSED;
        this.emit('close', event.code, event.reason || '');
      };

      this.ws.onerror = (_event: Event) => {
        // WebSocket errors don't provide details for security reasons
        // The actual error info comes through the close event
        this.emit('error', new Error('WebSocket error'));
      };
    } catch (error) {
      this.clearConnectionTimeout();
      this._readyState = WebSocketReadyState.CLOSED;
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create the appropriate WebSocket instance for the current environment.
   */
  private async createWebSocket(): Promise<WebSocket> {
    // Check if native WebSocket is available (browsers, Node.js 18+, Deno, Bun)
    if (typeof globalThis.WebSocket !== 'undefined') {
      return new globalThis.WebSocket(this.url);
    }

    // For older Node.js environments, try to use 'ws' package
    if (isNodeWithoutNativeWS()) {
      try {
        // Dynamic import to avoid bundling issues
        const { default: WS } = await import('ws');
        return new WS(this.url, {
          headers: this.options.headers,
        }) as unknown as WebSocket;
      } catch {
        throw new Error(
          'WebSocket not available. Please use Node.js 18+ or install the "ws" package.'
        );
      }
    }

    throw new Error('WebSocket not available in this environment');
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit<K extends keyof WebSocketAdapterEvents>(
    event: K,
    ...args: Parameters<WebSocketAdapterEvents[K]>
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(...args);
        } catch (error) {
          // Use separate arguments to avoid format string injection
          console.error('Error in WebSocket handler:', event, error);
        }
      }
    }
  }

  /**
   * Clear the connection timeout timer.
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }
}
