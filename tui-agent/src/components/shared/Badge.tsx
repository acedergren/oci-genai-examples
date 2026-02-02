import React from 'react';
import { useColors } from '../../theme/index.js';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';

export interface BadgeProps {
  /** Badge text content */
  children: string;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Custom foreground color */
  fg?: string;
  /** Custom background color */
  bg?: string;
}

export function Badge({ children, variant = 'default', fg, bg }: BadgeProps) {
  const colors = useColors();

  const variantStyles: Record<BadgeVariant, { fg: string; bg: string }> = {
    default: { fg: colors.fg.primary, bg: colors.bg.elevated },
    success: { fg: colors.bg.primary, bg: colors.semantic.success },
    warning: { fg: colors.bg.primary, bg: colors.semantic.warning },
    error: { fg: colors.bg.primary, bg: colors.semantic.error },
    info: { fg: colors.bg.primary, bg: colors.semantic.info },
    accent: { fg: colors.bg.primary, bg: colors.accent.primary },
  };

  const style = variantStyles[variant];

  return (
    <text
      style={{
        fg: fg ?? style.fg,
        backgroundColor: bg ?? style.bg,
      }}
    >
      {` ${children} `}
    </text>
  );
}
