import { AIServiceSpeechClient, models } from 'oci-aispeech';
import { Region } from 'oci-common';
import type { SharedV3Warning, SharedV2Headers, JSONObject } from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { createAuthProvider, getRegion, getCompartmentId } from '../auth';
import { getSpeechModelMetadata, isValidSpeechModelId } from './registry';
import type { OCISpeechSettings } from '../types';
import type { SpeechModelV3, SpeechModelV3CallOptions } from '@ai-sdk/provider';
import { handleOCIError } from '../shared/errors';
import {
  getOCIProviderOptions,
  resolveCompartmentId,
  resolveEndpoint,
} from '../shared/provider-options';

export class OCISpeechModel implements SpeechModelV3 {
  readonly specificationVersion = 'v3';
  readonly provider = 'oci-genai';
  private readonly voice: string;
  private readonly _config: OCISpeechSettings;
  private _client?: AIServiceSpeechClient;

  constructor(
    readonly modelId: string,
    config: OCISpeechSettings
  ) {
    if (!isValidSpeechModelId(modelId)) {
      throw new NoSuchModelError({
        modelId,
        modelType: 'speechModel',
      });
    }
    const metadata = getSpeechModelMetadata(modelId);
    const defaultVoice = metadata?.defaultVoice;
    this.voice = config.voice ?? defaultVoice ?? 'en-US-AriaNeural';
    this._config = config;
  }

  private async getClient(endpointOverride?: string): Promise<AIServiceSpeechClient> {
    const resolvedEndpoint = resolveEndpoint(this._config.endpoint, endpointOverride);

    if (!this._client || (endpointOverride && endpointOverride !== this._config.endpoint)) {
      const authProvider = await createAuthProvider(this._config);
      const region = getRegion(this._config);

      const client = new AIServiceSpeechClient({
        authenticationDetailsProvider: authProvider,
      });

      client.region = Region.fromRegionId(region);

      if (resolvedEndpoint) {
        client.endpoint = resolvedEndpoint;
      }

      if (!endpointOverride || endpointOverride === this._config.endpoint) {
        this._client = client;
      }

      return client;
    }

    return this._client;
  }

  getVoice(): string {
    return this.voice;
  }

  async doGenerate(options: SpeechModelV3CallOptions): Promise<{
    audio: string | Uint8Array;
    warnings: SharedV3Warning[];
    request?: { body?: unknown };
    response: { timestamp: Date; modelId: string; headers?: SharedV2Headers; body?: unknown };
    providerMetadata?: Record<string, JSONObject>;
  }> {
    const startTime = new Date();
    const { text } = options;
    const warnings: SharedV3Warning[] = [];

    if (options.instructions) {
      warnings.push({
        type: 'unsupported',
        feature: 'instructions',
        details: 'OCI speech does not support instruction prompts.',
      });
    }

    if (options.speed !== undefined) {
      warnings.push({
        type: 'unsupported',
        feature: 'speed',
        details: 'OCI speech does not support speed adjustments.',
      });
    }

    if (options.language) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details: 'OCI speech does not support language override per request.',
      });
    }

    const metadata = getSpeechModelMetadata(this.modelId);
    if (!metadata) throw new Error('Invalid model metadata');

    if (text.length > metadata.maxTextLength) {
      throw new Error(
        'Text length (' + text.length + ') exceeds maximum allowed (' + metadata.maxTextLength + ')'
      );
    }

    const ociOptions = getOCIProviderOptions(options.providerOptions);
    const client = await this.getClient(ociOptions?.endpoint);
    const compartmentId = resolveCompartmentId(
      getCompartmentId(this._config),
      ociOptions?.compartmentId
    );
    const voice = options.voice ?? this.voice;

    // Map format to OCI output format enum
    const outputFormat = this.mapOutputFormat(options.outputFormat ?? this._config.format);

    // Build synthesize speech request using proper OCI SDK types
    const synthesizeSpeechDetails: models.SynthesizeSpeechDetails = {
      text,
      isStreamEnabled: false,
      compartmentId,
      configuration: {
        modelFamily: 'ORACLE',
        modelDetails: {
          modelName: metadata.modelName,
          voiceId: voice,
        },
        speechSettings: {
          outputFormat,
        },
      },
    };

    try {
      const response = await client.synthesizeSpeech({
        synthesizeSpeechDetails,
      });

      // Convert response stream to Uint8Array
      const audioData = await this.streamToUint8Array(response.value);

      return {
        audio: audioData,
        warnings,
        request: {
          body: synthesizeSpeechDetails,
        },
        response: {
          timestamp: startTime,
          modelId: this.modelId,
          headers: response.opcRequestId ? { 'opc-request-id': response.opcRequestId } : {},
        },
        providerMetadata: {
          oci: {
            compartmentId,
            voice,
            format: (options.outputFormat ?? this._config.format) || 'mp3',
            requestId: response.opcRequestId,
          },
        },
      };
    } catch (error) {
      throw handleOCIError(error);
    }
  }

  /**
   * Map user-friendly format names to OCI OutputFormat enum
   */
  private mapOutputFormat(format?: string): models.TtsOracleSpeechSettings.OutputFormat {
    switch (format) {
      case 'wav':
      case 'pcm':
        return models.TtsOracleSpeechSettings.OutputFormat.Pcm;
      case 'ogg':
        return models.TtsOracleSpeechSettings.OutputFormat.Ogg;
      case 'mp3':
      default:
        return models.TtsOracleSpeechSettings.OutputFormat.Mp3;
    }
  }

  /**
   * Convert a Web Streams API ReadableStream or Node.js stream to Uint8Array
   */
  private async streamToUint8Array(stream: any): Promise<Uint8Array> {
    // Check if it's a Web Streams API ReadableStream
    if (stream && typeof stream.getReader === 'function') {
      return this.webStreamToUint8Array(stream);
    }

    // Otherwise, treat as Node.js stream
    return this.nodeStreamToUint8Array(stream);
  }

  /**
   * Convert Web Streams API ReadableStream to Uint8Array
   */
  private async webStreamToUint8Array(stream: ReadableStream): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      // Calculate total length and combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Convert Node.js readable stream to Uint8Array
   */
  private async nodeStreamToUint8Array(stream: NodeJS.ReadableStream): Promise<Uint8Array> {
    const chunks: Buffer[] = [];
    const STREAM_TIMEOUT_MS = 30000; // 30 seconds

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stream read timeout after 30 seconds'));
      }, STREAM_TIMEOUT_MS);

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        clearTimeout(timeout);
        const buffer = Buffer.concat(chunks);
        resolve(new Uint8Array(buffer));
      });

      stream.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
}
