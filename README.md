# OCI GenAI Examples

Use Oracle Cloud Infrastructure Generative AI models with the [Vercel AI SDK](https://sdk.vercel.ai/) — chat, embeddings, tool calling, speech, and more.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **This is not an official Oracle product.** This project is independent, community-driven, and has no affiliation with Oracle Corporation. It is provided as-is with absolutely no warranty. Oracle, OCI, and related trademarks are the property of Oracle Corporation. Use at your own risk.

## Features

- **AI SDK Provider** for OCI GenAI — drop-in replacement supporting chat, embeddings, tool calling, and speech
- **15+ chat models** — Llama 4, Gemini 2.5, Cohere Command A, Grok 4, and more
- **60+ OCI tools** — AI-powered cloud operations through natural language
- **Multiple frontends** — SvelteKit, Next.js, terminal UI, and CLI
- **RAG examples** — retrieval-augmented generation with Cohere reranking
- **Speech-to-text** — real-time streaming transcription

## Packages

### Provider

| Package | Description |
|---------|-------------|
| [`oci-genai-provider`](./oci-genai-provider/) | AI SDK provider for OCI GenAI — chat, embeddings, tool calling, speech |

### Applications

| App | Description |
|-----|-------------|
| [`oci-self-service-portal`](https://github.com/acedergren/oci-self-service-portal) | Production SvelteKit portal — 60+ OCI tools, OIDC auth, RBAC, Oracle ADB 26AI *(standalone repo)* |
| [`tui-agent`](./tui-agent/) | Terminal UI agent with keyboard navigation, themes, tool approval |
| [`fraud-analyst-agent`](./fraud-analyst-agent/) | Financial fraud analysis agent with specialized tools |

### Demos

| Demo | Description |
|------|-------------|
| [`chatbot-demo`](./chatbot-demo/) | SvelteKit chatbot with bioluminescence theme |
| [`nextjs-chatbot`](./nextjs-chatbot/) | Next.js 15 chatbot |
| [`cli-tool`](./cli-tool/) | Command-line interface for OCI GenAI |
| [`rag-demo`](./rag-demo/) | Retrieval-Augmented Generation |
| [`rag-reranking-demo`](./rag-reranking-demo/) | RAG with Cohere reranking |
| [`stt-demo`](./stt-demo/) | Speech-to-text transcription |
| [`realtime-stt-demo`](./realtime-stt-demo/) | Real-time streaming transcription |
| [`kyc-intelligence`](./kyc-intelligence/) | Enterprise KYC dashboard — AI segmentation, embeddings, k-means clustering |

### Infrastructure

| Package | Description |
|---------|-------------|
| [`langflow`](./langflow/) | Langflow custom components for OCI GenAI + Oracle 26AI vector store ([deployed](https://flow.solutionsedge.io)) |
| [`kyc-platform`](./kyc-platform/) | Shared KYC infrastructure — database, embeddings, segmentation |

## Quick Start

### Prerequisites

- Node.js 18+ (22 recommended)
- pnpm 8+
- OCI account with GenAI access
- OCI CLI configured (`~/.oci/config`)

### Install

```bash
git clone https://github.com/acedergren/oci-genai-examples.git
cd oci-genai-examples
pnpm install
```

### Configure

Create a `.env` file in the package you want to run:

```bash
OCI_REGION=us-chicago-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxxxx
```

### Run

```bash
pnpm chatbot:dev          # SvelteKit chatbot
pnpm nextjs:dev           # Next.js chatbot
pnpm oci-ai-chat:dev      # Self-service portal (local dev)
cd tui-agent && pnpm dev  # Terminal UI agent
pnpm cli:dev              # CLI tool
```

## Using the Provider

```bash
npm install @acedergren/oci-genai-provider ai
```

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

See the [provider README](./oci-genai-provider/README.md) for the full API.

## Supported Models

### Chat

| Provider | Models |
|----------|--------|
| Meta Llama 4 | Maverick, Scout |
| Meta Llama 3.x | 3.3-70B, 3.2-90B Vision, 3.1-405B/70B/8B |
| Cohere | Command A, A Reasoning, A Vision, R+, R |
| Google Gemini | 2.5 Pro, Flash, Flash-Lite |
| xAI Grok | 4, 4 Fast, 3, 3 Mini |

### Embeddings

- Cohere embed-english-v3.0
- Cohere embed-multilingual-v3.0

### Speech

- OCI Speech (transcription, real-time streaming)

## Repository Split Notice

The `oci-ai-chat` self-service portal has moved to its own repository:

**[github.com/acedergren/oci-self-service-portal](https://github.com/acedergren/oci-self-service-portal)**

The `oci-ai-chat/` directory remains here for reference but is no longer actively developed in this repo. The standalone version includes CI/CD, Docker deployment, Better Auth + OIDC, Oracle ADB 26AI, RBAC, multi-tenancy, and 360+ tests.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](./SECURITY.md) for the security policy and how to report vulnerabilities.

## Author

Alex Cedergren — [alex@solutionsedge.io](mailto:alex@solutionsedge.io)

## License

[MIT](./LICENSE)
