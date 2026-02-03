import { tool, type ModelMessage, type CoreTool } from 'ai';
import { z } from 'zod';
import { LLMClient, calculateCost, type StreamCallbacks, type ToolCallInfo } from './llm-client.js';
import { toolExecutor, toAISDKTools, getAllTools, type PendingToolCall } from '../tools/index.js';
import { getMCPManager, getMCPToolsForAISDK } from './mcp-service.js';

export interface AgentConfig {
  model: string;
  region: string;
  compartmentId?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  systemPrompt?: string;
  /** Enable built-in OCI tools */
  enableOCITools?: boolean;
  /** Enable MCP tools */
  enableMCPTools?: boolean;
}

export interface AgentCallbacks extends StreamCallbacks {
  onThinking?: (thought: string) => void;
  onToolCall?: (tool: ToolCallInfo) => void;
  onToolResult?: (result: { id: string; success: boolean; data?: unknown; error?: string }) => void;
  onPendingApproval?: (pending: PendingToolCall) => void;
  onIterationStart?: (iteration: number) => void;
  onComplete?: (result: { text: string; iterations: number; totalTokens: number; cost: number }) => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert Oracle Cloud Infrastructure (OCI) assistant with access to OCI management tools.

You help users manage their OCI resources including:
- Compute instances
- Networking (VCNs, subnets, security lists)
- Storage (Object Storage, Block Volumes)
- Databases (Autonomous Database, DB Systems)
- Identity (compartments, users, policies)
- Monitoring and observability

When asked to perform operations:
1. First explain what you're going to do
2. Use the appropriate tools to execute the operation
3. Report the results clearly

Always be cautious with destructive operations (delete, terminate) and explain the impact before executing.`;

/**
 * Agent executor for multi-step agentic interactions
 */
export class AgentExecutor {
  private client: LLMClient;
  private config: AgentConfig;
  private messages: ModelMessage[] = [];
  private totalTokens = 0;
  private totalCost = 0;

  constructor(config: AgentConfig) {
    this.config = {
      maxIterations: 10,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      enableOCITools: true,
      enableMCPTools: true,
      ...config,
    };

    this.client = new LLMClient({
      model: config.model,
      region: config.region,
      compartmentId: config.compartmentId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Initialize with system prompt
    this.messages = [
      { role: 'system', content: this.config.systemPrompt! },
    ];

    // Set up tool approval callbacks
    toolExecutor.setPendingApprovalCallback((pending) => {
      // This will be connected to the UI
    });
  }

  /**
   * Get all available tools (OCI + MCP)
   */
  private getTools(): Record<string, CoreTool> {
    const tools: Record<string, CoreTool> = {};

    // Add OCI tools if enabled
    if (this.config.enableOCITools) {
      const ociTools = toAISDKTools();
      Object.assign(tools, ociTools);
    }

    // Add MCP tools if enabled
    if (this.config.enableMCPTools) {
      const mcpTools = getMCPToolsForAISDK();
      Object.assign(tools, mcpTools);
    }

    return tools;
  }

  /**
   * Execute a user message and run the agent loop
   */
  async execute(userMessage: string, callbacks: AgentCallbacks = {}): Promise<string> {
    // Add user message
    this.messages.push({ role: 'user', content: userMessage });

    let iterations = 0;
    let finalResponse = '';
    const maxIterations = this.config.maxIterations!;

    // Get available tools
    const tools = this.getTools();
    const hasTools = Object.keys(tools).length > 0;

    // Agent loop - with tools, the AI SDK handles multi-step internally
    // We run once and let maxSteps handle tool iterations
    iterations = 1;
    callbacks.onIterationStart?.(iterations);

    // Get LLM response with tools
    const response = await this.client.streamCompletion(
      this.messages,
      {
        onStart: callbacks.onStart,
        onText: callbacks.onText,
        onToolCall: (toolCall) => {
          callbacks.onToolCall?.(toolCall);
        },
        onToolResult: (toolId, result) => {
          callbacks.onToolResult?.({
            id: toolId,
            success: true,
            data: result,
          });
        },
        onFinish: (result) => {
          if (result.usage) {
            this.totalTokens += result.usage.inputTokens + result.usage.outputTokens;
            this.totalCost += calculateCost(
              this.config.model,
              result.usage.inputTokens,
              result.usage.outputTokens
            );
          }

          // Count tool calls as iterations for reporting
          if (result.toolCalls) {
            iterations = result.toolCalls.length + 1;
          }
        },
        onError: callbacks.onError,
      },
      {
        tools: hasTools ? tools : undefined,
        maxSteps: maxIterations,
      }
    );

    // Add assistant response to history
    this.messages.push({ role: 'assistant', content: response });
    finalResponse = response;

    callbacks.onComplete?.({
      text: finalResponse,
      iterations,
      totalTokens: this.totalTokens,
      cost: this.totalCost,
    });

    return finalResponse;
  }

  /**
   * Get conversation messages
   */
  getMessages(): ModelMessage[] {
    return [...this.messages];
  }

  /**
   * Clear conversation history (keeps system prompt)
   */
  clearHistory(): void {
    this.messages = [this.messages[0]]; // Keep system prompt
    this.totalTokens = 0;
    this.totalCost = 0;
  }

  /**
   * Restore messages from a previous session
   */
  restoreMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>): void {
    for (const msg of messages) {
      this.messages.push(msg);
    }
  }

  /**
   * Get session stats
   */
  getStats(): { totalTokens: number; totalCost: number } {
    return {
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
    };
  }

  /**
   * Approve a pending tool call
   */
  approveTool(toolId: string): void {
    toolExecutor.approve(toolId);
  }

  /**
   * Reject a pending tool call
   */
  rejectTool(toolId: string): void {
    toolExecutor.reject(toolId);
  }

  /**
   * Check if there's a pending approval
   */
  hasPendingApproval(): boolean {
    return toolExecutor.hasPendingApprovals();
  }

  /**
   * Get pending approval
   */
  getPendingApproval(): PendingToolCall | undefined {
    return toolExecutor.getPendingApproval();
  }
}
