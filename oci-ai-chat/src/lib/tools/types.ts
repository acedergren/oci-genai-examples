import { z } from 'zod';

/**
 * Tool categories for OCI operations
 */
export type ToolCategory =
  | 'compute'
  | 'networking'
  | 'storage'
  | 'database'
  | 'identity'
  | 'observability';

/**
 * Approval level for tool execution
 */
export type ApprovalLevel = 'auto' | 'confirm' | 'danger';

/**
 * Tool execution status
 */
export type ToolStatus = 'pending' | 'awaiting_approval' | 'running' | 'completed' | 'error';

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Tool definition for registration
 */
export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  approvalLevel: ApprovalLevel;
  parameters: z.ZodTypeAny;
}

/**
 * Pending approval request sent to client
 */
export interface PendingApproval {
  toolCallId: string;
  toolName: string;
  category: ToolCategory;
  approvalLevel: ApprovalLevel;
  args: Record<string, unknown>;
}

/**
 * Tool result for streaming
 */
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * Check if a tool name indicates a read-only operation
 */
export function isReadOnlyOperation(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name.startsWith('list') || name.startsWith('get') || name.startsWith('describe');
}

/**
 * Check if a tool name indicates a destructive operation
 */
export function isDestructiveOperation(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name.startsWith('delete') || name.startsWith('terminate') || name.startsWith('stop');
}

/**
 * Infer approval level from tool name
 */
export function inferApprovalLevel(toolName: string): ApprovalLevel {
  if (isReadOnlyOperation(toolName)) return 'auto';
  if (isDestructiveOperation(toolName)) return 'danger';
  return 'confirm';
}
