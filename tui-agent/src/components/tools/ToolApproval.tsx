import React from 'react';
import { useColors, useSpacing } from '../../theme/index.js';
import { Badge } from '../shared/index.js';
import type { ToolExecution } from '../panels/index.js';

export interface ToolApprovalProps {
  /** The tool awaiting approval */
  tool: ToolExecution;
  /** Callback when approved */
  onApprove: () => void;
  /** Callback when rejected */
  onReject: () => void;
}

export function ToolApproval({ tool, onApprove, onReject }: ToolApprovalProps) {
  const colors = useColors();
  const spacing = useSpacing();

  // Determine danger level from tool name
  const isDanger = tool.name.startsWith('delete') ||
                   tool.name.startsWith('terminate') ||
                   tool.name.startsWith('stop');

  const borderColor = isDanger ? colors.tool.danger : colors.tool.caution;

  return (
    <box
      flexDirection="column"
      padding={spacing.md}
      backgroundColor={colors.bg.elevated}
      border
      borderStyle="double"
      borderColor={borderColor}
    >
      {/* Header */}
      <box flexDirection="row" gap={1} style={{ marginBottom: spacing.sm }}>
        <text style={{ fg: borderColor }}>
          {isDanger ? '⚠ DANGER' : '? Confirm'}
        </text>
        <Badge variant={isDanger ? 'error' : 'warning'}>
          {tool.category}
        </Badge>
      </box>

      {/* Tool name */}
      <box style={{ marginBottom: spacing.sm }}>
        <text style={{ fg: colors.fg.primary }}>{tool.name}</text>
      </box>

      {/* Arguments */}
      <box
        flexDirection="column"
        padding={1}
        backgroundColor={colors.bg.tertiary}
        style={{ marginBottom: spacing.sm }}
      >
        <text style={{ fg: colors.fg.tertiary }}>Arguments:</text>
        {tool.args && Object.entries(tool.args).map(([key, value]) => (
          <box key={key} flexDirection="row">
            <text style={{ fg: colors.fg.secondary }}>{`  ${key}: `}</text>
            <text style={{ fg: colors.fg.primary }}>
              {typeof value === 'string' ? value : JSON.stringify(value)}
            </text>
          </box>
        ))}
      </box>

      {/* Action prompt */}
      <box flexDirection="row" gap={2}>
        <text style={{ fg: colors.semantic.success }}>[y] Approve</text>
        <text style={{ fg: colors.semantic.error }}>[n] Reject</text>
      </box>
    </box>
  );
}
