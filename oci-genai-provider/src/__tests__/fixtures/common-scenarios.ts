/**
 * Common test scenarios across all model types
 */

export const COMMON_SCENARIOS = {
  configs: {
    frankfurt: {
      region: 'eu-frankfurt-1',
      compartmentId: 'ocid1.compartment.oc1..aaaaaaatest',
      profile: 'FRANKFURT',
    },
    stockholm: {
      region: 'eu-stockholm-1',
      compartmentId: 'ocid1.compartment.oc1..aaaaaaatest',
      profile: 'STOCKHOLM',
    },
    ashburn: {
      region: 'us-ashburn-1',
      compartmentId: 'ocid1.compartment.oc1..aaaaaaatest',
      profile: 'ASHBURN',
    },
  },

  errors: {
    rateLimit: {
      statusCode: 429,
      message: 'TooManyRequests: Rate limit exceeded',
    },
    authentication: {
      statusCode: 401,
      message: 'NotAuthenticated: Invalid credentials',
    },
    notFound: {
      statusCode: 404,
      message: 'NotAuthorizedOrNotFound: Model not found',
    },
    serviceUnavailable: {
      statusCode: 503,
      message: 'ServiceUnavailable: Service temporarily unavailable',
    },
  },

  messages: {
    simple: [{ role: 'user' as const, content: 'Hello' }],
    conversation: [
      { role: 'user' as const, content: 'What is 2+2?' },
      { role: 'assistant' as const, content: '4' },
      { role: 'user' as const, content: 'And 3+3?' },
    ],
  },

  modelIds: {
    language: {
      cohere: ['cohere.command-r-plus', 'cohere.command-r', 'cohere.command-r-plus-08-2024'],
      meta: ['meta.llama-3.3-70b', 'meta.llama-3.1-405b', 'meta.llama-3.1-70b'],
    },
    embedding: [
      'cohere.embed-multilingual-v3.0',
      'cohere.embed-english-v3.0',
      'cohere.embed-english-light-v3.0',
    ],
  },
};
