import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepository } from '$lib/server/db.js';

// GET /api/sessions/:id - Get session with turns
export const GET: RequestHandler = async ({ params }) => {
  const repository = getRepository();
  const session = repository.getSession(params.id);

  if (!session) {
    throw error(404, 'Session not found');
  }

  const turns = repository.getSessionTurns(params.id);
  return json({ session, turns });
};

// DELETE /api/sessions/:id - Mark session as completed
export const DELETE: RequestHandler = async ({ params }) => {
  const repository = getRepository();
  const session = repository.getSession(params.id);

  if (!session) {
    throw error(404, 'Session not found');
  }

  repository.updateSession(params.id, { status: 'completed' });
  return json({ success: true });
};
