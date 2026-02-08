/**
 * Better Auth configuration exports.
 *
 * This module is now a thin wrapper around auth-factory.ts.
 * The actual auth instance is built dynamically from database configuration.
 *
 * Migration from static singleton:
 * - OLD: `import { auth } from './config.js'` → static at build time
 * - NEW: `import { getAuth } from './config.js'; const auth = await getAuth();` → dynamic at runtime
 *
 * Type exports remain the same for backward compatibility.
 */

export { getAuth, reloadAuth } from './auth-factory.js';

// Type exports for SvelteKit (app.d.ts) and other modules
// These are derived from a dummy auth instance built with minimal config
import { betterAuth } from 'better-auth';

const dummyAuth = betterAuth({
	database: {
		provider: 'oracle',
		type: 'oracle' as const
	},
	secret: 'type-export-only'
});

export type Session = typeof dummyAuth.$Infer.Session.session;
export type User = typeof dummyAuth.$Infer.Session.user;
