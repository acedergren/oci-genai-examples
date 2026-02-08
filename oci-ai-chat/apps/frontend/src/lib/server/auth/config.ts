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
// Import directly from better-auth's type system — no runtime initialization needed
export type { Session, User } from 'better-auth';
