/**
 * Approval service — manages pending tool approvals and server-side
 * approval records. Approval tokens are single-use with 5-min expiry.
 *
 * This is a lightweight port of apps/frontend/src/lib/server/approvals.ts
 * for the Fastify API.
 */

// ---------------------------------------------------------------------------
// Pending approvals — in-memory map of tool calls awaiting user decision
// ---------------------------------------------------------------------------

interface PendingApproval {
  toolName: string;
  args: Record<string, unknown>;
  sessionId?: string;
  createdAt: number;
  resolve: (approved: boolean) => void;
}

export const pendingApprovals = new Map<string, PendingApproval>();

export function addPendingApproval(
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string | undefined,
  resolve: (approved: boolean) => void,
) {
  pendingApprovals.set(toolCallId, {
    toolName,
    args,
    sessionId,
    createdAt: Date.now(),
    resolve,
  });
}

// ---------------------------------------------------------------------------
// Server-side approval records — single-use, 5-min expiry
// ---------------------------------------------------------------------------

const APPROVAL_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface ApprovalRecord {
  toolName: string;
  createdAt: number;
}

const approvalRecords = new Map<string, ApprovalRecord>();

/** Record a server-side approval token (called when user approves). */
export async function recordApproval(
  toolCallId: string,
  toolName: string,
): Promise<void> {
  approvalRecords.set(toolCallId, { toolName, createdAt: Date.now() });
}

/** Consume a server-side approval token (single-use, 5-min expiry). */
export async function consumeApproval(
  toolCallId: string,
  toolName: string,
): Promise<boolean> {
  const record = approvalRecords.get(toolCallId);
  if (!record) return false;

  // Always delete (single-use)
  approvalRecords.delete(toolCallId);

  // Verify tool name matches
  if (record.toolName !== toolName) return false;

  // Verify not expired
  if (Date.now() - record.createdAt > APPROVAL_EXPIRY_MS) return false;

  return true;
}

/** Reset all state (for testing). */
export function _resetApprovals() {
  pendingApprovals.clear();
  approvalRecords.clear();
}
