// Initialize tool registry by importing categories
import './categories/index.js';

export {
  registerTool,
  getTool,
  getAllTools,
  getToolsByCategory,
  requiresApproval,
  inferApprovalLevel,
  toAISDKTools,
  executeTool,
  type ToolCategory,
  type ApprovalLevel,
  type ToolDefinition,
} from './registry.js';

export {
  checkAutoApprove,
  formatApprovalPrompt,
  getDangerLevel,
  getDangerDescription,
  type ApprovalDecision,
  type DangerLevel,
} from './approval-rules.js';

export {
  ToolExecutor,
  toolExecutor,
  type ExecutionResult,
  type PendingToolCall,
} from './executor.js';
