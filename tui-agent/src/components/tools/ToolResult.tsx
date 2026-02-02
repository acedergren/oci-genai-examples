import React from 'react';
import { useColors, useSpacing } from '../../theme/index.js';
import { Badge, CodeBlock } from '../shared/index.js';

export interface ToolResultProps {
  /** Tool name */
  name: string;
  /** Whether execution was successful */
  success: boolean;
  /** Result data (if successful) */
  data?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Execution duration in ms */
  duration?: number;
}

export function ToolResult({ name, success, data, error, duration }: ToolResultProps) {
  const colors = useColors();
  const spacing = useSpacing();

  const resultContent = success
    ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    : error || 'Unknown error';

  return (
    <box flexDirection="column" style={{ marginTop: spacing.sm }}>
      {/* Header */}
      <box flexDirection="row" gap={1} style={{ marginBottom: spacing.xs }}>
        <text style={{ fg: success ? colors.semantic.success : colors.semantic.error }}>
          {success ? '✓' : '✗'}
        </text>
        <text style={{ fg: colors.fg.secondary }}>{name}</text>
        <Badge variant={success ? 'success' : 'error'}>
          {success ? 'completed' : 'error'}
        </Badge>
        {duration && (
          <text style={{ fg: colors.fg.tertiary }}>{`${duration}ms`}</text>
        )}
      </box>

      {/* Result content */}
      <box
        padding={1}
        backgroundColor={success ? colors.bg.tertiary : colors.bg.elevated}
        borderColor={success ? colors.border.muted : colors.semantic.error}
        border
        borderStyle="single"
      >
        {resultContent.includes('\n') || resultContent.length > 80 ? (
          <CodeBlock
            code={resultContent}
            language="json"
            showLineNumbers={false}
            maxHeight={10}
          />
        ) : (
          <text style={{ fg: success ? colors.fg.primary : colors.semantic.error }}>
            {resultContent}
          </text>
        )}
      </box>
    </box>
  );
}
