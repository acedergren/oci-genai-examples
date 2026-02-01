# Next.js OCI GenAI Chatbot Demo

A minimal chatbot demo using OCI GenAI Provider with Next.js App Router.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Configure OCI credentials in `.env.local`:
   - Set `OCI_COMPARTMENT_ID` to your compartment OCID
   - Set `OCI_REGION` (default: eu-frankfurt-1)

4. Start the dev server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Features

- Streaming chat responses
- Model selection (Command R+, Command R, Llama 3.1)
- Bioluminescence design theme
- Built with Next.js 15 App Router

## Learn More

- [OCI GenAI Provider Documentation](../../docs/getting-started/README.md)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
