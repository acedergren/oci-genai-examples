import { describe, it, expect } from '@jest/globals';
import {
  getRerankingModelMetadata,
  isValidRerankingModelId,
  getAllRerankingModels,
} from '../registry';

describe('Reranking Model Registry', () => {
  it('should validate Cohere reranking model IDs', () => {
    expect(isValidRerankingModelId('cohere.rerank-v3.5')).toBe(true);
    expect(isValidRerankingModelId('invalid-model')).toBe(false);
  });

  it('should return metadata for valid reranking models', () => {
    const metadata = getRerankingModelMetadata('cohere.rerank-v3.5');

    expect(metadata).toBeDefined();
    expect(metadata?.id).toBe('cohere.rerank-v3.5');
    expect(metadata?.family).toBe('cohere');
    expect(metadata?.maxDocuments).toBeGreaterThan(0);
  });

  it('should return undefined for invalid model IDs', () => {
    const metadata = getRerankingModelMetadata('invalid-model');
    expect(metadata).toBeUndefined();
  });

  it('should list all reranking models', () => {
    const models = getAllRerankingModels();

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.family === 'cohere')).toBe(true);
  });
});
