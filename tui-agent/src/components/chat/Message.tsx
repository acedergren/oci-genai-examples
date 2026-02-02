import React from 'react';
import { useColors, useSpacing } from '../../theme/index.js';
import { StreamingText } from './StreamingText.js';
import { Badge } from '../shared/index.js';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCallDisplay {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

export interface MessageProps {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Extended thinking/reasoning (for assistant messages) */
  reasoning?: string;
  /** Whether this message is currently streaming */
  isStreaming?: boolean;
  /** Tool calls associated with this message */
  toolCalls?: ToolCallDisplay[];
  /** Timestamp */
  timestamp?: number;
}

export function Message({
  role,
  content,
  reasoning,
  isStreaming = false,
  toolCalls,
  timestamp,
}: MessageProps) {
  const colors = useColors();
  const spacing = useSpacing();

  const roleColors: Record<MessageRole, string> = {
    user: colors.accent.primary,
    assistant: colors.fg.primary,
    system: colors.fg.tertiary,
    tool: colors.semantic.info,
  };

  const roleLabels: Record<MessageRole, string> = {
    user: 'You',
    assistant: 'Agent',
    system: 'System',
    tool: 'Tool',
  };

  const formatTime = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <box
      flexDirection="column"
      style={{ marginBottom: spacing.md }}
    >
      {/* Message header */}
      <box flexDirection="row" justifyContent="space-between" style={{ marginBottom: spacing.xs }}>
        <box flexDirection="row" gap={1}>
          <text style={{ fg: roleColors[role] }}>{roleLabels[role]}</text>
          {role === 'assistant' && isStreaming && (
            <Badge variant="info">streaming</Badge>
          )}
        </box>
        {timestamp && (
          <text style={{ fg: colors.fg.tertiary }}>{formatTime(timestamp)}</text>
        )}
      </box>

      {/* Message content */}
      <box
        padding={1}
        backgroundColor={role === 'user' ? colors.bg.elevated : colors.bg.secondary}
        border
        borderStyle="single"
        borderColor={role === 'user' ? colors.accent.muted : colors.border.muted}
      >
        <StreamingText
          text={content}
          isStreaming={isStreaming}
          color={role === 'user' ? colors.fg.primary : colors.fg.primary}
        />
      </box>

      {/* Reasoning block (if present and not hidden) */}
      {reasoning && (
        <box
          flexDirection="column"
          style={{ marginTop: spacing.xs }}
          padding={1}
          backgroundColor={colors.bg.tertiary}
          border
          borderStyle="single"
          borderColor={colors.border.muted}
        >
          <text style={{ fg: colors.fg.tertiary }}>
            {'💭 Reasoning:'}
          </text>
          <text style={{ fg: colors.fg.secondary }}>{reasoning}</text>
        </box>
      )}

      {/* Tool calls (if present) */}
      {toolCalls && toolCalls.length > 0 && (
        <box flexDirection="column" style={{ marginTop: spacing.xs }}>
          {toolCalls.map((tool) => (
            <box
              key={tool.id}
              flexDirection="row"
              gap={1}
              padding={1}
              backgroundColor={colors.bg.tertiary}
            >
              <Badge
                variant={
                  tool.status === 'completed' ? 'success' :
                  tool.status === 'error' ? 'error' :
                  tool.status === 'running' ? 'info' :
                  'default'
                }
              >
                {tool.status}
              </Badge>
              <text style={{ fg: colors.fg.secondary }}>{tool.name}</text>
              {tool.result && (
                <text style={{ fg: colors.fg.tertiary }}>
                  {` → ${tool.result.slice(0, 50)}${tool.result.length > 50 ? '...' : ''}`}
                </text>
              )}
            </box>
          ))}
        </box>
      )}
    </box>
  );
}
