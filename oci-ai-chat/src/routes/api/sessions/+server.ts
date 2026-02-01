import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepository } from '$lib/server/db.js';
import { startNewSession } from '$lib/server/session.js';

// GET /api/sessions - List recent sessions
export const GET: RequestHandler = async ({ url }) => {
  const repository = getRepository();
  const limit = parseInt(url.searchParams.get('limit') ?? '20');
  const status = url.searchParams.get('status') as 'active' | 'completed' | undefined;

  const sessions = repository.listSessions({ limit, status });
  return json({ sessions });
};

// POST /api/sessions - Create new session
export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const model = body.model ?? 'meta.llama-3.3-70b-instruct';
  const region = body.region ?? 'eu-frankfurt-1';

  const { sessionId } = startNewSession(cookies, { model, region });
  const repository = getRepository();
  const session = repository.getSession(sessionId);

  return json({ session }, { status: 201 });
};
