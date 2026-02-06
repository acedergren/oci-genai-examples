import { describe, it, expect } from '@jest/globals';
import {
  isValidModelId,
  getModelMetadata,
  getAllModels,
  getModelsByFamily,
  supportsReasoning,
} from '../registry';

describe('Model Registry', () => {
  describe('isValidModelId', () => {
    describe('Grok models', () => {
      it('should validate xai.grok-code-fast-1', () => {
        expect(isValidModelId('xai.grok-code-fast-1')).toBe(true);
      });

      it('should validate xai.grok-4-1-fast-reasoning', () => {
        expect(isValidModelId('xai.grok-4-1-fast-reasoning')).toBe(true);
      });

      it('should validate xai.grok-4-1-fast-non-reasoning', () => {
        expect(isValidModelId('xai.grok-4-1-fast-non-reasoning')).toBe(true);
      });

      it('should validate xai.grok-4-fast-reasoning', () => {
        expect(isValidModelId('xai.grok-4-fast-reasoning')).toBe(true);
      });

      it('should validate xai.grok-4-fast-non-reasoning', () => {
        expect(isValidModelId('xai.grok-4-fast-non-reasoning')).toBe(true);
      });

      it('should validate xai.grok-3', () => {
        expect(isValidModelId('xai.grok-3')).toBe(true);
      });

      it('should validate xai.grok-3-mini', () => {
        expect(isValidModelId('xai.grok-3-mini')).toBe(true);
      });

      it('should reject invalid Grok model', () => {
        expect(isValidModelId('xai.invalid')).toBe(false);
      });
    });

    describe('Llama models', () => {
      it('should validate meta.llama-3.3-70b-instruct', () => {
        expect(isValidModelId('meta.llama-3.3-70b-instruct')).toBe(true);
      });

      it('should validate meta.llama-3.2-90b-vision-instruct', () => {
        expect(isValidModelId('meta.llama-3.2-90b-vision-instruct')).toBe(true);
      });

      it('should validate meta.llama-3.1-405b-instruct', () => {
        expect(isValidModelId('meta.llama-3.1-405b-instruct')).toBe(true);
      });
    });

    describe('Cohere models', () => {
      it('should validate cohere.command-r-plus', () => {
        expect(isValidModelId('cohere.command-r-plus')).toBe(true);
      });

      it('should validate cohere.command-plus-latest', () => {
        expect(isValidModelId('cohere.command-plus-latest')).toBe(true);
      });

      it('should validate cohere.command-latest', () => {
        expect(isValidModelId('cohere.command-latest')).toBe(true);
      });

      it('should validate cohere.command-a-03-2025', () => {
        expect(isValidModelId('cohere.command-a-03-2025')).toBe(true);
      });

      it('should validate cohere.command-a-reasoning', () => {
        expect(isValidModelId('cohere.command-a-reasoning')).toBe(true);
      });

      it('should validate cohere.command-a-vision', () => {
        expect(isValidModelId('cohere.command-a-vision')).toBe(true);
      });
    });

    describe('Gemini models', () => {
      it('should validate google.gemini-2.5-pro', () => {
        expect(isValidModelId('google.gemini-2.5-pro')).toBe(true);
      });

      it('should validate google.gemini-2.5-flash', () => {
        expect(isValidModelId('google.gemini-2.5-flash')).toBe(true);
      });

      it('should validate google.gemini-2.5-flash-lite', () => {
        expect(isValidModelId('google.gemini-2.5-flash-lite')).toBe(true);
      });
    });

    it('should reject completely invalid model ID', () => {
      expect(isValidModelId('invalid.model')).toBe(false);
    });
  });

  describe('getModelMetadata', () => {
    it('should return Grok Code Fast metadata', () => {
      const metadata = getModelMetadata('xai.grok-code-fast-1');
      expect(metadata).toBeDefined();
      expect(metadata?.family).toBe('grok');
      expect(metadata?.capabilities.streaming).toBe(true);
      expect(metadata?.capabilities.tools).toBe(true);
      expect(metadata?.contextWindow).toBe(131072);
      expect(metadata?.speed).toBe('very-fast');
    });

    it('should return Gemini Flash with vision capability', () => {
      const metadata = getModelMetadata('google.gemini-2.5-flash');
      expect(metadata?.capabilities.vision).toBe(true);
      expect(metadata?.contextWindow).toBe(1048576);
    });

    it('should return Llama Vision metadata', () => {
      const metadata = getModelMetadata('meta.llama-3.2-90b-vision-instruct');
      expect(metadata?.capabilities.vision).toBe(true);
    });

    it('should return undefined for invalid model', () => {
      const result = getModelMetadata('invalid.model');
      expect(result).toBeUndefined();
    });

    it('should include all required metadata fields', () => {
      const metadata = getModelMetadata('cohere.command-r-plus');
      expect(metadata).toHaveProperty('id');
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('family');
      expect(metadata).toHaveProperty('capabilities');
      expect(metadata).toHaveProperty('contextWindow');
      expect(metadata).toHaveProperty('speed');
    });
  });

  describe('getAllModels', () => {
    it('should return all models (16+ models)', () => {
      const models = getAllModels();
      expect(models.length).toBeGreaterThanOrEqual(16);
    });

    it('should include models from all families', () => {
      const models = getAllModels();
      const families = new Set(models.map((m) => m.family));
      expect(families.has('grok')).toBe(true);
      expect(families.has('llama')).toBe(true);
      expect(families.has('cohere')).toBe(true);
      expect(families.has('gemini')).toBe(true);
    });
  });

  describe('getModelsByFamily', () => {
    it('should return Grok models', () => {
      const grokModels = getModelsByFamily('grok');
      expect(grokModels.length).toBeGreaterThanOrEqual(3);
      grokModels.forEach((m) => expect(m.family).toBe('grok'));
    });

    it('should return Llama models', () => {
      const llamaModels = getModelsByFamily('llama');
      expect(llamaModels.length).toBeGreaterThanOrEqual(3);
      llamaModels.forEach((m) => expect(m.family).toBe('llama'));
    });

    it('should return Cohere models', () => {
      const cohereModels = getModelsByFamily('cohere');
      expect(cohereModels.length).toBeGreaterThanOrEqual(3);
      cohereModels.forEach((m) => expect(m.family).toBe('cohere'));
    });

    it('should return Gemini models', () => {
      const geminiModels = getModelsByFamily('gemini');
      expect(geminiModels.length).toBe(3);
      geminiModels.forEach((m) => expect(m.family).toBe('gemini'));
    });

    it('should return empty array for unknown family', () => {
      // @ts-expect-error - Testing invalid family
      const result = getModelsByFamily('unknown');
      expect(result).toHaveLength(0);
    });
  });

  describe('supportsReasoning', () => {
    describe('reasoning-capable models', () => {
      it('should return true for xai.grok-4-1-fast-reasoning', () => {
        expect(supportsReasoning('xai.grok-4-1-fast-reasoning')).toBe(true);
      });

      it('should return true for xai.grok-4-fast-reasoning', () => {
        expect(supportsReasoning('xai.grok-4-fast-reasoning')).toBe(true);
      });

      it('should return true for cohere.command-a-reasoning-08-2025', () => {
        expect(supportsReasoning('cohere.command-a-reasoning-08-2025')).toBe(true);
      });

      it('should return true for cohere.command-a-reasoning', () => {
        expect(supportsReasoning('cohere.command-a-reasoning')).toBe(true);
      });

      it('should return true for google.gemini-2.5-flash (supports reasoning)', () => {
        expect(supportsReasoning('google.gemini-2.5-flash')).toBe(true);
      });
    });

    describe('non-reasoning models', () => {
      it('should return false for meta.llama-3.3-70b-instruct', () => {
        expect(supportsReasoning('meta.llama-3.3-70b-instruct')).toBe(false);
      });

      it('should return false for cohere.command-r-plus', () => {
        expect(supportsReasoning('cohere.command-r-plus')).toBe(false);
      });

      it('should return false for xai.grok-4-1-fast-non-reasoning', () => {
        expect(supportsReasoning('xai.grok-4-1-fast-non-reasoning')).toBe(false);
      });
    });

    it('should return false for invalid model ID', () => {
      expect(supportsReasoning('invalid.model')).toBe(false);
    });
  });
});
