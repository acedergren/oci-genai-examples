import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Stateless sessions API - returns empty list.
 * Session management is not available in Cloudflare Pages deployment.
 */
export const GET: RequestHandler = async () => {
  return json({ sessions: [] });
};

export const POST: RequestHandler = async () => {
  return json({
    error: 'Session management not available in stateless deployment',
  }, { status: 501 });
};
