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
 * Tool definition with Zod schema
 */
export interface ToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  category: ToolCategory;
  approvalLevel: ApprovalLevel;
  schema: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
}

/**
 * Registered tools map
 */
const tools = new Map<string, ToolDefinition>();

/**
 * Register a tool
 */
export function registerTool<T extends z.ZodTypeAny>(tool: ToolDefinition<T>): void {
  tools.set(tool.name, tool as ToolDefinition);
}

/**
 * Get a tool by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

/**
 * Get all tools
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return Array.from(tools.values()).filter(t => t.category === category);
}

/**
 * Check if a tool requires approval based on operation type
 */
export function requiresApproval(toolName: string): boolean {
  const tool = tools.get(toolName);
  if (!tool) return true; // Unknown tools require approval

  return tool.approvalLevel !== 'auto';
}

/**
 * Determine approval level from tool name pattern
 */
export function inferApprovalLevel(toolName: string): ApprovalLevel {
  const name = toolName.toLowerCase();

  // Auto-approve read operations
  if (name.startsWith('list') || name.startsWith('get') || name.startsWith('describe')) {
    return 'auto';
  }

  // Danger level for destructive operations
  if (name.startsWith('delete') || name.startsWith('terminate') || name.startsWith('stop')) {
    return 'danger';
  }

  // Confirm level for modify operations
  return 'confirm';
}

/**
 * Convert tools to AI SDK tool format
 */
export function toAISDKTools() {
  const aiTools: Record<string, {
    description: string;
    inputSchema: z.ZodTypeAny;
  }> = {};

  for (const [name, tool] of tools) {
    aiTools[name] = {
      description: tool.description,
      inputSchema: tool.schema,
    };
  }

  return aiTools;
}

/**
 * Execute a tool by name with the given arguments
 */
export async function executeTool(name: string, args: unknown): Promise<unknown> {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Validate arguments against schema
  const validatedArgs = tool.schema.parse(args);

  // Execute the tool
  return tool.execute(validatedArgs);
}
