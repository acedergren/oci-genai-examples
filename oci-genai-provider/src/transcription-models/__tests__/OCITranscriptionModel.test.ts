import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock oci-aispeech - needs to be at top level
const mockCreateTranscriptionJob = jest.fn<any>();
const mockGetTranscriptionJob = jest.fn<any>();
const mockListTranscriptionTasks = jest.fn<any>();
const mockGetTranscriptionTask = jest.fn<any>();

jest.mock('oci-aispeech', () => ({
  AIServiceSpeechClient: jest.fn().mockImplementation(() => ({
    region: null,
    endpoint: null,
    createTranscriptionJob: mockCreateTranscriptionJob,
    getTranscriptionJob: mockGetTranscriptionJob,
    listTranscriptionTasks: mockListTranscriptionTasks,
    getTranscriptionTask: mockGetTranscriptionTask,
  })),
  models: {
    TranscriptionModelDetails: {
      LanguageCode: {
        EnUs: 'en-US',
        EsEs: 'es-ES',
        En: 'en',
        Auto: 'auto',
      },
    },
    TranscriptionJob: {
      LifecycleState: {
        Succeeded: 'SUCCEEDED',
        Failed: 'FAILED',
        InProgress: 'IN_PROGRESS',
      },
    },
  },
}));

// Mock oci-common
jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => ({})),
  InstancePrincipalsAuthenticationDetailsProviderBuilder: jest.fn().mockImplementation(() => ({
    // @ts-expect-error - Mock implementation for testing
    build: jest.fn().mockResolvedValue({}),
  })),
  ResourcePrincipalAuthenticationDetailsProvider: {
    builder: jest.fn().mockReturnValue({}),
  },
  Region: {
    fromRegionId: jest.fn().mockReturnValue({ regionId: 'eu-frankfurt-1' }),
  },
}));

// Mock Object Storage functions
const mockUploadAudioToObjectStorage = jest.fn<any>();
const mockDeleteFromObjectStorage = jest.fn<any>();
const mockGenerateAudioObjectName = jest.fn<any>();
const mockDownloadTranscriptionResult = jest.fn<any>();

jest.mock('../../shared/storage/object-storage', () => ({
  uploadAudioToObjectStorage: mockUploadAudioToObjectStorage,
  deleteFromObjectStorage: mockDeleteFromObjectStorage,
  generateAudioObjectName: mockGenerateAudioObjectName,
  downloadTranscriptionResult: mockDownloadTranscriptionResult,
}));

// Import after mocks
import { NoSuchModelError } from '@ai-sdk/provider';
import { OCITranscriptionModel } from '../OCITranscriptionModel';

describe('OCITranscriptionModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockGenerateAudioObjectName.mockReturnValue('test-audio.wav');
    mockUploadAudioToObjectStorage.mockResolvedValue({
      namespaceName: 'test-namespace',
      bucketName: 'test-bucket',
      objectName: 'test-audio.wav',
    });
    mockDeleteFromObjectStorage.mockResolvedValue(undefined);
    mockCreateTranscriptionJob.mockResolvedValue({
      transcriptionJob: { id: 'test-job-id' },
    });
    mockGetTranscriptionJob.mockResolvedValue({
      transcriptionJob: {
        lifecycleState: 'SUCCEEDED',
        lifecycleDetails: null,
      },
    });
    mockListTranscriptionTasks.mockResolvedValue({
      transcriptionTaskCollection: {
        items: [{ id: 'test-task-id' }],
      },
    });
    mockGetTranscriptionTask.mockResolvedValue({
      transcriptionTask: {
        id: 'test-task-id',
        outputLocation: 'results-12345/test-audio.json',
      },
    });
    mockDownloadTranscriptionResult.mockResolvedValue({
      text: 'This is a test transcription',
      segments: [
        {
          text: 'This',
          startSecond: 0,
          endSecond: 0.5,
        },
        {
          text: 'is a test transcription',
          startSecond: 0.5,
          endSecond: 2.0,
        },
      ],
      confidence: 0.95,
      languageCode: 'en-US',
    });
  });

  it('should have correct specification version and provider', () => {
    const model = new OCITranscriptionModel('ORACLE', {
      compartmentId: 'ocid1.compartment.test',
    });

    expect(model.specificationVersion).toBe('v3');
    expect(model.provider).toBe('oci-genai');
    expect(model.modelId).toBe('ORACLE');
  });

  it('should accept WHISPER_MEDIUM model ID', () => {
    const model = new OCITranscriptionModel('WHISPER_MEDIUM', {
      compartmentId: 'ocid1.compartment.test',
    });
    expect(model.modelId).toBe('WHISPER_MEDIUM');
  });

  it('should accept WHISPER_LARGE_V2 model ID', () => {
    const model = new OCITranscriptionModel('WHISPER_LARGE_V2', {
      compartmentId: 'ocid1.compartment.test',
    });
    expect(model.modelId).toBe('WHISPER_LARGE_V2');
  });

  it('should throw error for invalid model ID', () => {
    expect(() => {
      new OCITranscriptionModel('invalid-model', {});
    }).toThrow(NoSuchModelError);
  });

  it('should reject old-style model IDs', () => {
    expect(() => {
      new OCITranscriptionModel('oci.speech.standard', {});
    }).toThrow(NoSuchModelError);
  });

  it('should accept language setting', () => {
    const model = new OCITranscriptionModel('ORACLE', {
      language: 'en-US',
      compartmentId: 'test',
    });

    expect(model).toBeDefined();
  });

  it('should accept custom vocabulary for Oracle model', () => {
    const model = new OCITranscriptionModel('ORACLE', {
      vocabulary: ['OpenCode', 'GenAI', 'OCI'],
      compartmentId: 'test',
    });

    expect(model).toBeDefined();
  });

  it('should warn about vocabulary for Whisper model', () => {
    // Whisper does not support custom vocabulary
    const model = new OCITranscriptionModel('WHISPER_MEDIUM', {
      vocabulary: ['test'],
      compartmentId: 'test',
    });

    expect(model).toBeDefined();
  });

  describe('audio validation', () => {
    it('should throw error when audio exceeds 2GB limit', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      // Create a small array but mock the byteLength to simulate 3GB
      const largeAudio = new Uint8Array(1);
      Object.defineProperty(largeAudio, 'byteLength', {
        value: 3 * 1024 * 1024 * 1024,
      });
      await expect(model.doGenerate({ audio: largeAudio, mediaType: 'audio/wav' })).rejects.toThrow(
        'Audio file size'
      );
    });

    it('should accept audio under 2GB limit', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      const result = await model.doGenerate({
        audio: new Uint8Array(1000),
        mediaType: 'audio/wav',
      });
      expect(result.text).toBeDefined();
    });
  });

  describe('response structure', () => {
    it('should return all required TranscriptionOutput properties', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });

      expect(result.text).toBeDefined();
      expect(result.segments).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.response).toBeDefined();
      expect(result.response.timestamp).toBeInstanceOf(Date);
      expect(result.response.modelId).toBe('ORACLE');
      expect('language' in result).toBe(true);
      expect('durationInSeconds' in result).toBe(true);
    });

    it('should include providerMetadata with jobId', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });

      expect(result.providerMetadata).toBeDefined();
      expect(result.providerMetadata?.oci).toBeDefined();
    });
  });

  describe('warnings', () => {
    it('should add warning when using vocabulary with Whisper model', async () => {
      const model = new OCITranscriptionModel('WHISPER_MEDIUM', {
        compartmentId: 'test',
        vocabulary: ['custom', 'terms'],
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('other');
    });

    it('should have empty warnings when vocabulary not used', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });
      expect(result.warnings).toEqual([]);
    });
  });

  describe('language handling', () => {
    it('should return configured language', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
        language: 'es-ES',
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });
      expect(result.language).toBe('es-ES');
    });

    it('should return undefined when language not configured', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });
      expect(result.language).toBeUndefined();
    });
  });

  describe('Object Storage integration', () => {
    it('should use custom bucket when configured', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
        transcriptionBucket: 'my-custom-bucket',
      });

      await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });

      expect(mockUploadAudioToObjectStorage).toHaveBeenCalledWith(
        expect.anything(),
        'my-custom-bucket',
        expect.any(String),
        expect.any(Uint8Array),
        'audio/wav'
      );
    });

    it('should cleanup uploaded file after transcription', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });

      expect(mockDeleteFromObjectStorage).toHaveBeenCalled();
    });
  });

  describe('base64 audio input', () => {
    it('should accept base64-encoded audio string', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      // Pass a base64 string instead of Uint8Array
      const base64Audio = Buffer.from([1, 2, 3, 4]).toString('base64');
      const result = await model.doGenerate({ audio: base64Audio, mediaType: 'audio/wav' });

      expect(result.text).toBeDefined();
      expect(mockUploadAudioToObjectStorage).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.any(String),
        expect.any(Uint8Array),
        'audio/wav'
      );
    });
  });

  describe('custom endpoint', () => {
    it('should set endpoint on client when configured', async () => {
      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
        endpoint: 'https://custom.endpoint.com',
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });
      expect(result.text).toBeDefined();
    });
  });

  describe('error paths', () => {
    it('should throw wrapped error when upload fails', async () => {
      mockUploadAudioToObjectStorage.mockRejectedValueOnce(new Error('Upload network error'));

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      await expect(
        model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' })
      ).rejects.toThrow('Failed to upload audio to Object Storage: Upload network error');
    });

    it('should throw when no transcription tasks found in job', async () => {
      mockListTranscriptionTasks.mockResolvedValueOnce({
        transcriptionTaskCollection: { items: [] },
      });

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      await expect(
        model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' })
      ).rejects.toThrow('No transcription tasks found in job');
    });

    it('should throw wrapped error when getting task details fails', async () => {
      mockGetTranscriptionTask.mockRejectedValueOnce(new Error('Task API error'));

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      await expect(
        model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' })
      ).rejects.toThrow('Failed to get transcription task details: Task API error');
    });

    it('should use fallback output filename when task has no outputLocation', async () => {
      mockGetTranscriptionTask.mockResolvedValueOnce({
        transcriptionTask: {
          id: 'test-task-id',
          // No outputLocation — triggers fallback path
          inputLocation: {
            objectNames: ['my-audio.wav'],
          },
        },
      });

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });

      // downloadTranscriptionResult should be called with a constructed filename
      expect(mockDownloadTranscriptionResult).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.any(String),
        expect.stringContaining('my-audio.json')
      );
      expect(result.text).toBeDefined();
    });

    it('should throw wrapped error when download result fails', async () => {
      mockDownloadTranscriptionResult.mockRejectedValueOnce(new Error('Download failed'));

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      await expect(
        model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' })
      ).rejects.toThrow('Failed to download transcription result: Download failed');
    });

    it('should throw when transcription job enters FAILED state', async () => {
      mockGetTranscriptionJob.mockResolvedValueOnce({
        transcriptionJob: {
          lifecycleState: 'FAILED',
          lifecycleDetails: 'Unsupported audio format',
        },
      });

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      await expect(
        model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' })
      ).rejects.toThrow('Transcription job failed: Unsupported audio format');
    });

    it('should throw timeout after max poll attempts', async () => {
      // Always return IN_PROGRESS — polling should eventually time out
      mockGetTranscriptionJob.mockResolvedValue({
        transcriptionJob: {
          lifecycleState: 'IN_PROGRESS',
          lifecycleDetails: null,
        },
      });

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      jest.useFakeTimers();

      // Attach .catch() immediately so the rejection is handled
      // before Node marks it as unhandled during timer advancement
      const promise = model
        .doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' })
        .catch((e: unknown) => e);

      // Advance through all 60 poll intervals (60 × 5000ms)
      for (let i = 0; i < 60; i++) {
        await jest.advanceTimersByTimeAsync(5000);
      }

      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('Transcription job timed out after 5 minutes');

      jest.useRealTimers();
    });

    it('should silently ignore cleanup errors after transcription', async () => {
      mockDeleteFromObjectStorage.mockRejectedValueOnce(new Error('Delete failed'));

      const model = new OCITranscriptionModel('ORACLE', {
        compartmentId: 'test',
      });

      // Should succeed despite cleanup failure
      const result = await model.doGenerate({ audio: new Uint8Array(100), mediaType: 'audio/wav' });
      expect(result.text).toBeDefined();
    });
  });
});
