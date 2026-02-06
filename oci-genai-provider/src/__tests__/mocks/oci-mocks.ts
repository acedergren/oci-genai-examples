/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/explicit-function-return-type */
import { createMockOCIResponse } from '../utils/test-helpers';

/**
 * Mock GenerativeAiInferenceClient
 */
export function mockGenerativeAiInferenceClient(
  options: {
    chatResponse?: any;
    embedResponse?: any;
    shouldError?: boolean;
    errorType?: 'RateLimit' | 'Authentication' | 'Network';
  } = {}
): any {
  const mock = {
    region: 'eu-frankfurt-1',
    endpoint: 'https://inference.generativeai.eu-frankfurt-1.oci.oraclecloud.com',

    chat: async () => {
      if (options.shouldError) {
        throw createMockError(options.errorType || 'Network');
      }
      return createMockOCIResponse('language', options.chatResponse || {});
    },

    embedText: async () => {
      if (options.shouldError) {
        throw createMockError(options.errorType || 'Network');
      }
      return createMockOCIResponse('embedding', options.embedResponse || {});
    },

    chatStream: async function* () {
      if (options.shouldError) {
        throw createMockError(options.errorType || 'Network');
      }

      const chunks = ['Hello', ' ', 'world', '!'];
      for (const chunk of chunks) {
        yield {
          chatResponse: { text: chunk },
          finishReason: null,
        };
      }
      yield {
        chatResponse: { text: '' },
        finishReason: 'COMPLETE',
      };
    },
  };

  return mock;
}

/**
 * Mock AuthenticationDetailsProvider
 */
export function mockAuthProvider(): any {
  return {
    getKeyId: () => Promise.resolve('ocid1.tenancy.oc1..test/ocid1.user.oc1..test/fingerprint'),
    getTenancyId: () => Promise.resolve('ocid1.tenancy.oc1..test'),
    getUserId: () => Promise.resolve('ocid1.user.oc1..test'),
    getFingerprint: () => Promise.resolve('test:fingerprint'),
    getPassphrase: () => Promise.resolve(null),
    getPrivateKey: () =>
      Promise.resolve('-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----'),
  };
}

/**
 * Create a mock error with proper structure
 */
function createMockError(type: string): Error & { statusCode: number } {
  const errorMap = {
    RateLimit: { statusCode: 429, message: 'Rate limit exceeded' },
    Authentication: { statusCode: 401, message: 'Authentication failed' },
    Network: { statusCode: 503, message: 'Network error' },
  };

  const errorData = errorMap[type as keyof typeof errorMap] || errorMap.Network;
  const error = new Error(errorData.message) as Error & { statusCode: number };
  error.statusCode = errorData.statusCode;

  return error;
}

/**
 * Reset all mocks (call in beforeEach)
 */
export function resetAllMocks(): void {
  // No-op for non-Jest mocks
}

/**
 * Mock OCI SDK modules
 */
export const mockOCIModules = () => {
  // Mock setup for modules if needed
};
