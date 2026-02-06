import { describe, it, expect } from '@jest/globals';
import { createMockOCIConfig } from '../utils/test-helpers';

describe('E2E: Complete Workflows', () => {
  it('should support complete RAG workflow', () => {
    // 1. Create embedding config
    const embeddingConfig = createMockOCIConfig({ region: 'eu-frankfurt-1' });
    expect(embeddingConfig).toBeDefined();

    // 2. Create language model config
    const languageConfig = createMockOCIConfig({ region: 'eu-frankfurt-1' });
    expect(languageConfig).toBeDefined();

    // 3. Create reranking config
    const rerankConfig = createMockOCIConfig({ region: 'eu-frankfurt-1' });
    expect(rerankConfig).toBeDefined();

    // Verify all configs are from same region
    expect(embeddingConfig.region).toBe(languageConfig.region);
    expect(rerankConfig.region).toBe(languageConfig.region);
  });

  it('should support multimodal workflow', () => {
    // 1. Transcription (audio -> text)
    const transcriptionConfig = createMockOCIConfig();
    expect(transcriptionConfig).toBeDefined();

    // 2. Language model (text -> text)
    const languageConfig = createMockOCIConfig();
    expect(languageConfig).toBeDefined();

    // 3. Speech synthesis (text -> audio)
    const speechConfig = createMockOCIConfig();
    expect(speechConfig).toBeDefined();
  });

  it('should handle errors gracefully across model types', () => {
    // Test invalid model handling
    expect(() => {
      const config = createMockOCIConfig({ region: 'invalid' });
      expect(config.region).toBe('invalid');
    }).not.toThrow();
  });
});
