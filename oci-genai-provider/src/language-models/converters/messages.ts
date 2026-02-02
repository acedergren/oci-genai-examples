import type {
  LanguageModelV3Prompt,
  LanguageModelV3ToolCallPart,
  LanguageModelV3ToolResultPart,
  LanguageModelV3FilePart,
  LanguageModelV3TextPart,
} from '@ai-sdk/provider';

export interface OCIMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: Array<
    | { type: 'TEXT'; text: string; imageUrl?: never }
    | { type: 'IMAGE'; imageUrl: { url: string }; text?: never }
  >;
  // OCI uses flat structure: { id, type, name, arguments } - NOT nested { function: { name, arguments } }
  toolCalls?: Array<{
    id: string;
    type: 'FUNCTION';
    name: string;
    arguments: string;
  }>;
  toolCallId?: string;
}

type RoleMap = {
  user: 'USER';
  assistant: 'ASSISTANT';
  system: 'SYSTEM';
  tool: 'TOOL';
};

const ROLE_MAP: RoleMap = {
  user: 'USER',
  assistant: 'ASSISTANT',
  system: 'SYSTEM',
  tool: 'TOOL',
};

export function convertToOCIMessages(prompt: LanguageModelV3Prompt): OCIMessage[] {
  return prompt.map((message) => {
    const role = message.role as keyof RoleMap;

    if (!ROLE_MAP[role]) {
      throw new Error(`Unsupported role: ${role}`);
    }

    const ociRole = ROLE_MAP[role];

    // Handle string content (system messages)
    if (typeof message.content === 'string') {
      return {
        role: ociRole,
        content: [{ type: 'TEXT' as const, text: message.content }],
      };
    }

    // Handle array content
    if (Array.isArray(message.content)) {
      // Handle tool messages with tool-result parts
      if (role === 'tool') {
        const toolResultPart = message.content.find(
          (part): part is LanguageModelV3ToolResultPart => part.type === 'tool-result'
        );

        if (toolResultPart) {
          const outputText = extractToolResultText(toolResultPart);
          return {
            role: ociRole,
            toolCallId: toolResultPart.toolCallId,
            content: [{ type: 'TEXT' as const, text: outputText }],
          };
        }
      }

      // Extract tool calls for assistant role
      let toolCalls: OCIMessage['toolCalls'] | undefined = undefined;
      if (role === 'assistant') {
        const toolCallParts = message.content.filter(
          (part): part is LanguageModelV3ToolCallPart => part.type === 'tool-call'
        );
        if (toolCallParts.length > 0) {
          // OCI uses flat structure for FunctionCall: { id, type, name, arguments }
          toolCalls = toolCallParts.map((part) => ({
            id: part.toolCallId,
            type: 'FUNCTION' as const,
            name: part.toolName,
            arguments:
              typeof part.input === 'string' ? part.input : JSON.stringify(part.input ?? {}),
          }));
        }
      }

      // Convert all content parts (excluding tool-call/tool-result as they are handled above)
      const content = message.content
        .map((part) => {
          if (part.type === 'text') {
            return convertTextPartToOCIContent(part);
          }
          if (part.type === 'file') {
            return convertFilePartToOCIContent(part);
          }
          return null;
        })
        .filter((part): part is NonNullable<typeof part> => part !== null);

      const result: OCIMessage = {
        role: ociRole,
        content,
      };

      if (toolCalls) {
        result.toolCalls = toolCalls;
      }

      return result;
    }

    return {
      role: ociRole,
      content: [],
    };
  });
}

function convertTextPartToOCIContent(part: LanguageModelV3TextPart): OCIMessage['content'][number] {
  return { type: 'TEXT', text: part.text };
}

function convertFilePartToOCIContent(
  part: LanguageModelV3FilePart
): OCIMessage['content'][number] | null {
  if (part.mediaType && part.mediaType.startsWith('image/')) {
    let url = '';
    if (part.data instanceof Uint8Array) {
      const base64 = Buffer.from(part.data).toString('base64');
      url = `data:${part.mediaType};base64,${base64}`;
    } else if (typeof part.data === 'string') {
      url = part.data.startsWith('data:')
        ? part.data
        : `data:${part.mediaType};base64,${part.data}`;
    } else if (part.data instanceof URL) {
      url = part.data.toString(); // instanceof narrows type, cast unnecessary
    }
    return { type: 'IMAGE', imageUrl: { url } };
  }
  return null;
}

/**
 * Extract text from tool result output.
 * AI SDK v3 uses { type: 'text', value: string } format.
 */
function extractToolResultText(part: LanguageModelV3ToolResultPart): string {
  const output = part.output;
  if (output.type === 'text') {
    return output.value;
  }
  // For other output types (file, base64), stringify the content
  return JSON.stringify(output);
}
