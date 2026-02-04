export interface RerankingModelMetadata {
  id: string;
  name: string;
  family: 'cohere';
  maxDocuments: number;
  maxQueryLength: number;
  supportsMultilingual: boolean;
}

export const RERANKING_MODELS: RerankingModelMetadata[] = [
  {
    id: 'cohere.rerank-v3.5',
    name: 'Cohere Rerank v3.5',
    family: 'cohere',
    maxDocuments: 1000,
    maxQueryLength: 2048,
    supportsMultilingual: true,
  },
];

export function isValidRerankingModelId(modelId: string): boolean {
  return RERANKING_MODELS.some((m) => m.id === modelId);
}

export function getRerankingModelMetadata(modelId: string): RerankingModelMetadata | undefined {
  return RERANKING_MODELS.find((m) => m.id === modelId);
}

export function getAllRerankingModels(): RerankingModelMetadata[] {
  return RERANKING_MODELS;
}
