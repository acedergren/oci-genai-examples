/**
 * /api/admin/ai-providers
 *
 * Admin endpoints for AI provider management.
 * Requires admin:all permission.
 */
import { json, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	aiProviderRepository,
	CreateAiProviderInputSchema,
	stripAiProviderSecretsArray,
	stripAiProviderSecrets
} from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';
import { toPortalError } from '$lib/server/errors.js';

const log = createLogger('admin-ai-providers');

/**
 * GET /api/admin/ai-providers
 * List all AI providers (including disabled ones).
 */
export const GET: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		const providers = await aiProviderRepository.list();

		log.info({ requestId, count: providers.length }, 'admin listed all AI providers');

		return json(stripAiProviderSecretsArray(providers));
	} catch (err) {
		log.error({ err, requestId }, 'failed to list AI providers');

		// Handle SvelteKit HttpError (from requirePermission)
		if (isHttpError(err) && (err.status === 401 || err.status === 403)) {
			return json({ error: err.body.message }, { status: err.status });
		}

		const portalError = toPortalError(err);
		return json(portalError.toResponseBody(), { status: portalError.statusCode });
	}
};

/**
 * POST /api/admin/ai-providers
 * Create a new AI provider.
 */
export const POST: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		// Parse and validate input
		const body = await event.request.json();
		const input = CreateAiProviderInputSchema.parse(body);

		// Create AI provider
		const provider = await aiProviderRepository.create(input);

		log.info(
			{ requestId, providerId: provider.providerId, providerType: provider.providerType },
			'admin created AI provider'
		);

		return json(stripAiProviderSecrets(provider), { status: 201 });
	} catch (err) {
		log.error({ err, requestId }, 'failed to create AI provider');

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
