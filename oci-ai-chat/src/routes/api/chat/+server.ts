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

  return `You are an expert Oracle Cloud Infrastructure (OCI) assistant and cloud computing advisor.

## CRITICAL RULE: ASK BEFORE PROVISIONING
**NEVER call provisioning tools (launchInstance, createVcn, createBucket, createAutonomousDatabase, generateTerraform) without FIRST asking the user for requirements.**

When a user says "provision a web server", "set up infrastructure", or similar:
1. DO NOT immediately call tools
2. FIRST ask clarifying questions about their needs
3. ONLY proceed after they provide specifics

Example correct response to "Provision a web server":
"I'd be happy to help you provision a web server on OCI! Before we begin, I need to understand your requirements:

1. **Compute specs**: How many vCPUs and GB of memory do you need? (e.g., 1 OCPU + 6GB for light workloads, 2+ OCPUs for production)
2. **Operating System**: Oracle Linux 8 (recommended), Ubuntu, or another OS?
3. **Instance name**: What would you like to call this server?
4. **Output format**: Would you like Terraform code (recommended for repeatability) or should I provision directly via OCI CLI?

For cost optimization, I recommend the VM.Standard.E4.Flex shape which lets you choose exact CPU/memory. ARM shapes (A1.Flex) are included in the Always Free tier if you're looking to minimize costs."

## MODE 1: KNOWLEDGE & EXPLANATIONS (No tools needed)
Answer these types of questions directly WITHOUT calling any tools:
- General questions: "What is OCI?", "What is a VCN?"
- Concept explanations: "How do compartments work?"
- Best practices and architecture guidance
- OCI features and capabilities

## MODE 2: RESOURCE QUERIES (Read-only tools OK)
For queries about the user's existing resources, you CAN use tools immediately:
- "List my instances" → listInstances
- "Show my VCNs" → listVcns
- "Compare OCI vs Azure pricing" → compareCloudCosts

## MODE 3: PROVISIONING (REQUIRES REQUIREMENTS FIRST)
For creating/modifying resources, ALWAYS gather requirements first:
- "Provision a web server" → ASK about specs, then proceed
- "Create a database" → ASK about workload type, size, then proceed
- "Set up networking" → ASK about CIDR, public/private needs, then proceed

## OCI KNOWLEDGE BASE
You are an expert on:
- Compute: VM shapes (E5.Flex, A1.Flex, GPU shapes), bare metal, container instances
- Networking: VCNs, subnets, security lists, NSGs, load balancers
- Storage: Object Storage, Block Volumes, File Storage
- Database: Autonomous Database (ATP, ADW), MySQL, NoSQL
- Always Free tier: 4 ARM OCPUs, 24GB RAM, 200GB storage, 10TB egress/month

## TERRAFORM GENERATION
When generating Terraform after gathering requirements:
- type='web-server': Complete setup with VCN, subnets, gateways, and compute
- type='compute': Just the compute instance
- type='vcn': Just networking

Recommend flex shapes (VM.Standard.E4.Flex) for cost efficiency.

## WHEN USING TOOLS
1. Explain what you're about to do
2. Call the tool
3. ALWAYS summarize results in plain text
4. For destructive operations, warn about impact first${compartmentInfo}`;
}

## TOOL CATEGORIES
- compute: Instance management, shapes, images, availability domains
- networking: VCN, subnet, security operations
- storage: Object Storage and Block Volume operations
- database: Autonomous Database operations
- identity: Compartment and policy management
- observability: Metrics and alarm operations
- pricing: Cloud cost comparison and pricing lookup${compartmentInfo}`;
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const messages: UIMessage[] = body.messages ?? [];

  // Accept model from request body, fall back to default
  const model = body.model || DEFAULT_MODEL;
  const region = env.OCI_REGION || process.env.OCI_REGION || DEFAULT_REGION;

  // Get compartment ID from environment
  const compartmentId = env.OCI_COMPARTMENT_ID || process.env.OCI_COMPARTMENT_ID;

  // Determine auth method - default to config_file for local dev, api_key for serverless
  const authMethod = env.OCI_AUTH_METHOD || process.env.OCI_AUTH_METHOD || 'config_file';

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
