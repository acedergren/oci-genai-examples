# OCI GenAI Provider Examples

This directory contains example applications demonstrating the OCI GenAI Provider.

## Available Examples

### [SvelteKit Chatbot](./chatbot-demo/)

A beautiful chatbot demo using SvelteKit and the bioluminescence design system.

```bash
cd chatbot-demo
pnpm install
cp .env.example .env
# Configure OCI credentials
pnpm dev
```

**Features:**

- Svelte 4 with reactive stores
- Streaming responses with AI SDK
- Model selection dropdown
- Tailwind CSS 4 styling
- Mobile responsive design

### [Next.js Chatbot](./nextjs-chatbot/)

A minimal chatbot using Next.js 15 App Router.

```bash
cd nextjs-chatbot
pnpm install
cp .env.example .env.local
# Configure OCI credentials
pnpm dev
```

**Features:**

- Next.js 15 App Router
- React 19
- useChat hook from AI SDK
- Streaming responses
- Tailwind CSS styling

### [CLI Tool](./cli-tool/)

A command-line interface for interacting with OCI GenAI models.

```bash
cd cli-tool
pnpm install
export OCI_COMPARTMENT_ID=ocid1.compartment...
pnpm dev "What is TypeScript?"
```

**Features:**

- Interactive REPL mode
- One-shot queries
- Pipe input support
- Streaming output

## Prerequisites

All examples require:

1. **OCI Account** with GenAI service access
2. **OCI CLI configured** (`~/.oci/config`)
3. **Compartment ID** with GenAI permissions

See the [Getting Started Guide](../docs/getting-started/README.md) for detailed setup.

## Running Examples

Each example is a standalone application within this monorepo. From the root:

```bash
# Install all dependencies
pnpm install

# Run specific example
pnpm --filter @acedergren/chatbot-demo dev
pnpm --filter nextjs-chatbot-demo dev
pnpm --filter oci-genai-cli-demo dev
```

## Example Architecture

All examples use the core `@acedergren/oci-genai-provider` package:

```
examples/
├── chatbot-demo/          # SvelteKit web app
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte      # Chat UI
│   │   │   └── api/chat/+server.ts   # API endpoint
│   │   └── lib/                  # Shared components
│   └── package.json
├── nextjs-chatbot/        # Next.js web app
│   ├── app/
│   │   ├── page.tsx              # Chat UI
│   │   └── api/chat/route.ts     # API endpoint
│   └── package.json
└── cli-tool/              # Command-line tool
    ├── src/
    │   └── cli.ts                # CLI entry point
    └── package.json
```

## Configuration

### Environment Variables

All examples support these environment variables:

```bash
# Required
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..your_id

# Optional (defaults shown)
OCI_REGION=eu-frankfurt-1
OCI_CONFIG_PROFILE=DEFAULT
OCI_CONFIG_FILE=~/.oci/config
```

### OCI Config File

Ensure your `~/.oci/config` is properly configured:

```ini
[DEFAULT]
user=ocid1.user.oc1..your_user_id
fingerprint=your_fingerprint
key_file=~/.oci/oci_api_key.pem
tenancy=ocid1.tenancy.oc1..your_tenancy_id
region=eu-frankfurt-1
```

## Troubleshooting

See the [Troubleshooting Guide](../docs/guides/troubleshooting.md) for common issues and solutions.

### Quick Fixes

**Authentication errors:** Check `~/.oci/config` exists and has valid credentials.

**Model not found:** Verify model ID is correct and available in your region.

**Rate limiting:** The provider has built-in retry with exponential backoff.

---

**Need help?** Open an issue on [GitHub](https://github.com/acedergren/oci-genai-provider/issues).
