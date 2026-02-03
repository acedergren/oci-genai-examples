import React from 'react';
import { useColors } from '../../theme/index.js';
import { Collapsible, Badge, Spinner } from '../shared/index.js';
import { getDangerLevel, type DangerLevel } from '../../tools/approval-rules.js';

export interface ToolExecution {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'awaiting_approval' | 'running' | 'completed' | 'error';
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export interface ToolPanelProps {
  /** Whether the panel is expanded */
  isOpen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Recent tool executions */
  tools: ToolExecution[];
  /** Currently pending approval */
  pendingApproval?: ToolExecution;
  /** Callback for approval */
  onApprove?: (toolId: string) => void;
  /** Callback for rejection */
  onReject?: (toolId: string) => void;
}

export function ToolPanel({
  isOpen,
  onToggle,
  tools,
  pendingApproval,
  onApprove,
  onReject,
}: ToolPanelProps) {
  const colors = useColors();

  const statusColors: Record<ToolExecution['status'], string> = {
    pending: colors.fg.tertiary,
    awaiting_approval: colors.semantic.warning,
    running: colors.agent.executing,
    completed: colors.semantic.success,
    error: colors.semantic.error,
  };

  const dangerColors: Record<DangerLevel, string> = {
    safe: colors.tool.safe,
    caution: colors.tool.caution,
    danger: colors.tool.danger,
  };

  const runningCount = tools.filter(t => t.status === 'running').length;

  return (
    <Collapsible
      title="Tools"
      isOpen={isOpen}
      onToggle={onToggle}
      shortcut="o"
      badge={
        runningCount > 0 ? (
          <box flexDirection="row" gap={1}>
            <Spinner />
            <Badge variant="info">{String(runningCount)}</Badge>
          </box>
        ) : tools.length > 0 ? (
          <Badge variant="default">{String(tools.length)}</Badge>
        ) : undefined
      }
    >
      {/* Pending Approval Alert */}
      {pendingApproval && (() => {
        const dangerLevel = getDangerLevel(pendingApproval.name);
        const borderColor = dangerColors[dangerLevel];
        return (
          <box
            flexDirection="column"
            padding={1}
            backgroundColor={colors.bg.elevated}
            border
            borderStyle="double"
            borderColor={borderColor}
            style={{ marginBottom: 2 }}
          >
            <box flexDirection="row" gap={1} justifyContent="space-between">
              <box flexDirection="row" gap={1}>
                <text style={{ fg: borderColor }}>
                  {dangerLevel === 'danger' ? '⚠' : dangerLevel === 'safe' ? '✓' : '?'}
                </text>
                <text style={{ fg: colors.fg.primary }}>
                  {dangerLevel === 'danger' ? 'DANGER' : dangerLevel === 'safe' ? 'Safe' : 'Confirm'}
                </text>
              </box>
              <Badge variant={dangerLevel === 'danger' ? 'error' : dangerLevel === 'safe' ? 'success' : 'warning'}>
                {dangerLevel}
              </Badge>
            </box>
            <text style={{ fg: colors.fg.secondary }}>{pendingApproval.name}</text>
            <text style={{ fg: colors.fg.tertiary }}>
              {JSON.stringify(pendingApproval.args, null, 2).slice(0, 100)}
            </text>
            <box flexDirection="row" gap={2} style={{ marginTop: 1 }}>
              <text style={{ fg: colors.semantic.success }}>[y] Approve</text>
              <text style={{ fg: colors.semantic.error }}>[n] Reject</text>
            </box>
          </box>
        );
      })()}

      {/* Tool History */}
      {tools.length > 0 ? (
        <scrollbox
          style={{
            maxHeight: 10,
            backgroundColor: colors.bg.tertiary,
          }}
        >
          {tools.map((tool) => {
            const toolDangerLevel = getDangerLevel(tool.name);
            return (
              <box
                key={tool.id}
                flexDirection="row"
                gap={1}
                style={{ marginBottom: 1 }}
              >
                {/* Status icon */}
                <text style={{ fg: statusColors[tool.status] }}>
                  {tool.status === 'running' ? '●' :
                   tool.status === 'completed' ? '✓' :
                   tool.status === 'error' ? '✗' :
                   tool.status === 'awaiting_approval' ? '?' :
                   '○'}
                </text>

                {/* Danger level indicator */}
                <text style={{ fg: dangerColors[toolDangerLevel] }}>
                  {toolDangerLevel === 'danger' ? '!' :
                   toolDangerLevel === 'caution' ? '~' :
                   '·'}
                </text>

                {/* Tool name */}
                <text style={{ fg: colors.fg.secondary }}>{tool.name}</text>

                {/* Running spinner */}
                {tool.status === 'running' && <Spinner />}

                {/* Duration */}
                {tool.completedAt && (
                  <text style={{ fg: colors.fg.tertiary }}>
                    {`${tool.completedAt - tool.startedAt}ms`}
                  </text>
                )}
              </box>
            );
          })}
        </scrollbox>
      ) : (
        <text style={{ fg: colors.fg.tertiary }}>No tool executions</text>
      )}
    </Collapsible>
  );
}
