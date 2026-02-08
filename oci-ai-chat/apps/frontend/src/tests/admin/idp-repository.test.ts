/**
 * Tests for IDP Provider repository
 *
 * @module tests/admin/idp-repository
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IdpProvider, IdpProviderPublic } from '$lib/server/admin/types.js';

// Mock Oracle connection
const mockExecute = vi.fn();
const mockCommit = vi.fn();
const mockConn = {
	execute: mockExecute,
	commit: mockCommit,
	rollback: vi.fn(),
	close: vi.fn(),
	OBJECT: 3001 // OUT_FORMAT_OBJECT constant
};

vi.mock('$lib/server/oracle/connection.js', () => ({
	withConnection: vi.fn(async (fn: (conn: typeof mockConn) => Promise<unknown>) => fn(mockConn))
}));

// Mock crypto functions
const mockEncryptSecret = vi.fn();
const mockDecryptSecret = vi.fn();

vi.mock('$lib/server/auth/crypto.js', () => ({
	encryptSecret: mockEncryptSecret,
	decryptSecret: mockDecryptSecret
}));

describe('idp-repository.ts', () => {
	let idpRepository: typeof import('$lib/server/admin/idp-repository.js').idpRepository;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Default mock implementations
		mockEncryptSecret.mockResolvedValue({
			encrypted: Buffer.from('encrypted-data'),
			iv: Buffer.from('000000000000'),
			tag: Buffer.from('0000000000000000')
		});
		mockDecryptSecret.mockResolvedValue('decrypted-secret');

		// Re-import module to get fresh instance
		const module = await import('$lib/server/admin/idp-repository.js');
		idpRepository = module.idpRepository;
	});

	describe('list', () => {
		it('returns all IDPs with decrypted secrets', async () => {
			const mockRows = [
				{
					ID: '123e4567-e89b-12d3-a456-426614174000',
					PROVIDER_ID: 'oidc-1',
					DISPLAY_NAME: 'Test OIDC',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: 'https://idp.example.com/.well-known/openid-configuration',
					AUTHORIZATION_URL: null,
					TOKEN_URL: null,
					USERINFO_URL: null,
					JWKS_URL: null,
					CLIENT_ID: 'test-client',
					CLIENT_SECRET_ENC: Buffer.from('encrypted'),
					CLIENT_SECRET_IV: Buffer.from('iv-data'),
					CLIENT_SECRET_TAG: Buffer.from('tag-data'),
					SCOPES: 'openid,email,profile',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 1,
					SORT_ORDER: 0,
					ICON_URL: null,
					BUTTON_LABEL: null,
					ADMIN_GROUPS: null,
					OPERATOR_GROUPS: null,
					TENANT_ORG_MAP: null,
					DEFAULT_ORG_ID: null,
					EXTRA_CONFIG: null,
					CREATED_AT: new Date('2026-01-01'),
					UPDATED_AT: new Date('2026-01-01')
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });
			mockDecryptSecret.mockResolvedValue('test-client-secret-value');

			const result = await idpRepository.list();

			expect(result).toHaveLength(1);
			expect(result[0].providerId).toBe('oidc-1');
			expect(result[0].clientSecret).toBe('test-client-secret-value');
			expect(mockDecryptSecret).toHaveBeenCalledWith(
				mockRows[0].CLIENT_SECRET_ENC,
				mockRows[0].CLIENT_SECRET_IV,
				mockRows[0].CLIENT_SECRET_TAG
			);
		});

		it('orders by sort_order then display_name', async () => {
			mockExecute.mockResolvedValue({ rows: [] });

			await idpRepository.list();

			const sql = mockExecute.mock.calls[0][0] as string;
			expect(sql).toMatch(/ORDER BY sort_order, display_name/i);
		});

		it('handles missing encrypted secret gracefully', async () => {
			const mockRows = [
				{
					ID: '123e4567-e89b-12d3-a456-426614174000',
					PROVIDER_ID: 'oidc-1',
					DISPLAY_NAME: 'Test OIDC',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: 'https://idp.example.com/.well-known',
					AUTHORIZATION_URL: null,
					TOKEN_URL: null,
					USERINFO_URL: null,
					JWKS_URL: null,
					CLIENT_ID: 'test-client',
					CLIENT_SECRET_ENC: null,
					CLIENT_SECRET_IV: null,
					CLIENT_SECRET_TAG: null,
					SCOPES: 'openid',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 0,
					SORT_ORDER: 0,
					ICON_URL: null,
					BUTTON_LABEL: null,
					ADMIN_GROUPS: null,
					OPERATOR_GROUPS: null,
					TENANT_ORG_MAP: null,
					DEFAULT_ORG_ID: null,
					EXTRA_CONFIG: null,
					CREATED_AT: new Date(),
					UPDATED_AT: new Date()
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });

			const result = await idpRepository.list();

			expect(result[0].clientSecret).toBeUndefined();
			expect(mockDecryptSecret).not.toHaveBeenCalled();
		});

		it('continues with undefined secret on decryption error', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockRows = [
				{
					ID: '123e4567-e89b-12d3-a456-426614174000',
					PROVIDER_ID: 'oidc-1',
					DISPLAY_NAME: 'Test',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: 'https://idp.example.com/.well-known',
					AUTHORIZATION_URL: null,
					TOKEN_URL: null,
					USERINFO_URL: null,
					JWKS_URL: null,
					CLIENT_ID: 'test',
					CLIENT_SECRET_ENC: Buffer.from('bad-data'),
					CLIENT_SECRET_IV: Buffer.from('iv'),
					CLIENT_SECRET_TAG: Buffer.from('tag'),
					SCOPES: 'openid',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 0,
					SORT_ORDER: 0,
					ICON_URL: null,
					BUTTON_LABEL: null,
					ADMIN_GROUPS: null,
					OPERATOR_GROUPS: null,
					TENANT_ORG_MAP: null,
					DEFAULT_ORG_ID: null,
					EXTRA_CONFIG: null,
					CREATED_AT: new Date(),
					UPDATED_AT: new Date()
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });
			mockDecryptSecret.mockRejectedValue(new Error('Decryption failed'));

			const result = await idpRepository.list();

			expect(result[0].clientSecret).toBeUndefined();
			expect(consoleErrorSpy).toHaveBeenCalled();

			consoleErrorSpy.mockRestore();
		});

		it('converts Oracle UPPERCASE keys to camelCase', async () => {
			const mockRows = [
				{
					ID: 'test-id',
					PROVIDER_ID: 'test-provider',
					DISPLAY_NAME: 'Test Name',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: 'https://test.com',
					AUTHORIZATION_URL: 'https://test.com/auth',
					TOKEN_URL: 'https://test.com/token',
					USERINFO_URL: 'https://test.com/userinfo',
					JWKS_URL: 'https://test.com/jwks',
					CLIENT_ID: 'client',
					CLIENT_SECRET_ENC: null,
					CLIENT_SECRET_IV: null,
					CLIENT_SECRET_TAG: null,
					SCOPES: 'openid',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 0,
					SORT_ORDER: 5,
					ICON_URL: 'https://test.com/icon.png',
					BUTTON_LABEL: 'Sign In',
					ADMIN_GROUPS: 'admin',
					OPERATOR_GROUPS: 'ops',
					TENANT_ORG_MAP: '{"tenant1":"org1"}',
					DEFAULT_ORG_ID: 'default-org',
					EXTRA_CONFIG: '{"key":"value"}',
					CREATED_AT: new Date('2026-01-01'),
					UPDATED_AT: new Date('2026-01-02')
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });

			const result = await idpRepository.list();

			expect(result[0]).toMatchObject({
				id: 'test-id',
				providerId: 'test-provider',
				displayName: 'Test Name',
				providerType: 'oidc',
				discoveryUrl: 'https://test.com',
				authorizationUrl: 'https://test.com/auth',
				tokenUrl: 'https://test.com/token',
				userinfoUrl: 'https://test.com/userinfo',
				jwksUrl: 'https://test.com/jwks',
				clientId: 'client',
				scopes: 'openid',
				pkceEnabled: true,
				status: 'active',
				isDefault: false,
				sortOrder: 5,
				iconUrl: 'https://test.com/icon.png',
				buttonLabel: 'Sign In',
				adminGroups: 'admin',
				operatorGroups: 'ops',
				defaultOrgId: 'default-org'
			});
		});

		it('parses JSON fields (tenant_org_map, extra_config)', async () => {
			const mockRows = [
				{
					ID: 'test-id',
					PROVIDER_ID: 'test',
					DISPLAY_NAME: 'Test',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: 'https://test.com',
					AUTHORIZATION_URL: null,
					TOKEN_URL: null,
					USERINFO_URL: null,
					JWKS_URL: null,
					CLIENT_ID: 'client',
					CLIENT_SECRET_ENC: null,
					CLIENT_SECRET_IV: null,
					CLIENT_SECRET_TAG: null,
					SCOPES: 'openid',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 0,
					SORT_ORDER: 0,
					ICON_URL: null,
					BUTTON_LABEL: null,
					ADMIN_GROUPS: null,
					OPERATOR_GROUPS: null,
					TENANT_ORG_MAP: '{"tenant1":"org1","tenant2":"org2"}',
					DEFAULT_ORG_ID: null,
					EXTRA_CONFIG: '{"custom":"setting","number":42}',
					CREATED_AT: new Date(),
					UPDATED_AT: new Date()
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });

			const result = await idpRepository.list();

			expect(result[0].tenantOrgMap).toEqual({ tenant1: 'org1', tenant2: 'org2' });
			expect(result[0].extraConfig).toEqual({ custom: 'setting', number: 42 });
		});
	});

	describe('listActive', () => {
		it('returns only active IDPs without secrets', async () => {
			const mockRows = [
				{
					ID: '1',
					PROVIDER_ID: 'active-1',
					DISPLAY_NAME: 'Active IDP',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: null,
					AUTHORIZATION_URL: null,
					TOKEN_URL: null,
					USERINFO_URL: null,
					JWKS_URL: null,
					CLIENT_ID: 'client',
					CLIENT_SECRET_ENC: Buffer.from('secret'),
					CLIENT_SECRET_IV: Buffer.from('iv'),
					CLIENT_SECRET_TAG: Buffer.from('tag'),
					SCOPES: 'openid',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 1,
					SORT_ORDER: 0,
					ICON_URL: 'https://test.com/icon.png',
					BUTTON_LABEL: 'Sign In',
					ADMIN_GROUPS: null,
					OPERATOR_GROUPS: null,
					TENANT_ORG_MAP: null,
					DEFAULT_ORG_ID: null,
					EXTRA_CONFIG: null,
					CREATED_AT: new Date(),
					UPDATED_AT: new Date()
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });

			const result = await idpRepository.listActive();

			expect(result).toHaveLength(1);
			expect(result[0].providerId).toBe('active-1');
			expect(result[0]).not.toHaveProperty('clientId');
			expect(result[0]).not.toHaveProperty('clientSecret');
			expect(result[0]).not.toHaveProperty('discoveryUrl');
			expect(mockDecryptSecret).not.toHaveBeenCalled();
		});

		it('filters by status=active in SQL', async () => {
			mockExecute.mockResolvedValue({ rows: [] });

			await idpRepository.listActive();

			const sql = mockExecute.mock.calls[0][0] as string;
			expect(sql).toMatch(/WHERE status = 'active'/i);
		});

		it('returns public fields only', async () => {
			const mockRows = [
				{
					ID: '1',
					PROVIDER_ID: 'test',
					DISPLAY_NAME: 'Test',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: null,
					AUTHORIZATION_URL: null,
					TOKEN_URL: null,
					USERINFO_URL: null,
					JWKS_URL: null,
					CLIENT_ID: 'client',
					CLIENT_SECRET_ENC: null,
					CLIENT_SECRET_IV: null,
					CLIENT_SECRET_TAG: null,
					SCOPES: 'openid',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 0,
					SORT_ORDER: 5,
					ICON_URL: 'https://test.com/icon.png',
					BUTTON_LABEL: 'Test Button',
					ADMIN_GROUPS: 'admin',
					OPERATOR_GROUPS: 'ops',
					TENANT_ORG_MAP: null,
					DEFAULT_ORG_ID: null,
					EXTRA_CONFIG: null,
					CREATED_AT: new Date(),
					UPDATED_AT: new Date()
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });

			const result = await idpRepository.listActive();

			const publicFields: IdpProviderPublic = result[0];
			expect(publicFields).toEqual({
				id: '1',
				providerId: 'test',
				displayName: 'Test',
				providerType: 'oidc',
				status: 'active',
				isDefault: false,
				sortOrder: 5,
				iconUrl: 'https://test.com/icon.png',
				buttonLabel: 'Test Button'
			});
		});
	});

	describe('getById', () => {
		it('returns IDP by ID with decrypted secret', async () => {
			const mockRows = [
				{
					ID: 'target-id',
					PROVIDER_ID: 'test-idp',
					DISPLAY_NAME: 'Test IDP',
					PROVIDER_TYPE: 'oidc',
					DISCOVERY_URL: 'https://test.com',
					AUTHORIZATION_URL: null,
					TOKEN_URL: null,
					USERINFO_URL: null,
					JWKS_URL: null,
					CLIENT_ID: 'client',
					CLIENT_SECRET_ENC: Buffer.from('enc'),
					CLIENT_SECRET_IV: Buffer.from('iv'),
					CLIENT_SECRET_TAG: Buffer.from('tag'),
					SCOPES: 'openid',
					PKCE_ENABLED: 1,
					STATUS: 'active',
					IS_DEFAULT: 0,
					SORT_ORDER: 0,
					ICON_URL: null,
					BUTTON_LABEL: null,
					ADMIN_GROUPS: null,
					OPERATOR_GROUPS: null,
					TENANT_ORG_MAP: null,
					DEFAULT_ORG_ID: null,
					EXTRA_CONFIG: null,
					CREATED_AT: new Date(),
					UPDATED_AT: new Date()
				}
			];

			mockExecute.mockResolvedValue({ rows: mockRows });
			mockDecryptSecret.mockResolvedValue('decrypted-value');

			const result = await idpRepository.getById('target-id');

			expect(result).toBeDefined();
			expect(result!.id).toBe('target-id');
			expect(result!.clientSecret).toBe('decrypted-value');
			expect(mockExecute).toHaveBeenCalledWith(
				expect.stringMatching(/WHERE id = :id/i),
				{ id: 'target-id' },
				expect.any(Object)
			);
		});

		it('returns undefined when IDP not found', async () => {
			mockExecute.mockResolvedValue({ rows: [] });

			const result = await idpRepository.getById('nonexistent');

			expect(result).toBeUndefined();
		});

		it('uses bind variable for ID (not string interpolation)', async () => {
			mockExecute.mockResolvedValue({ rows: [] });

			await idpRepository.getById('test-id');

			expect(mockExecute).toHaveBeenCalledWith(
				expect.any(String),
				{ id: 'test-id' },
				expect.any(Object)
			);
		});
	});

	describe('create', () => {
		it('encrypts client secret and inserts new IDP', async () => {
			const createdRow = {
				ID: 'new-id',
				PROVIDER_ID: 'new-idp',
				DISPLAY_NAME: 'New IDP',
				PROVIDER_TYPE: 'oidc',
				DISCOVERY_URL: 'https://idp.example.com/.well-known',
				AUTHORIZATION_URL: null,
				TOKEN_URL: null,
				USERINFO_URL: null,
				JWKS_URL: null,
				CLIENT_ID: 'client-123',
				CLIENT_SECRET_ENC: Buffer.from('encrypted-data'),
				CLIENT_SECRET_IV: Buffer.from('iv-bytes-12ch'),
				CLIENT_SECRET_TAG: Buffer.from('tag-bytes-16chr'),
				SCOPES: 'openid,email',
				PKCE_ENABLED: 1,
				STATUS: 'active',
				IS_DEFAULT: 0,
				SORT_ORDER: 0,
				ICON_URL: null,
				BUTTON_LABEL: null,
				ADMIN_GROUPS: null,
				OPERATOR_GROUPS: null,
				TENANT_ORG_MAP: null,
				DEFAULT_ORG_ID: null,
				EXTRA_CONFIG: null,
				CREATED_AT: new Date(),
				UPDATED_AT: new Date()
			};

			// Mock INSERT, then mock the SELECT for getById()
			mockExecute
				.mockResolvedValueOnce({ rowsAffected: 1 }) // INSERT
				.mockResolvedValueOnce({ rows: [createdRow] }); // SELECT in getById()

			mockEncryptSecret.mockResolvedValue({
				encrypted: Buffer.from('encrypted-data'),
				iv: Buffer.from('iv-bytes-12ch'),
				tag: Buffer.from('tag-bytes-16chr')
			});
			mockDecryptSecret.mockResolvedValue('plaintext-secret');

			const input = {
				providerId: 'new-idp',
				displayName: 'New IDP',
				providerType: 'oidc' as const,
				discoveryUrl: 'https://idp.example.com/.well-known',
				clientId: 'client-123',
				clientSecret: 'plaintext-secret',
				scopes: 'openid,email',
				pkceEnabled: true,
				status: 'active' as const,
				isDefault: false,
				sortOrder: 0
			};

			const result = await idpRepository.create(input);

			expect(result.providerId).toBe('new-idp');
			expect(mockEncryptSecret).toHaveBeenCalledWith('plaintext-secret');

			const sql = mockExecute.mock.calls[0][0] as string;
			expect(sql).toMatch(/INSERT INTO idp_providers/i);

			// Verify autoCommit is used
			const options = mockExecute.mock.calls[0][2] as { autoCommit: boolean };
			expect(options.autoCommit).toBe(true);
		});

		it('passes encrypted components as bind variables', async () => {
			const encryptedData = {
				encrypted: Buffer.from('enc'),
				iv: Buffer.from('123456789012'),
				tag: Buffer.from('1234567890123456')
			};

			const createdRow = {
				ID: 'new-id',
				PROVIDER_ID: 'test',
				DISPLAY_NAME: 'Test',
				PROVIDER_TYPE: 'oidc',
				DISCOVERY_URL: 'https://test.com',
				AUTHORIZATION_URL: null,
				TOKEN_URL: null,
				USERINFO_URL: null,
				JWKS_URL: null,
				CLIENT_ID: 'client',
				CLIENT_SECRET_ENC: encryptedData.encrypted,
				CLIENT_SECRET_IV: encryptedData.iv,
				CLIENT_SECRET_TAG: encryptedData.tag,
				SCOPES: 'openid',
				PKCE_ENABLED: 1,
				STATUS: 'active',
				IS_DEFAULT: 0,
				SORT_ORDER: 0,
				ICON_URL: null,
				BUTTON_LABEL: null,
				ADMIN_GROUPS: null,
				OPERATOR_GROUPS: null,
				TENANT_ORG_MAP: null,
				DEFAULT_ORG_ID: null,
				EXTRA_CONFIG: null,
				CREATED_AT: new Date(),
				UPDATED_AT: new Date()
			};

			mockExecute
				.mockResolvedValueOnce({ rowsAffected: 1 }) // INSERT
				.mockResolvedValueOnce({ rows: [createdRow] }); // SELECT
			mockEncryptSecret.mockResolvedValue(encryptedData);
			mockDecryptSecret.mockResolvedValue('secret');

			const input = {
				providerId: 'test',
				displayName: 'Test',
				providerType: 'oidc' as const,
				discoveryUrl: 'https://test.com',
				clientId: 'client',
				clientSecret: 'secret',
				scopes: 'openid',
				pkceEnabled: true,
				status: 'active' as const,
				isDefault: false,
				sortOrder: 0
			};

			await idpRepository.create(input);

			const bindVars = mockExecute.mock.calls[0][1] as Record<string, unknown>;
			expect(bindVars.clientSecretEnc).toEqual(encryptedData.encrypted);
			expect(bindVars.clientSecretIv).toEqual(encryptedData.iv);
			expect(bindVars.clientSecretTag).toEqual(encryptedData.tag);
		});
	});

	describe('update', () => {
		it('updates IDP fields by ID', async () => {
			const existingRow = {
				ID: 'idp-id',
				PROVIDER_ID: 'test',
				DISPLAY_NAME: 'Old Name',
				PROVIDER_TYPE: 'oidc',
				DISCOVERY_URL: 'https://test.com',
				AUTHORIZATION_URL: null,
				TOKEN_URL: null,
				USERINFO_URL: null,
				JWKS_URL: null,
				CLIENT_ID: 'client',
				CLIENT_SECRET_ENC: null,
				CLIENT_SECRET_IV: null,
				CLIENT_SECRET_TAG: null,
				SCOPES: 'openid',
				PKCE_ENABLED: 1,
				STATUS: 'active',
				IS_DEFAULT: 0,
				SORT_ORDER: 0,
				ICON_URL: null,
				BUTTON_LABEL: null,
				ADMIN_GROUPS: null,
				OPERATOR_GROUPS: null,
				TENANT_ORG_MAP: null,
				DEFAULT_ORG_ID: null,
				EXTRA_CONFIG: null,
				CREATED_AT: new Date(),
				UPDATED_AT: new Date()
			};

			const updatedRow = { ...existingRow, DISPLAY_NAME: 'Updated Name', STATUS: 'disabled' };

			// Mock getById (SELECT), UPDATE, then getById again (SELECT)
			mockExecute
				.mockResolvedValueOnce({ rows: [existingRow] }) // getById before update
				.mockResolvedValueOnce({ rowsAffected: 1 }) // UPDATE
				.mockResolvedValueOnce({ rows: [updatedRow] }); // getById after update

			const updates = {
				displayName: 'Updated Name',
				status: 'disabled' as const
			};

			const result = await idpRepository.update('idp-id', updates);

			expect(result.displayName).toBe('Updated Name');
			expect(result.status).toBe('disabled');

			// Second call should be UPDATE
			const sql = mockExecute.mock.calls[1][0] as string;
			expect(sql).toMatch(/UPDATE idp_providers/i);
			expect(sql).toMatch(/WHERE id = :id/i);

			// Verify autoCommit is used
			const options = mockExecute.mock.calls[1][2] as { autoCommit: boolean };
			expect(options.autoCommit).toBe(true);
		});

		it('encrypts new client secret if provided', async () => {
			const existingRow = {
				ID: 'idp-id',
				PROVIDER_ID: 'test',
				DISPLAY_NAME: 'Test',
				PROVIDER_TYPE: 'oidc',
				DISCOVERY_URL: 'https://test.com',
				AUTHORIZATION_URL: null,
				TOKEN_URL: null,
				USERINFO_URL: null,
				JWKS_URL: null,
				CLIENT_ID: 'client',
				CLIENT_SECRET_ENC: Buffer.from('old'),
				CLIENT_SECRET_IV: Buffer.from('old-iv'),
				CLIENT_SECRET_TAG: Buffer.from('old-tag'),
				SCOPES: 'openid',
				PKCE_ENABLED: 1,
				STATUS: 'active',
				IS_DEFAULT: 0,
				SORT_ORDER: 0,
				ICON_URL: null,
				BUTTON_LABEL: null,
				ADMIN_GROUPS: null,
				OPERATOR_GROUPS: null,
				TENANT_ORG_MAP: null,
				DEFAULT_ORG_ID: null,
				EXTRA_CONFIG: null,
				CREATED_AT: new Date(),
				UPDATED_AT: new Date()
			};

			const updatedRow = {
				...existingRow,
				CLIENT_SECRET_ENC: Buffer.from('new-enc'),
				CLIENT_SECRET_IV: Buffer.from('new-iv-12byt'),
				CLIENT_SECRET_TAG: Buffer.from('new-tag-16bytes1')
			};

			mockExecute
				.mockResolvedValueOnce({ rows: [existingRow] }) // getById before
				.mockResolvedValueOnce({ rowsAffected: 1 }) // UPDATE
				.mockResolvedValueOnce({ rows: [updatedRow] }); // getById after
			mockEncryptSecret.mockResolvedValue({
				encrypted: Buffer.from('new-enc'),
				iv: Buffer.from('new-iv-12byt'),
				tag: Buffer.from('new-tag-16bytes1')
			});
			mockDecryptSecret.mockResolvedValue('new-plaintext-secret');

			const updates = {
				clientSecret: 'new-plaintext-secret'
			};

			const result = await idpRepository.update('idp-id', updates);

			expect(mockEncryptSecret).toHaveBeenCalledWith('new-plaintext-secret');
			expect(result.clientSecret).toBe('new-plaintext-secret');
		});

		it('does not encrypt if clientSecret is not provided', async () => {
			const existingRow = {
				ID: 'idp-id',
				PROVIDER_ID: 'test',
				DISPLAY_NAME: 'Test',
				PROVIDER_TYPE: 'oidc',
				DISCOVERY_URL: 'https://test.com',
				AUTHORIZATION_URL: null,
				TOKEN_URL: null,
				USERINFO_URL: null,
				JWKS_URL: null,
				CLIENT_ID: 'client',
				CLIENT_SECRET_ENC: null,
				CLIENT_SECRET_IV: null,
				CLIENT_SECRET_TAG: null,
				SCOPES: 'openid',
				PKCE_ENABLED: 1,
				STATUS: 'active',
				IS_DEFAULT: 0,
				SORT_ORDER: 0,
				ICON_URL: null,
				BUTTON_LABEL: null,
				ADMIN_GROUPS: null,
				OPERATOR_GROUPS: null,
				TENANT_ORG_MAP: null,
				DEFAULT_ORG_ID: null,
				EXTRA_CONFIG: null,
				CREATED_AT: new Date(),
				UPDATED_AT: new Date()
			};

			const updatedRow = { ...existingRow, DISPLAY_NAME: 'Updated' };

			mockExecute
				.mockResolvedValueOnce({ rows: [existingRow] }) // getById before
				.mockResolvedValueOnce({ rowsAffected: 1 }) // UPDATE
				.mockResolvedValueOnce({ rows: [updatedRow] }); // getById after

			const updates = {
				displayName: 'Updated'
			};

			const result = await idpRepository.update('idp-id', updates);

			expect(mockEncryptSecret).not.toHaveBeenCalled();
			expect(result.displayName).toBe('Updated');
		});
	});

	describe('delete', () => {
		it('deletes IDP by ID and returns true on success', async () => {
			mockExecute.mockResolvedValue({ rowsAffected: 1 });

			const result = await idpRepository.delete('idp-to-delete');

			expect(result).toBe(true);
			expect(mockExecute).toHaveBeenCalledWith(
				expect.stringMatching(/DELETE FROM idp_providers WHERE id = :id/i),
				{ id: 'idp-to-delete' },
				expect.objectContaining({ autoCommit: true })
			);
		});

		it('returns false when IDP not found', async () => {
			mockExecute.mockResolvedValue({ rowsAffected: 0 });

			const result = await idpRepository.delete('nonexistent');

			expect(result).toBe(false);
		});
	});

	describe('count', () => {
		it('returns total number of IDPs', async () => {
			mockExecute.mockResolvedValue({
				rows: [{ COUNT: 5 }]
			});

			const result = await idpRepository.count();

			expect(result).toBe(5);
			expect(mockExecute).toHaveBeenCalledWith(
				expect.stringMatching(/SELECT COUNT\(\*\) as COUNT FROM idp_providers/i),
				[],
				expect.any(Object)
			);
		});

		it('returns 0 when no IDPs exist', async () => {
			mockExecute.mockResolvedValue({
				rows: [{ COUNT: 0 }]
			});

			const result = await idpRepository.count();

			expect(result).toBe(0);
		});
	});
});
