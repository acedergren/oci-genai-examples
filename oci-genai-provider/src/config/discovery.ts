/**
 * OCI Compartment Discovery
 *
 * Discovers available compartments from the OCI API for user selection
 * during setup. Shows compartment names (not just OCIDs) for a better UX.
 *
 * @example
 * ```typescript
 * import { discoverCompartments } from '@acedergren/oci-genai-provider/config';
 *
 * const compartments = await discoverCompartments('FRANKFURT');
 * for (const c of compartments) {
 *   console.log(`${c.name}: ${c.id}`);
 * }
 * ```
 */

import * as common from 'oci-common';
import * as identity from 'oci-identity';
import type { OCICompartment } from './types';

/**
 * Discover compartments from OCI API
 *
 * Lists all compartments accessible to the authenticated user,
 * including the root tenancy compartment.
 *
 * @param profileName - Profile name from ~/.oci/config (default: 'DEFAULT')
 * @param includeRoot - Include root compartment/tenancy (default: true)
 * @returns Array of compartments with their names and OCIDs
 *
 * @example
 * ```typescript
 * // Discover all compartments including root
 * const compartments = await discoverCompartments('FRANKFURT');
 *
 * // Discover compartments without root
 * const subCompartments = await discoverCompartments('FRANKFURT', false);
 * ```
 */
export async function discoverCompartments(
  profileName = 'DEFAULT',
  includeRoot = true
): Promise<OCICompartment[]> {
  const authProvider = new common.ConfigFileAuthenticationDetailsProvider(undefined, profileName);

  const identityClient = new identity.IdentityClient({
    authenticationDetailsProvider: authProvider,
  });

  // Get tenancy ID (root compartment)
  const tenancyId = await authProvider.getTenantId();

  const compartments: OCICompartment[] = [];

  // Optionally include root compartment (tenancy)
  if (includeRoot) {
    const tenancy = await identityClient.getTenancy({ tenancyId });
    compartments.push({
      id: tenancyId,
      name: tenancy.tenancy.name || 'root',
      description: 'Root compartment (tenancy)',
      lifecycleState: 'ACTIVE',
    });
  }

  // List all compartments under the tenancy
  // Using 'ACTIVE' string instead of enum to avoid mock issues
  const response = await identityClient.listCompartments({
    compartmentId: tenancyId,
    compartmentIdInSubtree: true,
    lifecycleState: 'ACTIVE' as identity.models.Compartment.LifecycleState,
  });

  for (const compartment of response.items) {
    compartments.push({
      id: compartment.id,
      name: compartment.name,
      description: compartment.description,
      lifecycleState: compartment.lifecycleState,
    });
  }

  return compartments;
}
