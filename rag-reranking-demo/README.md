# RAG + Reranking Demo

Advanced RAG (Retrieval Augmented Generation) example combining embeddings with semantic reranking.

## Features

- Embedding-based document retrieval
- Semantic reranking for improved precision
- Demonstrates the power of combining two ranking strategies
- Shows embedding similarity scores and reranking results

## How It Works

1. **Retrieval Phase:** Use embeddings to retrieve top-K candidate documents
2. **Reranking Phase:** Apply semantic reranking to the candidates for better precision
3. **Comparison:** Display both results to show improvement

## Setup

```bash
pnpm install
```

Set environment variables:

```bash
export OCI_COMPARTMENT_ID=ocid1.compartment...
export OCI_CONFIG_PROFILE=DEFAULT
```

## Running the Demo

```bash
pnpm start
```

## Models Used

- **Embeddings:** `cohere.embed-multilingual-v3.0` (1024 dimensions)
- **Reranking:** `cohere.rerank-v3.5` (semantic relevance scoring)

## Key Insights

1. **Embeddings** provide fast, approximate retrieval at scale
2. **Reranking** improves precision by re-evaluating semantic relevance
3. **Combined approach** gives best of both worlds: speed + precision

## Learn More

- [Embeddings Documentation](../../packages/oci-genai-provider/docs/embeddings.md)
- [Reranking Documentation](../../packages/oci-genai-provider/docs/reranking.md)
- [OCI GenAI Provider](../../packages/oci-genai-provider)
