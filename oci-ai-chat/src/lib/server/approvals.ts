/**
 * Pending tool approval state
 *
 * Extracted from approve/+server.ts — SvelteKit endpoint files
 * can only export HTTP method handlers (GET, POST, etc.).
 *
 * In production, replace with Redis or database-backed storage.
 */

export interface PendingApprovalEntry {
  toolName: string;
  args: Record<string, unknown>;
  sessionId?: string;
  createdAt: number;
  resolve: (approved: boolean) => void;
}

export const pendingApprovals = new Map<string, PendingApprovalEntry>();

/**
 * Register a pending approval (called from chat stream)
 */
export function registerPendingApproval(
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionId?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    pendingApprovals.set(toolCallId, {
      toolName,
      args,
      sessionId,
      createdAt: Date.now(),
      resolve,
    });

    // Auto-timeout after 5 minutes
    setTimeout(() => {
      if (pendingApprovals.has(toolCallId)) {
        pendingApprovals.delete(toolCallId);
        resolve(false);
      }
    }, 5 * 60 * 1000);
  });
}
