# Contributing to OCI GenAI Examples

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm 8+
- OCI account with GenAI access
- OCI CLI configured (`~/.oci/config`)
- Git for version control

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/yourusername/oci-genai-examples.git
   cd oci-genai-examples
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Build core packages**:
   ```bash
   cd oci-genai-provider && pnpm build && cd ..
   cd kyc-platform && pnpm build && cd ..
   ```

4. **Configure OCI credentials**:
   Create a `.env` file in the package you're working on:
   ```bash
   OCI_REGION=us-chicago-1
   OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxxxx
   ```

## How to Contribute

### Reporting Issues

- Use GitHub Issues to report bugs or suggest features
- Search existing issues before creating a new one
- Include detailed information: OS, Node version, error messages, steps to reproduce
- For security vulnerabilities, see [SECURITY.md](./SECURITY.md)

### Pull Requests

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Follow the code style (see below)
   - Add tests for new functionality
   - Update documentation as needed
   - Keep commits atomic and well-described

3. **Test your changes**:
   ```bash
   # Run type checking
   pnpm type-check
   
   # Run tests
   pnpm test
   
   # Test in development
   pnpm dev
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "feat(kyc-intelligence): add customer search feature"
   ```
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `refactor:` Code refactoring
   - `test:` Test additions or fixes
   - `chore:` Build process or tooling changes

5. **Push and create a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub with:
   - Clear description of changes
   - Link to related issues
   - Screenshots for UI changes

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use functional programming patterns where appropriate
- Follow existing code conventions

### SvelteKit/Svelte 5

- Use Svelte 5 runes (`$state`, `$derived`, `$props`)
- Follow SvelteKit file-based routing conventions
- Keep components focused and reusable
- Use TypeScript for component props

### CSS/Tailwind

- Use Tailwind CSS utility classes
- Follow the established design system (see `app.css`)
- Prefer fluid typography and spacing (clamp values)
- Use container queries for component responsiveness

### AI SDK Usage

- Use the Vercel AI SDK 6.0 patterns
- Implement proper error handling
- Add streaming support where appropriate
- Follow OCI GenAI best practices

## Project Structure

```
oci-genai-examples/
├── oci-genai-provider/     # Core AI SDK provider
├── kyc-platform/            # Shared KYC infrastructure
├── kyc-intelligence/        # KYC Intelligence demo
├── oci-ai-chat/            # Production chat app
├── tui-agent/              # Terminal UI agent
└── [other demos]/          # Various demo applications
```

## Testing

- Write unit tests for utility functions
- Add integration tests for API endpoints
- Test edge cases and error conditions
- Ensure tests pass before submitting PR

## Documentation

- Update README.md for new features
- Add JSDoc comments for complex functions
- Include code examples in documentation
- Update architecture diagrams if needed

## Monorepo Guidelines

This is a pnpm workspace monorepo:

- **Shared packages** must be built before use: `pnpm build`
- **Dependencies**: Use workspace protocol (`"@acedergren/package": "workspace:*"`)
- **Scripts**: Run from package directory or use pnpm filters
- **Changes**: Consider impact on dependent packages

## Common Pitfalls

### OCI Provider Issues

- Ensure OCI CLI is configured correctly
- Check region and compartment ID in `.env`
- Verify OCI GenAI service access in your tenancy

### Database Issues

- SQLite database files are in `.data/` directories (gitignored)
- Run seed scripts to populate test data
- BLOB fields require Buffer type for embeddings

### Build Issues

- Clean build artifacts: `rm -rf dist/ .svelte-kit/`
- Rebuild dependencies: `pnpm install --force`
- Check Node version: `node --version` (should be 18+)

## Getting Help

- GitHub Issues for bugs and features
- Discussions for questions and ideas
- Check existing documentation first
- Be respectful and constructive

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you agree to uphold this code. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License. See [LICENSE](./LICENSE).

---

Thank you for contributing to OCI GenAI Examples! 🙏
