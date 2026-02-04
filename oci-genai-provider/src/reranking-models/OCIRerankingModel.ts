import type {
  RerankingModelV3,
  RerankingModelV3CallOptions,
  JSONObject,
  SharedV3Warning,
} from '@ai-sdk/provider';
import { InvalidArgumentError, NoSuchModelError } from '@ai-sdk/provider';
import { GenerativeAiInferenceClient } from 'oci-generativeaiinference';
import { Region } from 'oci-common';
import { createAuthProvider, getCompartmentId, getRegion } from '../auth';
import { getRerankingModelMetadata, isValidRerankingModelId } from './registry';
import type { OCIRerankingSettings, RequestOptions } from '../types';
import { handleOCIError } from '../shared/errors';
import { withRetry, withTimeout, isRetryableError } from '../shared/utils';
import {
  getOCIProviderOptions,
  resolveCompartmentId,
  resolveEndpoint,
  resolveServingMode,
} from '../shared/provider-options';
import { resolveRequestOptions } from '../shared/request-options';

export class OCIRerankingModel implements RerankingModelV3 {
  readonly specificationVersion = 'v3';
  readonly provider = 'oci-genai';

  private _clientCache = new Map<string, GenerativeAiInferenceClient>();

  constructor(
    readonly modelId: string,
    private config: OCIRerankingSettings
  ) {
    if (!isValidRerankingModelId(modelId)) {
      throw new NoSuchModelError({
        modelId,
        modelType: 'rerankingModel',
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

  private getRequestOptions(perRequestOptions?: RequestOptions): Required<RequestOptions> {
    return resolveRequestOptions(this.config.requestOptions, perRequestOptions);
  }

  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
    requestOptions?: RequestOptions
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

  async doRerank(options: RerankingModelV3CallOptions): Promise<{
    ranking: Array<{
      index: number;
      relevanceScore: number;
    }>;
    providerMetadata?: Record<string, JSONObject>;
    warnings?: SharedV3Warning[];
    response?: {
      id?: string;
      timestamp?: Date;
      modelId?: string;
      headers?: Record<string, string>;
      body?: unknown;
    };
  }> {
    const { query, documents, topN } = options;

    if (documents.type !== 'text') {
      throw new InvalidArgumentError({
        argument: 'documents',
        message: `OCI reranking only supports text documents, got: ${documents.type}`,
      });
    }

    const documentTexts = documents.values;
    const metadata = getRerankingModelMetadata(this.modelId);

    if (metadata && documentTexts.length > metadata.maxDocuments) {
      throw new Error(
        `Document count (${documentTexts.length}) exceeds maximum allowed (${metadata.maxDocuments})`
      );
    }

    const ociOptions = getOCIProviderOptions(options.providerOptions);
    const client = await this.getClient(ociOptions?.endpoint);
    const compartmentId = resolveCompartmentId(
      getCompartmentId(this.config),
      ociOptions?.compartmentId
    );
    const warnings: SharedV3Warning[] = [];

    try {
      const response = await this.executeWithResilience<any>(
        () =>
          (client as any).rerankText({
            rerankTextDetails: {
              servingMode: resolveServingMode(
                this.modelId,
                this.config.servingMode,
                ociOptions?.servingMode
              ),
              compartmentId,
              input: query,
              documents: documentTexts,
              topN: topN ?? this.config.topN,
              isEcho: this.config.returnDocuments ?? false,
            },
          }),
        'OCI rerank request',
        ociOptions?.requestOptions
      );

      const documentRanks = response.rerankTextResult?.documentRanks ?? [];
      const ranking = documentRanks.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (rank: any, i: number) => {
          // Warn about missing fields to help detect data quality issues
          if (rank.index === undefined || rank.index === null) {
            warnings.push({
              type: 'other',
              message: `Missing index for rank at position ${i}, defaulting to 0`,
            });
          }
          if (rank.relevanceScore === undefined || rank.relevanceScore === null) {
            warnings.push({
              type: 'other',
              message: `Missing relevanceScore for rank at position ${i}, defaulting to 0`,
            });
          }

          return {
            index: rank.index ?? 0,
            relevanceScore: rank.relevanceScore ?? 0,
          };
        }
      );

      return {
        ranking,
        warnings,
        providerMetadata: {
          oci: {
            requestId: response.opcRequestId,
            modelId: response.rerankTextResult.modelId ?? this.modelId,
          },
        },
        response: {
          id: response.rerankTextResult.id,
          modelId: response.rerankTextResult.modelId,
          headers: response.opcRequestId ? { 'opc-request-id': response.opcRequestId } : undefined,
          body: response,
        },
      };
    } catch (error) {
      throw handleOCIError(error);
    }
  }
}
