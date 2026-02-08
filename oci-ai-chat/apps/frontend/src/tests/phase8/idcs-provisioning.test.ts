/**
 * Phase 8: IDCS Provisioning Tests
 *
 * Tests the IDCS auto-provisioning pipeline:
 * - Profile cache (stash IDCS claims during OAuth callback)
 * - Group-to-role mapping
 * - Org resolution (existing membership → tenant mapping → default)
 * - Org membership upsert (MERGE INTO)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock Oracle connection before importing modules
const mockExecute = vi.fn();
vi.mock('$lib/server/oracle/connection.js', () => ({
	withConnection: vi.fn(async (fn: (conn: { execute: typeof mockExecute }) => unknown) => {
		return fn({ execute: mockExecute });
	})
}));

vi.mock('$lib/server/logger.js', () => ({
	createLogger: () => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	})
}));

// ── Group-to-role mapping ──────────────────────────────────────────────────
describe('mapIdcsGroupsToRole', () => {
	let mapIdcsGroupsToRole: (
		groups: string[],
		adminGroups: string[],
		operatorGroups: string[]
	) => 'admin' | 'operator' | 'viewer';

	const ADMIN_GROUPS = ['PortalAdmins', 'OCI_Administrators', 'Administrators'];
	const OPERATOR_GROUPS = ['PortalOperators', 'OCI_Operators', 'CloudOperators'];

	beforeEach(async () => {
		const mod = await import('$lib/server/auth/idcs-provisioning.js');
		mapIdcsGroupsToRole = mod.mapIdcsGroupsToRole;
	});

	test('maps admin group to admin role', () => {
		expect(mapIdcsGroupsToRole(['PortalAdmins'], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe('admin');
		expect(mapIdcsGroupsToRole(['OCI_Administrators'], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe(
			'admin'
		);
		expect(mapIdcsGroupsToRole(['Administrators'], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe('admin');
	});

	test('maps operator group to operator role', () => {
		expect(mapIdcsGroupsToRole(['PortalOperators'], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe(
			'operator'
		);
		expect(mapIdcsGroupsToRole(['OCI_Operators'], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe('operator');
		expect(mapIdcsGroupsToRole(['CloudOperators'], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe('operator');
	});

	test('defaults to viewer when no known groups', () => {
		expect(mapIdcsGroupsToRole([], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe('viewer');
		expect(mapIdcsGroupsToRole(['SomeOtherGroup'], ADMIN_GROUPS, OPERATOR_GROUPS)).toBe('viewer');
	});

	test('admin takes precedence over operator', () => {
		expect(
			mapIdcsGroupsToRole(['PortalOperators', 'PortalAdmins'], ADMIN_GROUPS, OPERATOR_GROUPS)
		).toBe('admin');
	});
});

// ── IDCS Profile Cache ─────────────────────────────────────────────────────
describe('idcsProfileCache', () => {
	let stashIdcsProfile: (sub: string, groups: string[], tenantName?: string) => void;
	let consumeIdcsProfile: (sub: string) => { groups: string[]; tenantName?: string } | null;

	beforeEach(async () => {
		const mod = await import('$lib/server/auth/idcs-provisioning.js');
		stashIdcsProfile = mod.stashIdcsProfile;
		consumeIdcsProfile = mod.consumeIdcsProfile;
	});

	test('stashes and consumes IDCS profile data', () => {
		stashIdcsProfile('user-sub-1', ['PortalAdmins'], 'myTenant');
		const result = consumeIdcsProfile('user-sub-1');
		expect(result).toEqual({ groups: ['PortalAdmins'], tenantName: 'myTenant' });
	});

	test('consume is single-use (removes entry)', () => {
		stashIdcsProfile('user-sub-2', ['OCI_Operators']);
		consumeIdcsProfile('user-sub-2');
		expect(consumeIdcsProfile('user-sub-2')).toBeNull();
	});

	test('returns null for unknown sub', () => {
		expect(consumeIdcsProfile('unknown-sub')).toBeNull();
	});

	test('stash without tenant name', () => {
		stashIdcsProfile('user-sub-3', ['CloudOperators']);
		const result = consumeIdcsProfile('user-sub-3');
		expect(result).toEqual({ groups: ['CloudOperators'], tenantName: undefined });
	});
});

// ── Org resolution ──────────────────────────────────────────────────────────
describe('resolveIdcsOrg', () => {
	let resolveIdcsOrg: (
		userId: string,
		tenantName?: string,
		tenantOrgMap?: Record<string, string>,
		defaultOrgId?: string
	) => Promise<string | null>;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import('$lib/server/auth/idcs-provisioning.js');
		resolveIdcsOrg = mod.resolveIdcsOrg;
	});

	test('returns existing org membership from DB', async () => {
		mockExecute.mockResolvedValueOnce({
			rows: [{ ORG_ID: 'existing-org-123' }]
		});

		const result = await resolveIdcsOrg('user-1');
		expect(result).toBe('existing-org-123');
	});

	test('falls back to tenant mapping when no existing membership', async () => {
		mockExecute.mockResolvedValueOnce({ rows: [] });

		const result = await resolveIdcsOrg('user-2', 'myTenant', { myTenant: 'org-from-mapping' });
		expect(result).toBe('org-from-mapping');
	});

	test('falls back to default org when no tenant mapping', async () => {
		mockExecute.mockResolvedValueOnce({ rows: [] });

		const result = await resolveIdcsOrg('user-3', undefined, undefined, 'default-org-456');
		expect(result).toBe('default-org-456');
	});

	test('returns null when no org can be resolved', async () => {
		mockExecute.mockResolvedValueOnce({ rows: [] });

		const result = await resolveIdcsOrg('user-4');
		expect(result).toBeNull();
	});

	test('handles DB error gracefully and falls through', async () => {
		mockExecute.mockRejectedValueOnce(new Error('DB down'));

		const result = await resolveIdcsOrg('user-5', undefined, undefined, 'fallback-org');
		expect(result).toBe('fallback-org');
	});
});

// ── Org membership provisioning ────────────────────────────────────────────
describe('provisionFromIdcsGroups', () => {
	const ADMIN_GROUPS = ['PortalAdmins', 'OCI_Administrators', 'Administrators'];
	const OPERATOR_GROUPS = ['PortalOperators', 'OCI_Operators', 'CloudOperators'];

	let provisionFromIdcsGroups: (
		userId: string,
		orgId: string,
		groups: string[],
		adminGroups?: string[],
		operatorGroups?: string[]
	) => Promise<string>;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import('$lib/server/auth/idcs-provisioning.js');
		provisionFromIdcsGroups = mod.provisionFromIdcsGroups;
	});

	test('provisions admin role for admin group', async () => {
		mockExecute.mockResolvedValueOnce({});

		const role = await provisionFromIdcsGroups(
			'user-1',
			'org-1',
			['PortalAdmins'],
			ADMIN_GROUPS,
			OPERATOR_GROUPS
		);
		expect(role).toBe('admin');
		expect(mockExecute).toHaveBeenCalledWith(
			expect.stringContaining('MERGE INTO org_members'),
			expect.objectContaining({ userId: 'user-1', orgId: 'org-1', role: 'admin' }),
			expect.objectContaining({ autoCommit: true })
		);
	});

	test('provisions operator role for operator group', async () => {
		mockExecute.mockResolvedValueOnce({});

		const role = await provisionFromIdcsGroups(
			'user-2',
			'org-1',
			['OCI_Operators'],
			ADMIN_GROUPS,
			OPERATOR_GROUPS
		);
		expect(role).toBe('operator');
	});

	test('provisions viewer role when no matching groups', async () => {
		mockExecute.mockResolvedValueOnce({});

		const role = await provisionFromIdcsGroups(
			'user-3',
			'org-1',
			['SomeGroup'],
			ADMIN_GROUPS,
			OPERATOR_GROUPS
		);
		expect(role).toBe('viewer');
	});

	test('returns computed role even when DB write fails', async () => {
		mockExecute.mockRejectedValueOnce(new Error('DB write failed'));

		const role = await provisionFromIdcsGroups(
			'user-4',
			'org-1',
			['PortalAdmins'],
			ADMIN_GROUPS,
			OPERATOR_GROUPS
		);
		expect(role).toBe('admin');
	});

	test('uses MERGE INTO for atomic upsert', async () => {
		mockExecute.mockResolvedValueOnce({});

		await provisionFromIdcsGroups(
			'user-5',
			'org-1',
			['CloudOperators'],
			ADMIN_GROUPS,
			OPERATOR_GROUPS
		);

		const sql = mockExecute.mock.calls[0][0] as string;
		expect(sql).toContain('MERGE INTO org_members');
		expect(sql).toContain('WHEN MATCHED THEN UPDATE');
		expect(sql).toContain('WHEN NOT MATCHED THEN INSERT');
	});
});
