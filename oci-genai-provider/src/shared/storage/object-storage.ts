/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import { ObjectStorageClient } from 'oci-objectstorage';
import { Region } from 'oci-common';
import type { OCIConfig } from '../../types';
import { createAuthProvider, getRegion } from '../../auth';

/**
 * Upload audio data to OCI Object Storage for transcription processing.
 * OCI Speech service requires audio files to be in Object Storage.
 *
 * @param config - OCI configuration with auth details
 * @param bucketName - Target bucket name
 * @param objectName - Object name/path in the bucket
 * @param audioData - Audio bytes to upload
 * @returns Object Storage URI for the uploaded file
 */
export async function uploadAudioToObjectStorage(
  config: OCIConfig,
  bucketName: string,
  objectName: string,
  audioData: Uint8Array,
  contentType?: string
): Promise<{ namespaceName: string; bucketName: string; objectName: string }> {
  const authProvider = await createAuthProvider(config);
  const region = getRegion(config);

  const client = new ObjectStorageClient({
    authenticationDetailsProvider: authProvider,
  });
  client.region = Region.fromRegionId(region);

  // Get namespace for the tenancy
  const namespaceResponse = await client.getNamespace({});
  const namespaceName = namespaceResponse.value;

  // Upload the audio file
  await client.putObject({
    namespaceName,
    bucketName,
    objectName,
    putObjectBody: audioData,
    contentLength: audioData.byteLength,
    contentType: contentType ?? 'audio/wav',
  });

  return { namespaceName, bucketName, objectName };
}

/**
 * Delete an object from OCI Object Storage.
 * Used for cleanup after transcription completes.
 *
 * @param config - OCI configuration with auth details
 * @param namespaceName - Object Storage namespace
 * @param bucketName - Bucket name
 * @param objectName - Object name to delete
 */
export async function deleteFromObjectStorage(
  config: OCIConfig,
  namespaceName: string,
  bucketName: string,
  objectName: string
): Promise<void> {
  const authProvider = await createAuthProvider(config);
  const region = getRegion(config);

  const client = new ObjectStorageClient({
    authenticationDetailsProvider: authProvider,
  });
  client.region = Region.fromRegionId(region);

  await client.deleteObject({
    namespaceName,
    bucketName,
    objectName,
  });
}

/**
 * Generate a unique object name for audio uploads.
 * Format: audio-{timestamp}-{random}.wav
 */
export function generateAudioObjectName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `audio-${timestamp}-${random}.wav`;
}

/**
 * Token object from OCI Speech transcription result.
 */
interface TranscriptionToken {
  token: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

/**
 * Segment representing a group of consecutive tokens.
 */
interface TranscriptionSegment {
  text: string;
  startSecond: number;
  endSecond: number;
}

/**
 * Transcription result returned from downloadTranscriptionResult.
 */
export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  confidence?: number;
  languageCode?: string;
}

/**
 * Group tokens into segments based on time gaps.
 * Tokens separated by > 1 second are put in separate segments.
 *
 * @param tokens - Array of token objects with timing information
 * @returns Array of segments with text and timing
 */
function groupTokensIntoSegments(tokens: TranscriptionToken[]): TranscriptionSegment[] {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  const segments: TranscriptionSegment[] = [];
  let currentSegment: TranscriptionToken[] = [tokens[0]];

  for (let i = 1; i < tokens.length; i++) {
    const prevToken = tokens[i - 1];
    const currentToken = tokens[i];

    // Check if there's a gap > 1 second between tokens
    const gap = currentToken.startTime - prevToken.endTime;

    if (gap > 1.0) {
      // Gap exceeds threshold, finish current segment and start new one
      segments.push({
        text: currentSegment.map((t) => t.token).join(' '),
        startSecond: currentSegment[0].startTime,
        endSecond: currentSegment[currentSegment.length - 1].endTime,
      });
      currentSegment = [currentToken];
    } else {
      // Gap is within threshold, add to current segment
      currentSegment.push(currentToken);
    }
  }

  // Add the last segment
  if (currentSegment.length > 0) {
    segments.push({
      text: currentSegment.map((t) => t.token).join(' '),
      startSecond: currentSegment[0].startTime,
      endSecond: currentSegment[currentSegment.length - 1].endTime,
    });
  }

  return segments;
}

/**
 * Download transcription result from OCI Object Storage.
 * Parses OCI Speech JSON format and converts tokens to segments.
 *
 * @param config - OCI configuration with auth details
 * @param namespaceName - Object Storage namespace
 * @param bucketName - Bucket name
 * @param objectName - Object name (JSON transcription result file)
 * @returns Structured transcription result with text, segments, and metadata
 */
export async function downloadTranscriptionResult(
  config: OCIConfig,
  namespaceName: string,
  bucketName: string,
  objectName: string
): Promise<TranscriptionResult> {
  const authProvider = await createAuthProvider(config);
  const region = getRegion(config);

  const client = new ObjectStorageClient({
    authenticationDetailsProvider: authProvider,
  });
  client.region = Region.fromRegionId(region);

  try {
    // Download the object
    const response = await client.getObject({
      namespaceName,
      bucketName,
      objectName,
    });

    // Stream response to string to handle large files efficiently
    const responseStream = response.value as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    const STREAM_TIMEOUT_MS = 30000; // 30 seconds

    // Collect stream data with timeout protection
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stream read timeout after 30 seconds'));
        }, STREAM_TIMEOUT_MS);

        responseStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        responseStream.on('end', () => {
          clearTimeout(timeout);
          resolve();
        });

        responseStream.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(new Error(`Stream read error: ${error.message}`));
        });
      }),
    ]);

    // Parse the JSON content
    const jsonString = Buffer.concat(chunks).toString('utf-8');
    let speechResult: any;

    try {
      speechResult = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(
        `Failed to parse transcription JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // Extract transcription data from OCI Speech response
    const transcription = speechResult.transcription;
    if (!transcription) {
      throw new Error('Missing transcription field in JSON response');
    }

    // Extract the main transcript text
    const text = transcription.transcript || '';

    // Extract tokens if available
    const tokens: TranscriptionToken[] = [];
    if (transcription.tokens && Array.isArray(transcription.tokens)) {
      for (const token of transcription.tokens) {
        if (
          token.token &&
          typeof token.startTime === 'number' &&
          typeof token.endTime === 'number'
        ) {
          tokens.push({
            token: token.token,
            startTime: token.startTime,
            endTime: token.endTime,
            confidence: token.confidence,
          });
        }
      }
    }

    // Group tokens into segments
    const segments = groupTokensIntoSegments(tokens);

    // Extract optional metadata
    const confidence = transcription.confidence;
    const languageCode = transcription.languageCode;

    return {
      text,
      segments,
      confidence,
      languageCode,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing transcription field')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('Failed to parse')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('Stream read error')) {
      throw error;
    }
    throw new Error(
      `Failed to download transcription result: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
