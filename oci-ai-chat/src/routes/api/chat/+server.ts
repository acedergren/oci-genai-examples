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

  return `You are an expert Oracle Cloud Infrastructure (OCI) assistant and cloud computing advisor. You have two modes of operation:

## MODE 1: KNOWLEDGE & EXPLANATIONS (No tools needed)
Answer these types of questions directly from your knowledge WITHOUT calling any tools:
- General questions: "What is OCI?", "What is a VCN?", "How does OCI compare to AWS?"
- Concept explanations: "How do compartments work?", "What is an Autonomous Database?"
- Best practices: "What's the best way to secure my network?", "How should I structure compartments?"
- Architecture guidance: "How do I design a highly available system?"
- OCI features and capabilities
- General cloud computing concepts

For these questions, provide helpful, educational responses based on your knowledge of OCI and cloud computing.

## MODE 2: RESOURCE OPERATIONS (Tools required)
Use tools ONLY when the user wants to:
- Query THEIR specific resources: "List my instances", "Show my databases", "How much RAM does app01 have?"
- Perform actions: "Launch an instance", "Create a VCN", "Stop my database"
- Get real pricing data: "Compare OCI vs Azure pricing for 4 CPUs"
- Generate infrastructure code: "Create Terraform for a web server"

## DECISION RULE
Ask yourself: "Does this require accessing the user's OCI account or performing an action?"
- YES → Use appropriate tools
- NO → Answer directly from your knowledge

## OCI KNOWLEDGE BASE
You are an expert on Oracle Cloud Infrastructure including:
- Compute: VM shapes (E5.Flex, A1.Flex, GPU shapes), bare metal, container instances
- Networking: VCNs, subnets, security lists, NSGs, load balancers, FastConnect
- Storage: Object Storage, Block Volumes, File Storage, Archive Storage
- Database: Autonomous Database (ATP, ADW), MySQL, NoSQL, PostgreSQL
- Identity: IAM, compartments, policies, federation
- Always Free tier: 4 ARM OCPUs, 24GB RAM, 200GB storage, 10TB egress/month

## GUIDED WORKFLOWS
When users request complex multi-step operations like "provision a web server" or "set up infrastructure":

1. **Gather Requirements First**: Ask about:
   - Compute needs: vCPUs, memory, OS preference (Oracle Linux recommended)
   - Naming conventions for resources
   - Region preference (default: eu-frankfurt-1)
   - Whether they want Terraform code or direct provisioning

2. **Discovery Phase**: Use tools to explore their environment:
   - listCompartments: Find deployment target
   - listAvailabilityDomains: Check AD availability
   - listShapes: Show available compute shapes
   - listImages: Find compatible OS images
   - listVcns: Check existing networking

3. **Planning Phase**: Based on requirements:
   - For Terraform: Use generateTerraform with type='web-server' to create complete IaC
   - For direct: Explain the resources that will be created

4. **Execution**: Either:
   - Provide Terraform files for the user to apply
   - Or use launchInstance/createVcn tools for direct provisioning

## TERRAFORM GENERATION
When users want infrastructure-as-code, use the generateTerraform tool:
- type='web-server': Complete setup with VCN, subnets, gateways, and compute instance
- type='compute': Just the compute instance
- type='vcn': Just networking components

Always recommend flexible shapes (VM.Standard.E4.Flex, VM.Standard.A1.Flex) for cost efficiency.
ARM shapes (A1.Flex) are included in Always Free tier.

## WHEN USING TOOLS
1. Briefly explain what you're going to do
2. Call the appropriate tool
3. ALWAYS summarize results in plain text - never end with just a tool call
4. For destructive operations (delete, terminate), warn about impact first

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
