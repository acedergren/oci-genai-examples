/**
 * POST /api/admin/idp/[id]/test
 *
 * Test IDP connection by fetching discovery URL and validating endpoints.
 * Requires admin:all permission.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { idpRepository } from '$lib/server/admin';
import { requirePermission } from '$lib/server/auth/rbac.js';
import { createLogger } from '$lib/server/logger';
import { toPortalError } from '$lib/server/errors.js';

const log = createLogger('admin-idp');

export const POST: RequestHandler = async (event) => {
	const requestId = event.request.headers.get('X-Request-Id') ?? 'unknown';
	const { id } = event.params;

	try {
		// Require admin:all permission
		await requirePermission(event, 'admin:all');

		// Get the provider
		const provider = await idpRepository.getById(id);

		if (!provider) {
			return json({ error: 'IDP provider not found' }, { status: 404 });
		}

		const details: Record<string, unknown> = {};

		// Test 1: Fetch discovery document if provided
		if (provider.discoveryUrl) {
			try {
				const response = await event.fetch(provider.discoveryUrl, {
					headers: { Accept: 'application/json' }
				});

				if (!response.ok) {
					return json({
						success: false,
						message: `Discovery URL returned ${response.status}`,
						details: { discoveryUrl: provider.discoveryUrl, status: response.status }
					});
				}

				const discovery = await response.json();
				details.discoveryEndpoints = {
					authorization: discovery.authorization_endpoint,
					token: discovery.token_endpoint,
					userinfo: discovery.userinfo_endpoint,
					jwks: discovery.jwks_uri
				};

				// Validate required endpoints exist
				if (!discovery.authorization_endpoint || !discovery.token_endpoint) {
					return json({
						success: false,
						message: 'Discovery document missing required endpoints',
						details
					});
				}
			} catch (err) {
				const portalError = toPortalError(err);
				return json({
					success: false,
					message: `Failed to fetch discovery URL: ${portalError.message}`,
					details: { discoveryUrl: provider.discoveryUrl }
				});
			}
		}

		// Test 2: Validate manual endpoint configuration
		if (!provider.discoveryUrl) {
			if (!provider.authorizationUrl || !provider.tokenUrl) {
				return json({
					success: false,
					message: 'Provider missing required endpoints (authorization and token)',
					details: { provider: provider.providerId }
				});
			}

			details.manualEndpoints = {
				authorization: provider.authorizationUrl,
				token: provider.tokenUrl,
				jwks: provider.jwksUrl
			};
		}

		log.info(
			{ requestId, id, providerId: provider.providerId, hasDiscovery: !!provider.discoveryUrl },
			'IDP connection test passed'
		);

		return json({
			success: true,
			message: 'IDP configuration is valid',
			details
		});
	} catch (err) {
		log.error({ err, requestId, id }, 'IDP connection test failed');

		const isPermissionError = err instanceof Error && err.message.includes('permission');
		if (isPermissionError) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		const portalError = toPortalError(err);
		return json({
			success: false,
			message: portalError.message,
			details: {}
		});
	}
};
