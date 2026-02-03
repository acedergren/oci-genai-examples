/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect } from '@jest/globals';
import { createMockOCIConfig, createMockOCIResponse } from '../utils/test-helpers';

describe('Embedding Models Integration', () => {
  describe('Model Creation', () => {
    it('should create multilingual embedding config', () => {
      const config = createMockOCIConfig();
      expect(config.region).toBeDefined();
    });

    it('should create English light model config', () => {
      const config = createMockOCIConfig({ region: 'eu-frankfurt-1' });
      expect(config.region).toBe('eu-frankfurt-1');
    });
  });

  describe('Batch Processing', () => {
    // TODO: Add actual integration test that calls OCIEmbeddingModel.embed()
    // with 100+ texts and verifies batching behavior (requests split into batches of 96)

    it('should generate batch embeddings', () => {
      const response = createMockOCIResponse('embedding', {
        embeddings: Array(3).fill([0.1, 0.2, 0.3]),
      });

      expect(response.embedTextResult).toBeDefined();
      expect(response.embedTextResult.embeddings).toHaveLength(3);
    });
  });

  describe('Configuration Options', () => {
    // TODO: Add actual integration tests that call OCIEmbeddingModel with different
    // truncation and input type options and verify they are sent correctly in API requests
  });
});
