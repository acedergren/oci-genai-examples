import React from 'react';
import { useColors, useSizing } from '../../theme/index.js';
import { Badge } from '../shared/index.js';

export interface HeaderProps {
  /** Current model name */
  model: string;
  /** Current session ID (truncated) */
  sessionId?: string;
  /** Total tokens used this session */
  tokensUsed?: number;
  /** Agent status */
  status: 'idle' | 'thinking' | 'executing' | 'streaming' | 'error';
}

export function Header({ model, sessionId, tokensUsed, status }: HeaderProps) {
  const colors = useColors();
  const sizing = useSizing();

  const statusColors: Record<HeaderProps['status'], string> = {
    idle: colors.fg.tertiary,
    thinking: colors.agent.thinking,
    executing: colors.agent.executing,
    streaming: colors.agent.streaming,
    error: colors.semantic.error,
  };

  const statusLabels: Record<HeaderProps['status'], string> = {
    idle: 'Ready',
    thinking: 'Thinking...',
    executing: 'Executing...',
    streaming: 'Streaming...',
    error: 'Error',
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return String(tokens);
  };

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      height={sizing.headerHeight}
      padding={1}
      backgroundColor={colors.bg.secondary}
      borderColor={colors.border.default}
    >
      {/* Left: Logo and model */}
      <box flexDirection="row" gap={2}>
        <text style={{ fg: colors.accent.primary }}>◆ OCI GenAI</text>
        <Badge variant="default">{model}</Badge>
      </box>

      {/* Center: Session info */}
      {sessionId && (
        <text style={{ fg: colors.fg.tertiary }}>
          Session: {sessionId.slice(0, 8)}...
        </text>
      )}

      {/* Right: Status and tokens */}
      <box flexDirection="row" gap={2}>
        {tokensUsed !== undefined && (
          <text style={{ fg: colors.fg.secondary }}>
            {formatTokens(tokensUsed)} tokens
          </text>
        )}
        <text style={{ fg: statusColors[status] }}>
          {status === 'thinking' || status === 'streaming' ? '● ' : '○ '}
          {statusLabels[status]}
        </text>
      </box>
    </box>
  );
}
