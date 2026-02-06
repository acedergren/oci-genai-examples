/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect } from '@jest/globals';
import {
  createMockOCIConfig,
  createMockOCIResponse,
  mockOCIError,
  waitForCondition,
} from '../test-helpers';

describe('Test Helpers', () => {
  describe('createMockOCIConfig', () => {
    it('should create valid mock config with defaults', () => {
      const config = createMockOCIConfig();

      expect(config.region).toBeDefined();
      expect(config.compartmentId).toBeDefined();
    });

    it('should allow overrides', () => {
      const config = createMockOCIConfig({
        region: 'us-ashburn-1',
      });

      expect(config.region).toBe('us-ashburn-1');
    });
  });

  describe('createMockOCIResponse', () => {
    it('should create mock language model response', () => {
      const response = createMockOCIResponse('language', {
        text: 'Hello world',
      });

      expect(response.chatResult).toBeDefined();
      expect(response.chatResult.chatResponse.text).toBe('Hello world');
    });

    it('should create mock embedding response', () => {
      const response = createMockOCIResponse('embedding', {
        embeddings: [[0.1, 0.2, 0.3]],
      });

      expect(response.embedTextResult).toBeDefined();
      expect(response.embedTextResult.embeddings).toHaveLength(1);
    });
  });

  describe('mockOCIError', () => {
    it('should create mock rate limit error', () => {
      const error = mockOCIError('RateLimit', 'Too many requests');

      expect(error.statusCode).toBe(429);
      expect(error.message).toContain('Too many requests');
    });

    it('should create mock authentication error', () => {
      const error = mockOCIError('Authentication', 'Invalid credentials');

      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('Invalid credentials');
    });
  });

  describe('waitForCondition', () => {
    it('should resolve when condition becomes true', async () => {
      let value = false;
      setTimeout(() => {
        value = true;
      }, 100);

      await expect(waitForCondition(() => value, 500)).resolves.toBe(undefined);
    });

    it('should timeout if condition never becomes true', async () => {
      await expect(waitForCondition(() => false, 100)).rejects.toThrow(
        'Condition not met within 100ms'
      );
    });
  });
});
