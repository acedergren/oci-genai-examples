import { getTool, executeTool as registryExecute } from './registry.js';
import { checkAutoApprove, type ApprovalDecision } from './approval-rules.js';

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface PendingToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  decision: ApprovalDecision;
  resolve: (approved: boolean) => void;
}

/**
 * Tool executor with approval workflow
 */
export class ToolExecutor {
  private pendingApprovals = new Map<string, PendingToolCall>();
  private onPendingApproval?: (pending: PendingToolCall) => void;
  private onApprovalResolved?: (id: string, approved: boolean) => void;

  /**
   * Set callback for pending approvals
   */
  setPendingApprovalCallback(callback: (pending: PendingToolCall) => void): void {
    this.onPendingApproval = callback;
  }

  /**
   * Set callback for when approvals are resolved
   */
  setApprovalResolvedCallback(callback: (id: string, approved: boolean) => void): void {
    this.onApprovalResolved = callback;
  }

  /**
   * Execute a tool call with approval workflow
   */
  async execute(
    callId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Check approval requirements
      const decision = checkAutoApprove(toolName, args);

      if (!decision.approved) {
        // Wait for user approval
        const approved = await this.waitForApproval(callId, toolName, args, decision);

        if (!approved) {
          return {
            success: false,
            error: 'Tool execution rejected by user',
            duration: Date.now() - startTime,
          };
        }
      }

      // Execute the tool
      const result = await registryExecute(toolName, args);

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Wait for user approval
   */
  private waitForApproval(
    id: string,
    name: string,
    args: Record<string, unknown>,
    decision: ApprovalDecision
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const pending: PendingToolCall = {
        id,
        name,
        args,
        decision,
        resolve: (approved: boolean) => {
          this.pendingApprovals.delete(id);
          this.onApprovalResolved?.(id, approved);
          resolve(approved);
        },
      };

      this.pendingApprovals.set(id, pending);
      this.onPendingApproval?.(pending);
    });
  }

  /**
   * Approve a pending tool call
   */
  approve(callId: string): void {
    const pending = this.pendingApprovals.get(callId);
    if (pending) {
      pending.resolve(true);
    }
  }

  /**
   * Reject a pending tool call
   */
  reject(callId: string): void {
    const pending = this.pendingApprovals.get(callId);
    if (pending) {
      pending.resolve(false);
    }
  }

  /**
   * Get current pending approval (if any)
   */
  getPendingApproval(): PendingToolCall | undefined {
    const entries = this.pendingApprovals.entries();
    const first = entries.next();
    return first.done ? undefined : first.value[1];
  }

  /**
   * Check if there are pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }
}

// Singleton instance
export const toolExecutor = new ToolExecutor();
