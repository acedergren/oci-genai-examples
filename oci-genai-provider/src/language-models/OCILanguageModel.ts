import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  SharedV3Warning,
  LanguageModelV3FinishReason,
  LanguageModelV3Usage,
  LanguageModelV3Content,
} from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { GenerativeAiInferenceClient, models as OCIModel } from 'oci-generativeaiinference';
import type { OCIConfig, RequestOptions } from '../types';
import { isValidModelId, getModelMetadata, supportsReasoning } from './registry';
import { convertToOCIMessages } from './converters/messages';
import type { OCIMessage } from './converters/messages';
import { convertToCohereFormat } from './converters/cohere-messages';
import { convertToOCITools, convertToOCIToolChoice, supportsToolCalling } from './converters/tools';
import { parseSSEStream } from '../shared/streaming/sse-parser';
import { getCompartmentId } from '../auth/index.js';
import { handleOCIError } from '../shared/errors/index.js';
import {
  getOCIProviderOptions,
  resolveCompartmentId,
  resolveServingMode,
} from '../shared/provider-options';
import { resolveRequestOptions } from '../shared/request-options';
import { OCIClientFactory } from '../shared/client-factory';
import { executeWithResilience } from '../shared/resilience';
import {
  type OCIApiFormat,
  toOCIReasoningEffort,
  createThinkingConfig,
} from '../shared/oci-sdk-types';

type ChatRequest =
  | OCIModel.GenericChatRequest
  | OCIModel.CohereChatRequest
  | OCIModel.CohereChatRequestV2;

export class OCILanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3';
  readonly provider = 'oci-genai';
  readonly defaultObjectGenerationMode = 'tool';
  readonly supportedUrls: Record<string, RegExp[]> = {};
  private clientFactory: OCIClientFactory<GenerativeAiInferenceClient>;

  constructor(
    public readonly modelId: string,
    private readonly config: OCIConfig
  ) {
    if (!isValidModelId(modelId)) {
      throw new NoSuchModelError({
        modelId,
        modelType: 'languageModel',
      });
    }

    this.clientFactory = new OCIClientFactory(GenerativeAiInferenceClient, config);
  }

  private async getClient(endpointOverride?: string): Promise<GenerativeAiInferenceClient> {
    try {
      return await this.clientFactory.getClient(endpointOverride);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error during client initialization';
      throw new Error(
        `Failed to initialize OCI client: ${message}. ` +
          `Check your OCI configuration (config file, credentials, region).`
      );
    }
  }

  private getRequestOptions(perRequestOptions?: RequestOptions): Required<RequestOptions> {
    return resolveRequestOptions(this.config.requestOptions, perRequestOptions);
  }

  private getApiFormat(): OCIApiFormat {
    const metadata = getModelMetadata(this.modelId);
    if (metadata?.family === 'cohere') {
      // COHEREV2 format is required for vision-capable Cohere models
      if (metadata.capabilities?.vision) {
        return 'COHEREV2';
      }
      return 'COHERE';
    }
    return 'GENERIC';
  }


  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const { stream, response, request } = await this.doStream(options);
    const reader = stream.getReader();
    const warnings: SharedV3Warning[] = [];
    const content: LanguageModelV3Content[] = [];
    let usage: LanguageModelV3Usage = {
      inputTokens: {
        total: 0,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 0,
        text: undefined,
        reasoning: undefined,
      },
    };
    let finishReason: LanguageModelV3FinishReason = {
      unified: 'other',
      raw: 'initializing',
    };
    let providerMetadata: Record<string, any> | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        switch (value.type) {
          case 'text-delta': {
            const last = content[content.length - 1];
            if (last?.type === 'text') {
              last.text += value.delta;
            } else {
              content.push({ type: 'text', text: value.delta });
            }
            break;
          }
          case 'reasoning-delta': {
            const last = content[content.length - 1];
            if (last?.type === 'reasoning') {
              last.text += value.delta;
            } else {
              content.push({ type: 'reasoning', text: value.delta });
            }
            break;
          }
          case 'tool-call':
            content.push({
              type: 'tool-call',
              toolCallId: value.toolCallId,
              toolName: value.toolName,
              input: value.input,
            });
            break;
          case 'finish':
            finishReason = value.finishReason;
            usage = value.usage;
            providerMetadata = value.providerMetadata;
            break;
          case 'error':
            throw value.error;
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content,
      usage,
      finishReason,
      request,
      response,
      warnings,
      providerMetadata,
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const messages: OCIMessage[] = convertToOCIMessages(options.prompt);
    const ociOptions = getOCIProviderOptions(options.providerOptions);
    const client = await this.getClient(ociOptions?.endpoint);
    const compartmentId = resolveCompartmentId(
      getCompartmentId(this.config),
      ociOptions?.compartmentId
    );
    const apiFormat = this.getApiFormat();
    const warnings: SharedV3Warning[] = [];

    if (options.responseFormat?.type === 'json') {
      warnings.push({
        type: 'unsupported',
        feature: 'responseFormat.json',
        details: 'OCI response format JSON is not supported in this provider.',
      });
    }

    const modelSupportsTools = supportsToolCalling(this.modelId);
    const modelSupportsReasoning = supportsReasoning(this.modelId);
    const hasTools = options.tools && options.tools.length > 0;
    const functionTools = hasTools ? options.tools!.filter((t) => t.type === 'function') : [];

    // Add tools warning for unsupported models (matching doGenerate)
    if (hasTools && !modelSupportsTools) {
      warnings.push({
        type: 'unsupported',
        feature: 'tools',
        details: `Model ${this.modelId} does not support tool calling. Supported: Llama 3.1+, Cohere Command R/R+, Grok, Gemini.`,
      });
    }

    // Add reasoning model validation (matching doGenerate)
    if (ociOptions?.reasoningEffort && !modelSupportsReasoning) {
      warnings.push({
        type: 'unsupported',
        feature: 'reasoningEffort',
        details: `Model ${this.modelId} does not support reasoning. Use a reasoning model like xai.grok-4-1-fast-reasoning or cohere.command-a-reasoning-08-2025.`,
      });
    }

    if (ociOptions?.thinking && !modelSupportsReasoning) {
      warnings.push({
        type: 'unsupported',
        feature: 'thinking',
        details: `Model ${this.modelId} does not support thinking/reasoning. Use a reasoning model like cohere.command-a-reasoning-08-2025.`,
      });
    }

    try {
      const commonParams = {
        maxTokens: options.maxOutputTokens ? Math.min(options.maxOutputTokens, 4000) : undefined,
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK ? Math.min(options.topK, 40) : undefined,
        isStream: true,
      };

      const toolParams =
        modelSupportsTools && functionTools.length > 0
          ? {
              tools: convertToOCITools(functionTools, apiFormat),
              ...(options.toolChoice
                ? { toolChoice: convertToOCIToolChoice(options.toolChoice) }
                : {}),
            }
          : {};

      let chatRequest: ChatRequest;
      if (apiFormat === 'COHEREV2') {
        chatRequest = {
          apiFormat,
          messages: messages.map((m) => {
            const content: OCIModel.CohereContentV2[] = m.content.map((c) => {
              if (c.type === 'IMAGE') {
                return {
                  type: 'IMAGE_URL',
                  imageUrl: c.imageUrl as OCIModel.CohereImageUrlV2,
                } as OCIModel.CohereImageContentV2;
              }
              return { type: 'TEXT', text: c.text ?? '' } as OCIModel.CohereTextContentV2;
            });
            return {
              role: m.role,
              content,
            } as OCIModel.CohereMessageV2;
          }),
          ...commonParams,
          ...toolParams,
        } as OCIModel.CohereChatRequestV2;
      } else if (apiFormat === 'COHERE') {
        chatRequest = {
          apiFormat,
          ...convertToCohereFormat(messages),
          ...commonParams,
          ...toolParams,
        } as OCIModel.CohereChatRequest;
      } else {
        const mappedMessages = messages.map((m) => {
          // OCI API requires content to be null (not empty array) when assistant has tool calls
          // See: AssistantMessage docs - "When responding to a tool call, set content to null"
          const hasToolCalls = m.toolCalls && m.toolCalls.length > 0;
          const hasContent = m.content && m.content.length > 0;

          return {
            role: m.role,
            // Set content to null for assistant messages with tool calls but no text
            content:
              m.role === 'ASSISTANT' && hasToolCalls && !hasContent
                ? null
                : (m.content as OCIModel.ChatContent[]),
            toolCalls: m.toolCalls,
            toolCallId: m.toolCallId,
          };
        }) as OCIModel.Message[];

        chatRequest = {
          apiFormat,
          messages: mappedMessages,
          ...commonParams,
          ...toolParams,
          stop: options.stopSequences,
        } as OCIModel.GenericChatRequest;
      }

      if (ociOptions?.reasoningEffort && apiFormat === 'GENERIC') {
        const genericReq = chatRequest as OCIModel.GenericChatRequest;
        genericReq.reasoningEffort = toOCIReasoningEffort(ociOptions.reasoningEffort) as any;
      }

      if (ociOptions?.thinking && (apiFormat === 'COHEREV2' || apiFormat === 'COHERE')) {
        const cohereReq = chatRequest as OCIModel.CohereChatRequestV2;
        cohereReq.thinking = createThinkingConfig(true, ociOptions.tokenBudget) as any;
      }

      if (options.seed !== undefined) chatRequest.seed = options.seed;

      const response = (await executeWithResilience<unknown>(
        () =>
          client.chat({
            chatDetails: {
              compartmentId,
              servingMode: resolveServingMode(
                this.modelId,
                this.config.servingMode,
                ociOptions?.servingMode
              ),
              chatRequest,
            },
          }),
        'OCI chat stream',
        this.getRequestOptions(ociOptions?.requestOptions)
      )) as {
        body?: ReadableStream<Uint8Array>;
        headers?: { entries(): IterableIterator<[string, string]> };
      };

      // response can be ReadableStream (Browser/new SDK) or Response object (Node/Fetch polyfill)
      // Some mocks might just return the stream directly.
      const streamInput = response.body ?? (response as unknown as ReadableStream<Uint8Array>);

      if (!streamInput) {
        throw new Error('No stream received from OCI.');
      }

      const stream = parseSSEStream(streamInput, {
        includeRawChunks: options.includeRawChunks,
      });

      const headers = response.headers ? Object.fromEntries(response.headers.entries()) : undefined;

      return {
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });

            let hasText = false;
            let hasReasoning = false;
            const textId = `text-${Date.now()}`;
            const reasoningId = `reasoning-${Date.now()}`;

            try {
              for await (const part of stream) {
                switch (part.type) {
                  case 'text-delta':
                    if (!hasText) {
                      controller.enqueue({ type: 'text-start', id: textId });
                      hasText = true;
                    }
                    controller.enqueue({
                      type: 'text-delta',
                      delta: part.textDelta,
                      id: textId,
                    });
                    break;
                  case 'reasoning-delta':
                    if (!hasReasoning) {
                      controller.enqueue({ type: 'reasoning-start', id: reasoningId });
                      hasReasoning = true;
                    }
                    controller.enqueue({
                      type: 'reasoning-delta',
                      delta: part.reasoningDelta,
                      id: reasoningId,
                    });
                    break;
                  case 'tool-call':
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: part.toolCallId,
                      toolName: part.toolName,
                      input: part.input,
                    });
                    break;
                  case 'finish':
                    if (hasText) {
                      controller.enqueue({ type: 'text-end', id: textId });
                    }
                    if (hasReasoning) {
                      controller.enqueue({ type: 'reasoning-end', id: reasoningId });
                    }
                    controller.enqueue({
                      type: 'finish',
                      finishReason: part.finishReason,
                      usage: {
                        inputTokens: {
                          total: part.usage.promptTokens,
                          noCache: undefined,
                          cacheRead: undefined,
                          cacheWrite: undefined,
                        },
                        outputTokens: {
                          total: part.usage.completionTokens,
                          text:
                            part.usage.reasoningTokens !== undefined
                              ? part.usage.completionTokens - part.usage.reasoningTokens
                              : part.usage.completionTokens,
                          reasoning: part.usage.reasoningTokens,
                        },
                      },
                      providerMetadata: {
                        oci: { requestId: headers?.['opc-request-id'] },
                      },
                    });
                    break;
                  case 'raw':
                    controller.enqueue({ type: 'raw', rawValue: part.rawValue });
                    break;
                }
              }
            } catch (error) {
              controller.enqueue({ type: 'error', error });
            } finally {
              controller.close();
            }
          },
        }),
        request: { body: JSON.stringify(messages) },
        response: {
          headers,
        },
      };
    } catch (error) {
      throw handleOCIError(error);
    }
  }
}
