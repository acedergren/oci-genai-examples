# OCI GenAI Examples

Example applications and libraries demonstrating Oracle Cloud Infrastructure Generative AI capabilities with the [Vercel AI SDK](https://sdk.vercel.ai/).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Disclaimer:** This is an independent, community-driven project with no official affiliation with Oracle Corporation. Oracle, OCI, and related trademarks are property of Oracle Corporation.

## Packages

### Core Libraries

| Package | Description |
|---------|-------------|
| [`oci-genai-provider`](./oci-genai-provider/) | AI SDK provider for OCI GenAI - chat, embeddings, tool calling |
| [`kyc-platform`](./kyc-platform/) | Shared KYC infrastructure - database, embeddings, segmentation, workflows |
| [`mcp-client`](./mcp-client/) | Model Context Protocol client for connecting AI agents to tool servers |
| [`agent-state`](./agent-state/) | State management utilities for AI agents |
| [`oci-genai-query`](./oci-genai-query/) | TanStack Query integration for OCI GenAI |

### Applications

| App | Description |
|-----|-------------|
| **[`oci-self-service-portal`](https://github.com/acedergren/oci-self-service-portal)** ⭐ | **Production-ready SvelteKit self-service portal** - 60+ OCI tools, Better Auth + OIDC, RBAC, Oracle ADB 26AI, multi-tenancy **(Moved to standalone repository)** |
| [`tui-agent`](./tui-agent/) | Terminal UI agent with keyboard navigation, themes, tool approval |
| [`fraud-analyst-agent`](./fraud-analyst-agent/) | Financial fraud analysis agent with specialized tools |

### Demos

| Demo | Description |
|------|-------------|
| [`kyc-intelligence`](./kyc-intelligence/) | 🎯 Enterprise KYC dashboard - AI segmentation, embeddings, k-means clustering |
| [`chatbot-demo`](./chatbot-demo/) | Simple SvelteKit chatbot with bioluminescence theme |
| [`nextjs-chatbot`](./nextjs-chatbot/) | Next.js 15 chatbot example |
| [`cli-tool`](./cli-tool/) | Command-line interface for OCI GenAI |
| [`rag-demo`](./rag-demo/) | Retrieval-Augmented Generation example |
| [`rag-reranking-demo`](./rag-reranking-demo/) | RAG with Cohere reranking |
| [`stt-demo`](./stt-demo/) | Speech-to-text transcription |
| [`realtime-stt-demo`](./realtime-stt-demo/) | Real-time streaming transcription |

## 📢 Repository Split Notice

**The `oci-ai-chat` application has been moved to a standalone repository:**

**🔗 New Home: [oci-self-service-portal](https://github.com/acedergren/oci-self-service-portal)**

The production-ready self-service portal (formerly `oci-ai-chat`) is now maintained as an independent project with:
- ✅ Full CI/CD pipeline
- ✅ Docker deployment support
- ✅ Better Auth with OCI IAM OIDC integration
- ✅ Oracle Autonomous Database 26AI backend
- ✅ 60+ OCI CLI tools with AI-powered orchestration
- ✅ RBAC with 3 roles and 10 permissions
- ✅ Multi-tenancy support for managed clients

The `oci-ai-chat` directory remains in this repository for historical reference but is **no longer actively developed here**. All future development happens in the new repository.

**Migration Notes:**
- Workspace packages (`agent-state`, `mcp-client`, `oci-genai-query`) were inlined into the new repository
- The `oci-genai-provider` is now installed from npm: `@acedergren/oci-genai-provider`
- Standalone Serena configuration for AI-assisted development

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- OCI account with GenAI access
- OCI CLI configured (`~/.oci/config`)

### Installation

```bash
git clone https://github.com/acedergren/oci-genai-examples.git
cd oci-genai-examples
pnpm install
```

### Configuration

Create a `.env` file in the package you want to run:

```bash
OCI_REGION=us-chicago-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxxxx
```

### Run an Application

```bash
# Web chat application
pnpm oci-ai-chat:dev

# Terminal UI agent
cd tui-agent && pnpm dev

# Simple chatbot demo
pnpm chatbot:dev
```

## Using the Provider

```typescript
import { createOCI } from '@acedergren/oci-genai-provider';
import { streamText } from 'ai';

const oci = createOCI({
  region: 'us-chicago-1',
  compartmentId: process.env.OCI_COMPARTMENT_ID,
});

const result = await streamText({
  model: oci.languageModel('meta.llama-3.3-70b-instruct'),
  messages: [{ role: 'user', content: 'Hello!' }],
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Supported Models

### Chat Models
- **Meta Llama 4** - Maverick, Scout
- **Meta Llama 3.x** - 3.3-70B, 3.2-90B Vision, 3.1-405B/70B/8B
- **Cohere** - Command A, A Reasoning, A Vision, R+, R
- **Google Gemini** - 2.5 Pro, Flash, Flash-Lite
- **xAI Grok** - 4, 4 Fast, 3, 3 Mini

### Embedding Models
- Cohere embed-english-v3.0
- Cohere embed-multilingual-v3.0

### Speech Models
- OCI Speech (transcription)

## MCP Integration

Both `oci-ai-chat` and `tui-agent` support [Model Context Protocol](https://modelcontextprotocol.io/) servers.

Configure in `~/.oci-genai/mcp.json` (web) or `~/.oci-tui/mcp.json` (TUI):

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}
```

## Documentation

- [OCI GenAI Provider](./oci-genai-provider/README.md) - Provider API reference
- [MCP Client](./mcp-client/README.md) - MCP protocol integration
- [Contributing](./CONTRIBUTING.md) - How to contribute
- [Security](./SECURITY.md) - Security policy

## License

[MIT](./LICENSE)
