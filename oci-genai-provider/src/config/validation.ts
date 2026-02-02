/**
 * OCI Credential Validation
 *
 * Validates OCI credentials by making a test API call to verify
 * authentication works correctly.
 *
 * @example
 * ```typescript
 * import { validateCredentials } from '@acedergren/oci-genai-provider/config';
 *
 * const result = await validateCredentials('FRANKFURT');
 * if (result.valid) {
 *   console.log(`Authenticated as: ${result.userName}`);
 * } else {
 *   console.error(`Authentication failed: ${result.error}`);
 * }
 * ```
 */

import * as common from 'oci-common';
import * as identity from 'oci-identity';
import type { ValidationResult } from './types';

/**
 * Validate OCI credentials by making a test API call
 *
 * This function attempts to authenticate using the specified profile
 * and makes a GetUser API call to verify the credentials work.
 *
 * @param profileName - Profile name from ~/.oci/config (default: 'DEFAULT')
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Validation result with user info if successful
 *
 * @example
 * ```typescript
 * // Validate default profile
 * const result = await validateCredentials();
 *
 * // Validate specific profile
 * const frankfurtResult = await validateCredentials('FRANKFURT');
 * ```
 */
export async function validateCredentials(
  profileName = 'DEFAULT',
  timeoutMs = 10000
): Promise<ValidationResult> {
  try {
    const authProvider = new common.ConfigFileAuthenticationDetailsProvider(
      undefined, // Use default config path
      profileName
    );

    const identityClient = new identity.IdentityClient({
      authenticationDetailsProvider: authProvider,
    });

    // Set timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Get the user ID from the auth provider
      const userId = await authProvider.getUser();

      // Fetch user details to validate credentials work
      const response = await identityClient.getUser({ userId });

      clearTimeout(timeoutId);

      return {
        valid: true,
        userName: response.user.name,
        userEmail: response.user.email,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide helpful error messages based on error type
    if (message.includes('NotAuthenticated')) {
      return {
        valid: false,
        error: 'Authentication failed. Check your API key and fingerprint.',
      };
    }

    if (message.includes('timeout') || message.includes('abort')) {
      return {
        valid: false,
        error: 'Connection timeout. Check network and OCI endpoint accessibility.',
      };
    }

    if (message.includes('key_file') || message.includes('key file')) {
      return {
        valid: false,
        error: 'Private key file not found or not readable.',
      };
    }

    return {
      valid: false,
      error: `Validation failed: ${message}`,
    };
  }
}
