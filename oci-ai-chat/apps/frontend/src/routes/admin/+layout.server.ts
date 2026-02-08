import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.auth();

	// Check if user is authenticated
	if (!session?.user) {
		throw redirect(303, '/login');
	}

	// Check if user has admin permissions
	// TODO: Replace with actual RBAC check when available
	// For now, allow access if user is authenticated
	// const hasAdminAccess = session.user.permissions?.includes('admin:all');
	// if (!hasAdminAccess) {
	// 	throw redirect(303, '/');
	// }

	return {
		user: session.user
	};
};
