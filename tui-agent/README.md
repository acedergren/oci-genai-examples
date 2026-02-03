# OCI TUI Agent

Terminal UI agent for Oracle Cloud Infrastructure with keyboard-driven navigation, theming, and tool approval workflows.

## Features

- **Keyboard Navigation** - Full keyboard control with intuitive shortcuts
- **Theme Support** - Dark (bioluminescence) and light (golden hour) themes
- **Session Management** - Persist and resume conversations
- **Model Picker** - Choose from 30+ OCI GenAI models
- **Tool Approval** - Visual danger-level indicators for OCI operations
- **MCP Integration** - Connect to Model Context Protocol servers
- **OCI Tools** - Built-in tools for compute, networking, storage, database

## Prerequisites

- Bun 1.2+
- OCI CLI configured (`~/.oci/config`)
- OCI Compartment with GenAI access

## Installation

```bash
cd tui-agent
pnpm install
```

## Usage

```bash
# Development
pnpm dev

# Build
pnpm build
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `t` | Toggle Thought panel |
| `r` | Toggle Reasoning panel |
| `o` | Toggle Tools panel |
| `s` | Toggle Sessions panel |
| `m` | Open Model picker |
| `T` | Toggle Theme (dark/light) |
| `y` | Approve tool call |
| `n` | Reject tool call |
| `Ctrl+N` | New session |
| `Ctrl+C` | Exit |

## Configuration

### Environment Variables

```bash
OCI_REGION=us-chicago-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxxxx
```

### MCP Servers

Configure in `~/.oci-tui/mcp.json`:

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home"]
    }
  }
}
```

## Architecture

```
tui-agent/
├── src/
│   ├── components/       # React components (OpenTUI)
│   │   ├── chat/         # Chat view, messages, input
│   │   ├── layout/       # Header, status bar
│   │   ├── panels/       # Collapsible side panels
│   │   └── tools/        # Tool approval UI
│   ├── hooks/            # Keyboard handling
│   ├── services/         # LLM client, MCP, persistence
│   ├── state/            # Zustand stores
│   ├── theme/            # Colors, tokens, provider
│   └── tools/            # OCI tool definitions
└── package.json
```

## Built-in OCI Tools

| Category | Tools |
|----------|-------|
| Compute | listInstances, getInstance, launchInstance, stopInstance, terminateInstance |
| Networking | listVcns, createVcn, deleteVcn, listSubnets |
| Storage | listBuckets, createBucket, deleteBucket |
| Database | listAutonomousDatabases, createAutonomousDatabase |
| Identity | listCompartments, listPolicies, createPolicy |
| Monitoring | listAlarms, summarizeMetrics |

## License

MIT
