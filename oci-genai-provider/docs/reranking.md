# Reranking Models

Complete reference for OCI reranking models.

## Available Models

### Cohere Rerank V3

- **Model ID:** `cohere.rerank-v3.0`
- **Available Regions:** All OCI regions
- **Purpose:** Semantic relevance ranking
- **Input:** Query + documents
- **Output:** Ranked documents with scores

## Usage Examples

### Basic Reranking

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { rerank } from 'ai';

const result = await rerank({
  model: oci.rerankingModel('cohere.rerank-v3.0'),
  query: 'What is machine learning?',
  documents: [
    'Machine learning is a type of AI...',
    'Deep learning uses neural networks...',
    'Python is a programming language...',
    'TensorFlow is an ML framework...',
  ],
  topN: 2,
});

console.log(result.rankings);
// [
//   { index: 0, relevanceScore: 0.95, text: "Machine learning is..." },
//   { index: 3, relevanceScore: 0.87, text: "TensorFlow is an ML..." }
// ]
```

### Search Result Improvement

```typescript
// Get initial search results (e.g., from BM25 or full-text search)
const searchResults = [
  { id: 1, text: 'First result from search' },
  { id: 2, text: 'Second result from search' },
  { id: 3, text: 'Third result from search' },
  // ... more results
];

// Rerank by semantic relevance
const query = 'user query';
const documents = searchResults.map(r => r.text);

const result = await rerank({
  model: oci.rerankingModel('cohere.rerank-v3.0'),
  query,
  documents,
  topN: 5, // Keep top 5
});

const rerankedResults = result.rankings.map(rank => ({
  ...searchResults[rank.index],
  relevanceScore: rank.relevanceScore,
}));
```

### Large Batch Reranking

```typescript
const query = 'search query';
const allDocuments = [...]; // 1000+ documents
const batchSize = 100;

const allRankings = [];

for (let i = 0; i < allDocuments.length; i += batchSize) {
  const batch = allDocuments.slice(i, i + batchSize);
  
  const result = await rerank({
    model: oci.rerankingModel('cohere.rerank-v3.0'),
    query,
    documents: batch,
    topN: batch.length, // Keep all for merging
  });
  
  allRankings.push(...result.rankings.map(r => ({
    ...r,
    batchOffset: i,
  })));
}

// Merge and sort all rankings
const finalRankings = allRankings.sort(
  (a, b) => b.relevanceScore - a.relevanceScore
);
```

## Configuration Options

```typescript
const model = oci.rerankingModel('cohere.rerank-v3.0', {
  topN: 5, // Return top N results
  region: 'us-phoenix-1', // Optional, any region
});
```

## Use Cases

1. **Improve Search Results** - Rerank full-text search results by semantic relevance
2. **RAG Optimization** - Rerank document chunks before passing to LLM
3. **E-commerce** - Rerank product search results
4. **Question Answering** - Find most relevant passages for QA tasks
5. **Information Retrieval** - Improve relevance of retrieved documents

## Performance Tips

1. **Batch requests:** Use reasonable batch sizes (50-100 documents)
2. **Semantic search first:** Use embeddings for initial filtering, then rerank
3. **Cache results:** Avoid reranking the same query-document pairs
4. **Use topN:** Only request the top N results you need

## See Also

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration.md)
