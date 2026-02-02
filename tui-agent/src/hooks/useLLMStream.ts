import { useCallback, useRef } from 'react';
import { useAgentStore, useChatStore, useConfigStore } from '../state/index.js';
import { LLMClient, calculateCost, type StreamCallbacks } from '../services/index.js';
import type { ModelMessage } from 'ai';

export interface UseLLMStreamOptions {
  onError?: (error: Error) => void;
}

export function useLLMStream(options: UseLLMStreamOptions = {}) {
  const clientRef = useRef<LLMClient | null>(null);
  const messagesRef = useRef<ModelMessage[]>([]);

  // Store actions
  const setStatus = useAgentStore((s) => s.setStatus);
  const setLastError = useAgentStore((s) => s.setLastError);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreamingMessageId = useChatStore((s) => s.setStreamingMessageId);
  const appendToStreamingMessage = useChatStore((s) => s.appendToStreamingMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const addTokensUsed = useConfigStore((s) => s.addTokensUsed);
  const addCostUsd = useConfigStore((s) => s.addCostUsd);
  const { model, region, compartmentId, temperature, maxTokens } = useConfigStore();

  // Initialize or get client
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new LLMClient({
        model,
        region,
        compartmentId,
        temperature,
        maxTokens,
      });
    }
    return clientRef.current;
  }, [model, region, compartmentId, temperature, maxTokens]);

  // Send a message and stream the response
  const sendMessage = useCallback(
    async (content: string): Promise<string> => {
      setLastError(undefined);
      setStatus('thinking');

      // Add user message to store
      addMessage({
        role: 'user',
        content,
        timestamp: Date.now(),
      });

      // Add to internal messages
      messagesRef.current.push({ role: 'user', content });

      // Create placeholder for assistant response
      const assistantMsg = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: Date.now(),
      });

      setStreamingMessageId(assistantMsg.id);
      setStatus('streaming');

      try {
        const client = getClient();

        const callbacks: StreamCallbacks = {
          onText: (text) => {
            appendToStreamingMessage(text);
          },
          onFinish: (result) => {
            if (result.usage) {
              addTokensUsed(result.usage.inputTokens + result.usage.outputTokens);
              addCostUsd(
                calculateCost(model, result.usage.inputTokens, result.usage.outputTokens)
              );
            }
          },
          onError: (error) => {
            setLastError(error.message);
            setStatus('error');
            options.onError?.(error);
          },
        };

        const response = await client.streamCompletion(messagesRef.current, callbacks);

        // Update message to mark streaming complete
        updateMessage(assistantMsg.id, {
          content: response,
          isStreaming: false,
        });

        // Add to internal messages
        messagesRef.current.push({ role: 'assistant', content: response });

        setStreamingMessageId(undefined);
        setStatus('idle');

        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setLastError(err.message);
        setStatus('error');
        updateMessage(assistantMsg.id, { isStreaming: false });
        setStreamingMessageId(undefined);
        throw err;
      }
    },
    [
      addMessage,
      updateMessage,
      setStreamingMessageId,
      appendToStreamingMessage,
      setStatus,
      setLastError,
      addTokensUsed,
      addCostUsd,
      getClient,
      model,
      options,
    ]
  );

  // Clear conversation
  const clearConversation = useCallback(() => {
    messagesRef.current = [];
    clientRef.current = null;
  }, []);

  // Restore messages from a previous session
  const restoreMessages = useCallback(
    (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      for (const msg of messages) {
        messagesRef.current.push(msg);
      }
    },
    []
  );

  return {
    sendMessage,
    clearConversation,
    restoreMessages,
    isStreaming: useAgentStore((s) => s.status === 'streaming'),
    isThinking: useAgentStore((s) => s.status === 'thinking'),
    error: useAgentStore((s) => s.lastError),
  };
}
