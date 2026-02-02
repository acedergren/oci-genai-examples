import React, { type ReactNode } from 'react';
import { useColors, useSpacing } from '../../theme/index.js';

export interface CollapsibleProps {
  /** Title shown in header */
  title: string;
  /** Whether the section is expanded */
  isOpen: boolean;
  /** Callback when toggle is triggered */
  onToggle?: () => void;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Content to show when expanded */
  children: ReactNode;
  /** Optional badge/status indicator */
  badge?: ReactNode;
}

export function Collapsible({
  title,
  isOpen,
  onToggle,
  shortcut,
  children,
  badge,
}: CollapsibleProps) {
  const colors = useColors();
  const spacing = useSpacing();

  const chevron = isOpen ? '▼' : '▶';

  return (
    <box
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={colors.border.default}
      style={{ marginBottom: spacing.sm }}
    >
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        padding={1}
        backgroundColor={colors.bg.secondary}
      >
        <box flexDirection="row" gap={1}>
          <text style={{ fg: colors.fg.tertiary }}>{chevron}</text>
          <text style={{ fg: colors.fg.primary }}>{title}</text>
          {badge}
        </box>
        {shortcut && (
          <text style={{ fg: colors.fg.tertiary }}>
            [{shortcut}]
          </text>
        )}
      </box>

      {/* Content - only render when open */}
      {isOpen && (
        <box padding={1} backgroundColor={colors.bg.tertiary}>
          {children}
        </box>
      )}
    </box>
  );
}
