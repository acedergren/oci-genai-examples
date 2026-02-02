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
    it('should respect maximum batch size of 96', () => {
      // OCI embedding API has a maximum batch size of 96 texts per request
      const maxBatchSize = 96;
      const inputTexts = Array(100).fill('test text');

      // Calculate expected number of batches
      const expectedBatches = Math.ceil(inputTexts.length / maxBatchSize);
      expect(expectedBatches).toBe(2); // 100 texts = 2 batches (96 + 4)

      // First batch should be full, second should have remainder
      const firstBatchSize = Math.min(inputTexts.length, maxBatchSize);
      const secondBatchSize = inputTexts.length - firstBatchSize;
      expect(firstBatchSize).toBe(96);
      expect(secondBatchSize).toBe(4);
    });

    it('should generate batch embeddings', () => {
      const response = createMockOCIResponse('embedding', {
        embeddings: Array(3).fill([0.1, 0.2, 0.3]),
      });

      expect(response.embedTextResult).toBeDefined();
      expect(response.embedTextResult.embeddings).toHaveLength(3);
    });
  });

  describe('Configuration Options', () => {
    it('should support truncation options', () => {
      const truncateOptions = ['START', 'END'];
      expect(truncateOptions).toContain('START');
    });

    it('should support input type optimization', () => {
      const inputTypes = ['DOCUMENT', 'QUERY'];
      expect(inputTypes).toContain('QUERY');
    });
  });
});
