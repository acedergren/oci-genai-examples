/**
 * OCI Realtime Client
 *
 * Manages WebSocket connections to OCI's realtime speech service.
 * Handles JWT token authentication and connection lifecycle.
 */

import { AIServiceSpeechClient } from 'oci-aispeech';
import * as common from 'oci-common';
import { WebSocketAdapter } from './WebSocketAdapter';
import type {
  OCIRealtimeSettings,
  RealtimeConnectionState,
  RealtimeServerMessage,
  RealtimeAuthMessage,
  RealtimeConnectMessage,
  RealtimeErrorMessage,
} from './types';
import { RealtimeError } from './types';
import { OCIConfig } from '../types';

/**
 * Events emitted by the realtime client.
 */
export interface RealtimeClientEvents {
  /** Connection state changed */
  stateChange: (state: RealtimeConnectionState) => void;
  /** Authenticated and ready */
  authenticated: (sessionId: string) => void;
  /** Message received from server */
  message: (message: RealtimeServerMessage) => void;
  /** Connection error */
  error: (error: Error) => void;
  /** Connection closed */
  closed: (code: number, reason: string) => void;
}

/**
 * Default OCI realtime speech regions and their endpoints.
 */
const REALTIME_ENDPOINTS: Record<string, string> = {
  'us-phoenix-1': 'wss://realtime.aiservice.us-phoenix-1.oci.oraclecloud.com',
  'us-ashburn-1': 'wss://realtime.aiservice.us-ashburn-1.oci.oraclecloud.com',
  'eu-frankfurt-1': 'wss://realtime.aiservice.eu-frankfurt-1.oci.oraclecloud.com',
  'uk-london-1': 'wss://realtime.aiservice.uk-london-1.oci.oraclecloud.com',
  'ap-tokyo-1': 'wss://realtime.aiservice.ap-tokyo-1.oci.oraclecloud.com',
  'ap-osaka-1': 'wss://realtime.aiservice.ap-osaka-1.oci.oraclecloud.com',
  'ap-sydney-1': 'wss://realtime.aiservice.ap-sydney-1.oci.oraclecloud.com',
  'ap-mumbai-1': 'wss://realtime.aiservice.ap-mumbai-1.oci.oraclecloud.com',
  'ca-toronto-1': 'wss://realtime.aiservice.ca-toronto-1.oci.oraclecloud.com',
  'sa-saopaulo-1': 'wss://realtime.aiservice.sa-saopaulo-1.oci.oraclecloud.com',
};

/**
 * Get the WebSocket endpoint for a region.
 */
function getRealtimeEndpoint(region: string): string {
  const endpoint = REALTIME_ENDPOINTS[region];
  if (!endpoint) {
    // Fall back to constructing the endpoint
    return `wss://realtime.aiservice.${region}.oci.oraclecloud.com`;
  }
  return endpoint;
}

/**
 * OCI Realtime Client - manages WebSocket connections to OCI Speech service.
 *
 * This client handles:
 * - JWT token creation via OCI Speech API
 * - WebSocket connection management
 * - Authentication message exchange
 * - Reconnection with exponential backoff
 *
 * @example
 * ```typescript
 * const client = new OCIRealtimeClient({
 *   region: 'us-phoenix-1',
 *   compartmentId: 'ocid1.compartment...',
 * });
 *
 * client.on('authenticated', (sessionId) => {
 *   console.log('Connected with session:', sessionId);
 * });
 *
 * client.on('message', (msg) => {
 *   if (msg.event === 'RESULT') {
 *     console.log('Transcription:', msg.transcriptions);
 *   }
 * });
 *
 * await client.connect({
 *   language: 'en-US',
 *   model: 'ORACLE',
 * });
 *
 * // Send audio data
 * client.sendAudio(audioChunk);
 *
 * // Close when done
 * await client.close();
 * ```
 */
export class OCIRealtimeClient {
  private ws: WebSocketAdapter | null = null;
  private speechClient: AIServiceSpeechClient | null = null;
  private sessionToken: string | null = null;
  private sessionId: string | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private _state: RealtimeConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: OCIConfig) {}

  /**
   * Get the current connection state.
   */
  get state(): RealtimeConnectionState {
    return this._state;
  }

  /**
   * Get the current session ID (available after authentication).
   */
  get currentSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if the client is connected and authenticated.
   */
  get isConnected(): boolean {
    return this._state === 'connected' && this.ws?.isOpen === true;
  }

  /**
   * Register an event listener.
   */
  on<K extends keyof RealtimeClientEvents>(event: K, callback: RealtimeClientEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: unknown[]) => void);
  }

  /**
   * Remove an event listener.
   */
  off<K extends keyof RealtimeClientEvents>(event: K, callback: RealtimeClientEvents[K]): void {
    this.listeners.get(event)?.delete(callback as (...args: unknown[]) => void);
  }

  /**
   * Connect to the OCI realtime speech service.
   *
   * @param settings - Realtime transcription settings
   * @throws RealtimeError if connection fails
   */
  async connect(settings: OCIRealtimeSettings = {}): Promise<void> {
    if (this._state === 'connected' || this._state === 'connecting') {
      throw new Error('Already connected or connecting');
    }

    this.setState('connecting');

    try {
      // Initialize OCI Speech client if needed
      if (!this.speechClient) {
        this.speechClient = await this.createSpeechClient();
      }

      // Get compartment ID
      const compartmentId = settings.compartmentId ?? this.config.compartmentId;
      if (!compartmentId) {
        throw new Error('compartmentId is required for realtime transcription');
      }

      // Create session token
      this.sessionToken = await this.createSessionToken(compartmentId);

      // Determine WebSocket endpoint
      const region = settings.region ?? this.config.region ?? 'us-phoenix-1';
      const wsEndpoint = getRealtimeEndpoint(region);

      // Create WebSocket connection
      this.ws = new WebSocketAdapter(wsEndpoint, {
        connectionTimeoutMs: settings.connectionTimeoutMs ?? 30000,
      });

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(settings);

      // Initiate connection (after handlers are attached)
      await this.ws.connect();

      // Wait for connection to open
      await this.waitForOpen();

      // Send authentication message
      this.setState('authenticating');
      this.sendAuthMessage(settings);

      // Wait for authentication response
      await this.waitForAuthentication();

      this.reconnectAttempts = 0;
    } catch (error) {
      this.setState('error');
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Send audio data to the service.
   *
   * @param audio - Audio data as Uint8Array or ArrayBuffer
   * @throws Error if not connected
   */
  sendAudio(audio: Uint8Array | ArrayBuffer): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to realtime service');
    }

    this.ws.send(audio);
  }

  /**
   * Request final results and close the session gracefully.
   */
  async requestFinalResult(): Promise<void> {
    if (!this.isConnected || !this.ws) {
      return;
    }

    const message = JSON.stringify({
      event: 'SEND_FINAL_RESULT',
    });

    this.ws.send(message);
  }

  /**
   * Close the WebSocket connection.
   *
   * @param code - Close code (default: 1000)
   * @param reason - Close reason
   */
  async close(code = 1000, reason = 'Normal closure'): Promise<void> {
    this.clearReconnectTimer();

    if (this.ws) {
      // Request final result before closing
      try {
        await this.requestFinalResult();
        // Give server a moment to send final results
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        // Ignore errors during final result request
      }

      this.ws.close(code, reason);
      this.ws = null;
    }

    this.sessionToken = null;
    this.sessionId = null;
    this.setState('closed');
  }

  /**
   * Create the OCI Speech client with proper authentication.
   */
  private async createSpeechClient(): Promise<AIServiceSpeechClient> {
    const authMethod = this.config.auth ?? 'config_file';

    let authProvider: common.AuthenticationDetailsProvider;

    switch (authMethod) {
      case 'instance_principal':
        authProvider =
          await new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build();
        break;

      case 'resource_principal':
        authProvider = await common.ResourcePrincipalAuthenticationDetailsProvider.builder();
        break;

      case 'config_file':
      default: {
        const configPath = this.config.configPath ?? common.ConfigFileReader.DEFAULT_FILE_PATH;
        const profile = this.config.profile ?? 'DEFAULT';
        authProvider = new common.ConfigFileAuthenticationDetailsProvider(configPath, profile);
        break;
      }
    }

    const client = new AIServiceSpeechClient({ authenticationDetailsProvider: authProvider });

    // Set region if specified
    const region = this.config.region ?? 'us-phoenix-1';
    client.regionId = region;

    return client;
  }

  /**
   * Create a session token for WebSocket authentication.
   */
  private async createSessionToken(compartmentId: string): Promise<string> {
    if (!this.speechClient) {
      throw new Error('Speech client not initialized');
    }

    const response = await this.speechClient.createRealtimeSessionToken({
      createRealtimeSessionTokenDetails: {
        compartmentId,
      },
    });

    return response.realtimeSessionToken.token;
  }

  /**
   * Set up WebSocket event handlers.
   */
  private setupWebSocketHandlers(settings: OCIRealtimeSettings): void {
    if (!this.ws) return;

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      this.handleClose(code, reason, settings);
    });

    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Wait for the WebSocket to open.
   */
  private waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not created'));
        return;
      }

      if (this.ws.isOpen) {
        resolve();
        return;
      }

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onClose = (_code: number, reason: string) => {
        cleanup();
        reject(new Error('Connection closed: ' + (reason || 'Unknown reason')));
      };

      const cleanup = () => {
        this.ws?.off('open', onOpen);
        this.ws?.off('error', onError);
        this.ws?.off('close', onClose);
      };

      this.ws.on('open', onOpen);
      this.ws.on('error', onError);
      this.ws.on('close', onClose);
    });
  }

  /**
   * Wait for authentication to complete.
   */
  private waitForAuthentication(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutMs = 10000;
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error('Authentication timeout'));
        }
      }, timeoutMs);

      const onAuthenticated = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };

      const onError = (error: Error) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(error);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.off('authenticated', onAuthenticated);
        this.off('error', onError);
      };

      this.on('authenticated', onAuthenticated);
      this.on('error', onError);
    });
  }

  /**
   * Send the authentication message to the server.
   */
  private sendAuthMessage(settings: OCIRealtimeSettings): void {
    if (!this.ws || !this.sessionToken) {
      throw new Error('WebSocket or session token not available');
    }

    const authMessage: RealtimeAuthMessage = {
      event: 'AUTHENTICATE',
      authenticationType: 'TOKEN',
      token: this.sessionToken,
      realtimeModelDetails: {
        domain: settings.modelDomain ?? 'GENERIC',
        languageCode: settings.language ?? 'en-US',
      },
      customizations: settings.customizations,
      parameters: {
        encoding: settings.encoding ?? 'audio/raw;rate=16000',
        isAckEnabled: settings.ackEnabled ?? false,
        partialSilenceThresholdInMs: settings.partialSilenceThresholdMs,
        finalSilenceThresholdInMs: settings.finalSilenceThresholdMs,
        stabilizePartialResults: settings.partialResultStability ?? 'MEDIUM',
        modelType: settings.model ?? 'ORACLE',
        modelDomain: settings.modelDomain ?? 'GENERIC',
        languageCode: settings.language ?? 'en-US',
        punctuation: settings.punctuation ?? 'AUTO',
      },
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(data: string | ArrayBuffer): void {
    // Only handle text messages (JSON)
    if (typeof data !== 'string') {
      return;
    }

    try {
      const message = JSON.parse(data) as RealtimeServerMessage;

      switch (message.event) {
        case 'CONNECT':
          this.handleConnectMessage(message);
          break;

        case 'RESULT':
          this.emit('message', message);
          break;

        case 'ACKAUDIO':
          this.emit('message', message);
          break;

        case 'ERROR':
          this.handleErrorMessage(message);
          break;

        default:
          // Unknown message type - emit anyway for extensibility
          this.emit('message', message);
      }
    } catch {
      // Ignore JSON parse errors - might be binary data
    }
  }

  /**
   * Handle connection acknowledgment message.
   */
  private handleConnectMessage(message: RealtimeConnectMessage): void {
    this.sessionId = message.sessionId;
    this.setState('connected');
    this.emit('authenticated', message.sessionId);
    this.emit('message', message);
  }

  /**
   * Handle error message from server.
   */
  private handleErrorMessage(message: RealtimeErrorMessage): void {
    const error = new RealtimeError(message.message, message.code as RealtimeError['code']);
    this.emit('error', error);
    this.emit('message', message);
  }

  /**
   * Handle WebSocket close event.
   */
  private handleClose(code: number, reason: string, settings: OCIRealtimeSettings): void {
    this.emit('closed', code, reason);

    // Check if we should reconnect
    const autoReconnect = settings.autoReconnect ?? true;
    const maxAttempts = settings.maxReconnectAttempts ?? 3;
    const wasConnected = this._state === 'connected';

    if (autoReconnect && wasConnected && code !== 1000 && this.reconnectAttempts < maxAttempts) {
      this.attemptReconnect(settings);
    } else {
      this.setState('disconnected');
    }
  }

  /**
   * Attempt to reconnect with exponential backoff.
   */
  private attemptReconnect(settings: OCIRealtimeSettings): void {
    this.reconnectAttempts++;
    this.setState('reconnecting');

    // Exponential backoff: 1s, 2s, 4s, 8s...
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

    this.reconnectTimer = setTimeout(async () => {
      try {
        this.ws = null;
        this.sessionToken = null;
        await this.connect(settings);
      } catch (error) {
        // Reconnection failed - emit error and check if we should give up
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);

        const maxAttempts = settings.maxReconnectAttempts ?? 3;
        if (this.reconnectAttempts >= maxAttempts) {
          this.setState('disconnected');
          this.emit('error', new Error(`Failed to reconnect after ${maxAttempts} attempts`));
        }
        // Otherwise, close event will trigger another reconnect attempt
      }
    }, delay);
  }

  /**
   * Clear the reconnection timer.
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Set connection state and emit event.
   */
  private setState(state: RealtimeConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit('stateChange', state);
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit<K extends keyof RealtimeClientEvents>(
    event: K,
    ...args: Parameters<RealtimeClientEvents[K]>
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(...args);
        } catch (error) {
          // Use separate arguments for safe logging
          console.error('Error in realtime client handler:', event, error);
        }
      }
    }
  }
}
