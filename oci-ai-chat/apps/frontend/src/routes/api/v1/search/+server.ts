/**
 * GET /api/v1/search — Proxy to Fastify API search endpoint.
 *
 * Vector search is now handled by the API layer (OracleVectorStore + OCI GenAI embedder).
 * This SvelteKit route proxies requests to the Fastify API for backward compatibility.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiAuth, resolveOrgId } from '$lib/server/api/require-auth.js';
import { createLogger } from '$lib/server/logger.js';

const log = createLogger('search-api');

export const GET: RequestHandler = async (event) => {
	requireApiAuth(event, 'sessions:read');

	const orgId = resolveOrgId(event);
	if (!orgId) {
		return json({ error: 'Organization context required for search' }, { status: 400 });
	}

	const query = event.url.searchParams.get('q');
	if (!query || query.trim().length === 0) {
		return json({ error: 'Query parameter "q" is required' }, { status: 400 });
	}

	try {
		// Forward to Fastify API search endpoint
		const apiBase = process.env.API_BASE_URL || 'http://localhost:3001';
		const params = new URLSearchParams();
		params.set('q', query);
		const refType = event.url.searchParams.get('type');
		if (refType) params.set('type', refType);
		const limit = event.url.searchParams.get('limit');
		if (limit) params.set('limit', limit);

		const response = await fetch(`${apiBase}/api/v1/search?${params.toString()}`, {
			headers: {
				cookie: event.request.headers.get('cookie') || '',
				authorization: event.request.headers.get('authorization') || ''
			}
		});

		const data = await response.json();
		return json(data, { status: response.status });
	} catch (err) {
		log.error({ err }, 'search proxy failed');
		return json({ error: 'Search service unavailable' }, { status: 503 });
	}
};
