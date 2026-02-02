import { type ApprovalLevel, getTool, inferApprovalLevel } from './registry.js';

/**
 * Tool approval rules engine
 *
 * Determines whether a tool call should be auto-approved,
 * require user confirmation, or be flagged as dangerous.
 */

export interface ApprovalDecision {
  approved: boolean;
  level: ApprovalLevel;
  reason: string;
}

/**
 * Check if a tool call should be auto-approved
 */
export function checkAutoApprove(
  toolName: string,
  args: Record<string, unknown>
): ApprovalDecision {
  const tool = getTool(toolName);
  const level = tool?.approvalLevel ?? inferApprovalLevel(toolName);

  // Auto-approved tools pass immediately
  if (level === 'auto') {
    return {
      approved: true,
      level: 'auto',
      reason: 'Read-only operation',
    };
  }

  // Check for specific dangerous patterns in arguments
  const dangerPatterns = checkDangerousPatterns(toolName, args);
  if (dangerPatterns) {
    return {
      approved: false,
      level: 'danger',
      reason: dangerPatterns,
    };
  }

  // Confirm-level tools need user approval
  return {
    approved: false,
    level,
    reason: level === 'danger'
      ? 'Destructive operation requires explicit approval'
      : 'Modification operation requires confirmation',
  };
}

/**
 * Check for dangerous patterns in tool arguments
 */
function checkDangerousPatterns(
  toolName: string,
  args: Record<string, unknown>
): string | null {
  // Check for wildcard or broad scope operations
  if (args.compartmentId === 'root') {
    return 'Operation targets root compartment';
  }

  // Check for force flags
  if (args.force === true || args.skipConfirmation === true) {
    return 'Force flag detected';
  }

  // Check for production indicators in names
  const nameFields = ['displayName', 'name', 'hostname'];
  for (const field of nameFields) {
    const value = args[field];
    if (typeof value === 'string' && /prod|production|live/i.test(value)) {
      return `Production resource detected: ${value}`;
    }
  }

  return null;
}

/**
 * Format approval prompt for user
 */
export function formatApprovalPrompt(
  toolName: string,
  args: Record<string, unknown>,
  decision: ApprovalDecision
): string {
  const lines: string[] = [];

  if (decision.level === 'danger') {
    lines.push('⚠️  DANGER: This is a destructive operation');
  } else {
    lines.push('📋 Confirmation required');
  }

  lines.push('');
  lines.push(`Tool: ${toolName}`);
  lines.push(`Reason: ${decision.reason}`);
  lines.push('');
  lines.push('Arguments:');

  // Format arguments (truncate long values)
  for (const [key, value] of Object.entries(args)) {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const truncated = valueStr.length > 50 ? `${valueStr.slice(0, 47)}...` : valueStr;
    lines.push(`  ${key}: ${truncated}`);
  }

  lines.push('');
  lines.push(decision.level === 'danger'
    ? 'Type "yes" to confirm, or "n" to reject'
    : 'Press [y] to approve, [n] to reject');

  return lines.join('\n');
}
