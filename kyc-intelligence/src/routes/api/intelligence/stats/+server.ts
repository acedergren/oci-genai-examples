// src/routes/api/intelligence/stats/+server.ts
import { json } from '@sveltejs/kit';
import { getRepository } from '$lib/server/db.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const repository = getRepository();

  // Get total customers
  const allCustomers = repository.customers.list();
  const totalCustomers = allCustomers.length;

  // Count customers with embeddings
  const customersWithEmbeddings = allCustomers.filter((c) => c.profile_embedding).length;

  // Get active segments
  const activeSegments = repository.segments.listActive().length;

  // Get last segmentation time
  const segments = repository.segments.listActive();
  const lastSegmentation = segments.length > 0
    ? new Date(Math.max(...segments.map((s) => s.updated_at))).toLocaleString()
    : null;

  return json({
    totalCustomers,
    customersWithEmbeddings,
    activeSegments,
    lastSegmentation,
  });
};
