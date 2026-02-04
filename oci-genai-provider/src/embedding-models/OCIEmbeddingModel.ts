import type {
  EmbeddingModelV3,
  EmbeddingModelV3CallOptions,
  EmbeddingModelV3Result,
} from '@ai-sdk/provider';
import { NoSuchModelError, TooManyEmbeddingValuesForCallError } from '@ai-sdk/provider';
import { GenerativeAiInferenceClient, models as ociModels } from 'oci-generativeaiinference';
import { Region } from 'oci-common';
import { createAuthProvider, getCompartmentId, getRegion } from '../auth';
import { isValidEmbeddingModelId } from './registry';
import type { OCIEmbeddingSettings, RequestOptions } from '../types';
import { handleOCIError } from '../shared/errors';
import { withRetry, withTimeout, isRetryableError } from '../shared/utils';
import {
  getOCIProviderOptions,
  resolveCompartmentId,
  resolveEndpoint,
  resolveServingMode,
} from '../shared/provider-options';
import { resolveRequestOptions } from '../shared/request-options';

type Truncate = ociModels.EmbedTextDetails.Truncate;
type InputType = ociModels.EmbedTextDetails.InputType;

export class OCIEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3';
  readonly provider = 'oci-genai';
  readonly maxEmbeddingsPerCall = 96;
  readonly supportsParallelCalls = true;

  private _clientCache = new Map<string, GenerativeAiInferenceClient>();

  constructor(
    readonly modelId: string,
    private config: OCIEmbeddingSettings
  ) {
    if (!isValidEmbeddingModelId(modelId)) {
      throw new NoSuchModelError({
        modelId,
        modelType: 'embeddingModel',
      });
    }
  }

  private async getClient(endpointOverride?: string): Promise<GenerativeAiInferenceClient> {
    const resolvedEndpoint = resolveEndpoint(this.config.endpoint, endpointOverride);
    const cacheKey = resolvedEndpoint ?? this.config.endpoint ?? 'default';

    // Check cache first
    const cached = this._clientCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create new client
    const authProvider = await createAuthProvider(this.config);
    const regionId = getRegion(this.config);

    const client = new GenerativeAiInferenceClient({
      authenticationDetailsProvider: authProvider,
    });

    // Set region using proper OCI Region API
    client.region = Region.fromRegionId(regionId);

    if (resolvedEndpoint) {
      client.endpoint = resolvedEndpoint;
    }

    // Cache the client
    this._clientCache.set(cacheKey, client);

    return client;
  }

  private getRequestOptions(
    perRequestOptions?: OCIEmbeddingSettings['requestOptions']
  ): Required<RequestOptions> {
    return resolveRequestOptions(this.config.requestOptions, perRequestOptions);
  }

  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
    requestOptions?: OCIEmbeddingSettings['requestOptions']
  ): Promise<T> {
    const options = this.getRequestOptions(requestOptions);

    const withTimeoutOperation = (): Promise<T> =>
      withTimeout(operation(), options.timeoutMs, operationName);

    if (options.retry.enabled) {
      return withRetry(withTimeoutOperation, {
        maxRetries: options.retry.maxRetries,
        baseDelayMs: options.retry.baseDelayMs,
        maxDelayMs: options.retry.maxDelayMs,
        isRetryable: isRetryableError,
      });
    }

    return withTimeoutOperation();
  }

  async doEmbed(options: EmbeddingModelV3CallOptions): Promise<EmbeddingModelV3Result> {
    const { values } = options;

    // Validate batch size
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    const ociOptions = getOCIProviderOptions(options.providerOptions);
    const client = await this.getClient(ociOptions?.endpoint);
    const compartmentId = resolveCompartmentId(
      getCompartmentId(this.config),
      ociOptions?.compartmentId
    );

    try {
      const response = await this.executeWithResilience(
        () =>
          client.embedText({
            embedTextDetails: {
              servingMode: resolveServingMode(
                this.modelId,
                this.config.servingMode,
                ociOptions?.servingMode
              ),
              compartmentId,
              inputs: values,
              truncate: (this.config.truncate ?? 'END') as Truncate,
              inputType: (this.config.inputType ?? 'SEARCH_DOCUMENT') as InputType,
            },
          }),
        'OCI embed request',
        ociOptions?.requestOptions
      );

      const embeddings = response.embedTextResult.embeddings;
      const usage = response.embedTextResult.usage;
      const tokenEstimate = values.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

      return {
        embeddings,
        usage: {
          tokens: usage?.promptTokens ?? usage?.totalTokens ?? tokenEstimate,
        },
        providerMetadata: {
          oci: {
            requestId: response.opcRequestId,
            modelId: response.embedTextResult.modelId ?? this.modelId,
          },
        },
        response: {
          headers: response.opcRequestId ? { 'opc-request-id': response.opcRequestId } : undefined,
          body: response,
        },
        warnings: [],
      };
    } catch (error) {
      throw handleOCIError(error);
    }
  }
}
