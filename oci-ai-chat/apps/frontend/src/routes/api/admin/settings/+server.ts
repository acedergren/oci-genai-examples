/**
 * /api/admin/settings
 *
 * Admin endpoints for portal settings management.
 * Requires admin:all permission.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { settingsRepository, BulkSetSettingsInputSchema } from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';
import { toPortalError } from '$lib/server/errors.js';
const log = createLogger('admin-settings');

/**
 * GET /api/admin/settings
 * Get portal settings, optionally filtered by category.
 * Query params: ?category=system
 */
export const GET: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		const category = event.url.searchParams.get('category');

		let settings;
		if (category) {
			settings = await settingsRepository.getByCategory(category);
		} else {
			// Get all public settings (or implement listAll if needed)
			settings = await settingsRepository.getPublic();
		}

		log.info({ requestId, count: settings.length, category }, 'admin listed settings');

		return json(settings);
	} catch (err) {
		log.error({ err, requestId }, 'failed to list settings');

		const isPermissionError = err instanceof Error && err.message.includes('permission');
		if (isPermissionError) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};

/**
 * PUT /api/admin/settings
 * Bulk update portal settings.
 */
export const PUT: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		// Parse and validate input
		const body = await event.request.json();
		const input = BulkSetSettingsInputSchema.parse(body);

		// Bulk set settings
		await settingsRepository.bulkSet(input.settings);

		log.info({ requestId, count: input.settings.length }, 'admin bulk updated settings');

		return json({ success: true, count: input.settings.length });
	} catch (err) {
		log.error({ err, requestId }, 'failed to bulk update settings');

		if (err instanceof Error) {
			if (err.message.includes('permission')) {
				return json({ error: 'Insufficient permissions' }, { status: 403 });
			}
			// Keep Zod validation details for admin endpoints
			if ('issues' in err) {
				return json({ error: 'Validation failed', details: (err as any).issues }, { status: 400 });
			}
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};
