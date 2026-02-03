# @acedergren/oci-genai-query

TanStack Query utilities for OCI GenAI applications.

## Features

- Pre-configured QueryClient for AI workloads
- Optimized caching strategies
- Retry logic for transient failures
- TypeScript-first design

## Installation

```bash
pnpm add @acedergren/oci-genai-query @tanstack/query-core
```

## Usage

### With Svelte

```typescript
import { createQueryClient } from '@acedergren/oci-genai-query';
import { QueryClientProvider } from '@tanstack/svelte-query';

const queryClient = createQueryClient();
```

```svelte
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### With React

```typescript
import { createQueryClient } from '@acedergren/oci-genai-query';
import { QueryClientProvider } from '@tanstack/react-query';

const queryClient = createQueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Chat />
    </QueryClientProvider>
  );
}
```

## Configuration

The default client is configured for AI workloads:

```typescript
const queryClient = createQueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      gcTime: 1000 * 60 * 30,    // 30 minutes
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    },
  },
});
```

## API

### createQueryClient(config?)

Creates a pre-configured QueryClient instance.

| Option | Default | Description |
|--------|---------|-------------|
| `staleTime` | 5 min | Time before data is considered stale |
| `gcTime` | 30 min | Time before inactive data is garbage collected |
| `retry` | 3 | Number of retry attempts |

## License

MIT
