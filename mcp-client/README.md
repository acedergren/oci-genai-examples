# @acedergren/mcp-client

Model Context Protocol (MCP) client for connecting AI agents to tool servers.

## Installation

```bash
pnpm add @acedergren/mcp-client
```

## Quick Start

```typescript
import { MCPClient } from '@acedergren/mcp-client';

// Connect to a local MCP server
const client = new MCPClient({
  name: 'my-agent',
  version: '1.0.0',
});

await client.connect({
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
});

// List available tools
const tools = client.getTools();

// Call a tool
const result = await client.callTool('read_file', { path: '/readme.txt' });
```

## Multi-Server Management

Use `MCPManager` to connect to multiple MCP servers:

```typescript
import { MCPManager } from '@acedergren/mcp-client';

const manager = new MCPManager({
  autoReconnect: true,
  onToolsChanged: (tools) => console.log('Tools updated:', tools.length),
});

// Add servers
manager.addServer('filesystem', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
});

manager.addServer('github', {
  type: 'sse',
  url: 'https://mcp.github.com/sse',
});

// Connect all
await manager.connectAll();

// Get combined tools for AI SDK
const tools = manager.toAISDKTools();
```

## AI SDK Integration

Convert MCP tools to AI SDK format:

```typescript
import { streamText } from 'ai';
import { createOCI } from '@acedergren/oci-genai-provider';

const oci = createOCI({ region: 'us-chicago-1' });

// Get tools from MCP manager
const mcpTools = manager.toAISDKTools();

const result = await streamText({
  model: oci.languageModel('meta.llama-3.3-70b-instruct'),
  messages: [{ role: 'user', content: 'List files in /home' }],
  tools: mcpTools,
  maxSteps: 5,
});
```

## Transports

### Stdio (Local Servers)

```typescript
await client.connect({
  type: 'stdio',
  command: 'node',
  args: ['./my-mcp-server.js'],
  env: { DEBUG: 'true' },
});
```

### SSE (Remote Servers)

```typescript
await client.connect({
  type: 'sse',
  url: 'https://api.example.com/mcp/sse',
  headers: { Authorization: 'Bearer token' },
});
```

## API Reference

### MCPClient

| Method | Description |
|--------|-------------|
| `connect(config)` | Connect to an MCP server |
| `disconnect()` | Disconnect from server |
| `getTools()` | Get available tool definitions |
| `callTool(name, args)` | Execute a tool |
| `readResource(uri)` | Read a resource |
| `toAISDKTools()` | Convert tools to AI SDK format |

### MCPManager

| Method | Description |
|--------|-------------|
| `addServer(name, config)` | Add a server configuration |
| `removeServer(name)` | Remove and disconnect a server |
| `connectAll()` | Connect to all configured servers |
| `getServers()` | List connected servers |
| `callTool(name, args)` | Call tool (auto-routes to correct server) |
| `toAISDKTools()` | Get combined tools from all servers |

## Configuration Files

Both `oci-ai-chat` and `tui-agent` read MCP configuration from JSON files:

**Web app:** `~/.oci-genai/mcp.json`
**TUI agent:** `~/.oci-tui/mcp.json`

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home"],
      "enabled": true
    },
    "remote": {
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer ${MCP_TOKEN}" },
      "enabled": true
    }
  }
}
```

## License

MIT
