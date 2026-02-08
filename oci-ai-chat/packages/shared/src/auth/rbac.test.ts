import { describe, it, expect } from 'vitest';
import {
	PERMISSIONS,
	getPermissionsForRole,
	hasPermission,
	type Permission
} from './rbac';

describe('PERMISSIONS', () => {
	it('exports all permission definitions', () => {
		expect(PERMISSIONS).toBeDefined();
		expect(typeof PERMISSIONS).toBe('object');
	});

	it('has expected tool permissions', () => {
		expect(PERMISSIONS['tools:read']).toBe('View tool definitions and results');
		expect(PERMISSIONS['tools:execute']).toBe('Execute auto-approved tools');
		expect(PERMISSIONS['tools:approve']).toBe('Approve/reject tool executions');
		expect(PERMISSIONS['tools:danger']).toBe('Execute danger-level tools');
	});

	it('has expected session permissions', () => {
		expect(PERMISSIONS['sessions:read']).toBe('View chat sessions');
		expect(PERMISSIONS['sessions:write']).toBe('Create/modify chat sessions');
	});

	it('has expected workflow permissions', () => {
		expect(PERMISSIONS['workflows:read']).toBe('View workflow definitions and runs');
		expect(PERMISSIONS['workflows:write']).toBe('Create/modify workflow definitions');
		expect(PERMISSIONS['workflows:execute']).toBe('Execute workflows');
	});

	it('has expected admin permissions', () => {
		expect(PERMISSIONS['admin:users']).toBe('Manage users');
		expect(PERMISSIONS['admin:orgs']).toBe('Manage organizations');
		expect(PERMISSIONS['admin:audit']).toBe('View audit logs');
		expect(PERMISSIONS['admin:all']).toBe('Full admin access');
	});

	it('has 13 total permissions', () => {
		const permissionKeys = Object.keys(PERMISSIONS);
		expect(permissionKeys).toHaveLength(13);
	});

	it('all values are non-empty strings', () => {
		for (const [key, desc] of Object.entries(PERMISSIONS)) {
			expect(typeof desc).toBe('string');
			expect(desc.length).toBeGreaterThan(0);
		}
	});
});

describe('getPermissionsForRole()', () => {
	it('returns viewer permissions for viewer role', () => {
		const perms = getPermissionsForRole('viewer');

		expect(perms).toContain('tools:read');
		expect(perms).toContain('sessions:read');
		expect(perms).toContain('workflows:read');
		expect(perms).toHaveLength(3);
	});

	it('returns operator permissions for operator role', () => {
		const perms = getPermissionsForRole('operator');

		expect(perms).toContain('tools:read');
		expect(perms).toContain('tools:execute');
		expect(perms).toContain('tools:approve');
		expect(perms).toContain('sessions:read');
		expect(perms).toContain('sessions:write');
		expect(perms).toContain('workflows:read');
		expect(perms).toContain('workflows:execute');
		expect(perms).toHaveLength(7);
	});

	it('returns all permissions for admin role', () => {
		const perms = getPermissionsForRole('admin');

		expect(perms).toHaveLength(13);
		expect(perms).toContain('tools:read');
		expect(perms).toContain('tools:execute');
		expect(perms).toContain('tools:approve');
		expect(perms).toContain('tools:danger');
		expect(perms).toContain('sessions:read');
		expect(perms).toContain('sessions:write');
		expect(perms).toContain('workflows:read');
		expect(perms).toContain('workflows:write');
		expect(perms).toContain('workflows:execute');
		expect(perms).toContain('admin:users');
		expect(perms).toContain('admin:orgs');
		expect(perms).toContain('admin:audit');
		expect(perms).toContain('admin:all');
	});

	it('falls back to viewer permissions for unknown role', () => {
		const perms = getPermissionsForRole('unknown');

		expect(perms).toEqual(getPermissionsForRole('viewer'));
	});

	it('falls back to viewer for empty string role', () => {
		const perms = getPermissionsForRole('');

		expect(perms).toEqual(getPermissionsForRole('viewer'));
	});

	it('viewer is least privileged', () => {
		const viewerPerms = getPermissionsForRole('viewer');
		const operatorPerms = getPermissionsForRole('operator');
		const adminPerms = getPermissionsForRole('admin');

		expect(viewerPerms.length).toBeLessThan(operatorPerms.length);
		expect(operatorPerms.length).toBeLessThan(adminPerms.length);
	});

	it('operator includes all viewer permissions', () => {
		const viewerPerms = getPermissionsForRole('viewer');
		const operatorPerms = getPermissionsForRole('operator');

		for (const perm of viewerPerms) {
			expect(operatorPerms).toContain(perm);
		}
	});

	it('admin includes all operator permissions', () => {
		const operatorPerms = getPermissionsForRole('operator');
		const adminPerms = getPermissionsForRole('admin');

		for (const perm of operatorPerms) {
			expect(adminPerms).toContain(perm);
		}
	});
});

describe('hasPermission()', () => {
	it('returns true when permission is in list', () => {
		const perms = getPermissionsForRole('viewer');
		expect(hasPermission(perms, 'tools:read')).toBe(true);
	});

	it('returns false when permission is not in list', () => {
		const perms = getPermissionsForRole('viewer');
		expect(hasPermission(perms, 'tools:execute')).toBe(false);
	});

	it('works with empty permission list', () => {
		expect(hasPermission([], 'tools:read')).toBe(false);
	});

	it('operator has tools:execute but viewer does not', () => {
		const viewerPerms = getPermissionsForRole('viewer');
		const operatorPerms = getPermissionsForRole('operator');

		expect(hasPermission(viewerPerms, 'tools:execute')).toBe(false);
		expect(hasPermission(operatorPerms, 'tools:execute')).toBe(true);
	});

	it('operator has sessions:write but viewer does not', () => {
		const viewerPerms = getPermissionsForRole('viewer');
		const operatorPerms = getPermissionsForRole('operator');

		expect(hasPermission(viewerPerms, 'sessions:write')).toBe(false);
		expect(hasPermission(operatorPerms, 'sessions:write')).toBe(true);
	});

	it('operator cannot execute workflows (only execute, not write)', () => {
		const operatorPerms = getPermissionsForRole('operator');

		expect(hasPermission(operatorPerms, 'workflows:execute')).toBe(true);
		expect(hasPermission(operatorPerms, 'workflows:write')).toBe(false);
	});

	it('admin has all permissions', () => {
		const adminPerms = getPermissionsForRole('admin');

		expect(hasPermission(adminPerms, 'tools:read')).toBe(true);
		expect(hasPermission(adminPerms, 'tools:danger')).toBe(true);
		expect(hasPermission(adminPerms, 'admin:all')).toBe(true);
		expect(hasPermission(adminPerms, 'workflows:write')).toBe(true);
	});

	it('case sensitive permission matching', () => {
		const perms = getPermissionsForRole('admin');

		expect(hasPermission(perms, 'tools:read')).toBe(true);
		// @ts-expect-error - deliberately test wrong case
		expect(hasPermission(perms, 'Tools:Read')).toBe(false);
	});

	it('all viewer permissions are grantable', () => {
		const viewerPerms = getPermissionsForRole('viewer');

		for (const perm of viewerPerms) {
			expect(hasPermission(viewerPerms, perm)).toBe(true);
		}
	});
});

describe('Permission type safety', () => {
	it('Permission type matches PERMISSIONS keys', () => {
		const viewer = getPermissionsForRole('viewer');

		// This should compile with type checking
		for (const perm of viewer) {
			// Verify it's a valid Permission key
			expect(Object.keys(PERMISSIONS)).toContain(perm);
		}
	});

	it('all valid permission values are in PERMISSIONS', () => {
		const allPerms = new Set<Permission>();

		for (const role of ['viewer', 'operator', 'admin']) {
			for (const perm of getPermissionsForRole(role)) {
				allPerms.add(perm as Permission);
			}
		}

		// Check they're all in PERMISSIONS
		for (const perm of allPerms) {
			expect(Object.keys(PERMISSIONS)).toContain(perm);
		}
	});
});

describe('Role hierarchy', () => {
	it('admin is superset of operator which is superset of viewer', () => {
		const viewer = getPermissionsForRole('viewer');
		const operator = getPermissionsForRole('operator');
		const admin = getPermissionsForRole('admin');

		// Check viewer ⊆ operator ⊆ admin
		for (const perm of viewer) {
			expect(operator).toContain(perm);
			expect(admin).toContain(perm);
		}

		for (const perm of operator) {
			expect(admin).toContain(perm);
		}
	});

	it('operator can approve tools but not manage danger tools', () => {
		const operatorPerms = getPermissionsForRole('operator');

		expect(hasPermission(operatorPerms, 'tools:approve')).toBe(true);
		expect(hasPermission(operatorPerms, 'tools:danger')).toBe(false);
	});

	it('admin can execute danger tools', () => {
		const adminPerms = getPermissionsForRole('admin');

		expect(hasPermission(adminPerms, 'tools:danger')).toBe(true);
	});

	it('viewer cannot execute or approve any tools', () => {
		const viewerPerms = getPermissionsForRole('viewer');

		expect(hasPermission(viewerPerms, 'tools:execute')).toBe(false);
		expect(hasPermission(viewerPerms, 'tools:approve')).toBe(false);
		expect(hasPermission(viewerPerms, 'tools:danger')).toBe(false);
	});

	it('only admin can access audit logs', () => {
		const viewer = getPermissionsForRole('viewer');
		const operator = getPermissionsForRole('operator');
		const admin = getPermissionsForRole('admin');

		expect(hasPermission(viewer, 'admin:audit')).toBe(false);
		expect(hasPermission(operator, 'admin:audit')).toBe(false);
		expect(hasPermission(admin, 'admin:audit')).toBe(true);
	});
});
