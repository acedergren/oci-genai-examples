/**
 * /api/admin/ai-providers/[id]
 *
 * Admin endpoints for single AI provider operations.
 * Requires admin:all permission.
 */
import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	aiProviderRepository,
	UpdateAiProviderInputSchema,
	stripAiProviderSecrets
} from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';
import { toPortalError } from '$lib/server/errors.js';

const log = createLogger('admin-ai-providers');

/**
 * GET /api/admin/ai-providers/[id]
 * Get a single AI provider by ID.
 */
export const GET: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';
	const { id } = event.params;

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		const provider = await aiProviderRepository.getById(id);

		if (!provider) {
			return json({ error: 'AI provider not found' }, { status: 404 });
		}

		log.info({ requestId, id, providerId: provider.providerId }, 'admin retrieved AI provider');

		return json(stripAiProviderSecrets(provider));
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to get AI provider');

		// Handle SvelteKit HttpError (from requirePermission)
		if (isHttpError(err) && (err.status === 401 || err.status === 403)) {
			return json({ error: err.body.message }, { status: err.status });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};

/**
 * PUT /api/admin/ai-providers/[id]
 * Update an existing AI provider.
 */
export const PUT: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';
	const { id } = event.params;

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		// Parse and validate input
		const body = await event.request.json();
		const input = UpdateAiProviderInputSchema.parse(body);

		// Update AI provider
		const provider = await aiProviderRepository.update(id, input);

		if (!provider) {
			return json({ error: 'AI provider not found' }, { status: 404 });
		}

		log.info({ requestId, id, providerId: provider.providerId }, 'admin updated AI provider');

		return json(stripAiProviderSecrets(provider));
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to update AI provider');

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
 * DELETE /api/admin/ai-providers/[id]
 * Delete an AI provider.
 */
export const DELETE: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';
	const { id } = event.params;

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		await aiProviderRepository.delete(id);

		log.info({ requestId, id }, 'admin deleted AI provider');

		return json({ success: true });
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to delete AI provider');

		// Handle SvelteKit HttpError (from requirePermission)
		if (isHttpError(err) && (err.status === 401 || err.status === 403)) {
			return json({ error: err.body.message }, { status: err.status });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};
