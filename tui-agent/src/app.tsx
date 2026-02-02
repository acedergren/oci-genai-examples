import React, { useCallback, useRef, useEffect } from 'react';
import { ThemeProvider } from './theme/index.js';
import { AppShell, Header, StatusBar, SplitPane } from './components/layout/index.js';
import { ChatView } from './components/chat/index.js';
import { PanelContainer } from './components/panels/index.js';
import {
  useAgentStore,
  useChatStore,
  usePanelStore,
  useConfigStore,
} from './state/index.js';
import { useAgentLoop, useSession, useKeyboardShortcuts, useToolApprovalKeys } from './hooks/index.js';

export interface AppProps {
  /** Continue most recent session */
  continueSession?: boolean;
  /** Resume specific session ID */
  sessionId?: string;
  /** Model to use */
  model?: string;
  /** Region to use */
  region?: string;
  /** Temperature setting */
  temperature?: number;
}

export function App({
  continueSession = false,
  sessionId,
  model,
  region,
  temperature,
}: AppProps) {
  const turnCountRef = useRef(0);

  // Store state
  const status = useAgentStore((s) => s.status);
  const currentThought = useAgentStore((s) => s.currentThought);
  const reasoningSteps = useAgentStore((s) => s.reasoningSteps);
  const toolExecutions = useAgentStore((s) => s.toolExecutions);
  const pendingApproval = useAgentStore((s) => s.pendingApproval);
  const lastError = useAgentStore((s) => s.lastError);

  const messages = useChatStore((s) => s.messages);
  const inputFocused = useChatStore((s) => s.inputFocused);

  const panels = usePanelStore((s) => s.panels);
  const sidePanelVisible = usePanelStore((s) => s.sidePanelVisible);
  const toggleThought = usePanelStore((s) => s.toggleThought);
  const toggleReasoning = usePanelStore((s) => s.toggleReasoning);
  const toggleTools = usePanelStore((s) => s.toggleTools);

  const configModel = useConfigStore((s) => s.model);
  const configSessionId = useConfigStore((s) => s.sessionId);
  const tokensUsed = useConfigStore((s) => s.tokensUsed);
  const costUsd = useConfigStore((s) => s.costUsd);
  const configRegion = useConfigStore((s) => s.region);

  // Session management
  const { recordTurn, completeTurn, setTitle, newSession } = useSession({
    continueSession,
    sessionId,
    model,
    region,
  });

  // Agent loop
  const { execute, approveTool, rejectTool } = useAgentLoop({
    onError: (error) => {
      console.error('Agent error:', error);
    },
  });

  // Apply temperature if provided
  useEffect(() => {
    if (temperature !== undefined) {
      useConfigStore.getState().setTemperature(temperature);
    }
  }, [temperature]);

  // Handle message submission
  const handleSendMessage = useCallback(
    async (content: string) => {
      turnCountRef.current += 1;
      const turnNumber = turnCountRef.current;

      // Record turn
      const turn = recordTurn(turnNumber, content);

      // Set title from first message
      if (turnNumber === 1) {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        setTitle(title);
      }

      try {
        // Execute through agent loop
        const response = await execute(content);

        // Complete turn with response
        const stats = useAgentStore.getState();
        completeTurn(
          turn.id,
          response,
          useConfigStore.getState().tokensUsed,
          useConfigStore.getState().costUsd
        );
      } catch (error) {
        console.error('Execution error:', error);
      }
    },
    [execute, recordTurn, completeTurn, setTitle]
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewSession: () => {
      newSession();
      turnCountRef.current = 0;
    },
    onHelp: () => {
      // Could show help modal
    },
    onExit: () => {
      process.exit(0);
    },
  });

  // Tool approval keys
  useToolApprovalKeys(approveTool, rejectTool);

  // Map status to header format
  const headerStatus: 'idle' | 'thinking' | 'executing' | 'streaming' | 'error' =
    status === 'thinking' ? 'thinking' :
    status === 'streaming' ? 'streaming' :
    status === 'executing' ? 'executing' :
    status === 'error' ? 'error' :
    'idle';

  return (
    <ThemeProvider>
      <AppShell
        header={
          <Header
            model={configModel}
            sessionId={configSessionId}
            tokensUsed={tokensUsed}
            status={headerStatus}
          />
        }
        statusBar={
          <StatusBar
            costUsd={costUsd}
            region={configRegion}
            message={lastError}
            awaitingApproval={!!pendingApproval}
          />
        }
      >
        <SplitPane
          leftWidth={sidePanelVisible ? 70 : 100}
          rightVisible={sidePanelVisible}
          left={
            <ChatView
              messages={messages}
              onSendMessage={handleSendMessage}
              isResponding={status !== 'idle' && status !== 'error'}
              inputFocused={inputFocused && !pendingApproval}
            />
          }
          right={
            <PanelContainer
              panelState={panels}
              onToggleThought={toggleThought}
              onToggleReasoning={toggleReasoning}
              onToggleTools={toggleTools}
              thought={currentThought}
              isThinking={status === 'thinking'}
              reasoningSteps={reasoningSteps}
              toolExecutions={toolExecutions}
              pendingApproval={pendingApproval}
              onApproveTool={approveTool}
              onRejectTool={rejectTool}
            />
          }
        />
      </AppShell>
    </ThemeProvider>
  );
}
