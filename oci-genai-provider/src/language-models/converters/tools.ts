import type {
  LanguageModelV3FunctionTool,
  LanguageModelV3ToolChoice,
  LanguageModelV3ToolCall,
} from '@ai-sdk/provider';
import type { OCIApiFormat } from '../../shared/oci-sdk-types';

/**
 * OCI GENERIC format tool definition (FunctionDefinition)
 */
export interface OCIFunctionDefinition {
  type: 'FUNCTION';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * OCI COHERE format tool definition (CohereTool)
 */
export interface OCICohereTool {
  name: string;
  description: string;
  parameterDefinitions?: Record<string, OCICohereParameterDefinition>;
}

interface OCICohereParameterDefinition {
  type: string;
  description?: string;
  required?: boolean;
}

/**
 * OCI tool choice types
 */
interface OCIToolChoiceAuto {
  type: 'AUTO';
}

interface OCIToolChoiceRequired {
  type: 'REQUIRED';
}

interface OCIToolChoiceNone {
  type: 'NONE';
}

interface OCIToolChoiceFunction {
  type: 'FUNCTION';
  function: { name: string };
}

export type OCIToolChoice =
  | OCIToolChoiceAuto
  | OCIToolChoiceRequired
  | OCIToolChoiceNone
  | OCIToolChoiceFunction;

/**
 * OCI GENERIC format tool call (from response)
 */
export interface OCIFunctionCall {
  id: string;
  type: 'FUNCTION';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * OCI COHERE format tool call (from response)
 */
export interface OCICohereToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export type OCIToolDefinition = OCIFunctionDefinition | OCICohereTool;
export type OCIToolCall = OCIFunctionCall | OCICohereToolCall;

/**
 * Converts AI SDK v3 function tools to OCI format.
 * AI SDK v3 uses `inputSchema` for the JSON schema, which maps to OCI's `parameters`.
 */
export function convertToOCITools(
  tools: LanguageModelV3FunctionTool[],
  apiFormat: OCIApiFormat
): OCIToolDefinition[] {
  if (apiFormat === 'COHERE' || apiFormat === 'COHEREV2') {
    return tools.map((tool) => convertToCohereToolFormat(tool));
  }
  return tools.map((tool) => convertToGenericToolFormat(tool));
}

function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchema);
  }

  const sanitized = { ...schema };
  delete sanitized.$schema;
  delete sanitized.ref;

  for (const [key, value] of Object.entries(sanitized)) {
    sanitized[key] = sanitizeSchema(value);
  }

  return sanitized;
}

function convertToGenericToolFormat(tool: LanguageModelV3FunctionTool): OCIFunctionDefinition {
  const parameters = sanitizeSchema(tool.inputSchema as Record<string, unknown>) || {};

  // Ensure the schema has a type 'object'
  if (!parameters.type) {
    parameters.type = 'object';
  }

  return {
    type: 'FUNCTION',
    name: tool.name,
    description: tool.description ?? '',
    parameters,
  };
}

function convertToCohereToolFormat(tool: LanguageModelV3FunctionTool): OCICohereTool {
  const schema = tool.inputSchema as {
    type?: string;
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };

  const parameterDefinitions: Record<string, OCICohereParameterDefinition> = {};

  if (schema?.properties) {
    const required = schema.required ?? [];
    for (const [key, value] of Object.entries(schema.properties)) {
      parameterDefinitions[key] = {
        type: value.type,
        description: value.description,
        required: required.includes(key),
      };
    }
  }

  return {
    name: tool.name,
    description: tool.description ?? '',
    parameterDefinitions:
      Object.keys(parameterDefinitions).length > 0 ? parameterDefinitions : undefined,
  };
}

/**
 * Converts AI SDK v3 tool choice to OCI format.
 */
export function convertToOCIToolChoice(choice: LanguageModelV3ToolChoice): OCIToolChoice {
  switch (choice.type) {
    case 'auto':
      return { type: 'AUTO' };
    case 'required':
      return { type: 'REQUIRED' };
    case 'none':
      return { type: 'NONE' };
    case 'tool':
      return {
        type: 'FUNCTION',
        function: { name: choice.toolName },
      };
    default:
      return { type: 'AUTO' };
  }
}

/**
 * Converts OCI tool calls from response to AI SDK v3 format.
 */
export function convertFromOCIToolCalls(
  toolCalls: OCIToolCall[],
  apiFormat: OCIApiFormat
): LanguageModelV3ToolCall[] {
  if (apiFormat === 'COHERE' || apiFormat === 'COHEREV2') {
    return toolCalls.map((call, index) =>
      convertFromCohereToolCall(call as OCICohereToolCall, index)
    );
  }
  return toolCalls.map((call) => convertFromGenericToolCall(call as OCIFunctionCall));
}

function convertFromGenericToolCall(call: OCIFunctionCall): LanguageModelV3ToolCall {
  // AI SDK v3 uses 'input' as a stringified JSON, not 'args' as an object
  return {
    type: 'tool-call',
    toolCallId: call.id,
    toolName: call.function.name,
    input: call.function.arguments,
  };
}

function convertFromCohereToolCall(
  call: OCICohereToolCall,
  index: number
): LanguageModelV3ToolCall {
  // Cohere doesn't provide tool call IDs, generate one
  const toolCallId = `tool-call-${Date.now()}-${index}`;

  // AI SDK v3 uses 'input' as a stringified JSON
  return {
    type: 'tool-call',
    toolCallId,
    toolName: call.name,
    input: JSON.stringify(call.parameters ?? {}),
  };
}

/**
 * Check if a model supports tool calling.
 * Currently supported: Llama 3.1+, Grok, Gemini, Cohere Command R/R+
 */
export function supportsToolCalling(modelId: string): boolean {
  const supportedPatterns = [
    /^meta\.llama-3\.[1-9]/, // Llama 3.1+
    /^cohere\.command-r/, // Cohere Command R and R+
    /^xai\.grok/, // Grok models
    /^google\.gemini/, // Gemini models
  ];

  return supportedPatterns.some((pattern) => pattern.test(modelId));
}
