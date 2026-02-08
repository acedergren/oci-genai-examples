/**
 * /api/admin/ai-providers/[id]
 *
 * Admin endpoints for single AI provider operations.
 * Requires admin:all permission.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiProviderRepository, UpdateAiProviderInputSchema } from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';

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

		return json(provider);
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to get AI provider');

		if (err instanceof Error && err.message.includes('permission')) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		return json({ error: 'Failed to get AI provider', details: String(err) }, { status: 500 });
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

		return json(provider);
	} catch (err) {
		log.error({ err, requestId, id }, 'failed to update AI provider');

		if (err instanceof Error && err.message.includes('permission')) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		if (err instanceof Error && 'issues' in err) {
			// Zod validation error
			return json({ error: 'Validation failed', details: (err as any).issues }, { status: 400 });
		}

		return json({ error: 'Failed to update AI provider', details: String(err) }, { status: 500 });
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

		if (err instanceof Error && err.message.includes('permission')) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		return json({ error: 'Failed to delete AI provider', details: String(err) }, { status: 500 });
	}
};
