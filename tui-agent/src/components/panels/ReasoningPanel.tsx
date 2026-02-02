import React from 'react';
import { useColors } from '../../theme/index.js';
import { Collapsible, Badge } from '../shared/index.js';

export interface ReasoningStep {
  id: string;
  content: string;
  timestamp: number;
}

export interface ReasoningPanelProps {
  /** Whether the panel is expanded */
  isOpen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Reasoning steps/chain of thought */
  steps: ReasoningStep[];
}

export function ReasoningPanel({ isOpen, onToggle, steps }: ReasoningPanelProps) {
  const colors = useColors();

  return (
    <Collapsible
      title="Reasoning"
      isOpen={isOpen}
      onToggle={onToggle}
      shortcut="r"
      badge={steps.length > 0 ? <Badge variant="info">{String(steps.length)}</Badge> : undefined}
    >
      {steps.length > 0 ? (
        <scrollbox
          style={{
            maxHeight: 15,
            backgroundColor: colors.bg.tertiary,
          }}
        >
          {steps.map((step, index) => (
            <box key={step.id} flexDirection="column" style={{ marginBottom: 1 }}>
              <box flexDirection="row" gap={1}>
                <text style={{ fg: colors.accent.primary }}>{`${index + 1}.`}</text>
                <text style={{ fg: colors.fg.secondary }}>{step.content}</text>
              </box>
            </box>
          ))}
        </scrollbox>
      ) : (
        <text style={{ fg: colors.fg.tertiary }}>No reasoning steps yet</text>
      )}
    </Collapsible>
  );
}
