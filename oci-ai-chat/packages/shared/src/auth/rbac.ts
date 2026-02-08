// ============================================================================
// Permissions
// ============================================================================

export const PERMISSIONS = {
	'tools:read': 'View tool definitions and results',
	'tools:execute': 'Execute auto-approved tools',
	'tools:approve': 'Approve/reject tool executions',
	'tools:danger': 'Execute danger-level tools',
	'sessions:read': 'View chat sessions',
	'sessions:write': 'Create/modify chat sessions',
	'workflows:read': 'View workflow definitions and runs',
	'workflows:write': 'Create/modify workflow definitions',
	'workflows:execute': 'Execute workflows',
	'admin:users': 'Manage users',
	'admin:orgs': 'Manage organizations',
	'admin:audit': 'View audit logs',
	'admin:all': 'Full admin access'
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ============================================================================
// Role -> Permission mapping
// ============================================================================

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
	viewer: ['tools:read', 'sessions:read', 'workflows:read'],
	operator: [
		'tools:read',
		'tools:execute',
		'tools:approve',
		'sessions:read',
		'sessions:write',
		'workflows:read',
		'workflows:execute'
	],
	admin: Object.keys(PERMISSIONS) as Permission[]
};

/**
 * Get the list of permissions for a given org role.
 * Falls back to viewer permissions for unknown roles.
 */
export function getPermissionsForRole(role: string): Permission[] {
	return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['viewer'];
}

/**
 * Check whether a set of user permissions includes the required one.
 * The `admin:all` permission acts as a wildcard — if present, any permission check passes.
 */
export function hasPermission(userPermissions: Permission[], required: Permission): boolean {
	return userPermissions.includes(required) || userPermissions.includes('admin:all');
}
