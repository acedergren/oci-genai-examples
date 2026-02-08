/**
 * POST /api/setup/idp
 *
 * Create the first IDP provider during setup.
 * Self-locking: returns 403 if setup is already complete.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { settingsRepository, idpRepository, CreateIdpInputSchema } from '$lib/server/admin';
import { createLogger } from '$lib/server/logger';

const log = createLogger('setup');

export const POST: RequestHandler = async ({ request }) => {
	const requestId = request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Lock: deny if setup is already complete
		const isSetupComplete = await settingsRepository.isSetupComplete();
		if (isSetupComplete) {
			log.warn({ requestId }, 'attempted IDP creation after setup complete');
			return json({ error: 'Setup is already complete' }, { status: 403 });
		}

		// Parse and validate input
		const body = await request.json();
		const input = CreateIdpInputSchema.parse(body);

		// Create IDP provider
		const idp = await idpRepository.create(input);

		log.info(
			{ requestId, providerId: idp.providerId, providerType: idp.providerType },
			'IDP provider created during setup'
		);

		return json(idp, { status: 201 });
	} catch (err) {
		log.error({ err, requestId }, 'failed to create IDP provider');

		const isValidationError = err instanceof Error && 'issues' in err;
		return json(
			{
				error: isValidationError ? 'Validation failed' : 'Failed to create IDP provider',
				details: isValidationError ? (err as any).issues : String(err)
			},
			{ status: isValidationError ? 400 : 500 }
		);
	}
};
