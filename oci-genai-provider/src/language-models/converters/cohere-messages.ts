/**
 * Converts AI SDK messages to Cohere chat format.
 *
 * Cohere API structure:
 * - message: string (the latest user input)
 * - chat_history: Array of previous messages with role and message fields
 */

import type { OCIMessage } from './messages';

interface CohereMessage {
  role: 'USER' | 'CHATBOT';
  message: string;
}

interface CohereChatRequest {
  message: string;
  chatHistory?: CohereMessage[];
  preambleOverride?: string;
}

/**
 * Converts generic OCI messages to Cohere format.
 * Extracts the last user message as 'message' and converts previous messages to 'chatHistory'.
 */
export function convertToCohereFormat(messages: OCIMessage[]): CohereChatRequest {
  if (messages.length === 0) {
    throw new Error('At least one message is required');
  }

  // Find the last user message
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('USER');

  if (lastUserIndex === -1) {
    throw new Error('At least one USER message is required');
  }

  // Extract system messages into preamble
  const systemMessages = messages
    .filter((m) => m.role === 'SYSTEM')
    .map((m) => m.content.filter((c) => c.type === 'TEXT').map((c) => c.text))
    .flat()
    .join('\n');

  // Extract the current message (last user message)
  const currentMessage = messages[lastUserIndex];
  const messageText = currentMessage.content
    .filter((c) => c.type === 'TEXT')
    .map((c) => c.text)
    .join('\n');

  // Convert previous messages to chatHistory
  const chatHistory: CohereMessage[] = [];

  for (let i = 0; i < lastUserIndex; i++) {
    const msg = messages[i];

    // Skip system messages (handled by preambleOverride)
    if (msg.role === 'SYSTEM') {
      continue;
    }

    const text = msg.content
      .filter((c) => c.type === 'TEXT')
      .map((c) => c.text)
      .join('\n');

    chatHistory.push({
      role: msg.role === 'USER' ? 'USER' : 'CHATBOT',
      message: text,
    });
  }

  return {
    message: messageText,
    ...(chatHistory.length > 0 ? { chatHistory } : {}),
    ...(systemMessages ? { preambleOverride: systemMessages } : {}),
  };
}
