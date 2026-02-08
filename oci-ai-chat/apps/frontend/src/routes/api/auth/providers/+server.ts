/**
 * GET /api/auth/providers
 *
 * Public endpoint: returns active IDP providers for login page.
 * No authentication required - this is consumed by the login UI.
 * Returns only safe fields (no secrets).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { idpRepository } from '$lib/server/admin';
import { createLogger } from '$lib/server/logger';

const log = createLogger('auth-providers');

export const GET: RequestHandler = async ({ request }) => {
	const requestId = request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		const providers = await idpRepository.listActive();

		// Return only public-safe fields (no secrets)
		const publicProviders = providers.map((p) => ({
			providerId: p.providerId,
			displayName: p.displayName,
			providerType: p.providerType,
			iconUrl: p.iconUrl,
			buttonLabel: p.buttonLabel,
			isDefault: p.isDefault,
			sortOrder: p.sortOrder
		}));

		log.info({ requestId, count: publicProviders.length }, 'public IDP providers listed');

		return json(publicProviders);
	} catch (err) {
		log.error({ err, requestId }, 'failed to list public IDP providers');
		// Public endpoint: no error details for security
		return json({ error: 'Failed to list providers' }, { status: 500 });
	}
};
