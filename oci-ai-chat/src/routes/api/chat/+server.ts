import { streamText, type UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { createOCI, supportsReasoning } from '@acedergren/oci-genai-provider';
import { env } from '$env/dynamic/private';
import { createAISDKTools } from '$lib/tools/index.js';
import type { RequestHandler } from './$types';

export const config = {
  maxDuration: 60,
};

const DEFAULT_MODEL = 'meta.llama-3.3-70b-instruct';
const DEFAULT_REGION = 'eu-frankfurt-1';

function getSystemPrompt(compartmentId: string | undefined): string {
  const compartmentInfo = compartmentId
    ? `\n\nDEFAULT COMPARTMENT: When a tool requires a compartmentId and the user doesn't specify one, use this default: ${compartmentId}`
    : `\n\nNOTE: No default compartment is configured. You should first call listCompartments to find available compartments and ask the user which one to use.`;

  return `You are an expert Oracle Cloud Infrastructure (OCI) assistant with access to OCI management tools.

You help users manage their OCI resources including:
- Compute instances (list, launch, stop, terminate)
- Networking (VCNs, subnets, security lists)
- Storage (Object Storage buckets, Block Volumes)
- Databases (Autonomous Database)
- Identity (compartments, policies)
- Monitoring and observability (metrics, alarms)

When asked to perform operations:
1. First briefly explain what you're going to do
2. Use the appropriate tools to execute the operation
3. ALWAYS summarize the results in plain text after receiving tool output - never end your response with just a tool call

CRITICAL: After every tool call, you MUST provide a human-readable summary of the results. Do not just call a tool and stop - always explain what was found or what happened.

IMPORTANT: For destructive operations (delete, terminate, stop), always warn the user about the impact first.

Available tool categories:
- compute: Instance management
- networking: VCN, subnet, security operations
- storage: Object Storage and Block Volume operations
- database: Autonomous Database operations
- identity: Compartment and policy management
- observability: Metrics and alarm operations${compartmentInfo}`;
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const messages: UIMessage[] = body.messages ?? [];

  // Accept model from request body, fall back to default
  const model = body.model || DEFAULT_MODEL;
  const region = env.OCI_REGION || process.env.OCI_REGION || DEFAULT_REGION;

  // Get compartment ID from environment
  const compartmentId = env.OCI_COMPARTMENT_ID || process.env.OCI_COMPARTMENT_ID;

  // Determine auth method - use api_key if OCI_AUTH_METHOD is set or if we're in Cloudflare (no config file)
  const authMethod = env.OCI_AUTH_METHOD || process.env.OCI_AUTH_METHOD || 'api_key';

  // Create OCI client with environment-based auth
  const oci = createOCI({
    compartmentId,
    region,
    auth: authMethod as 'config_file' | 'api_key' | 'instance_principal' | 'resource_principal',
  });

  // Convert messages for the model
  const modelMessages = await convertToModelMessages(messages);

  // Create tools (OCI tools only - MCP disabled for stateless deployment)
  const tools = createAISDKTools();

  // Add system prompt with compartment context
  const messagesWithSystem = [
    { role: 'system' as const, content: getSystemPrompt(compartmentId) },
    ...modelMessages,
  ];

  // Build provider options for reasoning if model supports it
  const modelSupportsReasoning = supportsReasoning(model);
  const providerOptions = modelSupportsReasoning
    ? {
        oci: {
          // Gemini uses reasoningEffort, Cohere uses thinking
          reasoningEffort: model.startsWith('google.') ? 'high' : undefined,
          thinking: model.startsWith('cohere.') ? true : undefined,
        },
      }
    : undefined;

  // Stream the response with tools
  const result = streamText({
    model: oci.languageModel(model),
    messages: messagesWithSystem,
    tools,
    providerOptions,
    stopWhen: stepCountIs(5), // AI SDK 6.0: use stopWhen instead of maxSteps
  });

  return result.toUIMessageStreamResponse();
};
