/**
 * /api/admin/idp
 *
 * Admin endpoints for IDP provider management.
 * Requires admin:all permission.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { idpRepository, CreateIdpInputSchema } from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';

const log = createLogger('admin-idp');

/**
 * GET /api/admin/idp
 * List all IDP providers (including disabled ones).
 */
export const GET: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		const providers = await idpRepository.list();

		log.info({ requestId, count: providers.length }, 'admin listed all IDP providers');

		return json(providers);
	} catch (err) {
		log.error({ err, requestId }, 'failed to list IDP providers');

		if (err instanceof Error && err.message.includes('permission')) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		return json({ error: 'Failed to list IDP providers', details: String(err) }, { status: 500 });
	}
};

/**
 * POST /api/admin/idp
 * Create a new IDP provider.
 */
export const POST: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		// Parse and validate input
		const body = await event.request.json();
		const input = CreateIdpInputSchema.parse(body);

		// Create IDP provider
		const provider = await idpRepository.create(input);

		log.info(
			{ requestId, providerId: provider.providerId, providerType: provider.providerType },
			'admin created IDP provider'
		);

		return json(provider, { status: 201 });
	} catch (err) {
		log.error({ err, requestId }, 'failed to create IDP provider');

		if (err instanceof Error && err.message.includes('permission')) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		if (err instanceof Error && 'issues' in err) {
			// Zod validation error
			return json({ error: 'Validation failed', details: (err as any).issues }, { status: 400 });
		}

		return json({ error: 'Failed to create IDP provider', details: String(err) }, { status: 500 });
	}
};
