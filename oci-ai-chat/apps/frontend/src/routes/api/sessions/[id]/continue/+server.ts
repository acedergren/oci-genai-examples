import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/auth/rbac.js';

/**
 * Stateless session continue API - sessions not persisted.
 */
export const POST: RequestHandler = async (event) => {
	// Defense-in-depth: require sessions:write permission (hooks.server.ts already enforces session)
	await requirePermission(event, 'sessions:write');

	return json(
		{
			error: 'Session management not available in stateless deployment'
		},
		{ status: 501 }
	);
};
