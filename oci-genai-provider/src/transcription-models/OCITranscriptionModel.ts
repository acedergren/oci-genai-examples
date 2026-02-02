import { AIServiceSpeechClient, models } from 'oci-aispeech';
import { Region } from 'oci-common';
import { createAuthProvider, getCompartmentId, getRegion } from '../auth';
import { NoSuchModelError } from '@ai-sdk/provider';
import { getTranscriptionModelMetadata, isValidTranscriptionModelId } from './registry';
import {
  uploadAudioToObjectStorage,
  deleteFromObjectStorage,
  generateAudioObjectName,
  downloadTranscriptionResult,
} from '../shared/storage/object-storage';
import type { OCITranscriptionSettings } from '../types';
import type {
  SharedV3Warning,
  JSONObject,
  TranscriptionModelV3,
  TranscriptionModelV3CallOptions,
} from '@ai-sdk/provider';
import { handleOCIError } from '../shared/errors';
import {
  getOCIProviderOptions,
  resolveCompartmentId,
  resolveEndpoint,
} from '../shared/provider-options';

interface TranscriptionOutput {
  text: string;
  segments: Array<{
    text: string;
    startSecond: number;
    endSecond: number;
  }>;
  language: string | undefined;
  durationInSeconds: number | undefined;
  warnings: SharedV3Warning[];
  request?: {
    body?: string;
  };
  response: {
    timestamp: Date;
    modelId: string;
    headers?: Record<string, string>;
  };
  providerMetadata?: Record<string, JSONObject>;
}

export class OCITranscriptionModel implements TranscriptionModelV3 {
  readonly specificationVersion = 'v3';
  readonly provider = 'oci-genai';

  private _client?: AIServiceSpeechClient;

  constructor(
    readonly modelId: string,
    private config: OCITranscriptionSettings
  ) {
    if (isValidTranscriptionModelId(modelId) === false) {
      throw new NoSuchModelError({
        modelId,
        modelType: 'transcriptionModel',
      });
    }
  }

  private async getClient(endpointOverride?: string): Promise<AIServiceSpeechClient> {
    const resolvedEndpoint = resolveEndpoint(this.config.endpoint, endpointOverride);

    if (!this._client || (endpointOverride && endpointOverride !== this.config.endpoint)) {
      const authProvider = await createAuthProvider(this.config);
      const region = getRegion(this.config);

      const client = new AIServiceSpeechClient({
        authenticationDetailsProvider: authProvider,
      });

      client.region = Region.fromRegionId(region);

      if (resolvedEndpoint) {
        client.endpoint = resolvedEndpoint;
      }

      if (!endpointOverride || endpointOverride === this.config.endpoint) {
        this._client = client;
      }

      return client;
    }

    return this._client;
  }

  async doGenerate(options: TranscriptionModelV3CallOptions): Promise<TranscriptionOutput> {
    return this.doTranscribe(options);
  }

  async doTranscribe(options: TranscriptionModelV3CallOptions): Promise<TranscriptionOutput> {
    const startTime = new Date();
    const warnings: SharedV3Warning[] = [];

    // Convert audio to Uint8Array if it's a base64 string
    let audioData: Uint8Array;
    if (typeof options.audio === 'string') {
      audioData = new Uint8Array(Buffer.from(options.audio, 'base64'));
    } else {
      audioData = options.audio;
    }

    // Validate audio size (2GB max)
    const maxSizeBytes = 2 * 1024 * 1024 * 1024;
    if (audioData.byteLength > maxSizeBytes) {
      throw new Error(
        `Audio file size (${(audioData.byteLength / 1024 / 1024).toFixed(1)}MB) ` +
          `exceeds maximum allowed (2048MB)`
      );
    }

    const ociOptions = getOCIProviderOptions(options.providerOptions);
    const client = await this.getClient(ociOptions?.endpoint);
    const compartmentId = resolveCompartmentId(
      getCompartmentId(this.config),
      ociOptions?.compartmentId
    );
    const metadata = getTranscriptionModelMetadata(this.modelId);

    // Collect warning if vocabulary used with Whisper
    if (
      metadata?.modelType !== 'ORACLE' &&
      this.config.vocabulary &&
      this.config.vocabulary.length > 0
    ) {
      warnings.push({
        type: 'other',
        message: 'Custom vocabulary is not supported by Whisper model. It will be ignored.',
      });
    }

    // Get bucket name for audio uploads
    const bucketName = this.config.transcriptionBucket || 'oci-speech-transcription';
    const objectName = generateAudioObjectName();

    // Upload audio to Object Storage
    let uploadedLocation: { namespaceName: string; bucketName: string; objectName: string };
    try {
      uploadedLocation = await uploadAudioToObjectStorage(
        this.config,
        bucketName,
        objectName,
        audioData,
        options.mediaType
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload audio to Object Storage: ${message}`);
    }

    try {
      // Map language code to enum
      const languageCode = this.mapLanguageCode(this.config.language);

      // Generate unique prefix once for consistent use in job creation and polling
      const outputPrefix = `results-${Date.now()}`;

      // Create transcription job with inline input location
      const createJobRequest = {
        createTranscriptionJobDetails: {
          compartmentId,
          displayName: `Transcription-${Date.now()}`,
          modelDetails: {
            modelType: metadata?.modelType || 'ORACLE',
            languageCode,
          },
          inputLocation: {
            locationType: 'OBJECT_LIST_INLINE_INPUT_LOCATION',
            objectLocations: [
              {
                namespaceName: uploadedLocation.namespaceName,
                bucketName: uploadedLocation.bucketName,
                objectNames: [uploadedLocation.objectName],
              },
            ],
          },
          outputLocation: {
            namespaceName: uploadedLocation.namespaceName,
            bucketName: bucketName,
            prefix: outputPrefix,
          },
        },
      };

      const jobResponse = await client.createTranscriptionJob(createJobRequest);
      const jobId = jobResponse.transcriptionJob.id;

      // Poll for job completion and get transcript
      const { text, taskId, segments } = await this.pollForCompletion(
        client,
        jobId,
        bucketName,
        uploadedLocation.namespaceName,
        outputPrefix
      );

      return {
        text,
        segments,
        language: this.config.language || undefined,
        durationInSeconds: undefined,
        warnings,
        request: {
          body: JSON.stringify({ audioSize: audioData.byteLength, mediaType: options.mediaType }),
        },
        response: {
          timestamp: startTime,
          modelId: this.modelId,
          headers: jobResponse.opcRequestId ? { 'opc-request-id': jobResponse.opcRequestId } : {},
        },
        providerMetadata: {
          oci: {
            compartmentId,
            modelType: metadata?.modelType || 'ORACLE',
            jobId,
            taskId,
            requestId: jobResponse.opcRequestId,
          },
        },
      };
    } catch (error) {
      throw handleOCIError(error);
    } finally {
      // Cleanup: delete uploaded audio file
      try {
        await deleteFromObjectStorage(
          this.config,
          uploadedLocation.namespaceName,
          uploadedLocation.bucketName,
          uploadedLocation.objectName
        );
      } catch {
        // Silently ignore cleanup errors
      }
    }
  }

  /**
   * Map language string to OCI LanguageCode enum
   */
  private mapLanguageCode(
    language?: string
  ): models.TranscriptionModelDetails.LanguageCode | undefined {
    if (!language) return models.TranscriptionModelDetails.LanguageCode.EnUs;

    // Map common language codes to OCI enum values
    const mapping: Record<string, models.TranscriptionModelDetails.LanguageCode> = {
      'en-US': models.TranscriptionModelDetails.LanguageCode.EnUs,
      'es-ES': models.TranscriptionModelDetails.LanguageCode.EsEs,
      'pt-BR': models.TranscriptionModelDetails.LanguageCode.PtBr,
      'en-GB': models.TranscriptionModelDetails.LanguageCode.EnGb,
      'en-AU': models.TranscriptionModelDetails.LanguageCode.EnAu,
      'en-IN': models.TranscriptionModelDetails.LanguageCode.EnIn,
      'hi-IN': models.TranscriptionModelDetails.LanguageCode.HiIn,
      'fr-FR': models.TranscriptionModelDetails.LanguageCode.FrFr,
      'de-DE': models.TranscriptionModelDetails.LanguageCode.DeDe,
      'it-IT': models.TranscriptionModelDetails.LanguageCode.ItIt,
      en: models.TranscriptionModelDetails.LanguageCode.En,
      es: models.TranscriptionModelDetails.LanguageCode.Es,
      fr: models.TranscriptionModelDetails.LanguageCode.Fr,
      de: models.TranscriptionModelDetails.LanguageCode.De,
      it: models.TranscriptionModelDetails.LanguageCode.It,
      auto: models.TranscriptionModelDetails.LanguageCode.Auto,
    };

    return mapping[language] || models.TranscriptionModelDetails.LanguageCode.EnUs;
  }

  private async pollForCompletion(
    client: AIServiceSpeechClient,
    jobId: string,
    outputBucket: string,
    outputNamespace: string,
    outputPrefix: string
  ): Promise<{
    text: string;
    taskId: string;
    segments: Array<{ text: string; startSecond: number; endSecond: number }>;
  }> {
    const maxAttempts = 60;
    const pollIntervalMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const jobResponse = await client.getTranscriptionJob({
        transcriptionJobId: jobId,
      });

      const state = jobResponse.transcriptionJob.lifecycleState;

      if (state === models.TranscriptionJob.LifecycleState.Succeeded) {
        // List tasks to get the task ID
        const tasksResponse = await client.listTranscriptionTasks({
          transcriptionJobId: jobId,
        });

        const firstTask = tasksResponse.transcriptionTaskCollection?.items?.[0];
        if (!firstTask) {
          throw new Error('No transcription tasks found in job');
        }

        // Get full task details to retrieve output file location
        let taskDetails;
        try {
          const taskResponse = await client.getTranscriptionTask({
            transcriptionJobId: jobId,
            transcriptionTaskId: firstTask.id,
          });
          taskDetails = taskResponse.transcriptionTask;
        } catch (error) {
          throw new Error(
            `Failed to get transcription task details: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        // Determine the output file name
        let outputFileName: string;

        // If task has outputLocation, use it; otherwise use fallback naming
        const taskOutputLocation = (taskDetails as { outputLocation?: string }).outputLocation;
        if (taskOutputLocation) {
          // outputLocation is typically a string containing the full path
          // Format is usually "{prefix}/{input_filename}.json"
          outputFileName = taskOutputLocation;
        } else {
          // Fallback: construct filename from prefix and task input
          // Get the input object names from the input location
          const inputObjectNames =
            (taskDetails.inputLocation as { objectNames?: string[] })?.objectNames || [];
          const inputName = inputObjectNames[0] || `task-${firstTask.id}`;
          const baseName = inputName.replace(/\.[^.]*$/, ''); // Remove extension
          outputFileName = `${outputPrefix}/${baseName}.json`;
        }

        // Download and parse the transcription result from Object Storage
        let result;
        try {
          result = await downloadTranscriptionResult(
            this.config,
            outputNamespace,
            outputBucket,
            outputFileName
          );
        } catch (error) {
          throw new Error(
            `Failed to download transcription result: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        return {
          text: result.text,
          taskId: firstTask.id,
          segments: result.segments,
        };
      }

      if (state === models.TranscriptionJob.LifecycleState.Failed) {
        throw new Error(
          `Transcription job failed: ${jobResponse.transcriptionJob.lifecycleDetails || 'Unknown error'}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Transcription job timed out after 5 minutes');
  }
}
