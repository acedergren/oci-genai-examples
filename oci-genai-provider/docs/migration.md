# Migration Guide: v1.x to v2.0

This guide helps you migrate from v1.x to v2.0 with ProviderV3 support.

## Overview

v2.0 introduces breaking changes to align with Vercel AI SDK v4+ and ProviderV3 interface:

- Explicit model type methods (`.languageModel()`, `.embeddingModel()`, etc.)
- Support for embeddings, speech, transcription, and reranking
- Improved type safety and configuration
- Better error handling

## Breaking Changes

### 1. Language Model Creation

**v1.x (deprecated):**
```typescript
import { oci } from '@acedergren/oci-genai-provider';

const model = oci('cohere.command-r-plus'); // ❌ No longer supported
```

**v2.0 (ProviderV3):**
```typescript
import { oci } from '@acedergren/oci-genai-provider';

const model = oci.languageModel('cohere.command-r-plus'); // ✅ Required
```

### 2. Provider Factory

**v1.x (deprecated):**
```typescript
import { createOCI } from '@acedergren/oci-genai-provider';

const provider = createOCI(config);
const model = provider(modelId); // ❌ No longer supported
```

**v2.0 (ProviderV3):**
```typescript
import { createOCI } from '@acedergren/oci-genai-provider';

const provider = createOCI(config);
const model = provider.languageModel(modelId); // ✅ Required
```

### 3. Configuration Structure

**v1.x:**
```typescript
const provider = createOCI({
  region: 'us-phoenix-1',
  compartmentId: 'ocid1...',
  timeout: 60000,
});
```

**v2.0:**
```typescript
const provider = createOCI({
  region: 'us-phoenix-1',
  compartmentId: 'ocid1...',
});

const model = provider.languageModel('model-id', {
  requestOptions: {
    timeoutMs: 60000,
  },
});
```

### 4. Error Handling

**v1.x:**
```typescript
try {
  await generateText({ model, prompt });
} catch (error) {
  // Generic error handling
}
```

**v2.0:**
```typescript
import {
  NetworkError,
  RateLimitError,
  AuthenticationError,
} from '@acedergren/oci-genai-provider';

try {
  await generateText({ model, prompt });
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limit
  } else if (error instanceof AuthenticationError) {
    // Handle auth error
  }
}
```

## Step-by-Step Migration

### Step 1: Update Dependencies

```bash
npm install @acedergren/oci-genai-provider@^2.0.0 ai@^6.0.0
# or
pnpm add @acedergren/oci-genai-provider@^2.0.0 ai@^6.0.0
```

### Step 2: Update Imports

No changes needed for imports - they remain the same.

### Step 3: Update Model Creation

Find and replace pattern:

```typescript
// Before (v1.x - deprecated)
const model = oci('cohere.command-r-plus'); // ❌ Remove
const model = provider('model-id'); // ❌ Remove

// After (v2.0 - ProviderV3)
const model = oci.languageModel('cohere.command-r-plus'); // ✅ Use
const model = provider.languageModel('model-id'); // ✅ Use
```

### Step 4: Move Model Settings

Move model-specific settings from provider config to model config:

**Before:**
```typescript
const provider = createOCI({
  region: 'us-phoenix-1',
  timeout: 60000,
  maxRetries: 3,
});
```

**After:**
```typescript
const provider = createOCI({
  region: 'us-phoenix-1',
});

const model = provider.languageModel('model-id', {
  requestOptions: {
    timeoutMs: 60000,
    retry: {
      enabled: true,
      maxRetries: 3,
    },
  },
});
```

### Step 5: Update Error Handling

Add specific error type handling:

```typescript
import {
  OCIGenAIError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
} from '@acedergren/oci-genai-provider';

try {
  // Your code
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfterMs);
  } else if (error instanceof AuthenticationError) {
    console.log('Auth failed:', error.message);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message);
  }
}
```

## New Features in v2.0

### 1. Embeddings

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  values: ['text 1', 'text 2'],
});
```

### 2. Speech Synthesis

```typescript
import { generateSpeech } from 'ai';

const result = await generateSpeech({
  model: oci.speechModel('oci-tts-standard', {
    voice: 'en-US-Standard-A',
    region: 'us-phoenix-1',
  }),
  text: 'Hello world',
});
```

### 3. Transcription

```typescript
import { transcribe } from 'ai';

const result = await transcribe({
  model: oci.transcriptionModel('oci-stt-standard', {
    language: 'en',
  }),
  audio: audioBuffer,
});
```

### 4. Reranking

```typescript
import { rerank } from 'ai';

const result = await rerank({
  model: oci.rerankingModel('cohere.rerank-v3.0'),
  query: 'search query',
  documents: ['doc1', 'doc2', 'doc3'],
});
```

## Testing After Migration

### 1. Run Type Checker

```bash
tsc --noEmit
```

Fix any type errors that appear.

### 2. Run Tests

```bash
npm test
# or
pnpm test
```

### 3. Test in Development

```bash
npm run dev
```

Verify all functionality works as expected.

## Compatibility

### AI SDK Version

- **v1.x:** Works with `ai@^3.0.0`
- **v2.0:** Requires `ai@^6.0.0`

### Node.js Version

- **Minimum:** Node.js 18+
- **Recommended:** Node.js 20+

### TypeScript Version

- **Minimum:** TypeScript 5.0+
- **Recommended:** TypeScript 5.6+

## Getting Help

If you encounter issues during migration:

1. Check [Troubleshooting Guide](./troubleshooting.md)
2. Review [API Reference](./api-reference.md)
3. See [examples/](../../examples/) for working code
4. Open an issue on GitHub

## Rollback Plan

If you need to rollback to v1.x:

```bash
npm install @acedergren/oci-genai-provider@^1.0.0 ai@^3.0.0
# or
pnpm add @acedergren/oci-genai-provider@^1.0.0 ai@^3.0.0
```

Then revert your code changes using git:

```bash
git checkout -- .
```
