import { type ApprovalLevel, getTool, inferApprovalLevel } from './registry.js';

/**
 * Tool approval rules engine
 *
 * Determines whether a tool call should be auto-approved,
 * require user confirmation, or be flagged as dangerous.
 */

export type DangerLevel = 'safe' | 'caution' | 'danger';

export interface ApprovalDecision {
  approved: boolean;
  level: ApprovalLevel;
  reason: string;
}

/**
 * Patterns for determining danger level from tool names
 */
const DANGER_PATTERNS: Array<{ pattern: RegExp; level: DangerLevel; description: string }> = [
  // Danger (destructive operations)
  { pattern: /^delete/i, level: 'danger', description: 'Delete operation' },
  { pattern: /^terminate/i, level: 'danger', description: 'Terminate operation' },
  { pattern: /^destroy/i, level: 'danger', description: 'Destroy operation' },
  { pattern: /^remove/i, level: 'danger', description: 'Remove operation' },
  { pattern: /^purge/i, level: 'danger', description: 'Purge operation' },
  { pattern: /^force/i, level: 'danger', description: 'Force operation' },
  { pattern: /^drop/i, level: 'danger', description: 'Drop operation' },

  // Caution (modification operations)
  { pattern: /^stop/i, level: 'caution', description: 'Stop operation' },
  { pattern: /^update/i, level: 'caution', description: 'Update operation' },
  { pattern: /^modify/i, level: 'caution', description: 'Modify operation' },
  { pattern: /^change/i, level: 'caution', description: 'Change operation' },
  { pattern: /^create/i, level: 'caution', description: 'Create operation' },
  { pattern: /^launch/i, level: 'caution', description: 'Launch operation' },
  { pattern: /^start/i, level: 'caution', description: 'Start operation' },
  { pattern: /^reboot/i, level: 'caution', description: 'Reboot operation' },
  { pattern: /^restart/i, level: 'caution', description: 'Restart operation' },
  { pattern: /^scale/i, level: 'caution', description: 'Scale operation' },
  { pattern: /^resize/i, level: 'caution', description: 'Resize operation' },
  { pattern: /^attach/i, level: 'caution', description: 'Attach operation' },
  { pattern: /^detach/i, level: 'caution', description: 'Detach operation' },
  { pattern: /^move/i, level: 'caution', description: 'Move operation' },
  { pattern: /^copy/i, level: 'caution', description: 'Copy operation' },
  { pattern: /^run/i, level: 'caution', description: 'Run operation' },
  { pattern: /^execute/i, level: 'caution', description: 'Execute operation' },

  // Safe (read-only operations)
  { pattern: /^list/i, level: 'safe', description: 'List operation' },
  { pattern: /^get/i, level: 'safe', description: 'Get operation' },
  { pattern: /^describe/i, level: 'safe', description: 'Describe operation' },
  { pattern: /^show/i, level: 'safe', description: 'Show operation' },
  { pattern: /^read/i, level: 'safe', description: 'Read operation' },
  { pattern: /^search/i, level: 'safe', description: 'Search operation' },
  { pattern: /^find/i, level: 'safe', description: 'Find operation' },
  { pattern: /^check/i, level: 'safe', description: 'Check operation' },
  { pattern: /^validate/i, level: 'safe', description: 'Validate operation' },
];

/**
 * Get the danger level for a tool name
 */
export function getDangerLevel(toolName: string): DangerLevel {
  // Extract the action part of the tool name (e.g., "delete_instance" -> "delete")
  const normalizedName = toolName.replace(/_/g, ' ').toLowerCase();

  for (const { pattern, level } of DANGER_PATTERNS) {
    if (pattern.test(normalizedName)) {
      return level;
    }
  }

  // Default to caution for unknown operations
  return 'caution';
}

/**
 * Get danger description for a tool
 */
export function getDangerDescription(toolName: string): string {
  const normalizedName = toolName.replace(/_/g, ' ').toLowerCase();

  for (const { pattern, description } of DANGER_PATTERNS) {
    if (pattern.test(normalizedName)) {
      return description;
    }
  }

  return 'Unknown operation';
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
