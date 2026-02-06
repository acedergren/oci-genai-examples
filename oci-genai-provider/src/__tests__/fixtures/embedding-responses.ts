/**
 * Common test fixtures for embedding responses
 */

export const EMBEDDING_FIXTURES = {
  singleEmbedding: {
    embedTextResult: {
      embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
    },
  },

  batchEmbeddings: {
    embedTextResult: {
      embeddings: [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ],
    },
  },

  maxBatchEmbeddings: {
    embedTextResult: {
      embeddings: Array.from({ length: 96 }, () => [0.1, 0.2, 0.3]),
    },
  },

  multilingualEmbedding: {
    embedTextResult: {
      embeddings: [Array(1024).fill(0.1)],
    },
  },

  lightEmbedding: {
    embedTextResult: {
      embeddings: [Array(384).fill(0.1)],
    },
  },
};

export const EMBEDDING_REQUESTS = {
  single: {
    embedTextDetails: {
      servingMode: {
        servingType: 'ON_DEMAND',
        modelId: 'cohere.embed-multilingual-v3.0',
      },
      inputs: ['Hello world'],
      truncate: 'END',
      inputType: 'DOCUMENT',
    },
  },

  batch: {
    embedTextDetails: {
      servingMode: {
        servingType: 'ON_DEMAND',
        modelId: 'cohere.embed-multilingual-v3.0',
      },
      inputs: ['Text 1', 'Text 2', 'Text 3'],
      truncate: 'END',
      inputType: 'DOCUMENT',
    },
  },
};
