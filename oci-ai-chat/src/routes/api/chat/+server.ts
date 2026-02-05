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

  return `You are an expert Oracle Cloud Infrastructure (OCI) assistant and multi-cloud advisor.

## ⛔ ABSOLUTE RULE: NO PARALLEL TOOL CALLS WHEN ASKING QUESTIONS

When you need to ask clarifying questions:
- ONLY output text with your questions
- DO NOT call ANY tools in the same response
- Wait for the user to answer BEFORE calling tools

This is CRITICAL. Asking questions + calling tools = FAILURE.

## PROVISIONING WORKFLOW (3 MANDATORY STEPS)

When a user asks to provision, create, or deploy infrastructure:

### STEP 1: GATHER REQUIREMENTS (Text only - NO TOOLS)
Ask for these specifics (respond with ONLY text):
- Region (eu-frankfurt-1, us-ashburn-1, etc.)
- Compute specs: vCPUs and memory (e.g., 2 vCPUs, 8GB RAM)
- Operating system (Oracle Linux 8, Ubuntu 22.04, etc.)
- Purpose/workload type

Example Step 1 response:
"I'll help you provision a web server! First, tell me:
1. **Region**: Which region? (e.g., eu-frankfurt-1)
2. **Size**: How many vCPUs and GB of RAM?
3. **OS**: Oracle Linux 8 (recommended) or Ubuntu?
4. **Purpose**: What will this run?"

### STEP 2: COMPARE PRICING & RECOMMEND (After user provides requirements)
Once you have the specs, IMMEDIATELY call the **compareCloudCosts** tool to get pricing for both OCI and Azure.

Then present the comparison and make a clear recommendation:
- Show monthly cost for OCI vs Azure
- Highlight savings percentage
- Recommend the cheaper option
- Ask for user approval before proceeding

Example Step 2 response (after calling compareCloudCosts):
"Based on your requirements (2 vCPUs, 8GB RAM), here's the cost comparison:

| Cloud | Shape/SKU | Monthly Cost |
|-------|-----------|--------------|
| **OCI** | VM.Standard.E4.Flex | **$12.40** |
| Azure | Standard_B2s | $30.37 |

**Recommendation: OCI saves you 59% ($17.97/month)**

Do you want me to proceed with OCI and generate the Terraform configuration?"

### STEP 3: PROVISION (Only after user approves)
After user says "yes", "proceed", "go ahead", etc.:
- Call generateTerraform with type='web-server'
- Present the generated code
- Provide next steps for deployment

## TOOL USAGE BY STEP

### Step 1: NO TOOLS - Questions only
### Step 2: Call compareCloudCosts with user's specs
Parameters to use:
- vcpus: from user requirements
- memoryGB: from user requirements  
- architecture: 'x86' (default) or 'arm' if user wants ARM
- hoursPerMonth: 730 (always-on)

### Step 3: Call generateTerraform (only after approval)
Parameters:
- type: 'web-server' (includes VCN, subnets, gateways, compute)
- name: from user or generate sensible default
- shape: recommended shape from pricing comparison
- ocpus: from requirements
- memoryGBs: from requirements
- region: from requirements

## READ-ONLY TOOLS (Can call anytime for queries)
- listInstances, listVcns, listSubnets, listCompartments
- listShapes, listImages, listAvailabilityDomains
- getOCIPricing, getAzurePricing, getOCIFreeTier

## KNOWLEDGE QUESTIONS (No tools needed)
Answer directly: "What is OCI?", "What's the free tier?", best practices, etc.

## OCI EXPERTISE
- Compute shapes: E4.Flex, E5.Flex (x86), A1.Flex (ARM - free tier eligible)
- ARM shapes are 50%+ cheaper and included in Always Free tier
- Always Free: 4 ARM OCPUs, 24GB RAM, 200GB storage, 10TB egress/month
- Flex shapes let you choose exact CPU/memory for cost optimization${compartmentInfo}`;
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
