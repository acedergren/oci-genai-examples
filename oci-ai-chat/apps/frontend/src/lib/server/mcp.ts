/**
 * MCP Service for oci-ai-chat
 *
 * Manages MCP server connections and integrates MCP tools with the AI SDK.
 * This service runs server-side only in SvelteKit.
 *
 * Uses official @modelcontextprotocol/sdk (v1.26.0+)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { tool } from 'ai';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createLogger } from './logger.js';

const log = createLogger('mcp');

const MCP_CONFIG_PATH = join(homedir(), '.oci-genai', 'mcp.json');

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
}

/**
 * Internal server entry tracking MCP client instances
 */
interface MCPServerEntry {
	name: string;
	config: MCPServerConfigEntry;
	client: Client;
	transport: StdioClientTransport | SSEClientTransport;
	state: 'connected' | 'disconnected' | 'error';
}

/**
 * Multi-server MCP manager (thin wrapper over official SDK Client)
 */
class MCPManager {
	private servers = new Map<string, MCPServerEntry>();
	private onToolsChanged?: (tools: unknown[]) => void;
	private onLog?: (serverName: string, level: string, message: string, data?: unknown) => void;

	constructor(options: {
		autoReconnect?: boolean;
		reconnectDelay?: number;
		onToolsChanged?: (tools: unknown[]) => void;
		onLog?: (serverName: string, level: string, message: string, data?: unknown) => void;
	}) {
		this.onToolsChanged = options.onToolsChanged;
		this.onLog = options.onLog;
	}

	/**
	 * Add a new MCP server
	 */
	addServer(name: string, config: MCPServerConfigEntry): void {
		if (this.servers.has(name)) {
			throw new Error(`Server "${name}" already exists`);
		}

		// Create client
		const client = new Client(
			{ name: `portal-${name}`, version: '1.0.0' },
			{ capabilities: {} }
		);

		// Create transport based on config
		let transport: StdioClientTransport | SSEClientTransport;

		if (config.command) {
			// Stdio transport
			transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: config.env
			});
		} else if (config.url) {
			// SSE transport
			transport = new SSEClientTransport(new URL(config.url));
		} else {
			throw new Error(`Server "${name}" must have either command or url`);
		}

		// Store entry (not connected yet)
		this.servers.set(name, {
			name,
			config,
			client,
			transport,
			state: 'disconnected'
		});
	}

	/**
	 * Connect to all registered servers
	 */
	async connectAll(): Promise<void> {
		const promises = Array.from(this.servers.keys()).map(async (name) => {
			try {
				const entry = this.servers.get(name)!;
				await entry.client.connect(entry.transport);
				entry.state = 'connected';
				this.onLog?.(name, 'info', 'Connected to MCP server');
			} catch (error) {
				const entry = this.servers.get(name);
				if (entry) {
					entry.state = 'error';
				}
				this.onLog?.(name, 'error', 'Failed to connect', error);
			}
		});

		await Promise.all(promises);

		// Notify that tools may have changed
		if (this.onToolsChanged) {
			const tools = this.getAllTools();
			this.onToolsChanged(tools);
		}
	}

	/**
	 * Get all connected servers
	 */
	getServers(): Array<{ name: string; state: string; toolCount: number }> {
		return Array.from(this.servers.values()).map((entry) => ({
			name: entry.name,
			state: entry.state,
			toolCount: entry.state === 'connected' ? (entry.client.getServerCapabilities()?.tools ? 1 : 0) : 0
		}));
	}

	/**
	 * Get all tools from all connected servers
	 */
	getAllTools(): unknown[] {
		const tools: unknown[] = [];

		for (const entry of this.servers.values()) {
			if (entry.state === 'connected') {
				// Tools are fetched via listTools() - we'll convert them in toAISDKTools()
				// For now, just return empty array as we'll fetch them on demand
			}
		}

		return tools;
	}

	/**
	 * Call a tool by name (finds the server that has it)
	 */
	async callTool(toolName: string, args?: Record<string, unknown>): Promise<{
		content: Array<{ type: string; text?: string }>;
		isError?: boolean;
	}> {
		// Find the server that has this tool
		for (const entry of this.servers.values()) {
			if (entry.state !== 'connected') continue;

			try {
				const result = await entry.client.callTool({ name: toolName, arguments: args ?? {} });
				return result;
			} catch {
				// Try next server
				continue;
			}
		}

		throw new Error(`Tool "${toolName}" not found in any connected server`);
	}

	/**
	 * Read a resource by URI (finds the server that has it)
	 */
	async readResource(uri: string): Promise<{ contents: Array<{ text?: string }> }> {
		// Find the server that has this resource
		for (const entry of this.servers.values()) {
			if (entry.state !== 'connected') continue;

			try {
				const result = await entry.client.readResource({ uri });
				return result;
			} catch {
				// Try next server
				continue;
			}
		}

		throw new Error(`Resource "${uri}" not found in any connected server`);
	}

	/**
	 * Convert all MCP tools to AI SDK format
	 */
	toAISDKTools(): Record<string, ReturnType<typeof tool>> {
		const aiTools: Record<string, ReturnType<typeof tool>> = {};

		for (const entry of this.servers.values()) {
			if (entry.state !== 'connected') continue;

			// We need to fetch tools first - this is async
			// For now, return empty object - caller should await listTools() first
		}

		return aiTools;
	}
}

// Singleton MCP manager instance
let mcpManager: MCPManager | null = null;
let initialized = false;

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
			log.info({ toolCount: tools.length }, 'tools updated');
		},
		onLog: (serverName, level, message, data) => {
			if (level === 'error') {
				log.error({ server: serverName, data }, message);
			}
		}
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
	if (initialized) {
		return;
	}

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

				manager.addServer(name, entry);
			}

			// Connect to all enabled servers
			await manager.connectAll();
			initialized = true;
			log.info({ serverCount: manager.getServers().length }, 'connected to servers');
		} catch (error) {
			log.error({ err: error }, 'failed to load configuration');
		}
	} else {
		log.info({ path: MCP_CONFIG_PATH }, 'no configuration file found');
		initialized = true;
	}
}

/**
 * Get all MCP tools in AI SDK format
 */
export function getMCPToolsForAISDK(): Record<string, ReturnType<typeof tool>> {
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
		.map((c) => c.text ?? '');

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
	const textContents = result.contents.filter((c) => c.text).map((c) => c.text);

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

	return manager.getServers();
}

/**
 * Check if MCP is initialized
 */
export function isMCPInitialized(): boolean {
	return initialized;
}
