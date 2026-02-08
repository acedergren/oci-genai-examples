/**
 * Dynamic auth factory — builds Better Auth instance from database configuration.
 *
 * Replaces static auth.ts singleton with lazy, reloadable factory that:
 * - Loads IDP providers from Oracle at runtime (not build time)
 * - Falls back to env vars if database is empty (backward compat)
 * - Supports reload for admin console changes
 * - Maintains IDCS-specific provisioning logic
 *
 * Usage:
 *   const auth = await getAuth();  // Cached after first call
 *   await reloadAuth();            // Rebuild from DB after config changes
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { genericOAuth, organization, type GenericOAuthConfig } from 'better-auth/plugins';
import { oracleAdapter } from './oracle-adapter.js';
import { createLogger } from '$lib/server/logger.js';
import {
	stashIdcsProfile,
	consumeIdcsProfile,
	resolveIdcsOrg,
	provisionFromIdcsGroups,
	findOidcSub
} from './idcs-provisioning.js';
import { idpRepository } from '$lib/server/admin/idp-repository.js';
import type { IdpProvider } from '$lib/server/admin/types.js';
import { building } from '$app/environment';

const log = createLogger('auth-factory');

// ============================================================================
// Cached Auth Instance
// ============================================================================

let cachedAuth: ReturnType<typeof betterAuth> | null = null;
let buildPromise: Promise<ReturnType<typeof betterAuth>> | null = null;

// ============================================================================
// IDCS Profile Types
// ============================================================================

/**
 * IDCS-specific OIDC claims.
 * OCI IDCS returns non-standard claims like user_displayname, groups, etc.
 */
interface IdcsProfile {
	sub: string;
	email?: string;
	name?: string;
	user_displayname?: string;
	user_tenantname?: string;
	groups?: string[];
	app_roles?: string[];
	[key: string]: unknown;
}

/**
 * Standard OIDC profile claims.
 * Used for generic OIDC providers.
 */
interface OidcProfile {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
	[key: string]: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps IDCS group names to portal roles.
 * Uses provider's admin_groups and operator_groups configuration.
 */
function mapIdcsGroupsToRole(
	groups: string[],
	adminGroups: string[],
	operatorGroups: string[]
): 'admin' | 'operator' | 'viewer' {
	const groupSet = new Set(groups);
	if (adminGroups.some((g) => groupSet.has(g))) return 'admin';
	if (operatorGroups.some((g) => groupSet.has(g))) return 'operator';
	return 'viewer';
}

/**
 * Creates mapProfileToUser function for IDCS providers.
 * Includes group extraction and stashing for post-login provisioning.
 */
function createIdcsMapper(provider: IdpProvider) {
	// Parse admin/operator groups from provider config
	const adminGroups = provider.adminGroups
		? provider.adminGroups.split(',').map((s) => s.trim())
		: [];
	const operatorGroups = provider.operatorGroups
		? provider.operatorGroups.split(',').map((s) => s.trim())
		: [];

	return (profile: Record<string, unknown>) => {
		const p = profile as IdcsProfile;
		const displayName = p.user_displayname || p.name || p.email || p.sub;

		// Stash IDCS groups for post-login provisioning
		if (p.groups?.length) {
			stashIdcsProfile(p.sub, p.groups, p.user_tenantname);
			log.info(
				{
					sub: p.sub,
					groups: p.groups,
					tenant: p.user_tenantname,
					providerId: provider.providerId
				},
				'IDCS user signed in with groups'
			);
		}

		return {
			name: displayName,
			email: p.email || `${p.sub}@${provider.providerId}.local`,
			image: undefined
		};
	};
}

/**
 * Creates mapProfileToUser function for generic OIDC providers.
 * Standard claim mapping, no group provisioning.
 */
function createGenericOidcMapper(provider: IdpProvider) {
	return (profile: Record<string, unknown>) => {
		const p = profile as OidcProfile;
		return {
			name: p.name || p.email || p.sub,
			email: p.email || `${p.sub}@${provider.providerId}.local`,
			image: p.picture
		};
	};
}

/**
 * Converts IdpProvider from database to GenericOAuthConfig for Better Auth.
 * Selects appropriate mapProfileToUser based on provider type.
 */
function toGenericOAuthConfig(provider: IdpProvider): GenericOAuthConfig {
	const config: GenericOAuthConfig = {
		providerId: provider.providerId,
		clientId: provider.clientId,
		clientSecret: provider.clientSecret || '',
		scopes: provider.scopes.split(',').map((s) => s.trim()),
		pkce: provider.pkceEnabled
	};

	// Set OIDC URLs (discovery takes precedence)
	if (provider.discoveryUrl) {
		config.discoveryUrl = provider.discoveryUrl;
	} else if (provider.authorizationUrl && provider.tokenUrl) {
		config.authorizationUrl = provider.authorizationUrl;
		config.tokenUrl = provider.tokenUrl;
		if (provider.userinfoUrl) config.userinfoUrl = provider.userinfoUrl;
	}

	// Provider-specific mapProfileToUser
	if (provider.providerType === 'idcs') {
		config.mapProfileToUser = createIdcsMapper(provider);
	} else {
		// Generic OIDC or SAML
		config.mapProfileToUser = createGenericOidcMapper(provider);
	}

	return config;
}

/**
 * Builds GenericOAuthConfig from environment variables (backward compat).
 * Falls back to OCI_IAM_* env vars if no database providers configured.
 */
function buildEnvFallbackConfig(): GenericOAuthConfig[] {
	const clientId = process.env.OCI_IAM_CLIENT_ID;
	const clientSecret = process.env.OCI_IAM_CLIENT_SECRET;
	const discoveryUrl = process.env.OCI_IAM_DISCOVERY_URL;

	if (!clientId || !clientSecret || !discoveryUrl) {
		log.warn('No IDP providers in database and missing OCI_IAM_* env vars — auth will fail');
		return [];
	}

	// Parse admin/operator groups from env vars
	const adminGroups = (
		process.env.OCI_IAM_ADMIN_GROUPS || 'PortalAdmins,OCI_Administrators,Administrators'
	)
		.split(',')
		.map((s) => s.trim());

	const operatorGroups = (
		process.env.OCI_IAM_OPERATOR_GROUPS || 'PortalOperators,OCI_Operators,CloudOperators'
	)
		.split(',')
		.map((s) => s.trim());

	log.info('Using OCI_IAM_* env vars for authentication (legacy fallback)');

	return [
		{
			providerId: 'oci-iam',
			clientId,
			clientSecret,
			discoveryUrl,
			scopes: ['openid', 'email', 'profile', 'urn:opc:idm:__myscopes__'],
			pkce: true,
			mapProfileToUser: (profile: Record<string, unknown>) => {
				const p = profile as IdcsProfile;
				const displayName = p.user_displayname || p.name || p.email || p.sub;

				// Stash IDCS groups for post-login provisioning
				if (p.groups?.length) {
					stashIdcsProfile(p.sub, p.groups, p.user_tenantname);
					log.info(
						{ sub: p.sub, groups: p.groups, tenant: p.user_tenantname },
						'IDCS user signed in with groups (env fallback)'
					);
				}

				return {
					name: displayName,
					email: p.email || `${p.sub}@oci-iam.local`,
					image: undefined
				};
			}
		}
	];
}

/**
 * Builds Better Auth instance from database configuration.
 * Internal — use getAuth() to get cached instance.
 */
async function buildAuth(): Promise<ReturnType<typeof betterAuth>> {
	// During build, skip database access and use minimal config
	if (building) {
		log.info('Build mode detected — skipping database access for auth');
		const config: BetterAuthOptions = {
			database: oracleAdapter(),
			baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
			secret: process.env.BETTER_AUTH_SECRET || 'dev-build-only-secret',
			plugins: [
				genericOAuth({ config: [] }), // Empty config during build
				organization({
					allowUserToCreateOrganization: false
				})
			],
			session: {
				expiresIn: 60 * 60 * 24 * 30,
				updateAge: 60 * 60 * 24
			},
			user: {
				modelName: 'user',
				fields: {
					name: 'display_name'
				}
			}
		};
		return betterAuth(config);
	}

	// Load active IDP providers from database
	let oauthConfigs: GenericOAuthConfig[] = [];

	try {
		const providers = await idpRepository.listActive();

		if (providers.length === 0) {
			log.warn('No active IDP providers in database — falling back to env vars');
			oauthConfigs = buildEnvFallbackConfig();
		} else {
			oauthConfigs = providers.map((p) => toGenericOAuthConfig(p));
			log.info(
				{ providerCount: providers.length, providerIds: providers.map((p) => p.providerId) },
				'Loaded IDP providers from database'
			);
		}
	} catch (err) {
		log.error({ err }, 'Failed to load IDP providers from database — falling back to env vars');
		oauthConfigs = buildEnvFallbackConfig();
	}

	const config: BetterAuthOptions = {
		database: oracleAdapter(),
		baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
		// Fallback needed for build (SvelteKit post-build runs in NODE_ENV=production).
		// Runtime validation in hooks.server.ts warns if secret is missing in production.
		secret: process.env.BETTER_AUTH_SECRET || 'dev-build-only-secret',
		plugins: [
			genericOAuth({ config: oauthConfigs }),
			organization({
				allowUserToCreateOrganization: false
			})
		],
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days
			updateAge: 60 * 60 * 24 // refresh session token every 24h
		},
		user: {
			modelName: 'user',
			fields: {
				name: 'display_name'
			}
		},
		databaseHooks: {
			session: {
				create: {
					after: async (session) => {
						// After session creation (login), provision IDCS org membership.
						// The IDCS profile was stashed during mapProfileToUser (same request).
						const userId = (session as Record<string, unknown>).userId as string | undefined;
						if (!userId) return;

						// Look up the user's OIDC sub to consume the cached profile.
						// Better Auth stores the OIDC subject in the account table.
						try {
							// Look up user's OIDC sub from account table
							const accountSub = await findOidcSub(userId);
							if (!accountSub) return;

							// Get active IDCS providers to resolve config
							const providers = await idpRepository.listActive();
							const idcsProvider = providers.find((p) => p.providerType === 'idcs');
							if (!idcsProvider) return;

							const cached = consumeIdcsProfile(accountSub);
							if (!cached || !cached.groups.length) return;

							// Parse provider config for provisioning
							const adminGroups = idcsProvider.adminGroups
								? idcsProvider.adminGroups.split(',').map((s) => s.trim())
								: [];
							const operatorGroups = idcsProvider.operatorGroups
								? idcsProvider.operatorGroups.split(',').map((s) => s.trim())
								: [];

							const orgId = await resolveIdcsOrg(
								userId,
								cached.tenantName,
								idcsProvider.tenantOrgMap ?? undefined,
								idcsProvider.defaultOrgId ?? undefined
							);
							if (!orgId) {
								log.warn(
									{ userId, tenantName: cached.tenantName },
									'no org resolved for IDCS user'
								);
								return;
							}

							await provisionFromIdcsGroups(
								userId,
								orgId,
								cached.groups,
								adminGroups,
								operatorGroups
							);
						} catch (err) {
							log.error({ err, userId }, 'IDCS post-login provisioning failed');
						}
					}
				}
			}
		}
	};

	return betterAuth(config);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the Better Auth instance.
 * Builds lazily on first call, then caches.
 * Thread-safe: multiple concurrent calls resolve to same instance.
 */
export async function getAuth(): Promise<ReturnType<typeof betterAuth>> {
	if (cachedAuth) return cachedAuth;

	// If build already in progress, wait for it
	if (buildPromise) return buildPromise;

	// Start build and cache promise
	buildPromise = buildAuth();

	try {
		cachedAuth = await buildPromise;
		return cachedAuth;
	} finally {
		buildPromise = null;
	}
}

/**
 * Reload auth configuration from database.
 * Call after admin updates IDP providers to pick up changes.
 *
 * NOTE: Existing sessions remain valid — only affects new logins.
 */
export async function reloadAuth(): Promise<void> {
	log.info('Reloading auth configuration from database');
	cachedAuth = null;
	buildPromise = null;
	await getAuth(); // Force rebuild
}

/**
 * Clear cached auth instance.
 * FOR TESTING ONLY — allows tests to rebuild auth with different DB state.
 *
 * @internal
 */
export function _clearAuthCache(): void {
	cachedAuth = null;
	buildPromise = null;
}
