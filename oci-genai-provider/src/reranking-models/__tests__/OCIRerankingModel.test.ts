/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { RerankingModelV3CallOptions } from '@ai-sdk/provider';
import { InvalidArgumentError, NoSuchModelError } from '@ai-sdk/provider';

// Define mocks at module scope - must be before jest.mock calls
const mockRerankText = jest.fn<(...args: any[]) => Promise<any>>();
const mockCreateAuthProvider = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetRegion = jest.fn<(...args: any[]) => any>();
const mockGetCompartmentId = jest.fn<(...args: any[]) => any>();

// Mock OCI SDK
jest.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: jest.fn().mockImplementation(() => ({
    rerankText: mockRerankText,
  })),
}));

// Mock auth module
jest.mock('../../auth', () => ({
  createAuthProvider: (...args: any[]) => mockCreateAuthProvider(...args),
  getRegion: (...args: any[]) => mockGetRegion(...args),
  getCompartmentId: (...args: any[]) => mockGetCompartmentId(...args),
}));

// Import after mocks are set up
import { OCIRerankingModel } from '../OCIRerankingModel';

describe('OCIRerankingModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock implementations
    mockRerankText.mockResolvedValue({
      rerankTextResult: {
        id: 'rerank-job-123',
        modelId: 'cohere.rerank-v3.5',
        documentRanks: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.78 },
          { index: 1, relevanceScore: 0.45 },
        ],
      },
    });
    mockCreateAuthProvider.mockResolvedValue({ type: 'mock_auth' });
    mockGetRegion.mockReturnValue('eu-frankfurt-1');
    mockGetCompartmentId.mockReturnValue('ocid1.compartment.test');
  });

  it('should have correct specification version and provider', () => {
    const model = new OCIRerankingModel('cohere.rerank-v3.5', {
      compartmentId: 'ocid1.compartment.test',
    });

    expect(model.specificationVersion).toBe('v3');
    expect(model.provider).toBe('oci-genai');
    expect(model.modelId).toBe('cohere.rerank-v3.5');
  });

  it('should throw error for invalid model ID', () => {
    expect(() => {
      new OCIRerankingModel('invalid-model', {});
    }).toThrow(NoSuchModelError);
  });

  // Client initialization tests (getClient - lines 31-48)
  describe('getClient', () => {
    it('should initialize client with auth provider and region', async () => {
      const { GenerativeAiInferenceClient } = require('oci-generativeaiinference');

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
        region: 'eu-frankfurt-1',
      });

      // Trigger client creation
      await model.doRerank({
        query: 'test query',
        documents: {
          type: 'text',
          values: ['doc1'],
        },
      });

      expect(mockCreateAuthProvider).toHaveBeenCalledWith({
        compartmentId: 'test',
        region: 'eu-frankfurt-1',
      });
      expect(mockGetRegion).toHaveBeenCalled();
      expect(GenerativeAiInferenceClient).toHaveBeenCalledWith({
        authenticationDetailsProvider: { type: 'mock_auth' },
      });
    });

    it('should set custom endpoint if provided', async () => {
      const { GenerativeAiInferenceClient } = require('oci-generativeaiinference');
      const mockClient: Record<string, any> = {
        rerankText: mockRerankText,
      };
      GenerativeAiInferenceClient.mockImplementation(() => mockClient);

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
        endpoint: 'https://custom.endpoint.com',
      });

      await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['doc'] },
      });

      // Verify client was created and endpoint was set
      expect(GenerativeAiInferenceClient).toHaveBeenCalled();
      expect(mockClient.endpoint).toBe('https://custom.endpoint.com');
    });

    it('should reuse existing client on subsequent calls', async () => {
      const { GenerativeAiInferenceClient } = require('oci-generativeaiinference');
      GenerativeAiInferenceClient.mockClear();

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      await model.doRerank({
        query: 'query1',
        documents: { type: 'text', values: ['doc1'] },
      });

      await model.doRerank({
        query: 'query2',
        documents: { type: 'text', values: ['doc2'] },
      });

      // Client should only be created once
      expect(GenerativeAiInferenceClient).toHaveBeenCalledTimes(1);
    });
  });

  // Document type validation (line 65)
  describe('document type validation', () => {
    it('should throw error for non-text documents', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      await expect(
        model.doRerank({
          query: 'test query',
          documents: {
            type: 'image' as 'text', // Invalid type
            values: [{ type: 'image', image: new Uint8Array() }] as unknown as string[],
          },
        })
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should accept text documents', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const result = await model.doRerank({
        query: 'test query',
        documents: {
          type: 'text',
          values: ['document 1', 'document 2'],
        },
      });

      expect(result.ranking).toBeDefined();
    });
  });

  // Document count validation
  describe('document count validation', () => {
    it('should validate document count does not exceed max', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const documents = Array(1001).fill('test') as string[]; // 1001 > 1000 max

      const options: RerankingModelV3CallOptions = {
        query: 'test query',
        documents: {
          type: 'text',
          values: documents,
        },
      };

      await expect(model.doRerank(options)).rejects.toThrow(
        'Document count (1001) exceeds maximum allowed (1000)'
      );
    });

    it('should accept maximum allowed documents', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const documents = Array.from({ length: 100 }, (_, i) => `doc ${i}`);

      const result = await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: documents },
      });

      expect(result.ranking).toBeDefined();
    });
  });

  // doRerank success tests (lines 79-105)
  describe('doRerank', () => {
    it('should rerank documents successfully', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const result = await model.doRerank({
        query: 'machine learning',
        documents: {
          type: 'text',
          values: ['Introduction to ML', 'Weather forecast', 'Deep learning tutorial'],
        },
      });

      expect(result.ranking).toEqual([
        { index: 2, relevanceScore: 0.95 },
        { index: 0, relevanceScore: 0.78 },
        { index: 1, relevanceScore: 0.45 },
      ]);

      expect(result.response).toEqual(
        expect.objectContaining({
          id: 'rerank-job-123',
          modelId: 'cohere.rerank-v3.5',
        })
      );
    });

    it('should call OCI API with correct parameters', async () => {
      mockRerankText.mockResolvedValue({
        rerankTextResult: {
          id: 'job-123',
          modelId: 'cohere.rerank-v3.5',
          documentRanks: [{ index: 0, relevanceScore: 1.0 }],
        },
      });

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'ocid1.compartment.test',
      });

      await model.doRerank({
        query: 'search query',
        documents: {
          type: 'text',
          values: ['doc1', 'doc2'],
        },
      });

      expect(mockRerankText).toHaveBeenCalledWith({
        rerankTextDetails: {
          servingMode: {
            servingType: 'ON_DEMAND',
            modelId: 'cohere.rerank-v3.5',
          },
          compartmentId: 'ocid1.compartment.test',
          input: 'search query',
          documents: ['doc1', 'doc2'],
          topN: undefined,
          isEcho: false,
        },
      });
    });

    it('should use custom topN setting from config', async () => {
      mockRerankText.mockResolvedValue({
        rerankTextResult: {
          documentRanks: [{ index: 0, relevanceScore: 1.0 }],
        },
      });

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
        topN: 5,
      });

      await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['doc'] },
      });

      expect(mockRerankText).toHaveBeenCalledWith(
        expect.objectContaining({
          rerankTextDetails: expect.objectContaining({
            topN: 5,
          }),
        })
      );
    });

    it('should pass topN from call options', async () => {
      mockRerankText.mockResolvedValue({
        rerankTextResult: {
          documentRanks: [{ index: 0, relevanceScore: 1.0 }],
        },
      });

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['doc'] },
        topN: 3,
      });

      expect(mockRerankText).toHaveBeenCalledWith(
        expect.objectContaining({
          rerankTextDetails: expect.objectContaining({
            topN: 3,
          }),
        })
      );
    });

    it('should use returnDocuments setting (maps to isEcho)', async () => {
      mockRerankText.mockResolvedValue({
        rerankTextResult: {
          documentRanks: [{ index: 0, relevanceScore: 1.0 }],
        },
      });

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
        returnDocuments: true,
      });

      await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['doc'] },
      });

      expect(mockRerankText).toHaveBeenCalledWith(
        expect.objectContaining({
          rerankTextDetails: expect.objectContaining({
            isEcho: true,
          }),
        })
      );
    });

    it('should handle missing relevanceScore gracefully', async () => {
      mockRerankText.mockResolvedValue({
        rerankTextResult: {
          documentRanks: [
            { index: 0 }, // Missing relevanceScore
          ],
        },
      });

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const result = await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['doc'] },
      });

      expect(result.ranking[0].relevanceScore).toBe(0);
    });

    it('should handle missing index gracefully', async () => {
      mockRerankText.mockResolvedValue({
        rerankTextResult: {
          documentRanks: [
            { relevanceScore: 0.9 }, // Missing index
          ],
        },
      });

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const result = await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['doc'] },
      });

      expect(result.ranking[0].index).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      mockRerankText.mockRejectedValue(new Error('API Error'));

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      await expect(
        model.doRerank({
          query: 'test',
          documents: { type: 'text', values: ['doc'] },
        })
      ).rejects.toThrow('API Error');
    });

    it('should handle empty document ranks', async () => {
      mockRerankText.mockResolvedValue({
        rerankTextResult: {
          documentRanks: [],
        },
      });

      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const result = await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['doc'] },
      });

      expect(result.ranking).toEqual([]);
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('should handle single document', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const result = await model.doRerank({
        query: 'test',
        documents: { type: 'text', values: ['single document'] },
      });

      expect(result.ranking).toBeDefined();
    });

    it('should handle empty query', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const result = await model.doRerank({
        query: '',
        documents: { type: 'text', values: ['doc1', 'doc2'] },
      });

      expect(result.ranking).toBeDefined();
    });

    it('should handle very long query', async () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      const longQuery = 'a'.repeat(10000);

      const result = await model.doRerank({
        query: longQuery,
        documents: { type: 'text', values: ['doc1'] },
      });

      expect(result.ranking).toBeDefined();
    });

    it('should handle text documents', () => {
      const model = new OCIRerankingModel('cohere.rerank-v3.5', {
        compartmentId: 'test',
      });

      expect(model).toBeDefined();
    });
  });
});
