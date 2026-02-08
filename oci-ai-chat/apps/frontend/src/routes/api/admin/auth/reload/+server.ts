/**
 * POST /api/admin/auth/reload
 *
 * Force reload of auth configuration (picks up IDP provider changes).
 * Requires admin:all permission.
 */
import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reloadAuth } from '$lib/server/auth/config.js';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';
import { toPortalError } from '$lib/server/errors.js';

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

		// Handle SvelteKit HttpError (from requirePermission)
		if (isHttpError(err) && (err.status === 401 || err.status === 403)) {
			return json({ error: err.body.message }, { status: err.status });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};
