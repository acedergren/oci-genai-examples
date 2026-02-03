import React, { useState } from 'react';
import { useColors, useSpacing } from '../../theme/index.js';
import { Badge } from '../shared/index.js';
import type { ToolExecution } from '../panels/index.js';
import { getDangerLevel, getDangerDescription, type DangerLevel } from '../../tools/approval-rules.js';

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
  const [argsExpanded, setArgsExpanded] = useState(false);

  // Get danger level using the rules engine
  const dangerLevel = getDangerLevel(tool.name);
  const dangerDescription = getDangerDescription(tool.name);

  // Color mapping by danger level
  const dangerColors: Record<DangerLevel, string> = {
    safe: colors.tool.safe,
    caution: colors.tool.caution,
    danger: colors.tool.danger,
  };

  const dangerLabels: Record<DangerLevel, string> = {
    safe: '✓ SAFE',
    caution: '? CONFIRM',
    danger: '⚠ DANGER',
  };

  const dangerBadgeVariant: Record<DangerLevel, 'success' | 'warning' | 'error'> = {
    safe: 'success',
    caution: 'warning',
    danger: 'error',
  };

  const borderColor = dangerColors[dangerLevel];
  const argEntries = tool.args ? Object.entries(tool.args) : [];
  const hasArgs = argEntries.length > 0;

  // Truncate long argument values
  const formatValue = (value: unknown): string => {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (str.length > 60) {
      return str.slice(0, 57) + '...';
    }
    return str;
  };

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
      <box flexDirection="row" justifyContent="space-between" style={{ marginBottom: spacing.sm }}>
        <box flexDirection="row" gap={1}>
          <text style={{ fg: borderColor }}>
            {dangerLabels[dangerLevel]}
          </text>
          <Badge variant={dangerBadgeVariant[dangerLevel]}>
            {dangerLevel}
          </Badge>
        </box>
        <Badge variant="default">
          {tool.category}
        </Badge>
      </box>

      {/* Tool name + description */}
      <box flexDirection="column" style={{ marginBottom: spacing.sm }}>
        <text style={{ fg: colors.fg.primary }}>{tool.name}</text>
        <text style={{ fg: colors.fg.tertiary }}>{dangerDescription}</text>
      </box>

      {/* Arguments (collapsible) */}
      {hasArgs && (
        <box
          flexDirection="column"
          padding={1}
          backgroundColor={colors.bg.tertiary}
          border
          borderStyle="single"
          borderColor={colors.border.muted}
          style={{ marginBottom: spacing.sm }}
        >
          <box flexDirection="row" justifyContent="space-between">
            <text style={{ fg: colors.fg.secondary }}>
              Arguments ({argEntries.length})
            </text>
            <text style={{ fg: colors.fg.tertiary }}>
              {argsExpanded ? '▼' : '▶'}
            </text>
          </box>

          {/* Show args (always show first 3, rest if expanded) */}
          {argEntries.slice(0, argsExpanded ? argEntries.length : 3).map(([key, value]) => (
            <box key={key} flexDirection="row" style={{ marginTop: 1 }}>
              <text style={{ fg: colors.accent.secondary }}>{`  ${key}: `}</text>
              <text style={{ fg: colors.fg.primary }}>
                {formatValue(value)}
              </text>
            </box>
          ))}

          {/* Show "and X more" if collapsed and more args */}
          {!argsExpanded && argEntries.length > 3 && (
            <text style={{ fg: colors.fg.tertiary }}>
              {`  ... and ${argEntries.length - 3} more`}
            </text>
          )}
        </box>
      )}

      {/* Action prompt */}
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="row" gap={2}>
          <text style={{ fg: colors.semantic.success }}>[y] Approve</text>
          <text style={{ fg: colors.semantic.error }}>[n] Reject</text>
        </box>
        {dangerLevel === 'danger' && (
          <text style={{ fg: colors.semantic.error }}>
            Destructive action!
          </text>
        )}
      </box>
    </box>
  );
}
