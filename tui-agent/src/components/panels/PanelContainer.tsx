import React from 'react';
import type { Session } from '../../services/index.js';
import { useColors } from '../../theme/index.js';
import { ThoughtPanel, type ThoughtPanelProps } from './ThoughtPanel.js';
import { ReasoningPanel, type ReasoningStep } from './ReasoningPanel.js';
import { ToolPanel, type ToolExecution } from './ToolPanel.js';
import { SessionsPanel, type SessionsPanelProps } from './SessionsPanel.js';

export interface PanelState {
  thought: boolean;
  reasoning: boolean;
  tools: boolean;
  sessions: boolean;
}

export interface PanelContainerProps {
  /** Panel visibility state */
  panelState: PanelState;
  /** Toggle handlers */
  onToggleThought: () => void;
  onToggleReasoning: () => void;
  onToggleTools: () => void;
  onToggleSessions: () => void;
  /** Thought content */
  thought?: string;
  isThinking?: boolean;
  /** Reasoning steps */
  reasoningSteps: ReasoningStep[];
  /** Tool executions */
  toolExecutions: ToolExecution[];
  /** Pending tool approval */
  pendingApproval?: ToolExecution;
  /** Tool approval callbacks */
  onApproveTool?: (toolId: string) => void;
  onRejectTool?: (toolId: string) => void;
  /** Sessions */
  sessions: Session[];
  currentSessionId: string | undefined;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

export function PanelContainer({
  panelState,
  onToggleThought,
  onToggleReasoning,
  onToggleTools,
  onToggleSessions,
  thought,
  isThinking,
  reasoningSteps,
  toolExecutions,
  pendingApproval,
  onApproveTool,
  onRejectTool,
  sessions,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
}: PanelContainerProps) {
  const colors = useColors();

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      padding={1}
      backgroundColor={colors.bg.secondary}
    >
      <SessionsPanel
        isOpen={panelState.sessions}
        onToggle={onToggleSessions}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewSession={onNewSession}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
      />

      <ThoughtPanel
        isOpen={panelState.thought}
        onToggle={onToggleThought}
        thought={thought}
        isThinking={isThinking}
      />

      <ReasoningPanel
        isOpen={panelState.reasoning}
        onToggle={onToggleReasoning}
        steps={reasoningSteps}
      />

      <ToolPanel
        isOpen={panelState.tools}
        onToggle={onToggleTools}
        tools={toolExecutions}
        pendingApproval={pendingApproval}
        onApprove={onApproveTool}
        onReject={onRejectTool}
      />
    </box>
  );
}
