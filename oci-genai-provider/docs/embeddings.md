# Embeddings

Complete reference for OCI embedding models.

## Available Models

| Model | Dimensions | Max Batch | Language | Best For |
|-------|-----------|-----------|----------|----------|
| `cohere.embed-multilingual-v3.0` | 1024 | 96 | Multiple | Multilingual semantic search |
| `cohere.embed-english-v3.0` | 1024 | 96 | English | English semantic search |
| `cohere.embed-english-light-v3.0` | 384 | 96 | English | Fast, lightweight embeddings |

## Usage Examples

### Single Embedding

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { embed } from 'ai';

const { embedding } = await embed({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  value: 'Hello world',
});

console.log(embedding); // [0.123, -0.456, ...]
```

### Batch Embeddings

```typescript
import { embedMany } from 'ai';

const texts = [
  'The capital of France is Paris',
  'Python is a programming language',
  'The Pacific is the largest ocean',
];

const { embeddings } = await embedMany({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  values: texts,
});

console.log(embeddings); // Array of embeddings
```

### Semantic Search

```typescript
import { embed, embedMany } from 'ai';

// Index documents
const documents = [
  'React is a JavaScript library',
  'Vue is a JavaScript framework',
  'TypeScript is a superset of JavaScript',
];

const { embeddings: docEmbeddings } = await embedMany({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  values: documents,
});

// Search query
const query = 'JavaScript frontend framework';
const { embedding: queryEmbedding } = await embed({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  value: query,
});

// Find most similar
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  // Guard against division by zero
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

const similarities = docEmbeddings.map(doc => cosineSimilarity(queryEmbedding, doc));
const bestMatch = Math.max(...similarities);
```

## Configuration Options

```typescript
const model = oci.embeddingModel('cohere.embed-multilingual-v3.0', {
  // Truncation strategy
  truncate: 'END', // 'START' | 'END' | 'NONE'

  // Input type for context
  inputType: 'DOCUMENT', // 'QUERY' | 'DOCUMENT'

  // Output dimensions (model dependent)
  dimensions: 1024, // 384 | 1024
});
```

## Dimension Selection

- **1024 dimensions:** High quality, larger vector size
- **384 dimensions:** Fast, smaller vector size, slightly lower quality

## Best Practices

1. **Batch requests:** Use up to 96 texts per request for efficiency
2. **Consistent input type:** Use same `inputType` for indexing and queries
3. **Handle truncation:** Choose truncation strategy based on your use case
4. **Cache embeddings:** Avoid re-embedding the same text

## See Also

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration.md)
