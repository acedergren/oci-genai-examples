import React from 'react';
import type { Session } from '../../services/index.js';
import { useColors, useSpacing } from '../../theme/index.js';
import { Collapsible, Badge } from '../shared/index.js';

export interface SessionsPanelProps {
  /** Whether the panel is expanded */
  isOpen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Available sessions */
  sessions: Session[];
  /** Currently active session ID */
  currentSessionId: string | undefined;
  /** Create a new session */
  onNewSession: () => void;
  /** Select an existing session */
  onSelectSession: (id: string) => void;
  /** Delete a session */
  onDeleteSession?: (id: string) => void;
}

export function SessionsPanel({
  isOpen,
  onToggle,
  sessions,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
}: SessionsPanelProps) {
  const colors = useColors();
  const spacing = useSpacing();

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  const truncateTitle = (title: string | undefined, maxLength: number = 25): string => {
    if (!title) return 'Untitled';
    if (title.length <= maxLength) return title;
    return title.slice(0, maxLength - 3) + '...';
  };

  return (
    <Collapsible
      title="Sessions"
      isOpen={isOpen}
      onToggle={onToggle}
      shortcut="s"
      badge={sessions.length > 0 ? <Badge>{sessions.length}</Badge> : undefined}
    >
      {/* New Chat Button */}
      <box
        flexDirection="row"
        justifyContent="center"
        style={{ marginBottom: spacing.sm }}
      >
        <text
          style={{
            fg: colors.accent.primary,
            backgroundColor: colors.bg.elevated,
          }}
        >
          {' [Ctrl+N] New Chat '}
        </text>
      </box>

      {/* Session List */}
      {sessions.length === 0 ? (
        <text style={{ fg: colors.fg.tertiary }}>No sessions yet</text>
      ) : (
        <scrollbox
          style={{
            maxHeight: 12,
            backgroundColor: colors.bg.tertiary,
          }}
        >
          {sessions.map((session, index) => {
            const isActive = session.id === currentSessionId;
            return (
              <box
                key={session.id}
                flexDirection="row"
                justifyContent="space-between"
                style={{
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: isActive ? colors.bg.elevated : undefined,
                }}
              >
                {/* Left: Active indicator + Title */}
                <box flexDirection="row" gap={1}>
                  <text style={{ fg: isActive ? colors.accent.primary : colors.fg.tertiary }}>
                    {isActive ? '●' : '○'}
                  </text>
                  <text style={{ fg: isActive ? colors.fg.primary : colors.fg.secondary }}>
                    {truncateTitle(session.title)}
                  </text>
                </box>

                {/* Right: Model badge + Date */}
                <box flexDirection="row" gap={1}>
                  <text style={{ fg: colors.fg.tertiary }}>
                    {session.model?.split('.').pop()?.slice(0, 8) || 'unknown'}
                  </text>
                  <text style={{ fg: colors.fg.tertiary }}>
                    {formatDate(session.createdAt)}
                  </text>
                </box>
              </box>
            );
          })}
        </scrollbox>
      )}

      {/* Keyboard hints */}
      <box
        flexDirection="row"
        justifyContent="flex-start"
        gap={2}
        style={{ marginTop: spacing.xs }}
      >
        <text style={{ fg: colors.fg.tertiary }}>
          [↑↓] navigate  [Enter] select
        </text>
      </box>
    </Collapsible>
  );
}
