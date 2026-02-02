import { describe, it, expect } from '@jest/globals';
import { createMockOCIConfig } from '../utils/test-helpers';
import { isValidModelId, getModelMetadata } from '../../language-models/registry';

describe('Language Models Integration', () => {
  describe('Model Creation', () => {
    it('should create config with default region', () => {
      const config = createMockOCIConfig();
      expect(config.region).toBe('eu-frankfurt-1');
    });

    it('should create config with custom region', () => {
      const config = createMockOCIConfig({ region: 'us-ashburn-1' });
      expect(config.region).toBe('us-ashburn-1');
    });

    it('should apply model-specific settings', () => {
      const config = createMockOCIConfig({
        region: 'us-ashburn-1',
      });
      expect(config).toBeDefined();
    });
  });

  describe('Model Registry', () => {
    it('should validate Cohere models in registry', () => {
      const cohereModels = [
        'cohere.command-r-plus',
        'cohere.command-r',
        'cohere.command-r-plus-08-2024',
      ];

      cohereModels.forEach((modelId) => {
        expect(isValidModelId(modelId)).toBe(true);
        const metadata = getModelMetadata(modelId);
        expect(metadata).toBeDefined();
        expect(metadata?.family).toBe('cohere');
      });
    });

    it('should validate Meta Llama models in registry', () => {
      const llamaModels = [
        'meta.llama-3.3-70b-instruct',
        'meta.llama-3.1-405b-instruct',
        'meta.llama-3.1-70b-instruct',
      ];

      llamaModels.forEach((modelId) => {
        expect(isValidModelId(modelId)).toBe(true);
        const metadata = getModelMetadata(modelId);
        expect(metadata).toBeDefined();
        expect(metadata?.family).toBe('meta');
      });
    });
  });
});
