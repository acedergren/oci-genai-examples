/**
 * POST /api/admin/auth/reload
 *
 * Force reload of auth configuration (picks up IDP provider changes).
 * Requires admin:all permission.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reloadAuth } from '$lib/server/auth/config.js';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';

const log = createLogger('admin-auth');

export const POST: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		// Reload auth configuration
		await reloadAuth();

		log.info({ requestId }, 'admin forced auth configuration reload');

		return json({ success: true, message: 'Auth configuration reloaded' });
	} catch (err) {
		log.error({ err, requestId }, 'failed to reload auth configuration');

		const isPermissionError = err instanceof Error && err.message.includes('permission');
		return json(
			{
				error: isPermissionError
					? 'Insufficient permissions'
					: 'Failed to reload auth configuration',
				...(isPermissionError ? {} : { details: String(err) })
			},
			{ status: isPermissionError ? 403 : 500 }
		);
	}
};
