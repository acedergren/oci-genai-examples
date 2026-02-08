/**
 * MCP Servers API
 *
 * MCP servers are not available in stateless Cloudflare Pages deployment.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/auth/rbac.js';

export const GET: RequestHandler = async (event) => {
	// Defense-in-depth: require tools:read permission (hooks.server.ts already enforces session)
	await requirePermission(event, 'tools:read');

	return json({
		initialized: false,
		servers: [],
		totalTools: 0,
		note: 'MCP servers not available in stateless deployment'
	});
};
