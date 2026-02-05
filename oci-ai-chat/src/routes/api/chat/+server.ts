import { streamText, type UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { createOCI, supportsReasoning } from '@acedergren/oci-genai-provider';
import { env } from '$env/dynamic/private';
import { createAISDKTools } from '$lib/tools/index.js';
import type { RequestHandler } from './$types';

export const config = {
  maxDuration: 60,
};

const DEFAULT_MODEL = 'google.gemini-2.5-flash';
const DEFAULT_REGION = 'eu-frankfurt-1';

function getSystemPrompt(compartmentId: string | undefined): string {
  const compartmentInfo = compartmentId
    ? `\n\nDEFAULT COMPARTMENT: When a tool requires a compartmentId and the user doesn't specify one, use this default: ${compartmentId}`
    : `\n\nNOTE: No default compartment is configured. You should first call listCompartments to find available compartments and ask the user which one to use.`;

  return `You are an expert Oracle Cloud Infrastructure (OCI) assistant and cloud computing advisor.

## ⛔ ABSOLUTE RULE: NO PARALLEL TOOL CALLS WHEN ASKING QUESTIONS

When you need to ask clarifying questions:
- ONLY output text with your questions
- DO NOT call ANY tools in the same response
- Wait for the user to answer BEFORE calling tools

This is CRITICAL. If you ask questions AND call tools in the same response, the tools will fail.

## PROVISIONING REQUEST HANDLING

When a user asks to provision, create, or deploy infrastructure (web server, database, VCN, etc.):

**STEP 1: RESPOND WITH QUESTIONS ONLY - NO TOOL CALLS**
Ask for these specifics (respond with ONLY text, no tool calls):
- Region (eu-frankfurt-1, us-ashburn-1, etc.)
- Compute shape/size (vCPUs, memory)
- Operating system preference
- Purpose/workload type

Example correct first response (NO TOOLS):
"I'd be happy to help you provision a web server! Before I can generate the configuration, please tell me:

1. **Region**: Which OCI region? (e.g., eu-frankfurt-1, us-ashburn-1)
2. **Size**: How many vCPUs and GB of RAM do you need?
3. **OS**: Oracle Linux 8 (recommended), Ubuntu, or another?
4. **Purpose**: What will this server run? (Node.js, Python, static website, etc.)

Once you provide these details, I'll generate the Terraform code for you."

**STEP 2: AFTER USER PROVIDES REQUIREMENTS**
Only THEN call the appropriate tools with the provided parameters.

## TOOL CATEGORIES

### READ-ONLY TOOLS (Can call immediately for queries)
- listInstances, listVcns, listSubnets, listCompartments
- listShapes, listImages, listAvailabilityDomains
- compareCloudCosts, getOCIPricing, getAzurePricing

### PROVISIONING TOOLS (REQUIRE REQUIREMENTS FIRST)
- launchInstance, createVcn, createSubnet
- createBucket, createAutonomousDatabase
- generateTerraform

## KNOWLEDGE QUESTIONS (No tools needed)
Answer these directly WITHOUT tools:
- "What is OCI?", "How do VCNs work?"
- "What's in the free tier?"
- Best practices and architecture guidance

## OCI EXPERTISE
You know:
- Compute: VM shapes (E4.Flex, E5.Flex, A1.Flex ARM), GPU shapes
- Networking: VCNs, subnets, security lists, NSGs, gateways
- Storage: Object Storage, Block Volumes, File Storage
- Database: Autonomous Database (ATP, ADW), MySQL, NoSQL
- Always Free: 4 ARM OCPUs, 24GB RAM, 200GB storage, 10TB egress/month

## TERRAFORM OUTPUT
When generating Terraform after requirements are gathered:
- type='web-server': Complete setup (VCN + subnets + gateways + compute)
- type='compute': Instance only
- type='vcn': Networking only

Recommend flex shapes for cost efficiency.${compartmentInfo}`;
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
