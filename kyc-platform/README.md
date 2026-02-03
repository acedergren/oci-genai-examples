# @acedergren/kyc-platform

KYC (Know Your Customer) workflow platform with AI-assisted document processing and verification.

## Features

- **Document Processing** - Extract and validate customer documents
- **Workflow Engine** - Configurable verification workflows
- **Embedding Search** - Semantic search across customer data
- **Tool Integration** - AI SDK compatible tools
- **Type-Safe Schema** - Zod-validated data structures

## Installation

```bash
pnpm add @acedergren/kyc-platform
```

## Usage

### Repository

```typescript
import { createRepository } from '@acedergren/kyc-platform/repository';

const repo = createRepository('./kyc.db');

// Create a customer record
const customer = repo.createCustomer({
  name: 'John Doe',
  email: 'john@example.com',
  status: 'pending',
});

// Update verification status
repo.updateCustomer(customer.id, {
  status: 'verified',
  verifiedAt: new Date(),
});
```

### Workflow

```typescript
import { createWorkflow } from '@acedergren/kyc-platform/workflow';

const workflow = createWorkflow({
  steps: ['document_upload', 'identity_verify', 'address_verify', 'approval'],
});

await workflow.start(customerId);
await workflow.advance(customerId, 'document_upload', { documentId: 'doc123' });
```

### Tools

```typescript
import { getKYCTools } from '@acedergren/kyc-platform/tools';

// Get AI SDK compatible tools
const tools = getKYCTools(repository);

// Use with streamText
const result = await streamText({
  model: oci.languageModel('meta.llama-3.3-70b-instruct'),
  tools,
  messages,
});
```

## Exports

| Export | Description |
|--------|-------------|
| `@acedergren/kyc-platform` | Main entry point |
| `@acedergren/kyc-platform/schema` | Zod schemas |
| `@acedergren/kyc-platform/repository` | Database repository |
| `@acedergren/kyc-platform/workflow` | Workflow engine |
| `@acedergren/kyc-platform/tools` | AI SDK tools |
| `@acedergren/kyc-platform/embeddings` | Vector embeddings |

## License

MIT
