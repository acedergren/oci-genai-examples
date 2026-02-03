# Contributing to OCI GenAI Examples

Thank you for your interest in contributing! This project demonstrates OCI Generative AI capabilities through example applications and libraries.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- OCI account with GenAI access
- OCI CLI configured (`~/.oci/config`)

### Setup

```bash
git clone https://github.com/acedergren/oci-genai-examples.git
cd oci-genai-examples
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` in the package you're working on and configure:

```bash
OCI_REGION=us-chicago-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxxxx
```

## Project Structure

```
oci-genai-examples/
├── oci-genai-provider/   # AI SDK provider for OCI GenAI
├── mcp-client/           # MCP protocol client library
├── agent-state/          # Agent state management
├── oci-ai-chat/          # SvelteKit web chat application
├── tui-agent/            # Terminal UI agent
├── chatbot-demo/         # Simple chatbot demo
├── nextjs-chatbot/       # Next.js chatbot example
├── cli-tool/             # Command-line interface
├── fraud-analyst-agent/  # Financial fraud analysis agent
└── rag-demo/             # RAG implementation example
```

## Development Workflow

### 1. Pick an Issue

Check [open issues](https://github.com/acedergren/oci-genai-examples/issues) or create one describing what you want to work on.

### 2. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-description
```

### 3. Make Changes

- Follow existing code style
- Add tests for new functionality
- Update documentation as needed

### 4. Test

```bash
# Run tests for a specific package
cd oci-genai-provider
pnpm test

# Type check
pnpm typecheck
```

### 5. Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat(provider): add streaming support for embeddings
fix(tui-agent): resolve keyboard navigation issue
docs(readme): update installation instructions
```

### 6. Submit PR

- Fill out the PR template
- Link related issues
- Ensure CI passes

## Code Guidelines

### TypeScript

- Use strict mode
- Prefer `type` over `interface` for simple types
- Export types alongside implementations

### Error Handling

- Use custom error classes from `shared/errors`
- Never swallow errors silently
- Include context in error messages

### Security

- Never commit credentials
- Validate all external input
- Follow OWASP guidelines

## Adding a New Example

1. Create a new directory in the workspace root
2. Add to `pnpm-workspace.yaml`
3. Include a README with:
   - What it demonstrates
   - Prerequisites
   - Setup instructions
   - Usage examples
4. Add workspace script to root `package.json`

## Questions?

Open an issue or start a discussion. We're happy to help!
