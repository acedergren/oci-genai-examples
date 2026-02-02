import React, { type ReactNode } from 'react';
import { useColors } from '../../theme/index.js';

export interface SplitPaneProps {
  /** Left/main pane content */
  left: ReactNode;
  /** Right/side pane content */
  right: ReactNode;
  /** Width of left pane as percentage (0-100) */
  leftWidth?: number;
  /** Whether to show the divider */
  showDivider?: boolean;
  /** Whether right pane is visible */
  rightVisible?: boolean;
}

export function SplitPane({
  left,
  right,
  leftWidth = 70,
  showDivider = true,
  rightVisible = true,
}: SplitPaneProps) {
  const colors = useColors();

  // If right pane is hidden, left takes full width
  const effectiveLeftWidth = rightVisible ? leftWidth : 100;
  const rightWidth = 100 - effectiveLeftWidth;

  return (
    <box flexDirection="row" flexGrow={1}>
      {/* Left/Main Pane */}
      <box
        flexDirection="column"
        style={{ width: `${effectiveLeftWidth}%` }}
      >
        {left}
      </box>

      {/* Divider */}
      {showDivider && rightVisible && (
        <box
          width={1}
          backgroundColor={colors.border.default}
        />
      )}

      {/* Right/Side Pane */}
      {rightVisible && (
        <box
          flexDirection="column"
          style={{ width: `${rightWidth}%` }}
        >
          {right}
        </box>
      )}
    </box>
  );
}
