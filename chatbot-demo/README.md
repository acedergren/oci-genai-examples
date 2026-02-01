# OCI GenAI SvelteKit Chatbot Demo

A beautiful, minimal chatbot demo showcasing the OCI GenAI Provider with Vercel AI SDK.

## Features

- 🎨 Oracle Branding & Modern UI
- ⚡ Real-time streaming responses
- 🔄 Model switching (Grok, Llama, Gemini, Cohere)
- 🧠 Reasoning/Thinking Trace support
- 📱 Mobile responsive
- ♿ Accessible (WCAG AA)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- OCI account with GenAI access

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your OCI credentials
# OCI_COMPARTMENT_ID=ocid1.compartment.oc1...
# OCI_REGION=eu-frankfurt-1
```

### Development

```bash
pnpm dev
```

Open [http://localhost:8765](http://localhost:8765)

### Build

```bash
pnpm build
pnpm preview
```

## Tech Stack

- **Framework**: SvelteKit 2 (Svelte 5)
- **AI SDK**: Vercel AI SDK v4+
- **Provider**: @acedergren/oci-genai-provider
- **Styling**: Tailwind CSS 4.1 + shadcn-svelte
- **Fonts**: Inter Variable, Space Grotesk

## License

MIT
