/**
 * MCP Servers API
 *
 * Returns information about connected MCP servers and their tools.
 */

import { json } from '@sveltejs/kit';
import { getMCPServers, isMCPInitialized } from '$lib/server/mcp.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const servers = getMCPServers();

  return json({
    initialized: isMCPInitialized(),
    servers: servers.map((s) => ({
      name: s.name,
      state: s.state,
      toolCount: s.toolCount,
    })),
    totalTools: servers.reduce((sum, s) => sum + s.toolCount, 0),
  });
};
