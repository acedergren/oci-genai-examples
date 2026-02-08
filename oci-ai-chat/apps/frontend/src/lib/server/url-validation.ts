/**
 * URL validation utilities with SSRF prevention.
 *
 * Provides validation for URLs that will be fetched by the server,
 * preventing Server-Side Request Forgery (SSRF) attacks by blocking
 * private IP ranges, loopback addresses, and cloud metadata endpoints.
 */

/**
 * Validate a URL is safe to fetch (SSRF prevention).
 *
 * Blocks:
 * - Non-HTTPS URLs
 * - Private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x)
 * - Loopback (localhost, [::1])
 * - Link-local (169.254.x — cloud metadata)
 * - Internal hostnames (*.internal)
 * - Zero address (0.0.0.0)
 *
 * Use this before fetching any user-supplied URL to prevent SSRF attacks.
 *
 * @param url - The URL to validate
 * @returns true if the URL is safe to fetch, false otherwise
 */
export function isValidExternalUrl(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}

	// Require HTTPS
	if (parsed.protocol !== 'https:') {
		return false;
	}

	const hostname = parsed.hostname.toLowerCase();

	// Block localhost and loopback
	if (hostname === 'localhost' || hostname === '[::1]' || hostname === '::1') {
		return false;
	}

	// Block internal hostnames
	if (hostname.endsWith('.internal')) {
		return false;
	}

	// Block private IP ranges
	const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipMatch) {
		const [, a, b] = ipMatch.map(Number);

		// 10.0.0.0/8
		if (a === 10) return false;

		// 127.0.0.0/8
		if (a === 127) return false;

		// 172.16.0.0/12
		if (a === 172 && b >= 16 && b <= 31) return false;

		// 192.168.0.0/16
		if (a === 192 && b === 168) return false;

		// 169.254.0.0/16 (link-local / cloud metadata)
		if (a === 169 && b === 254) return false;

		// 0.0.0.0
		if (a === 0) return false;
	}

	return true;
}
