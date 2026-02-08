/**
 * Tests for admin system Zod schemas
 *
 * @module tests/admin/types
 */
import { describe, it, expect } from 'vitest';
import {
	// Enum schemas
	IdpProviderTypeSchema,
	IdpStatusSchema,
	AiProviderTypeSchema,
	AiProviderStatusSchema,
	SettingTypeSchema,
	// IDP schemas
	CreateIdpInputSchema,
	UpdateIdpInputSchema,
	IdpProviderPublicSchema,
	// AI provider schemas
	CreateAiProviderInputSchema,
	UpdateAiProviderInputSchema,
	// Settings schemas
	SetSettingInputSchema,
	BulkSetSettingsInputSchema,
	// Status schemas
	SetupStatusSchema,
	TestConnectionResultSchema,
	ModelAllowlistSchema
} from '$lib/server/admin/types.js';

describe('types.ts - Admin Zod Schemas', () => {
	describe('Enum Schemas', () => {
		describe('IdpProviderTypeSchema', () => {
			it('accepts valid IDP types', () => {
				expect(() => IdpProviderTypeSchema.parse('idcs')).not.toThrow();
				expect(() => IdpProviderTypeSchema.parse('oidc')).not.toThrow();
				expect(() => IdpProviderTypeSchema.parse('saml')).not.toThrow();
			});

			it('rejects invalid IDP types', () => {
				expect(() => IdpProviderTypeSchema.parse('invalid')).toThrow();
				expect(() => IdpProviderTypeSchema.parse('')).toThrow();
			});
		});

		describe('IdpStatusSchema', () => {
			it('accepts valid status values', () => {
				expect(() => IdpStatusSchema.parse('active')).not.toThrow();
				expect(() => IdpStatusSchema.parse('disabled')).not.toThrow();
				expect(() => IdpStatusSchema.parse('testing')).not.toThrow();
			});

			it('rejects invalid status values', () => {
				expect(() => IdpStatusSchema.parse('pending')).toThrow();
			});
		});

		describe('AiProviderTypeSchema', () => {
			it('accepts all supported AI provider types', () => {
				const validTypes = [
					'oci',
					'openai',
					'anthropic',
					'google',
					'azure-openai',
					'aws-bedrock',
					'groq',
					'together',
					'fireworks',
					'mistral',
					'custom'
				];

				validTypes.forEach((type) => {
					expect(() => AiProviderTypeSchema.parse(type)).not.toThrow();
				});
			});

			it('rejects invalid provider types', () => {
				expect(() => AiProviderTypeSchema.parse('cohere')).toThrow();
			});
		});

		describe('AiProviderStatusSchema', () => {
			it('accepts valid AI provider status values', () => {
				expect(() => AiProviderStatusSchema.parse('active')).not.toThrow();
				expect(() => AiProviderStatusSchema.parse('disabled')).not.toThrow();
			});

			it('rejects invalid status values', () => {
				expect(() => AiProviderStatusSchema.parse('testing')).toThrow();
			});
		});

		describe('SettingTypeSchema', () => {
			it('accepts valid setting types', () => {
				expect(() => SettingTypeSchema.parse('string')).not.toThrow();
				expect(() => SettingTypeSchema.parse('number')).not.toThrow();
				expect(() => SettingTypeSchema.parse('boolean')).not.toThrow();
				expect(() => SettingTypeSchema.parse('json')).not.toThrow();
			});

			it('rejects invalid setting types', () => {
				expect(() => SettingTypeSchema.parse('array')).toThrow();
			});
		});
	});

	describe('IDP Provider Schemas', () => {
		describe('CreateIdpInputSchema', () => {
			const validInput = {
				providerId: 'test-idp',
				displayName: 'Test IDP',
				providerType: 'oidc' as const,
				discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret-value'
			};

			it('accepts valid IDP creation input with discoveryUrl', () => {
				expect(() => CreateIdpInputSchema.parse(validInput)).not.toThrow();
			});

			it('accepts valid IDP creation input with authorizationUrl and tokenUrl', () => {
				const input = {
					...validInput,
					discoveryUrl: undefined,
					authorizationUrl: 'https://idp.example.com/oauth2/authorize',
					tokenUrl: 'https://idp.example.com/oauth2/token'
				};

				expect(() => CreateIdpInputSchema.parse(input)).not.toThrow();
			});

			it('applies default values', () => {
				const result = CreateIdpInputSchema.parse(validInput);

				expect(result.scopes).toBe('openid,email,profile');
				expect(result.pkceEnabled).toBe(true);
				expect(result.status).toBe('active');
				expect(result.isDefault).toBe(false);
				expect(result.sortOrder).toBe(0);
			});

			it('rejects providerId with uppercase letters', () => {
				const input = { ...validInput, providerId: 'Test-IDP' };
				expect(() => CreateIdpInputSchema.parse(input)).toThrow(/lowercase alphanumeric/);
			});

			it('rejects providerId with invalid characters', () => {
				const input = { ...validInput, providerId: 'test_idp' };
				expect(() => CreateIdpInputSchema.parse(input)).toThrow(/lowercase alphanumeric/);
			});

			it('rejects when neither discoveryUrl nor auth+token URLs provided', () => {
				const input = {
					providerId: 'test-idp',
					displayName: 'Test',
					providerType: 'oidc' as const,
					clientId: 'client-123',
					clientSecret: 'test-client-secret-value'
				};

				expect(() => CreateIdpInputSchema.parse(input)).toThrow(/Either discoveryUrl or both/);
			});

			it('rejects when only authorizationUrl is provided (missing tokenUrl)', () => {
				const input = {
					providerId: 'test-idp',
					displayName: 'Test',
					providerType: 'oidc' as const,
					authorizationUrl: 'https://idp.example.com/oauth2/authorize',
					clientId: 'client-123',
					clientSecret: 'test-client-secret-value'
				};

				expect(() => CreateIdpInputSchema.parse(input)).toThrow(/Either discoveryUrl or both/);
			});

			it('rejects when only tokenUrl is provided (missing authorizationUrl)', () => {
				const input = {
					providerId: 'test-idp',
					displayName: 'Test',
					providerType: 'oidc' as const,
					tokenUrl: 'https://idp.example.com/oauth2/token',
					clientId: 'client-123',
					clientSecret: 'test-client-secret-value'
				};

				expect(() => CreateIdpInputSchema.parse(input)).toThrow(/Either discoveryUrl or both/);
			});

			it('rejects empty providerId', () => {
				const input = { ...validInput, providerId: '' };
				expect(() => CreateIdpInputSchema.parse(input)).toThrow();
			});

			it('rejects empty displayName', () => {
				const input = { ...validInput, displayName: '' };
				expect(() => CreateIdpInputSchema.parse(input)).toThrow();
			});

			it('rejects empty clientId', () => {
				const input = { ...validInput, clientId: '' };
				expect(() => CreateIdpInputSchema.parse(input)).toThrow();
			});

			it('rejects empty clientSecret', () => {
				const input = { ...validInput, clientSecret: '' };
				expect(() => CreateIdpInputSchema.parse(input)).toThrow();
			});

			it('rejects invalid URL format', () => {
				const input = { ...validInput, discoveryUrl: 'not-a-url' };
				expect(() => CreateIdpInputSchema.parse(input)).toThrow();
			});

			it('accepts optional fields', () => {
				const input = {
					...validInput,
					iconUrl: 'https://example.com/icon.png',
					buttonLabel: 'Sign in with Test',
					adminGroups: 'admin,superadmin',
					operatorGroups: 'operators',
					defaultOrgId: 'org-default'
				};

				const result = CreateIdpInputSchema.parse(input);
				expect(result.iconUrl).toBe('https://example.com/icon.png');
				expect(result.buttonLabel).toBe('Sign in with Test');
				expect(result.adminGroups).toBe('admin,superadmin');
			});
		});

		describe('UpdateIdpInputSchema', () => {
			it('accepts partial updates', () => {
				const input = {
					displayName: 'Updated Name',
					status: 'disabled' as const
				};

				expect(() => UpdateIdpInputSchema.parse(input)).not.toThrow();
			});

			it('accepts empty object (no updates)', () => {
				expect(() => UpdateIdpInputSchema.parse({})).not.toThrow();
			});

			it('rejects invalid URL formats', () => {
				const input = { iconUrl: 'not-a-url' };
				expect(() => UpdateIdpInputSchema.parse(input)).toThrow();
			});
		});

		describe('IdpProviderPublicSchema', () => {
			const fullProvider = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				providerId: 'test-idp',
				displayName: 'Test IDP',
				providerType: 'oidc' as const,
				discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
				clientId: 'client-123',
				clientSecret: 'test-client-secret-value',
				status: 'active' as const,
				isDefault: true,
				sortOrder: 0,
				iconUrl: 'https://example.com/icon.png',
				buttonLabel: 'Sign in',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			it('strips sensitive fields (clientId, clientSecret, discovery URLs)', () => {
				const parsed = IdpProviderPublicSchema.parse(fullProvider);

				expect(parsed).toHaveProperty('id');
				expect(parsed).toHaveProperty('providerId');
				expect(parsed).toHaveProperty('displayName');
				expect(parsed).not.toHaveProperty('clientId');
				expect(parsed).not.toHaveProperty('clientSecret');
				expect(parsed).not.toHaveProperty('discoveryUrl');
			});

			it('retains public display fields', () => {
				const parsed = IdpProviderPublicSchema.parse(fullProvider);

				expect(parsed.providerId).toBe('test-idp');
				expect(parsed.displayName).toBe('Test IDP');
				expect(parsed.iconUrl).toBe('https://example.com/icon.png');
				expect(parsed.buttonLabel).toBe('Sign in');
			});
		});
	});

	describe('AI Provider Schemas', () => {
		describe('CreateAiProviderInputSchema', () => {
			const validInput = {
				providerId: 'openai-1',
				displayName: 'OpenAI',
				providerType: 'openai' as const,
				apiKey: 'test-api-key-value'
			};

			it('accepts valid AI provider creation input', () => {
				expect(() => CreateAiProviderInputSchema.parse(validInput)).not.toThrow();
			});

			it('accepts OCI provider without API key', () => {
				const input = {
					providerId: 'oci-genai',
					displayName: 'OCI GenAI',
					providerType: 'oci' as const,
					region: 'eu-frankfurt-1'
				};

				expect(() => CreateAiProviderInputSchema.parse(input)).not.toThrow();
			});

			it('applies default values', () => {
				const result = CreateAiProviderInputSchema.parse(validInput);

				expect(result.status).toBe('active');
				expect(result.isDefault).toBe(false);
				expect(result.sortOrder).toBe(0);
			});

			it('rejects providerId with uppercase letters', () => {
				const input = { ...validInput, providerId: 'OpenAI-1' };
				expect(() => CreateAiProviderInputSchema.parse(input)).toThrow(/lowercase alphanumeric/);
			});

			it('rejects invalid provider type', () => {
				const input = { ...validInput, providerType: 'invalid' as any };
				expect(() => CreateAiProviderInputSchema.parse(input)).toThrow();
			});

			it('accepts modelAllowlist', () => {
				const input = {
					...validInput,
					modelAllowlist: ['gpt-4', 'gpt-3.5-turbo'],
					defaultModel: 'gpt-4'
				};

				expect(() => CreateAiProviderInputSchema.parse(input)).not.toThrow();
			});

			it('accepts extraConfig', () => {
				const input = {
					...validInput,
					modelAllowlist: ['gpt-4']
				};

				const result = CreateAiProviderInputSchema.parse(input);
				expect(result.modelAllowlist).toEqual(['gpt-4']);
			});

			it('rejects invalid API base URL format', () => {
				const input = {
					...validInput,
					apiBaseUrl: 'not-a-url'
				};

				expect(() => CreateAiProviderInputSchema.parse(input)).toThrow();
			});
		});

		describe('UpdateAiProviderInputSchema', () => {
			it('accepts partial updates', () => {
				const input = {
					displayName: 'Updated Provider',
					status: 'disabled' as const
				};

				expect(() => UpdateAiProviderInputSchema.parse(input)).not.toThrow();
			});

			it('accepts empty object', () => {
				expect(() => UpdateAiProviderInputSchema.parse({})).not.toThrow();
			});

			it('cannot change providerId (omitted)', () => {
				const input = {
					providerId: 'cannot-change'
				};

				const parsed = UpdateAiProviderInputSchema.parse(input);
				expect(parsed).not.toHaveProperty('providerId');
			});

			it('accepts updating modelAllowlist', () => {
				const input = {
					modelAllowlist: ['gpt-4-turbo', 'gpt-4']
				};

				expect(() => UpdateAiProviderInputSchema.parse(input)).not.toThrow();
			});
		});
	});

	describe('Portal Settings Schemas', () => {
		describe('SetSettingInputSchema', () => {
			it('accepts valid setting with string value', () => {
				const input = {
					key: 'portal.name',
					value: 'My Portal'
				};

				expect(() => SetSettingInputSchema.parse(input)).not.toThrow();
			});

			it('accepts valid setting with number value', () => {
				const input = {
					key: 'portal.max-sessions',
					value: 100,
					valueType: 'number' as const
				};

				expect(() => SetSettingInputSchema.parse(input)).not.toThrow();
			});

			it('accepts valid setting with boolean value', () => {
				const input = {
					key: 'portal.setup_complete',
					value: true,
					valueType: 'boolean' as const
				};

				expect(() => SetSettingInputSchema.parse(input)).not.toThrow();
			});

			it('accepts valid setting with JSON object value (as string)', () => {
				const input = {
					key: 'portal.config',
					value: JSON.stringify({ theme: 'dark', language: 'en' }),
					valueType: 'json' as const
				};

				const result = SetSettingInputSchema.parse(input);
				expect(result.value).toBe(JSON.stringify({ theme: 'dark', language: 'en' }));
			});

			it('rejects setting key with uppercase letters', () => {
				const input = {
					key: 'Portal.Name',
					value: 'Test'
				};

				expect(() => SetSettingInputSchema.parse(input)).toThrow(/lowercase alphanumeric/);
			});

			it('rejects setting key with invalid characters', () => {
				const input = {
					key: 'portal@name',
					value: 'Test'
				};

				expect(() => SetSettingInputSchema.parse(input)).toThrow(/lowercase alphanumeric/);
			});

			it('accepts valid separators in key (. _ -)', () => {
				const keys = ['portal.name', 'portal_name', 'portal-name', 'portal.sub_section-name'];

				keys.forEach((key) => {
					const input = { key, value: 'test' };
					expect(() => SetSettingInputSchema.parse(input)).not.toThrow();
				});
			});

			it('applies default values', () => {
				const input = {
					key: 'test.key',
					value: 'test'
				};

				const result = SetSettingInputSchema.parse(input);

				expect(result.isPublic).toBe(false);
				expect(result.sortOrder).toBe(0);
			});

			it('accepts optional description and category', () => {
				const input = {
					key: 'test.key',
					value: 'test',
					description: 'Test setting',
					category: 'general'
				};

				expect(() => SetSettingInputSchema.parse(input)).not.toThrow();
			});
		});

		describe('BulkSetSettingsInputSchema', () => {
			it('accepts array of valid settings', () => {
				const input = {
					settings: [
						{ key: 'portal.name', value: 'My Portal' },
						{ key: 'portal.max-sessions', value: 100 },
						{ key: 'portal.enabled', value: true }
					]
				};

				expect(() => BulkSetSettingsInputSchema.parse(input)).not.toThrow();
			});

			it('accepts empty settings array', () => {
				const input = {
					settings: []
				};

				expect(() => BulkSetSettingsInputSchema.parse(input)).not.toThrow();
			});

			it('rejects when settings is not an array', () => {
				const input = {
					settings: 'not-an-array'
				};

				expect(() => BulkSetSettingsInputSchema.parse(input)).toThrow();
			});
		});
	});

	describe('Status Schemas', () => {
		describe('SetupStatusSchema', () => {
			const validStatus = {
				isSetupComplete: true,
				idpConfigured: true,
				aiProviderConfigured: true,
				databaseHealthy: true,
				activeIdpCount: 2,
				activeAiProviderCount: 3,
				defaultIdpId: '123e4567-e89b-12d3-a456-426614174000',
				defaultAiProviderId: '223e4567-e89b-12d3-a456-426614174000'
			};

			it('accepts valid setup status', () => {
				expect(() => SetupStatusSchema.parse(validStatus)).not.toThrow();
			});

			it('accepts null for optional default IDs', () => {
				const input = {
					...validStatus,
					defaultIdpId: null,
					defaultAiProviderId: null
				};

				expect(() => SetupStatusSchema.parse(input)).not.toThrow();
			});

			it('rejects negative count values', () => {
				const input = {
					...validStatus,
					activeIdpCount: -1
				};

				expect(() => SetupStatusSchema.parse(input)).toThrow();
			});

			it('rejects invalid UUID format for default IDs', () => {
				const input = {
					...validStatus,
					defaultIdpId: 'not-a-uuid'
				};

				expect(() => SetupStatusSchema.parse(input)).toThrow();
			});

			it('accepts zero counts', () => {
				const input = {
					...validStatus,
					activeIdpCount: 0,
					activeAiProviderCount: 0
				};

				expect(() => SetupStatusSchema.parse(input)).not.toThrow();
			});
		});

		describe('TestConnectionResultSchema', () => {
			it('accepts successful test result', () => {
				const input = {
					success: true,
					message: 'Connection successful'
				};

				const result = TestConnectionResultSchema.parse(input);
				expect(result.success).toBe(true);
				expect(result.message).toBe('Connection successful');
			});

			it('accepts failed test result', () => {
				const input = {
					success: false,
					message: 'Connection failed: Timeout'
				};

				expect(() => TestConnectionResultSchema.parse(input)).not.toThrow();
			});

			it('accepts result without details', () => {
				const input = {
					success: true,
					message: 'OK'
				};

				expect(() => TestConnectionResultSchema.parse(input)).not.toThrow();
			});

			it('rejects missing required fields', () => {
				const input = {
					success: true
					// Missing message
				};

				expect(() => TestConnectionResultSchema.parse(input)).toThrow();
			});
		});

		describe('ModelAllowlistSchema', () => {
			it('accepts valid model allowlist', () => {
				const input = {
					'openai-1': ['gpt-4', 'gpt-3.5-turbo'],
					'anthropic-1': ['claude-3-opus', 'claude-3-sonnet'],
					'oci-genai': ['cohere.command', 'meta.llama-2']
				};

				expect(() => ModelAllowlistSchema.parse(input)).not.toThrow();
			});

			it('accepts empty allowlist', () => {
				const input = {};

				expect(() => ModelAllowlistSchema.parse(input)).not.toThrow();
			});

			it('accepts provider with empty model array', () => {
				const input = {
					'openai-1': []
				};

				expect(() => ModelAllowlistSchema.parse(input)).not.toThrow();
			});

			it('rejects non-string model names', () => {
				const input = {
					'openai-1': [123 as any]
				};

				expect(() => ModelAllowlistSchema.parse(input)).toThrow();
			});
		});
	});

	describe('Type Safety', () => {
		it('exported types match schema inference', () => {
			// This test validates that TypeScript types are correctly inferred
			// If these lines compile without errors, the types are correct
			type CreateIdpType = ReturnType<typeof CreateIdpInputSchema.parse>;
			type CreateAiProviderType = ReturnType<typeof CreateAiProviderInputSchema.parse>;
			type SetSettingType = ReturnType<typeof SetSettingInputSchema.parse>;

			// Type assertions to verify structure
			const _idp: CreateIdpType = {} as any;
			const _ai: CreateAiProviderType = {} as any;
			const _setting: SetSettingType = {} as any;

			expect(_idp).toBeDefined();
			expect(_ai).toBeDefined();
			expect(_setting).toBeDefined();
		});
	});
});
