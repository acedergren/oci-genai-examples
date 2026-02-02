import React from 'react';
import { useColors } from '../../theme/index.js';
import { ThoughtPanel, type ThoughtPanelProps } from './ThoughtPanel.js';
import { ReasoningPanel, type ReasoningStep } from './ReasoningPanel.js';
import { ToolPanel, type ToolExecution } from './ToolPanel.js';

export interface PanelState {
  thought: boolean;
  reasoning: boolean;
  tools: boolean;
}

export interface PanelContainerProps {
  /** Panel visibility state */
  panelState: PanelState;
  /** Toggle handlers */
  onToggleThought: () => void;
  onToggleReasoning: () => void;
  onToggleTools: () => void;
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
}

export function PanelContainer({
  panelState,
  onToggleThought,
  onToggleReasoning,
  onToggleTools,
  thought,
  isThinking,
  reasoningSteps,
  toolExecutions,
  pendingApproval,
  onApproveTool,
  onRejectTool,
}: PanelContainerProps) {
  const colors = useColors();

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      padding={1}
      backgroundColor={colors.bg.secondary}
    >
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
