import React, { useCallback, useRef, useEffect, useState } from 'react';
import { ThemeProvider } from './theme/index.js';
import { AppShell, Header, StatusBar, SplitPane } from './components/layout/index.js';
import { ChatView } from './components/chat/index.js';
import { PanelContainer } from './components/panels/index.js';
import { ModelPicker, AVAILABLE_MODELS } from './components/ui/index.js';
import {
  useAgentStore,
  useChatStore,
  usePanelStore,
  useConfigStore,
} from './state/index.js';
import { useAgentLoop, useSession, useKeyboardShortcuts, useToolApprovalKeys } from './hooks/index.js';
import type { Session } from './services/index.js';

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
  const toggleSessions = usePanelStore((s) => s.toggleSessions);

  const configModel = useConfigStore((s) => s.model);
  const setModel = useConfigStore((s) => s.setModel);
  const configSessionId = useConfigStore((s) => s.sessionId);
  const tokensUsed = useConfigStore((s) => s.tokensUsed);
  const costUsd = useConfigStore((s) => s.costUsd);
  const configRegion = useConfigStore((s) => s.region);
  const modelPickerOpen = useConfigStore((s) => s.modelPickerOpen);
  const setModelPickerOpen = useConfigStore((s) => s.setModelPickerOpen);

  // Session management
  const { recordTurn, completeTurn, setTitle, newSession, getSessions, switchSession } = useSession({
    continueSession,
    sessionId,
    model,
    region,
  });

  // Sessions list state
  const [sessions, setSessions] = useState<Session[]>([]);

  // Refresh sessions list
  const refreshSessions = useCallback(() => {
    const sessionsList = getSessions(20);
    setSessions(sessionsList);
  }, [getSessions]);

  // Load sessions on mount and when session changes
  useEffect(() => {
    refreshSessions();
  }, [configSessionId, refreshSessions]);

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

  // Handle session selection
  const handleSelectSession = useCallback((targetSessionId: string) => {
    if (targetSessionId === configSessionId) return;
    switchSession(targetSessionId);
    turnCountRef.current = 0; // Reset turn count for resumed session
    refreshSessions();
  }, [configSessionId, switchSession, refreshSessions]);

  // Handle new session
  const handleNewSession = useCallback(() => {
    newSession();
    turnCountRef.current = 0;
    refreshSessions();
  }, [newSession, refreshSessions]);

  // Handle model selection
  const handleModelSelect = useCallback((modelId: string) => {
    setModel(modelId);
    setModelPickerOpen(false);
  }, [setModel, setModelPickerOpen]);

  const handleModelPickerClose = useCallback(() => {
    setModelPickerOpen(false);
  }, [setModelPickerOpen]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewSession: handleNewSession,
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
      {/* Model Picker Overlay */}
      <ModelPicker
        isOpen={modelPickerOpen}
        currentModel={configModel}
        models={AVAILABLE_MODELS}
        region={configRegion}
        onSelect={handleModelSelect}
        onClose={handleModelPickerClose}
      />

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
              onToggleSessions={toggleSessions}
              thought={currentThought}
              isThinking={status === 'thinking'}
              reasoningSteps={reasoningSteps}
              toolExecutions={toolExecutions}
              pendingApproval={pendingApproval}
              onApproveTool={approveTool}
              onRejectTool={rejectTool}
              sessions={sessions}
              currentSessionId={configSessionId}
              onNewSession={handleNewSession}
              onSelectSession={handleSelectSession}
            />
          }
        />
      </AppShell>
    </ThemeProvider>
  );
}
