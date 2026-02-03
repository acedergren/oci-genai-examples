// src/routes/api/intelligence/segments/+server.ts
import { json } from '@sveltejs/kit';
import { getRepository } from '$lib/server/db.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const repository = getRepository();
  const segments = repository.segments.listActive();

  return json(segments);
};
