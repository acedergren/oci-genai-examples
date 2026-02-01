# OCI TUI

A simple command-line interface for chatting with OCI GenAI models.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set environment variables:
   ```bash
   export OCI_COMPARTMENT_ID=ocid1.compartment.oc1..your-compartment
   export OCI_REGION=eu-frankfurt-1  # optional, default
   export OCI_MODEL_ID=cohere.command-r-plus  # optional, default
   ```

## Usage

### Interactive Mode (REPL)

```bash
pnpm dev
```

This starts an interactive chat session. Type your messages and press Enter.
Type `exit` or Ctrl+C to quit.

### One-shot Query

```bash
pnpm dev "What is the capital of France?"
```

### Pipe Input

```bash
echo "Explain async/await in JavaScript" | pnpm dev
cat question.txt | pnpm dev
```

### Disable Streaming

```bash
pnpm dev --no-stream "Generate a haiku"
```

## Available Models

- `cohere.command-r-plus` (default)
- `cohere.command-r-08-2024`
- `meta.llama-3.1-70b-instruct`
- `meta.llama-3.1-405b-instruct`

### Create Standalone Executable

If you have [Bun](https://bun.sh) installed, you can create a single standalone binary:

```bash
pnpm bundle
./oci-tui --help
```

This creates an `oci-tui` binary that includes all dependencies.

- [OCI GenAI Provider Documentation](../../docs/getting-started/README.md)
