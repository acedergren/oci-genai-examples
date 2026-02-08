import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runHealthChecks } from '$lib/server/health.js';
import type { HealthCheckResult } from '$lib/server/health.js';

/**
 * GET /api/health — Deep health check endpoint.
 *
 * Returns 200 for ok/degraded, 503 only when critical checks fail.
 *
 * Security: Anonymous callers get minimal status info (component names + pass/fail).
 * Admins with `admin:all` permission get full diagnostic details (pool stats, error messages).
 */
export const GET: RequestHandler = async (event) => {
	const result = await runHealthChecks();
	const httpStatus = result.status === 'error' ? 503 : 200;

	// Check if caller has admin:all permission for full diagnostic details
	const session = event.locals.session as Record<string, unknown> | undefined;
	const user = session?.user as { permissions?: string[] } | undefined;
	const isAdmin = user?.permissions?.includes('admin:all') ?? false;

	// Strip sensitive details for anonymous/non-admin callers
	if (!isAdmin) {
		const publicResult: HealthCheckResult = {
			status: result.status,
			checks: Object.fromEntries(
				Object.entries(result.checks).map(([name, check]) => [
					name,
					{
						status: check.status,
						latencyMs: check.latencyMs
						// details stripped for non-admin
					}
				])
			),
			timestamp: result.timestamp,
			uptime: result.uptime,
			version: result.version
		};
		return json(publicResult, { status: httpStatus });
	}

	// Admin gets full diagnostic details
	return json(result, { status: httpStatus });
};
