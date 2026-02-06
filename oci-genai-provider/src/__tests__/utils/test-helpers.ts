/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-template-expressions, @typescript-eslint/require-await */
/**
 * Shared test utilities and helpers
 */

/**
 * Create a mock OCI config for testing
 */
export function createMockOCIConfig(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    region: 'eu-frankfurt-1',
    compartmentId: 'ocid1.compartment.oc1..aaaaaaatest',
    profile: 'DEFAULT',
    auth: 'config_file',
    ...overrides,
  };
}

/**
 * Create mock OCI API response
 */
export function createMockOCIResponse(
  type: 'language' | 'embedding' | 'speech' | 'transcription' | 'reranking',
  data: any
): any {
  switch (type) {
    case 'language':
      return {
        chatResult: {
          chatResponse: {
            text: data.text || 'Mock response',
            finishReason: data.finishReason || 'COMPLETE',
          },
        },
      };

    case 'embedding':
      return {
        embedTextResult: {
          embeddings: data.embeddings || [[0.1, 0.2, 0.3]],
        },
      };

    case 'speech':
      return {
        synthesizeSpeechResult: {
          audioContent: data.audioContent || Buffer.from('mock-audio'),
        },
      };

    case 'transcription':
      return {
        transcribeResult: {
          transcription: data.transcription || 'Mock transcription',
        },
      };

    case 'reranking':
      return {
        rerankResult: {
          rankings: data.rankings || [{ index: 0, relevanceScore: 0.9 }],
        },
      };

    default:
      throw new Error(`Unknown mock response type: ${type}`);
  }
}

/**
 * Create mock OCI error
 */
export function mockOCIError(
  type: 'RateLimit' | 'Authentication' | 'NotFound' | 'Network',
  message?: string
): Error & { statusCode: number } {
  const errors = {
    RateLimit: { statusCode: 429, message: message || 'Rate limit exceeded' },
    Authentication: { statusCode: 401, message: message || 'Authentication failed' },
    NotFound: { statusCode: 404, message: message || 'Model not found' },
    Network: { statusCode: 503, message: message || 'Service unavailable' },
  };

  const errorData = errors[type];
  const error = new Error(errorData.message) as Error & { statusCode: number };
  error.statusCode = errorData.statusCode;

  return error;
}

/**
 * Wait for a condition to become true (useful for async tests)
 */
export async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Create a mock streaming response in the 2025+ OCI format
 */
export function createMockStreamChunks(texts: string[]): string[] {
  return texts.map(
    (text) =>
      `data: ${JSON.stringify({
        message: {
          content: [{ type: 'TEXT', text }],
        },
      })}\n\n`
  );
}

/**
 * Create a ReadableStream from string chunks
 */
export function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/**
 * Mock OCI client for testing
 */
export class MockOCIClient {
  public callCount = 0;
  public lastRequest: any = null;

  async chat(request: any): Promise<any> {
    this.callCount++;
    this.lastRequest = request;
    return createMockOCIResponse('language', { text: 'Mock response' });
  }

  async embedText(request: any): Promise<any> {
    this.callCount++;
    this.lastRequest = request;
    return createMockOCIResponse('embedding', {
      embeddings: request.embedTextDetails?.inputs?.map(() => [0.1, 0.2, 0.3]) || [[0.1, 0.2, 0.3]],
    });
  }

  reset(): void {
    this.callCount = 0;
    this.lastRequest = null;
  }
}
