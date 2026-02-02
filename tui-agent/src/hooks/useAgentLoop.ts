import { useCallback, useRef } from 'react';
import { useAgentStore, useChatStore, useConfigStore } from '../state/index.js';
import { AgentExecutor, type AgentCallbacks } from '../services/index.js';

export interface UseAgentLoopOptions {
  onError?: (error: Error) => void;
  systemPrompt?: string;
}

export function useAgentLoop(options: UseAgentLoopOptions = {}) {
  const executorRef = useRef<AgentExecutor | null>(null);

  // Store selectors
  const setStatus = useAgentStore((s) => s.setStatus);
  const setCurrentThought = useAgentStore((s) => s.setCurrentThought);
  const addReasoningStep = useAgentStore((s) => s.addReasoningStep);
  const addToolExecution = useAgentStore((s) => s.addToolExecution);
  const updateToolExecution = useAgentStore((s) => s.updateToolExecution);
  const setPendingApproval = useAgentStore((s) => s.setPendingApproval);
  const setLastError = useAgentStore((s) => s.setLastError);
  const agentReset = useAgentStore((s) => s.reset);

  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setStreamingMessageId = useChatStore((s) => s.setStreamingMessageId);
  const appendToStreamingMessage = useChatStore((s) => s.appendToStreamingMessage);

  const addTokensUsed = useConfigStore((s) => s.addTokensUsed);
  const addCostUsd = useConfigStore((s) => s.addCostUsd);
  const { model, region, compartmentId, temperature, maxTokens } = useConfigStore();

  // Initialize executor
  const getExecutor = useCallback(() => {
    if (!executorRef.current) {
      executorRef.current = new AgentExecutor({
        model,
        region,
        compartmentId,
        temperature,
        maxTokens,
        systemPrompt: options.systemPrompt,
      });
    }
    return executorRef.current;
  }, [model, region, compartmentId, temperature, maxTokens, options.systemPrompt]);

  // Execute user message through agent loop
  const execute = useCallback(
    async (userMessage: string): Promise<string> => {
      setLastError(undefined);
      agentReset();
      setStatus('thinking');

      // Add user message
      addMessage({
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      });

      // Create placeholder for assistant
      const assistantMsg = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: Date.now(),
      });

      setStreamingMessageId(assistantMsg.id);

      try {
        const executor = getExecutor();

        const callbacks: AgentCallbacks = {
          onStart: () => {
            setStatus('streaming');
          },
          onText: (text) => {
            appendToStreamingMessage(text);
          },
          onThinking: (thought) => {
            setCurrentThought(thought);
            addReasoningStep({
              content: thought,
              timestamp: Date.now(),
            });
          },
          onToolCall: (tool) => {
            setStatus('executing');
            addToolExecution({
              id: tool.id,
              name: tool.name,
              category: 'compute', // Would be determined from tool registry
              status: 'running',
              args: tool.args as Record<string, unknown>,
              startedAt: Date.now(),
            });
          },
          onToolResult: (result) => {
            updateToolExecution(result.id, {
              status: result.success ? 'completed' : 'error',
              result: result.data ? JSON.stringify(result.data) : undefined,
              error: result.error,
              completedAt: Date.now(),
            });
            setStatus('streaming');
          },
          onPendingApproval: (pending) => {
            setPendingApproval({
              id: pending.id,
              name: pending.name,
              category: 'compute',
              status: 'awaiting_approval',
              args: pending.args,
              startedAt: Date.now(),
            });
          },
          onIterationStart: (iteration) => {
            setCurrentThought(`Iteration ${iteration}...`);
          },
          onComplete: (result) => {
            addTokensUsed(result.totalTokens);
            addCostUsd(result.cost);
          },
          onError: (error) => {
            setLastError(error.message);
            setStatus('error');
            options.onError?.(error);
          },
        };

        const response = await executor.execute(userMessage, callbacks);

        // Finalize assistant message
        updateMessage(assistantMsg.id, {
          content: response,
          isStreaming: false,
        });

        setStreamingMessageId(undefined);
        setCurrentThought(undefined);
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
      setCurrentThought,
      addReasoningStep,
      addToolExecution,
      updateToolExecution,
      setPendingApproval,
      setLastError,
      agentReset,
      addTokensUsed,
      addCostUsd,
      getExecutor,
      options,
    ]
  );

  // Approve pending tool
  const approveTool = useCallback(() => {
    const executor = executorRef.current;
    const pending = executor?.getPendingApproval();
    if (executor && pending) {
      executor.approveTool(pending.id);
      setPendingApproval(undefined);
    }
  }, [setPendingApproval]);

  // Reject pending tool
  const rejectTool = useCallback(() => {
    const executor = executorRef.current;
    const pending = executor?.getPendingApproval();
    if (executor && pending) {
      executor.rejectTool(pending.id);
      setPendingApproval(undefined);
    }
  }, [setPendingApproval]);

  // Reset the agent
  const reset = useCallback(() => {
    executorRef.current?.clearHistory();
    executorRef.current = null;
    agentReset();
  }, [agentReset]);

  // Restore from session
  const restoreFromSession = useCallback(
    (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      const executor = getExecutor();
      executor.restoreMessages(messages);
    },
    [getExecutor]
  );

  return {
    execute,
    approveTool,
    rejectTool,
    reset,
    restoreFromSession,
    status: useAgentStore((s) => s.status),
    currentThought: useAgentStore((s) => s.currentThought),
    pendingApproval: useAgentStore((s) => s.pendingApproval),
    error: useAgentStore((s) => s.lastError),
  };
}
