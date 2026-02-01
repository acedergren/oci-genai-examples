# OCI GenAI Examples - Setup Guide

This repository contains example applications demonstrating OCI Generative AI capabilities using the [OCI GenAI Provider](https://github.com/acedergren/oci-genai-provider).

## Prerequisites

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **OCI Account**: With Generative AI service access
- **OCI Configuration**: Valid API key credentials in `~/.oci/config`

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure OCI Credentials

Ensure your OCI credentials are set up:

```bash
# Create/update ~/.oci/config with your API key
# See: https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm
```

Set your default OCI profile (optional):

```bash
export OCI_CONFIG_FILE=~/.oci/config
export OCI_PROFILE=DEFAULT
```

### 3. Run an Example

Each example can be run independently:

```bash
# Chat applications
pnpm oci-ai-chat:dev          # SvelteKit chat application
pnpm nextjs:dev               # Next.js chatbot example
pnpm chatbot:dev              # Basic chatbot demo

# Terminal tools
pnpm cli:dev                  # Terminal REPL chat

# AI agents
pnpm fraud:dev                # Fraud analyst agent demo

# RAG examples
pnpm rag:dev                  # Semantic document retrieval
pnpm rag-reranking:dev        # RAG with reranking

# Speech-to-text
pnpm stt:dev                  # STT transcription
pnpm realtime-stt:dev         # Realtime STT streaming
```

## Documentation

- **[Provider Documentation](https://github.com/acedergren/oci-genai-provider)** - Core OCI GenAI provider
- **Individual Example READMEs** - Each example directory contains detailed instructions
- **[OCI GenAI Docs](https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm)** - Official OCI documentation

## License

MIT
