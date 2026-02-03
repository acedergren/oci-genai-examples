/**
 * MCP Service for TUI Agent
 *
 * Manages MCP server connections and integrates MCP tools with the agent.
 */

import { MCPManager, type MCPServerConfig, type MCPToolDefinition } from '@acedergren/mcp-client';
import { registerTool, type ApprovalLevel, type ToolCategory } from '../tools/registry.js';
import { z } from 'zod';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

const MCP_CONFIG_PATH = join(homedir(), '.oci-tui', 'mcp.json');

/**
 * MCP Configuration file format
 */
export interface MCPConfig {
  servers: Record<string, MCPServerConfigEntry>;
}

export interface MCPServerConfigEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  approvalLevel?: ApprovalLevel;
  category?: ToolCategory;
}

// Singleton MCP manager instance
let mcpManager: MCPManager | null = null;

/**
 * Initialize MCP service
 */
export function initMCP(): MCPManager {
  if (mcpManager) {
    return mcpManager;
  }

  mcpManager = new MCPManager({
    autoReconnect: true,
    reconnectDelay: 5000,
    onToolsChanged: (tools) => {
      // Use structured logging with safe format specifiers
      console.log('[MCP] Tools updated: %d tools available', tools.length);
      registerMCPTools(tools);
    },
    onLog: (serverName, level, message, data) => {
      if (level === 'error') {
        // Use structured logging to avoid format string injection
        console.error('[MCP:%s] %s', serverName, message, data ?? '');
      }
    },
  });

  return mcpManager;
}

/**
 * Get the MCP manager instance
 */
export function getMCPManager(): MCPManager | null {
  return mcpManager;
}

/**
 * Load MCP configuration and connect to servers
 */
export async function loadMCPConfig(): Promise<void> {
  const manager = initMCP();

  // Load configuration file if it exists
  if (existsSync(MCP_CONFIG_PATH)) {
    try {
      const configData = readFileSync(MCP_CONFIG_PATH, 'utf-8');
      const config: MCPConfig = JSON.parse(configData);

      for (const [name, entry] of Object.entries(config.servers)) {
        if (entry.enabled === false) {
          continue;
        }

        const serverConfig = parseServerConfig(entry);
        if (serverConfig) {
          manager.addServer(name, serverConfig);
        }
      }

      // Connect to all enabled servers
      await manager.connectAll();

    } catch (error) {
      console.error('[MCP] Failed to load configuration:', error);
    }
  }
}

/**
 * Add an MCP server dynamically
 */
export async function addMCPServer(name: string, config: MCPServerConfigEntry): Promise<void> {
  const manager = initMCP();
  const serverConfig = parseServerConfig(config);

  if (!serverConfig) {
    throw new Error('Invalid server configuration');
  }

  manager.addServer(name, serverConfig);
  await manager.connectServer(name);
}

/**
 * Remove an MCP server
 */
export async function removeMCPServer(name: string): Promise<void> {
  const manager = getMCPManager();
  if (manager) {
    await manager.removeServer(name);
  }
}

/**
 * Get all MCP tools in AI SDK format
 */
export function getMCPToolsForAISDK(): Record<string, unknown> {
  const manager = getMCPManager();
  if (!manager) {
    return {};
  }

  return manager.toAISDKTools();
}

/**
 * Call an MCP tool
 */
export async function callMCPTool(
  toolName: string,
  args?: Record<string, unknown>
): Promise<string> {
  const manager = getMCPManager();
  if (!manager) {
    throw new Error('MCP manager not initialized');
  }

  const result = await manager.callTool(toolName, args);

  // Extract text content
  const textContents = result.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text);

  if (result.isError) {
    throw new Error(textContents.join('\n') || 'MCP tool call failed');
  }

  return textContents.join('\n') || JSON.stringify(result);
}

/**
 * Read an MCP resource
 */
export async function readMCPResource(uri: string): Promise<string> {
  const manager = getMCPManager();
  if (!manager) {
    throw new Error('MCP manager not initialized');
  }

  const result = await manager.readResource(uri);

  // Extract text content
  const textContents = result.contents
    .filter((c) => c.text)
    .map((c) => c.text);

  return textContents.join('\n');
}

/**
 * Get list of connected MCP servers
 */
export function getMCPServers(): Array<{ name: string; state: string; toolCount: number }> {
  const manager = getMCPManager();
  if (!manager) {
    return [];
  }

  return manager.getServers().map((server) => ({
    name: server.name,
    state: server.state,
    toolCount: server.client.getTools().length,
  }));
}

// Private helpers

function parseServerConfig(entry: MCPServerConfigEntry): MCPServerConfig | null {
  // Stdio transport (local command)
  if (entry.command) {
    return {
      type: 'stdio',
      command: entry.command,
      args: entry.args,
      env: entry.env,
    };
  }

  // SSE transport (remote URL)
  if (entry.url) {
    return {
      type: 'sse',
      url: entry.url,
      headers: entry.headers,
    };
  }

  return null;
}

/**
 * Register MCP tools with the local tool registry
 */
function registerMCPTools(tools: MCPToolDefinition[]): void {
  for (const tool of tools) {
    // Convert JSON Schema to Zod schema
    const schema = jsonSchemaToZod(tool.inputSchema);

    // Register with local registry
    registerTool({
      name: `mcp_${tool.name}`,
      description: tool.description || `MCP tool: ${tool.name}`,
      category: 'observability', // Default category for MCP tools
      approvalLevel: 'confirm', // MCP tools require confirmation by default
      schema,
      execute: async (args: unknown) => {
        return callMCPTool(tool.name, args as Record<string, unknown>);
      },
    });
  }
}

/**
 * Convert JSON Schema to Zod (simplified)
 */
function jsonSchemaToZod(
  schema: MCPToolDefinition['inputSchema']
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let zodType = jsonPropertyToZod(prop);

    if (!required.has(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

function jsonPropertyToZod(prop: unknown): z.ZodTypeAny {
  if (!prop || typeof prop !== 'object') {
    return z.unknown();
  }

  const propObj = prop as {
    type?: string;
    description?: string;
    enum?: string[];
    items?: unknown;
  };

  let zodType: z.ZodTypeAny;

  switch (propObj.type) {
    case 'string':
      zodType = propObj.enum
        ? z.enum(propObj.enum as [string, ...string[]])
        : z.string();
      break;
    case 'number':
    case 'integer':
      zodType = z.number();
      break;
    case 'boolean':
      zodType = z.boolean();
      break;
    case 'array':
      zodType = z.array(
        propObj.items ? jsonPropertyToZod(propObj.items) : z.unknown()
      );
      break;
    case 'object':
      zodType = z.record(z.unknown());
      break;
    default:
      zodType = z.unknown();
  }

  if (propObj.description) {
    zodType = zodType.describe(propObj.description);
  }

  return zodType;
}
