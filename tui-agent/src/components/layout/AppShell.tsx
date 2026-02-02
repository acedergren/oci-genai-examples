import React, { type ReactNode } from 'react';
import { useColors } from '../../theme/index.js';

export interface AppShellProps {
  /** Header component */
  header: ReactNode;
  /** Main content area */
  children: ReactNode;
  /** Status bar component */
  statusBar: ReactNode;
}

export function AppShell({ header, children, statusBar }: AppShellProps) {
  const colors = useColors();

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.bg.primary}
    >
      {/* Header */}
      {header}

      {/* Main content - grows to fill available space */}
      <box flexDirection="column" flexGrow={1}>
        {children}
      </box>

      {/* Status bar */}
      {statusBar}
    </box>
  );
}
