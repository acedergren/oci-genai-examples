import { streamText, type ModelMessage, type CoreTool } from 'ai';
import { createOCI } from '@acedergren/oci-genai-provider';

export interface LLMClientConfig {
  model: string;
  region: string;
  compartmentId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface StreamCallbacks {
  onStart?: () => void;
  onText?: (text: string) => void;
  onToolCall?: (toolCall: ToolCallInfo) => void;
  onToolResult?: (toolId: string, result: unknown) => void;
  onFinish?: (result: {
    text: string;
    usage?: { inputTokens: number; outputTokens: number };
    toolCalls?: ToolCallInfo[];
  }) => void;
  onError?: (error: Error) => void;
}

export interface StreamOptions {
  /** Tools to make available to the model */
  tools?: Record<string, CoreTool>;
  /** Maximum number of tool call steps */
  maxSteps?: number;
}

/**
 * LLM client for OCI GenAI
 */
export class LLMClient {
  private config: LLMClientConfig;
  private provider: ReturnType<typeof createOCI>;

  constructor(config: LLMClientConfig) {
    this.config = config;
    this.provider = createOCI({
      compartmentId: config.compartmentId || process.env.OCI_COMPARTMENT_ID,
      region: config.region || process.env.OCI_REGION,
    });
  }

  /**
   * Stream a completion with callbacks
   */
  async streamCompletion(
    messages: ModelMessage[],
    callbacks: StreamCallbacks = {},
    options: StreamOptions = {}
  ): Promise<string> {
    const model = this.provider.languageModel(this.config.model);

    callbacks.onStart?.();

    let fullText = '';
    const toolCalls: ToolCallInfo[] = [];

    try {
      const result = await streamText({
        model,
        messages,
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        tools: options.tools,
        maxSteps: options.maxSteps ?? 5,
        onStepFinish: async (event) => {
          // Handle tool calls from each step
          if (event.toolCalls && event.toolCalls.length > 0) {
            for (const tc of event.toolCalls) {
              const toolCall: ToolCallInfo = {
                id: tc.toolCallId,
                name: tc.toolName,
                args: tc.args as Record<string, unknown>,
              };
              toolCalls.push(toolCall);
              callbacks.onToolCall?.(toolCall);
            }
          }

          // Handle tool results from each step
          if (event.toolResults && event.toolResults.length > 0) {
            for (const tr of event.toolResults) {
              callbacks.onToolResult?.(tr.toolCallId, tr.result);
            }
          }
        },
      });

      // Process the stream
      for await (const part of result.textStream) {
        fullText += part;
        callbacks.onText?.(part);
      }

      // Get final usage stats (usage is a Promise in AI SDK 6.0)
      const usage = await result.usage;

      callbacks.onFinish?.({
        text: fullText,
        usage:
          usage?.inputTokens !== undefined && usage?.outputTokens !== undefined
            ? {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              }
            : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      return fullText;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Update client configuration
   */
  updateConfig(updates: Partial<LLMClientConfig>): void {
    this.config = { ...this.config, ...updates };

    // Recreate provider if region or compartment changed
    if (updates.region || updates.compartmentId) {
      this.provider = createOCI({
        compartmentId: this.config.compartmentId || process.env.OCI_COMPARTMENT_ID,
        region: this.config.region || process.env.OCI_REGION,
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LLMClientConfig> {
    return { ...this.config };
  }
}

// Model pricing (per 1K tokens)
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'meta.llama-3.3-70b-instruct': { prompt: 0.00035, completion: 0.0004 },
  'cohere.command-r-plus': { prompt: 0.003, completion: 0.015 },
  'cohere.command-a-03-2025': { prompt: 0.0022, completion: 0.0088 },
};

/**
 * Calculate cost for token usage
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const price = MODEL_PRICING[model] ?? { prompt: 0.001, completion: 0.002 };
  return (promptTokens * price.prompt + completionTokens * price.completion) / 1000;
}
