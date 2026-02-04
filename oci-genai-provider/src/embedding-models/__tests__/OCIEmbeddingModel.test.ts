/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NoSuchModelError, TooManyEmbeddingValuesForCallError } from '@ai-sdk/provider';
import { OCIEmbeddingModel } from '../OCIEmbeddingModel';
import type { EmbeddingModelV3CallOptions } from '@ai-sdk/provider';

// Mockable embedText function - use any to avoid complex Jest typing issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEmbedText = jest.fn() as jest.Mock<any>;

// Mock OCI SDK
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation(() => ({
    embedText: mockEmbedText,
  })),
}));

jest.mock('../../auth', () => ({
  // @ts-expect-error - Jest mock type limitation
  createAuthProvider: jest.fn().mockResolvedValue({ type: 'mock_auth' }),
  getRegion: jest.fn().mockReturnValue('eu-frankfurt-1'),
  getCompartmentId: jest.fn().mockReturnValue('ocid1.compartment.test'),
}));

describe('OCIEmbeddingModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbedText.mockClear();
    mockEmbedText.mockResolvedValue({
      embedTextResult: {
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      },
    });
  });

  it('should have correct specification version and provider', () => {
    const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
      compartmentId: 'ocid1.compartment.test',
    });

    expect(model.specificationVersion).toBe('v3');
    expect(model.provider).toBe('oci-genai');
    expect(model.modelId).toBe('cohere.embed-multilingual-v3.0');
  });

  it('should set maxEmbeddingsPerCall to 96', () => {
    const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {});

    expect(model.maxEmbeddingsPerCall).toBe(96);
  });

  it('should throw error for invalid model ID', () => {
    expect(() => {
      new OCIEmbeddingModel('invalid-model', {});
    }).toThrow(NoSuchModelError);
  });

  it('should validate embeddings count does not exceed max', async () => {
    const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
      compartmentId: 'test',
    });

    const texts: string[] = Array.from({ length: 97 }, () => 'test'); // 97 > 96 max

    const options: EmbeddingModelV3CallOptions = {
      values: texts,
    };

    await expect(model.doEmbed(options)).rejects.toThrow(TooManyEmbeddingValuesForCallError);
  });

  describe('getClient', () => {
    it('should initialize client with auth provider', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAuthProvider } = require('../../auth');
      createAuthProvider.mockClear();

      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
        region: 'eu-frankfurt-1',
      });

      await model.doEmbed({ values: ['test'] });
      expect(createAuthProvider).toHaveBeenCalled();
    });

    it('should reuse client on subsequent calls', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GenerativeAiInferenceClient } = require('oci-generativeaiinference');
      GenerativeAiInferenceClient.mockClear();

      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
      });

      await model.doEmbed({ values: ['test1'] });
      await model.doEmbed({ values: ['test2'] });
      expect(GenerativeAiInferenceClient).toHaveBeenCalledTimes(1);
    });

    it('should set custom endpoint when provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GenerativeAiInferenceClient } = require('oci-generativeaiinference');
      const mockClientInstance = {
        embedText: mockEmbedText,
        region: undefined as string | undefined,
        endpoint: undefined as string | undefined,
      };
      GenerativeAiInferenceClient.mockImplementation(() => mockClientInstance);

      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
        endpoint: 'https://custom-endpoint.example.com',
      });

      await model.doEmbed({ values: ['test'] });
      expect(mockClientInstance.endpoint).toBe('https://custom-endpoint.example.com');
    });
  });

  describe('doEmbed', () => {
    beforeEach(() => {
      mockEmbedText.mockClear();
      mockEmbedText.mockResolvedValue({
        embedTextResult: {
          embeddings: [
            [0.1, 0.2],
            [0.3, 0.4],
          ],
        },
      });
    });

    it('should generate embeddings successfully', async () => {
      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
      });

      const result = await model.doEmbed({
        values: ['Hello world', 'Test text'],
      });

      expect(result.embeddings).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(result.warnings).toEqual([]);
    });

    it('should call OCI API with correct parameters', async () => {
      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'ocid1.compartment.test',
      });

      await model.doEmbed({ values: ['test text'] });

      expect(mockEmbedText).toHaveBeenCalledWith({
        embedTextDetails: expect.objectContaining({
          servingMode: expect.objectContaining({
            servingType: 'ON_DEMAND',
            modelId: 'cohere.embed-multilingual-v3.0',
          }),
          inputs: ['test text'],
          truncate: 'END',
          inputType: 'SEARCH_DOCUMENT',
        }),
      });
    });

    it('should use custom truncate setting', async () => {
      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
        truncate: 'START',
      });

      await model.doEmbed({ values: ['test'] });

      expect(mockEmbedText).toHaveBeenCalledWith(
        expect.objectContaining({
          embedTextDetails: expect.objectContaining({ truncate: 'START' }),
        })
      );
    });

    it('should use custom inputType setting', async () => {
      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
        inputType: 'SEARCH_QUERY',
      });

      await model.doEmbed({ values: ['query'] });

      expect(mockEmbedText).toHaveBeenCalledWith(
        expect.objectContaining({
          embedTextDetails: expect.objectContaining({ inputType: 'SEARCH_QUERY' }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockEmbedText.mockRejectedValueOnce(new Error('API Error'));

      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
      });

      await expect(model.doEmbed({ values: ['test'] })).rejects.toThrow('API Error');
    });

    it('should calculate token usage based on text length', async () => {
      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
      });

      const result = await model.doEmbed({
        values: ['Hello world', 'Test'], // 11 chars + 4 chars = ~4 + 1 tokens
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.tokens).toBeGreaterThan(0);
    });

    it('should handle single embedding request', async () => {
      mockEmbedText.mockResolvedValueOnce({
        embedTextResult: {
          embeddings: [[0.5, 0.6, 0.7]],
        },
      });

      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
      });

      const result = await model.doEmbed({
        values: ['single text'],
      });

      expect(result.embeddings).toEqual([[0.5, 0.6, 0.7]]);
      expect(result.embeddings.length).toBe(1);
    });

    it('should handle empty values array', async () => {
      mockEmbedText.mockResolvedValueOnce({
        embedTextResult: {
          embeddings: [],
        },
      });

      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
      });

      const result = await model.doEmbed({
        values: [],
      });

      expect(result.embeddings).toEqual([]);
    });
  });

  describe('model validation', () => {
    it('should accept cohere.embed-english-v3.0', () => {
      const model = new OCIEmbeddingModel('cohere.embed-english-v3.0', {
        compartmentId: 'test',
      });
      expect(model.modelId).toBe('cohere.embed-english-v3.0');
    });

    it('should accept cohere.embed-english-light-v3.0', () => {
      const model = new OCIEmbeddingModel('cohere.embed-english-light-v3.0', {
        compartmentId: 'test',
      });
      expect(model.modelId).toBe('cohere.embed-english-light-v3.0');
    });

    it('should support parallel calls', () => {
      const model = new OCIEmbeddingModel('cohere.embed-multilingual-v3.0', {
        compartmentId: 'test',
      });
      expect(model.supportsParallelCalls).toBe(true);
    });
  });
});
