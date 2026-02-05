import type {
  EmbeddingModelV3,
  EmbeddingModelV3CallOptions,
  EmbeddingModelV3Result,
} from '@ai-sdk/provider';
import { NoSuchModelError, TooManyEmbeddingValuesForCallError } from '@ai-sdk/provider';
import { GenerativeAiInferenceClient, models as ociModels } from 'oci-generativeaiinference';
import { getCompartmentId } from '../auth';
import { isValidEmbeddingModelId } from './registry';
import type { OCIEmbeddingSettings, RequestOptions } from '../types';
import { handleOCIError } from '../shared/errors';
import {
  getOCIProviderOptions,
  resolveCompartmentId,
  resolveServingMode,
} from '../shared/provider-options';
import { resolveRequestOptions } from '../shared/request-options';
import { OCIClientFactory } from '../shared/client-factory';
import { executeWithResilience } from '../shared/resilience';

type Truncate = ociModels.EmbedTextDetails.Truncate;
type InputType = ociModels.EmbedTextDetails.InputType;

export class OCIEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3';
  readonly provider = 'oci-genai';
  readonly maxEmbeddingsPerCall = 96;
  readonly supportsParallelCalls = true;

  private clientFactory: OCIClientFactory<GenerativeAiInferenceClient>;

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

    this.clientFactory = new OCIClientFactory(GenerativeAiInferenceClient, config);
  }

  private async getClient(endpointOverride?: string): Promise<GenerativeAiInferenceClient> {
    return this.clientFactory.getClient(endpointOverride);
  }

  private getRequestOptions(
    perRequestOptions?: OCIEmbeddingSettings['requestOptions']
  ): Required<RequestOptions> {
    return resolveRequestOptions(this.config.requestOptions, perRequestOptions);
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
      const response = await executeWithResilience(
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
        this.getRequestOptions(ociOptions?.requestOptions)
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
