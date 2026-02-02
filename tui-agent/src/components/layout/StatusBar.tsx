import React from 'react';
import { useColors, useSizing, useKeybindings } from '../../theme/index.js';

export interface StatusBarProps {
  /** Estimated cost in USD this session */
  costUsd?: number;
  /** Current region */
  region?: string;
  /** Custom status message */
  message?: string;
  /** Whether tool approval is pending */
  awaitingApproval?: boolean;
}

export function StatusBar({ costUsd, region, message, awaitingApproval }: StatusBarProps) {
  const colors = useColors();
  const sizing = useSizing();
  const keybindings = useKeybindings();

  const formatCost = (cost: number): string => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  };

  // Build keybinding hints based on current state
  const hints: string[] = [];
  if (awaitingApproval) {
    hints.push(`[${keybindings.approve}] approve`);
    hints.push(`[${keybindings.reject}] reject`);
  } else {
    hints.push(`[${keybindings.toggleThought}] thought`);
    hints.push(`[${keybindings.toggleReasoning}] reasoning`);
    hints.push(`[${keybindings.toggleTools}] tools`);
  }
  hints.push(`[${keybindings.help}] help`);

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      height={sizing.statusBarHeight}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={colors.bg.tertiary}
      borderColor={colors.border.muted}
    >
      {/* Left: Keybinding hints */}
      <box flexDirection="row" gap={2}>
        {hints.map((hint, i) => (
          <text key={i} style={{ fg: colors.fg.tertiary }}>
            {hint}
          </text>
        ))}
      </box>

      {/* Center: Custom message */}
      {message && (
        <text style={{ fg: colors.fg.secondary }}>{message}</text>
      )}

      {/* Right: Region and cost */}
      <box flexDirection="row" gap={2}>
        {region && (
          <text style={{ fg: colors.fg.tertiary }}>{region}</text>
        )}
        {costUsd !== undefined && (
          <text style={{ fg: colors.fg.secondary }}>
            {formatCost(costUsd)}
          </text>
        )}
      </box>
    </box>
  );
}
