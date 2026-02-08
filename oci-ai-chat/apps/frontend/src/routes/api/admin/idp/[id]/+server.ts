/**
 * /api/admin/idp/[id]
 *
 * Admin endpoints for single IDP provider operations.
 * Requires admin:all permission.
 */
import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { idpRepository, UpdateIdpInputSchema } from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';
import { toPortalError } from '$lib/server/errors.js';

const log = createLogger('admin-idp');

/**
 * GET /api/admin/idp/[id]
 * Get a single IDP provider by ID.
 */
export const GET: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';
	const { id } = event.params;

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		const provider = await idpRepository.getById(id);

		if (!provider) {
			return json({ error: 'IDP provider not found' }, { status: 404 });
		}

		log.info({ requestId, id, providerId: provider.providerId }, 'admin retrieved IDP provider');

		return json(provider);
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to get IDP provider');

		// Handle SvelteKit HttpError (from requirePermission)
		if (isHttpError(err) && (err.status === 401 || err.status === 403)) {
			return json({ error: err.body.message }, { status: err.status });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};

/**
 * PUT /api/admin/idp/[id]
 * Update an existing IDP provider.
 */
export const PUT: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';
	const { id } = event.params;

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		// Parse and validate input
		const body = await event.request.json();
		const input = UpdateIdpInputSchema.parse(body);

		// Update IDP provider
		const provider = await idpRepository.update(id, input);

		if (!provider) {
			return json({ error: 'IDP provider not found' }, { status: 404 });
		}

		log.info({ requestId, id, providerId: provider.providerId }, 'admin updated IDP provider');

		return json(provider);
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to update IDP provider');

		// Handle SvelteKit HttpError (from requirePermission)
		if (isHttpError(err) && (err.status === 401 || err.status === 403)) {
			return json({ error: err.body.message }, { status: err.status });
		}

		// Keep Zod validation details for admin endpoints
		if (err instanceof Error && 'issues' in err) {
			return json({ error: 'Validation failed', details: (err as any).issues }, { status: 400 });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};

/**
 * DELETE /api/admin/idp/[id]
 * Delete an IDP provider.
 */
export const DELETE: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';
	const { id } = event.params;

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		await idpRepository.delete(id);

		log.info({ requestId, id }, 'admin deleted IDP provider');

		return json({ success: true });
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to delete IDP provider');

		// Handle SvelteKit HttpError (from requirePermission)
		if (isHttpError(err) && (err.status === 401 || err.status === 403)) {
			return json({ error: err.body.message }, { status: err.status });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};
