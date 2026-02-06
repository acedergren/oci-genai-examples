/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockGenerativeAiInferenceClient, mockAuthProvider, resetAllMocks } from '../oci-mocks';

describe('OCI Mocks', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('mockGenerativeAiInferenceClient', () => {
    it('should create mock client with default responses', () => {
      const client = mockGenerativeAiInferenceClient();

      expect(client.chat).toBeDefined();
      expect(client.embedText).toBeDefined();
    });

    it('should allow custom response setup', () => {
      const client = mockGenerativeAiInferenceClient({
        chatResponse: { text: 'Custom response' },
      });

      expect(client).toBeDefined();
    });

    it('should have chat method callable', async () => {
      const client = mockGenerativeAiInferenceClient();

      const result = await client.chat({ chatDetails: {} });
      expect(result).toBeDefined();
      expect(result.chatResult).toBeDefined();
    });
  });

  describe('mockAuthProvider', () => {
    it('should create valid auth provider mock', async () => {
      const authProvider = mockAuthProvider();

      expect(authProvider).toBeDefined();
      expect(authProvider.getKeyId).toBeDefined();

      const keyId = await authProvider.getKeyId();
      expect(keyId).toContain('ocid1.tenancy');
    });
  });

  describe('resetAllMocks', () => {
    it('should be callable without error', () => {
      resetAllMocks();
      expect(true).toBe(true);
    });
  });
});
