/**
 * Common test fixtures for language model responses
 */

export const LANGUAGE_MODEL_FIXTURES = {
  simpleCompletion: {
    chatResult: {
      chatResponse: {
        text: 'Hello! How can I help you today?',
        finishReason: 'COMPLETE',
      },
    },
  },

  longCompletion: {
    chatResult: {
      chatResponse: {
        text: 'This is a long response. '.repeat(100),
        finishReason: 'COMPLETE',
      },
    },
  },

  truncatedResponse: {
    chatResult: {
      chatResponse: {
        text: 'This response was truncated due to max tokens',
        finishReason: 'MAX_TOKENS',
      },
    },
  },

  streamChunks: [
    { chatResponse: { text: 'Hello' }, finishReason: null },
    { chatResponse: { text: ' world' }, finishReason: null },
    { chatResponse: { text: '!' }, finishReason: null },
    { chatResponse: { text: '' }, finishReason: 'COMPLETE' },
  ],

  errorResponse: {
    statusCode: 429,
    message: 'Rate limit exceeded. Please try again later.',
  },
};

export const LANGUAGE_MODEL_REQUESTS = {
  simple: {
    chatDetails: {
      servingMode: {
        servingType: 'ON_DEMAND',
        modelId: 'cohere.command-r-plus',
      },
      chatRequest: {
        message: 'Hello',
        maxTokens: 100,
        temperature: 0.7,
      },
    },
  },
};
