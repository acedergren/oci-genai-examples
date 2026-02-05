import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logToolApproval, logToolExecution } from '$lib/server/audit.js';
import { getToolDefinition } from '$lib/tools/index.js';

/**
 * Store for pending tool approvals
 * In production, use Redis or a database
 */
const pendingApprovals = new Map<string, {
  toolName: string;
  args: Record<string, unknown>;
  sessionId?: string;
  createdAt: number;
  resolve: (approved: boolean) => void;
}>();

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

/**
 * POST /api/tools/approve
 * Handle tool approval decisions from the client
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { toolCallId, approved, reason } = body;

  if (!toolCallId) {
    return json({ error: 'Missing toolCallId' }, { status: 400 });
  }

  const pending = pendingApprovals.get(toolCallId);
  
  if (!pending) {
    return json({ error: 'No pending approval found for this tool call' }, { status: 404 });
  }

  // Get tool definition for logging
  const toolDef = getToolDefinition(pending.toolName);
  
  // Log the approval decision
  logToolApproval(
    pending.toolName,
    toolDef?.category || 'unknown',
    toolDef?.approvalLevel || 'confirm',
    pending.args,
    approved,
    pending.sessionId
  );

  // Resolve the pending promise
  pending.resolve(approved);
  pendingApprovals.delete(toolCallId);

  return json({ 
    success: true, 
    approved,
    toolCallId,
    message: approved ? 'Tool execution approved' : 'Tool execution rejected'
  });
};

/**
 * GET /api/tools/approve
 * Get list of pending approvals (for debugging/admin)
 */
export const GET: RequestHandler = async () => {
  const pending = Array.from(pendingApprovals.entries()).map(([id, data]) => ({
    toolCallId: id,
    toolName: data.toolName,
    args: data.args,
    sessionId: data.sessionId,
    createdAt: new Date(data.createdAt).toISOString(),
    age: Date.now() - data.createdAt,
  }));

  return json({ pending, count: pending.length });
};
