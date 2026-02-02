import React from 'react';
import { useColors } from '../../theme/index.js';
import { Spinner, Badge } from '../shared/index.js';

export interface ToolSpinnerProps {
  /** Tool name being executed */
  name: string;
  /** Tool category */
  category: string;
  /** Elapsed time in ms */
  elapsed?: number;
}

export function ToolSpinner({ name, category, elapsed }: ToolSpinnerProps) {
  const colors = useColors();

  const formatElapsed = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <box flexDirection="row" gap={1} padding={1} backgroundColor={colors.bg.secondary}>
      <Spinner label="" color={colors.agent.executing} />
      <text style={{ fg: colors.fg.primary }}>{name}</text>
      <Badge variant="info">{category}</Badge>
      {elapsed !== undefined && (
        <text style={{ fg: colors.fg.tertiary }}>{formatElapsed(elapsed)}</text>
      )}
    </box>
  );
}
