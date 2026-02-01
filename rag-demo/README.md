# RAG Demo - OCI Embedding Models

Simple Retrieval-Augmented Generation (RAG) example using OCI embedding models.

This demo shows how to:
- Generate embeddings for a collection of documents
- Embed a query
- Find the most relevant documents using cosine similarity

## Prerequisites

- Node.js 18+
- OCI configuration (API key, compartment ID)
- Valid OCI credentials

## Installation

```bash
pnpm install
```

## Running the Demo

```bash
pnpm start
```

Expected output:
```
🔹 OCI Embedding Demo - Simple RAG

📚 Documents:
  1. The capital of France is Paris.
  2. Python is a popular programming language.
  3. The Pacific Ocean is the largest ocean.
  4. Claude is an AI assistant made by Anthropic.

🧮 Generating embeddings...
✅ Generated 4 embeddings
   Dimensions: 1024

🔍 Query: "What is the largest ocean?"

📊 Results:
  1. [45.2%] The capital of France is Paris.
  2. [38.1%] Python is a popular programming language.
  3. [92.3%] The Pacific Ocean is the largest ocean.
  4. [41.7%] Claude is an AI assistant made by Anthropic.

🎯 Best match: "The Pacific Ocean is the largest ocean."
```

## How It Works

1. **Documents**: A small collection of sample documents
2. **Embeddings**: Convert all documents to 1024-dimensional vectors using Cohere
3. **Query**: Convert the user query to an embedding
4. **Similarity**: Calculate cosine similarity between query and each document
5. **Ranking**: Find and display the most relevant document

## Configuration

The demo uses the default OCI provider instance, which reads configuration from:
- `.env` file (if present)
- OCI config file (`~/.oci/config`)
- Environment variables (`OCI_COMPARTMENT_ID`, `OCI_REGION`)

## API Reference

### Embedding Models Available

| Model | Dimensions | Speed | Best For |
|-------|-----------|-------|----------|
| `cohere.embed-multilingual-v3.0` | 1024 | Medium | Multilingual search |
| `cohere.embed-english-v3.0` | 1024 | Medium | English search |
| `cohere.embed-english-light-v3.0` | 384 | Fast | Fast English search |

### API Usage

```typescript
import { oci } from '@acedergren/oci-genai-provider';
import { embed, embedMany } from 'ai';

// Single embedding
const { embedding } = await embed({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  value: 'Hello world',
});

// Batch embeddings (up to 96 texts)
const { embeddings } = await embedMany({
  model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
  values: ['Text 1', 'Text 2', 'Text 3'],
});
```
