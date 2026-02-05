import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Stateless session API - sessions not persisted.
 */
export const GET: RequestHandler = async () => {
  return json({ error: 'Session not found' }, { status: 404 });
};

export const DELETE: RequestHandler = async () => {
  return json({
    error: 'Session management not available in stateless deployment',
  }, { status: 501 });
};
