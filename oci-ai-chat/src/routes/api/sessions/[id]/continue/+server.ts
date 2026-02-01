import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepository } from '$lib/server/db.js';
import { switchToSession } from '$lib/server/session.js';

// POST /api/sessions/:id/continue - Switch to this session
export const POST: RequestHandler = async ({ params, cookies }) => {
  const success = switchToSession(cookies, params.id);

  if (!success) {
    throw error(404, 'Session not found');
  }

  const repository = getRepository();
  const session = repository.getSession(params.id);
  const turns = repository.getSessionTurns(params.id);

  // Convert turns to AI SDK message format
  const messages = turns.flatMap((turn) => {
    const msgs: Array<{ role: string; content: string }> = [];
    if (turn.userMessage) {
      msgs.push({ role: turn.userMessage.role, content: turn.userMessage.content });
    }
    if (turn.assistantResponse) {
      msgs.push({ role: turn.assistantResponse.role, content: turn.assistantResponse.content });
    }
    return msgs;
  });

  // Calculate total token usage
  const usage = turns.reduce(
    (acc, turn) => ({
      tokens: acc.tokens + (turn.tokensUsed || 0),
      cost: acc.cost + (turn.costUsd || 0),
    }),
    { tokens: 0, cost: 0 }
  );

  return json({ session, messages, usage });
};
