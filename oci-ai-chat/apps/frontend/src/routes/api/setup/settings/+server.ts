/**
 * POST /api/setup/settings
 *
 * Save portal settings during setup wizard.
 * Accepts bulk settings and stores them in the portal_settings table.
 * Self-locking: returns 403 if setup is already complete.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { settingsRepository, BulkSetSettingsInputSchema } from '$lib/server/admin';
import { createLogger } from '$lib/server/logger';

const log = createLogger('setup');

export const POST: RequestHandler = async ({ request }) => {
	const requestId = request.headers.get('X-Request-Id') ?? 'unknown';

	try {
		// Lock: deny if setup is already complete
		const isSetupComplete = await settingsRepository.isSetupComplete();
		if (isSetupComplete) {
			log.warn({ requestId }, 'attempted settings save after setup complete');
			return json({ error: 'Setup is already complete' }, { status: 403 });
		}

		// Parse and validate input
		const body = await request.json();
		const input = BulkSetSettingsInputSchema.parse(body);

		// Save all settings
		await settingsRepository.bulkSet(input.settings);

		log.info({ requestId, count: input.settings.length }, 'portal settings saved during setup');

		return json({ success: true, count: input.settings.length }, { status: 200 });
	} catch (err) {
		log.error({ err, requestId }, 'failed to save portal settings');

		if (err instanceof Error && 'issues' in err) {
			// Zod validation error
			return json({ error: 'Validation failed', details: (err as any).issues }, { status: 400 });
		}

		return json({ error: 'Failed to save settings', details: String(err) }, { status: 500 });
	}
};
