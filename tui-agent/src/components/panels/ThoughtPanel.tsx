import React from 'react';
import { useColors, useSpacing } from '../../theme/index.js';
import { Collapsible, Spinner, Badge } from '../shared/index.js';

export interface ThoughtPanelProps {
  /** Whether the panel is expanded */
  isOpen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Current thought content */
  thought?: string;
  /** Whether currently thinking */
  isThinking?: boolean;
}

export function ThoughtPanel({
  isOpen,
  onToggle,
  thought,
  isThinking = false,
}: ThoughtPanelProps) {
  const colors = useColors();
  const spacing = useSpacing();

  return (
    <Collapsible
      title="Thought"
      isOpen={isOpen}
      onToggle={onToggle}
      shortcut="t"
      badge={isThinking ? <Spinner variant="pulse" /> : undefined}
    >
      {thought ? (
        <scrollbox
          style={{
            maxHeight: 10,
            backgroundColor: colors.bg.tertiary,
          }}
        >
          <text style={{ fg: colors.fg.secondary }}>{thought}</text>
        </scrollbox>
      ) : (
        <text style={{ fg: colors.fg.tertiary }}>
          {isThinking ? 'Thinking...' : 'No active thought'}
        </text>
      )}
    </Collapsible>
  );
}
