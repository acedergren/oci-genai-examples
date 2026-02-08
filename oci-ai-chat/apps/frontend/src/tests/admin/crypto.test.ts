/**
 * Tests for AES-256-GCM encryption utilities
 *
 * @module tests/admin/crypto
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	encryptSecret,
	decryptSecret,
	_clearKeyCache,
	type EncryptedSecret
} from '$lib/server/auth/crypto.js';

describe('crypto.ts - AES-256-GCM Encryption', () => {
	const originalSecret = process.env.BETTER_AUTH_SECRET;

	beforeEach(() => {
		// Ensure we have a test secret
		process.env.BETTER_AUTH_SECRET = 'test-secret-key-at-least-32-bytes-long-for-security';
		_clearKeyCache();
	});

	afterEach(() => {
		// Restore original secret
		process.env.BETTER_AUTH_SECRET = originalSecret;
		_clearKeyCache();
	});

	describe('encryptSecret', () => {
		it('encrypts a plaintext string and returns encrypted data, IV, and tag', async () => {
			const plaintext = 'my-secret-api-key';
			const result = await encryptSecret(plaintext);

			expect(result).toHaveProperty('encrypted');
			expect(result).toHaveProperty('iv');
			expect(result).toHaveProperty('tag');

			expect(result.encrypted).toBeInstanceOf(Buffer);
			expect(result.iv).toBeInstanceOf(Buffer);
			expect(result.tag).toBeInstanceOf(Buffer);

			// Verify lengths
			expect(result.iv.length).toBe(12); // 96 bits
			expect(result.tag.length).toBe(16); // 128 bits
			expect(result.encrypted.length).toBeGreaterThan(0);
		});

		it('produces different ciphertext for the same plaintext (unique IVs)', async () => {
			const plaintext = 'same-secret-twice';

			const result1 = await encryptSecret(plaintext);
			const result2 = await encryptSecret(plaintext);

			// IVs should be different (random)
			expect(result1.iv).not.toEqual(result2.iv);

			// Ciphertext should be different due to different IVs
			expect(result1.encrypted).not.toEqual(result2.encrypted);
		});

		it('throws error for empty plaintext', async () => {
			await expect(encryptSecret('')).rejects.toThrow('Cannot encrypt empty plaintext');
		});

		it('throws error when BETTER_AUTH_SECRET is not set', async () => {
			delete process.env.BETTER_AUTH_SECRET;
			_clearKeyCache();

			await expect(encryptSecret('test')).rejects.toThrow(
				'BETTER_AUTH_SECRET environment variable is required for encryption'
			);
		});

		it('encrypts different plaintexts to different ciphertexts', async () => {
			const plaintext1 = 'secret-one';
			const plaintext2 = 'secret-two';

			const result1 = await encryptSecret(plaintext1);
			const result2 = await encryptSecret(plaintext2);

			expect(result1.encrypted).not.toEqual(result2.encrypted);
		});
	});

	describe('decryptSecret', () => {
		it('decrypts data encrypted with encryptSecret and returns original plaintext', async () => {
			const plaintext = 'my-api-key-12345';

			const { encrypted, iv, tag } = await encryptSecret(plaintext);
			const decrypted = await decryptSecret(encrypted, iv, tag);

			expect(decrypted).toBe(plaintext);
		});

		it('handles multi-byte UTF-8 characters correctly', async () => {
			const plaintext = 'Password: 🔒 émojis & spëciål chārs';

			const { encrypted, iv, tag } = await encryptSecret(plaintext);
			const decrypted = await decryptSecret(encrypted, iv, tag);

			expect(decrypted).toBe(plaintext);
		});

		it('throws error if ciphertext is tampered with', async () => {
			const plaintext = 'secret-data';

			const { encrypted, iv, tag } = await encryptSecret(plaintext);

			// Tamper with ciphertext
			const tampered = Buffer.from(encrypted);
			tampered[0] = tampered[0] ^ 0xff; // Flip all bits in first byte

			await expect(decryptSecret(tampered, iv, tag)).rejects.toThrow('Decryption failed');
		});

		it('throws error if IV is tampered with', async () => {
			const plaintext = 'secret-data';

			const { encrypted, iv, tag } = await encryptSecret(plaintext);

			// Tamper with IV
			const tamperedIv = Buffer.from(iv);
			tamperedIv[0] = tamperedIv[0] ^ 0xff;

			await expect(decryptSecret(encrypted, tamperedIv, tag)).rejects.toThrow('Decryption failed');
		});

		it('throws error if authentication tag is tampered with', async () => {
			const plaintext = 'secret-data';

			const { encrypted, iv, tag } = await encryptSecret(plaintext);

			// Tamper with tag
			const tamperedTag = Buffer.from(tag);
			tamperedTag[0] = tamperedTag[0] ^ 0xff;

			await expect(decryptSecret(encrypted, iv, tamperedTag)).rejects.toThrow('Decryption failed');
		});

		it('throws error when encrypted component is missing', async () => {
			const plaintext = 'test';
			const { iv, tag } = await encryptSecret(plaintext);

			await expect(decryptSecret(null as any, iv, tag)).rejects.toThrow(
				'Missing required decryption components'
			);
		});

		it('throws error when IV is missing', async () => {
			const plaintext = 'test';
			const { encrypted, tag } = await encryptSecret(plaintext);

			await expect(decryptSecret(encrypted, null as any, tag)).rejects.toThrow(
				'Missing required decryption components'
			);
		});

		it('throws error when tag is missing', async () => {
			const plaintext = 'test';
			const { encrypted, iv } = await encryptSecret(plaintext);

			await expect(decryptSecret(encrypted, iv, null as any)).rejects.toThrow(
				'Missing required decryption components'
			);
		});

		it('throws error when IV has invalid length', async () => {
			const plaintext = 'test';
			const { encrypted, tag } = await encryptSecret(plaintext);

			const wrongIv = Buffer.alloc(16); // Wrong size (should be 12)

			await expect(decryptSecret(encrypted, wrongIv, tag)).rejects.toThrow('Invalid IV length');
		});

		it('throws error when tag has invalid length', async () => {
			const plaintext = 'test';
			const { encrypted, iv } = await encryptSecret(plaintext);

			const wrongTag = Buffer.alloc(32); // Wrong size (should be 16)

			await expect(decryptSecret(encrypted, iv, wrongTag)).rejects.toThrow('Invalid tag length');
		});

		it('throws error when BETTER_AUTH_SECRET is not set', async () => {
			const plaintext = 'test';
			const { encrypted, iv, tag } = await encryptSecret(plaintext);

			delete process.env.BETTER_AUTH_SECRET;
			_clearKeyCache();

			await expect(decryptSecret(encrypted, iv, tag)).rejects.toThrow(
				'BETTER_AUTH_SECRET environment variable is required for encryption'
			);
		});
	});

	describe('key derivation and caching', () => {
		it('uses consistent key derivation (same secret produces same key)', async () => {
			const plaintext = 'test-secret';

			// Encrypt with first key derivation
			const { encrypted, iv, tag } = await encryptSecret(plaintext);

			// Decrypt should work (key is cached)
			const decrypted1 = await decryptSecret(encrypted, iv, tag);
			expect(decrypted1).toBe(plaintext);

			// Clear cache and decrypt again (forces re-derivation)
			_clearKeyCache();
			const decrypted2 = await decryptSecret(encrypted, iv, tag);
			expect(decrypted2).toBe(plaintext);
		});

		it('_clearKeyCache forces key re-derivation', async () => {
			const plaintext = 'test';

			// Encrypt (derives key)
			const result1 = await encryptSecret(plaintext);

			// Change secret and clear cache
			process.env.BETTER_AUTH_SECRET = 'different-secret-key-at-least-32-bytes-long-for-testing';
			_clearKeyCache();

			// Encrypt with new key
			const result2 = await encryptSecret(plaintext);

			// Different keys should produce different ciphertexts
			expect(result1.encrypted).not.toEqual(result2.encrypted);

			// First result should NOT decrypt with new key
			await expect(decryptSecret(result1.encrypted, result1.iv, result1.tag)).rejects.toThrow();
		});

		it('reuses cached key for multiple operations (performance)', async () => {
			const plaintext1 = 'first-secret';
			const plaintext2 = 'second-secret';

			// First encryption derives key
			await encryptSecret(plaintext1);

			// Second encryption should reuse cached key (we can't directly test this,
			// but we verify it doesn't error and produces valid output)
			const result2 = await encryptSecret(plaintext2);
			const decrypted = await decryptSecret(result2.encrypted, result2.iv, result2.tag);

			expect(decrypted).toBe(plaintext2);
		});
	});

	describe('round-trip encryption/decryption', () => {
		const testCases = [
			{ name: 'short string', plaintext: 'abc' },
			{ name: 'empty-ish (single space)', plaintext: ' ' },
			{ name: 'long string', plaintext: 'a'.repeat(1000) },
			{ name: 'special characters', plaintext: '!@#$%^&*()[]{}|\\:;"\'<>,.?/~`' },
			{ name: 'newlines and tabs', plaintext: 'line1\nline2\ttabbed' },
			{ name: 'unicode emoji', plaintext: '🔒🚀🎉' },
			{ name: 'JSON string', plaintext: JSON.stringify({ key: 'value', nested: { data: 123 } }) }
		];

		testCases.forEach(({ name, plaintext }) => {
			it(`round-trip: ${name}`, async () => {
				const { encrypted, iv, tag } = await encryptSecret(plaintext);
				const decrypted = await decryptSecret(encrypted, iv, tag);

				expect(decrypted).toBe(plaintext);
			});
		});
	});

	describe('EncryptedSecret type', () => {
		it('returns object matching EncryptedSecret interface', async () => {
			const result = await encryptSecret('test');

			// Type checking (TypeScript validates this at compile time)
			const typed: EncryptedSecret = result;

			expect(typed.encrypted).toBeInstanceOf(Buffer);
			expect(typed.iv).toBeInstanceOf(Buffer);
			expect(typed.tag).toBeInstanceOf(Buffer);
		});
	});
});
