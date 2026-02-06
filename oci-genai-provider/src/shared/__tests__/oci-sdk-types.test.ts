import { describe, it, expect } from '@jest/globals';
import type {
  OCIReasoningEffort,
  OCIThinkingType,
  OCIApiFormat,
  OCICompletionTokensDetails,
} from '../oci-sdk-types';
import { toOCIReasoningEffort, createThinkingConfig, isValidApiFormat } from '../oci-sdk-types';

describe('OCI SDK Types', () => {
  describe('OCIReasoningEffort', () => {
    it('should accept valid reasoning effort values', () => {
      const efforts: OCIReasoningEffort[] = ['NONE', 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];
      expect(efforts).toHaveLength(5);
    });
  });

  describe('OCIThinkingType', () => {
    it('should accept ENABLED and DISABLED', () => {
      const types: OCIThinkingType[] = ['ENABLED', 'DISABLED'];
      expect(types).toHaveLength(2);
    });
  });

  describe('OCIApiFormat', () => {
    it('should accept valid API formats', () => {
      const formats: OCIApiFormat[] = ['GENERIC', 'COHERE', 'COHEREV2'];
      expect(formats).toHaveLength(3);
    });
  });

  describe('OCICompletionTokensDetails', () => {
    it('should have optional fields', () => {
      const details: OCICompletionTokensDetails = {};
      expect(details.reasoningTokens).toBeUndefined();
      expect(details.acceptedPredictionTokens).toBeUndefined();
    });

    it('should accept all token detail fields', () => {
      const details: OCICompletionTokensDetails = {
        reasoningTokens: 100,
        acceptedPredictionTokens: 50,
        rejectedPredictionTokens: 10,
      };
      expect(details.reasoningTokens).toBe(100);
    });
  });

  describe('toOCIReasoningEffort', () => {
    it('should convert lowercase to uppercase', () => {
      expect(toOCIReasoningEffort('high')).toBe('HIGH');
      expect(toOCIReasoningEffort('low')).toBe('LOW');
    });

    it('should return MEDIUM for invalid values', () => {
      expect(toOCIReasoningEffort('invalid')).toBe('MEDIUM');
    });
  });

  describe('createThinkingConfig', () => {
    it('should create ENABLED config when true', () => {
      const config = createThinkingConfig(true, 1000);
      expect(config.type).toBe('ENABLED');
      expect(config.tokenBudget).toBe(1000);
    });

    it('should create DISABLED config when false', () => {
      const config = createThinkingConfig(false);
      expect(config.type).toBe('DISABLED');
    });
  });

  describe('isValidApiFormat', () => {
    it('should return true for valid formats', () => {
      expect(isValidApiFormat('GENERIC')).toBe(true);
      expect(isValidApiFormat('COHERE')).toBe(true);
      expect(isValidApiFormat('COHEREV2')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(isValidApiFormat('invalid')).toBe(false);
      expect(isValidApiFormat(null)).toBe(false);
    });
  });
});
