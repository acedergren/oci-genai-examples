/**
 * /api/admin/idp/[id]
 *
 * Admin endpoints for single IDP provider operations.
 * Requires admin:all permission.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { idpRepository, UpdateIdpInputSchema } from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';

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

		const isPermissionError = err instanceof Error && err.message.includes('permission');
		return json(
			{
				error: isPermissionError ? 'Insufficient permissions' : 'Failed to get IDP provider',
				...(isPermissionError ? {} : { details: String(err) })
			},
			{ status: isPermissionError ? 403 : 500 }
		);
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

		if (err instanceof Error) {
			if (err.message.includes('permission')) {
				return json({ error: 'Insufficient permissions' }, { status: 403 });
			}
			if ('issues' in err) {
				return json({ error: 'Validation failed', details: (err as any).issues }, { status: 400 });
			}
		}

		return json({ error: 'Failed to update IDP provider', details: String(err) }, { status: 500 });
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

		const isPermissionError = err instanceof Error && err.message.includes('permission');
		return json(
			{
				error: isPermissionError ? 'Insufficient permissions' : 'Failed to delete IDP provider',
				...(isPermissionError ? {} : { details: String(err) })
			},
			{ status: isPermissionError ? 403 : 500 }
		);
	}
};
