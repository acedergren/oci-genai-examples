import { streamText, type UIMessage, convertToModelMessages } from 'ai';
import { createOCI } from '@acedergren/oci-genai-provider';
import { env } from '$env/dynamic/private';
import { getRepository } from '$lib/server/db.js';
import { getOrCreateSession } from '$lib/server/session.js';
import { createAISDKTools, getToolDefinition, inferApprovalLevel } from '$lib/tools/index.js';
import type { RequestHandler } from './$types';

export const config = {
  maxDuration: 60,
};

const DEFAULT_MODEL = 'meta.llama-3.3-70b-instruct';
const DEFAULT_REGION = 'eu-frankfurt-1';

const SYSTEM_PROMPT = `You are an expert Oracle Cloud Infrastructure (OCI) assistant with access to OCI management tools.

You help users manage their OCI resources including:
- Compute instances (list, launch, stop, terminate)
- Networking (VCNs, subnets, security lists)
- Storage (Object Storage buckets, Block Volumes)
- Databases (Autonomous Database)
- Identity (compartments, policies)
- Monitoring and observability (metrics, alarms)

When asked to perform operations:
1. First explain what you're going to do
2. Use the appropriate tools to execute the operation
3. Report the results clearly

IMPORTANT: For destructive operations (delete, terminate, stop), always warn the user about the impact first.

Available tool categories:
- compute: Instance management
- networking: VCN, subnet, security operations
- storage: Object Storage and Block Volume operations
- database: Autonomous Database operations
- identity: Compartment and policy management
- observability: Metrics and alarm operations`;

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();
  const messages: UIMessage[] = body.messages ?? [];
  const toolApprovals: Record<string, boolean> = body.toolApprovals ?? {};

  const repository = getRepository();
  const model = DEFAULT_MODEL;
  const region = env.OCI_REGION || DEFAULT_REGION;

  // Get or create session
  const { sessionId } = getOrCreateSession(cookies, { model, region });

  // Get next turn number
  const existingTurns = repository.getSessionTurns(sessionId);
  const turnNumber = existingTurns.length + 1;
  const isFirstTurn = turnNumber === 1;

  // Extract user message content
  const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
  const userContent = extractTextFromMessage(lastUserMessage);

  // Generate title from first message
  if (isFirstTurn && userContent) {
    const title = generateSessionTitle(userContent);
    repository.updateSession(sessionId, { title });
  }

  // Record the turn with user message
  const turn = repository.addTurn(sessionId, {
    turnNumber,
    userMessage: {
      role: 'user',
      content: userContent,
    },
  });

  // Create OCI client
  const oci = createOCI({
    compartmentId: env.OCI_COMPARTMENT_ID || process.env.OCI_COMPARTMENT_ID,
    region,
  });

  // Convert messages for the model
  const modelMessages = await convertToModelMessages(messages);

  // Add system prompt
  const messagesWithSystem = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...modelMessages,
  ];

  // Create tools with execution wrappers
  const tools = createAISDKTools();

  // Stream the response with tools
  const result = streamText({
    model: oci.languageModel(model),
    messages: messagesWithSystem,
    tools,
    maxSteps: 5, // Allow multi-step tool calling
    onFinish({ text, usage, toolCalls }) {
      // Persist the assistant's response
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;

      try {
        repository.updateTurn(turn.id, {
          assistantResponse: {
            role: 'assistant',
            content: text,
          },
          toolCalls: toolCalls?.map((tc) => ({
            id: tc.toolCallId,
            name: tc.toolName,
            args: tc.args as Record<string, unknown>,
            result: tc.result,
            status: 'completed' as const,
            startedAt: Date.now(),
            completedAt: Date.now(),
          })),
          tokensUsed: inputTokens + outputTokens,
          costUsd: calculateCost(model, inputTokens, outputTokens),
        });

        repository.updateSession(sessionId, {});
      } catch (error) {
        console.error('Failed to persist turn response:', error);
        repository.updateTurn(turn.id, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  return result.toUIMessageStreamResponse();
};

/**
 * Extract text content from a UIMessage
 */
function extractTextFromMessage(message: UIMessage | undefined): string {
  if (!message?.parts) return '';

  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/**
 * Generate a session title from the first user message
 */
function generateSessionTitle(message: string): string {
  // Clean and truncate the message
  const cleaned = message.replace(/\s+/g, ' ').trim();

  // Truncate to ~40 chars, break at word boundary
  if (cleaned.length <= 40) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, 40);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 20) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const prices: Record<string, { prompt: number; completion: number }> = {
    'meta.llama-3.3-70b-instruct': { prompt: 0.00035, completion: 0.0004 },
    'cohere.command-r-plus': { prompt: 0.003, completion: 0.015 },
    'cohere.command-a-03-2025': { prompt: 0.0022, completion: 0.0088 },
  };

  const price = prices[model] ?? { prompt: 0.001, completion: 0.002 };
  return (promptTokens * price.prompt + completionTokens * price.completion) / 1000;
}
