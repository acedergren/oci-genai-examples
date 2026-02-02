/**
 * OCI Config Utilities
 *
 * This module provides utilities for auto-discovering OCI configuration,
 * validating credentials, and discovering compartments. It's designed
 * to be imported via subpath: `@acedergren/oci-genai-provider/config`
 *
 * Key features:
 * - Parse ~/.oci/config to discover profiles
 * - Validate credentials via OCI API
 * - Discover compartments automatically
 * - Fallback options for users without OCI CLI
 *
 * @example
 * ```typescript
 * import {
 *   parseOCIConfig,
 *   validateCredentials,
 *   discoverCompartments,
 *   OCI_REGIONS,
 * } from '@acedergren/oci-genai-provider/config';
 *
 * // Auto-discover profiles from ~/.oci/config
 * const config = parseOCIConfig();
 * if (config.found) {
 *   for (const profile of config.profiles) {
 *     console.log(`${profile.name}: ${profile.region}`);
 *   }
 * }
 *
 * // Validate credentials
 * const result = await validateCredentials('FRANKFURT');
 * if (result.valid) {
 *   console.log(`Authenticated as: ${result.userName}`);
 * }
 *
 * // Discover compartments
 * const compartments = await discoverCompartments('FRANKFURT');
 * for (const c of compartments) {
 *   console.log(`${c.name}: ${c.id}`);
 * }
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type { OCIProfile, OCIConfigResult, OCICompartment, ValidationResult } from './types';

// ============================================================================
// OCI Config Parsing
// ============================================================================

export { parseOCIConfig, hasOCIConfig, getConfigPath, getProfile, expandPath } from './oci-config';

// ============================================================================
// Credential Validation
// ============================================================================

export { validateCredentials } from './validation';

// ============================================================================
// Compartment Discovery
// ============================================================================

export { discoverCompartments } from './discovery';

// ============================================================================
// Fallback Utilities
// ============================================================================

export {
  OCI_REGIONS,
  type OCIRegionId,
  type ManualSetupInfo,
  ensureOCIDirectory,
  generateConfigContent,
  writeOCIConfig,
  profileFromEnvironment,
  getSetupInstructions,
  isValidOCID,
  getRegionName,
} from './fallback';
