/**
 * GET /api/setup/status
 *
 * Returns setup wizard completion status.
 * This endpoint is always accessible, even after setup is complete.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { settingsRepository, idpRepository, aiProviderRepository } from '$lib/server/admin';
import { createLogger } from '$lib/server/logger';

const log = createLogger('setup');

export const GET: RequestHandler = async ({ request }) => {
	const requestId = request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Check if setup is complete
		const isSetupComplete = await settingsRepository.isSetupComplete();

		// Count active providers
		const [idps, aiProviders] = await Promise.all([
			idpRepository.listActive(),
			aiProviderRepository.listActive()
		]);

		const status = {
			isSetupComplete,
			steps: {
				idp: idps.length > 0,
				aiProvider: aiProviders.length > 0,
				settings: isSetupComplete // Settings are done when setup is marked complete
			},
			activeIdpCount: idps.length,
			activeAiProviderCount: aiProviders.length,
			defaultIdpId: idps.find((idp) => idp.isDefault)?.id ?? null,
			defaultAiProviderId: aiProviders.find((p) => p.isDefault)?.id ?? null
		};

		log.info({ requestId, status }, 'setup status checked');

		return json(status);
	} catch (err) {
		log.error({ err, requestId }, 'failed to get setup status');
		return json(
			{ error: 'Failed to retrieve setup status', details: String(err) },
			{ status: 500 }
		);
	}
};
