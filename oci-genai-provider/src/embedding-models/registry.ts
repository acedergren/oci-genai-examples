export interface EmbeddingModelMetadata {
  id: string;
  name: string;
  family: 'cohere';
  dimensions: 384 | 1024;
  maxTextsPerBatch: number;
  maxTokensPerText: number;
}

export const EMBEDDING_MODELS: EmbeddingModelMetadata[] = [
  {
    id: 'cohere.embed-multilingual-v3.0',
    name: 'Cohere Embed Multilingual v3.0',
    family: 'cohere',
    dimensions: 1024,
    maxTextsPerBatch: 96,
    maxTokensPerText: 512,
  },
  {
    id: 'cohere.embed-english-v3.0',
    name: 'Cohere Embed English v3.0',
    family: 'cohere',
    dimensions: 1024,
    maxTextsPerBatch: 96,
    maxTokensPerText: 512,
  },
  {
    id: 'cohere.embed-english-light-v3.0',
    name: 'Cohere Embed English Light v3.0',
    family: 'cohere',
    dimensions: 384,
    maxTextsPerBatch: 96,
    maxTokensPerText: 512,
  },
];

export function isValidEmbeddingModelId(modelId: string): boolean {
  return EMBEDDING_MODELS.some((m) => m.id === modelId);
}

export function getEmbeddingModelMetadata(modelId: string): EmbeddingModelMetadata | undefined {
  return EMBEDDING_MODELS.find((m) => m.id === modelId);
}

export function getAllEmbeddingModels(): EmbeddingModelMetadata[] {
  return EMBEDDING_MODELS;
}
