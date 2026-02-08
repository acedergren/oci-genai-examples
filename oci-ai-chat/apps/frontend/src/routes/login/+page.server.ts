import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		// Fetch enabled IDPs for login page
		const response = await fetch('/api/admin/idp');

		if (response.ok) {
			const idps = await response.json();
			// Filter to only enabled IDPs
			const enabledIdps = idps.filter((idp: { enabled: boolean }) => idp.enabled);
			return {
				idps: enabledIdps
			};
		}
	} catch (error) {
		console.error('Failed to fetch IDPs:', error);
	}

	return {
		idps: []
	};
};
