/**
 * Minimal type declaration for the 'ws' WebSocket package.
 * This is only used as a fallback for Node.js environments without native WebSocket.
 */
declare module 'ws' {
  interface WebSocketOptions {
    headers?: Record<string, string>;
  }

  class WebSocket {
    static CONNECTING: 0;
    static OPEN: 1;
    static CLOSING: 2;
    static CLOSED: 3;

    readyState: number;
    binaryType: 'blob' | 'arraybuffer' | 'nodebuffer';

    onopen: (() => void) | null;
    onclose: ((event: { code: number; reason: string }) => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onerror: ((event: { error: Error }) => void) | null;

    constructor(url: string, options?: WebSocketOptions);
    send(data: string | ArrayBuffer | Buffer): void;
    close(code?: number, reason?: string): void;
  }

  export default WebSocket;
}
