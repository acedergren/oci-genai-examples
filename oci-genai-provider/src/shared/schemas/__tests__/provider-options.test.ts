import { describe, it, expect } from '@jest/globals';
import {
  OCIProviderOptionsSchema,
  parseProviderOptions,
  type OCIProviderOptions,
} from '../provider-options';
import { OCIValidationError } from '../../errors';

describe('OCIProviderOptionsSchema', () => {
  describe('valid options', () => {
    it('should accept empty options', () => {
      const result = OCIProviderOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept valid reasoningEffort values', () => {
      const efforts = ['none', 'minimal', 'low', 'medium', 'high'] as const;
      for (const effort of efforts) {
        const result = OCIProviderOptionsSchema.safeParse({ reasoningEffort: effort });
        expect(result.success).toBe(true);
      }
    });

    it('should accept thinking with tokenBudget', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        thinking: true,
        tokenBudget: 1024,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.thinking).toBe(true);
        expect(result.data.tokenBudget).toBe(1024);
      }
    });

    it('should accept valid servingMode object', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'ON_DEMAND', modelId: 'cohere.command-r-plus' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept dedicated servingMode with endpointId', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'DEDICATED', endpointId: 'ocid1.endpoint.oc1..aaaa' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid endpoint URL', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        endpoint: 'https://inference.generativeai.us-chicago-1.oci.oraclecloud.com',
      });
      expect(result.success).toBe(true);
    });

    it('should accept compartmentId', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        compartmentId: 'ocid1.compartment.oc1..aaaa',
      });
      expect(result.success).toBe(true);
    });

    it('should accept requestOptions', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        requestOptions: {
          timeoutMs: 30000,
          retry: {
            enabled: true,
            maxRetries: 3,
          },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid options', () => {
    it('should reject invalid reasoningEffort', () => {
      const result = OCIProviderOptionsSchema.safeParse({ reasoningEffort: 'maximum' });
      expect(result.success).toBe(false);
    });

    it('should reject negative tokenBudget', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        thinking: true,
        tokenBudget: -100,
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero tokenBudget', () => {
      const result = OCIProviderOptionsSchema.safeParse({ thinking: true, tokenBudget: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer tokenBudget', () => {
      const result = OCIProviderOptionsSchema.safeParse({ thinking: true, tokenBudget: 1024.5 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid servingMode type', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'HYBRID' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject servingMode as string', () => {
      const result = OCIProviderOptionsSchema.safeParse({ servingMode: 'ON_DEMAND' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid endpoint URL', () => {
      const result = OCIProviderOptionsSchema.safeParse({ endpoint: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid requestOptions.timeoutMs', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        requestOptions: { timeoutMs: -1000 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('discriminated union for servingMode', () => {
    it('should require modelId for ON_DEMAND serving mode', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'ON_DEMAND' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Error should reference the modelId path
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths.some((p) => p.includes('modelId'))).toBe(true);
      }
    });

    it('should require endpointId for DEDICATED serving mode', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'DEDICATED' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Error should reference the endpointId path
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths.some((p) => p.includes('endpointId'))).toBe(true);
      }
    });

    it('should accept ON_DEMAND with modelId', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'ON_DEMAND', modelId: 'cohere.command-r-plus' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept DEDICATED with endpointId', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'DEDICATED', endpointId: 'ocid1.endpoint.oc1..aaaa' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('strict mode - unknown keys rejected', () => {
    it('should reject unknown top-level keys', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        reasoningEffort: 'high',
        unknownKey: 'value',
      });
      expect(result.success).toBe(false);
    });

    it('should reject unknown keys in requestOptions', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        requestOptions: {
          timeoutMs: 30000,
          unknownOption: true,
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject unknown keys in retry config', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        requestOptions: {
          retry: {
            enabled: true,
            unknownRetryOption: 5,
          },
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('cross-field validation', () => {
    it('should reject tokenBudget without thinking enabled', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        tokenBudget: 1024,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('thinking');
      }
    });

    it('should reject tokenBudget when thinking is false', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        thinking: false,
        tokenBudget: 1024,
      });
      expect(result.success).toBe(false);
    });

    it('should accept tokenBudget when thinking is true', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        thinking: true,
        tokenBudget: 1024,
      });
      expect(result.success).toBe(true);
    });

    it('should accept thinking without tokenBudget', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        thinking: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('parseProviderOptions helper', () => {
    it('should return validated options', () => {
      const result = parseProviderOptions({ reasoningEffort: 'high' });
      expect(result.reasoningEffort).toBe('high');
    });

    it('should throw OCIValidationError for invalid options', () => {
      expect(() => parseProviderOptions({ reasoningEffort: 'invalid' })).toThrow(
        OCIValidationError
      );
    });

    it('should include error details in OCIValidationError', () => {
      try {
        parseProviderOptions({ reasoningEffort: 'invalid' });
        fail('Expected OCIValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OCIValidationError);
        expect((error as OCIValidationError).details).toBeDefined();
        expect((error as OCIValidationError).details?.issues).toBeInstanceOf(Array);
      }
    });

    it('should handle undefined gracefully', () => {
      const result = parseProviderOptions(undefined);
      expect(result).toEqual({});
    });

    it('should handle null gracefully', () => {
      const result = parseProviderOptions(null);
      expect(result).toEqual({});
    });

    it('should validate nested requestOptions', () => {
      const result = parseProviderOptions({
        requestOptions: {
          timeoutMs: 30000,
          retry: { enabled: true, maxRetries: 3 },
        },
      });
      expect(result.requestOptions?.timeoutMs).toBe(30000);
      expect(result.requestOptions?.retry?.maxRetries).toBe(3);
    });
  });

  describe('type inference', () => {
    it('should correctly infer types from schema', () => {
      const options: OCIProviderOptions = {
        reasoningEffort: 'high',
        thinking: true,
        tokenBudget: 2048,
        servingMode: { type: 'ON_DEMAND', modelId: 'cohere.command-r-plus' },
      };
      expect(options.reasoningEffort).toBe('high');
    });

    it('should narrow servingMode type based on discriminator', () => {
      const result = OCIProviderOptionsSchema.safeParse({
        servingMode: { type: 'DEDICATED', endpointId: 'ocid1.endpoint.oc1..aaaa' },
      });
      expect(result.success).toBe(true);
      if (result.success && result.data.servingMode) {
        // TypeScript should narrow the type here
        if (result.data.servingMode.type === 'DEDICATED') {
          expect(result.data.servingMode.endpointId).toBe('ocid1.endpoint.oc1..aaaa');
        }
      }
    });
  });
});
