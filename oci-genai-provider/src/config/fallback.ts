/**
 * Fallback Utilities for OCI Configuration
 *
 * Provides utilities for users who don't have OCI CLI installed,
 * including manual configuration options and environment variable support.
 *
 * @example
 * ```typescript
 * import {
 *   OCI_REGIONS,
 *   profileFromEnvironment,
 *   getSetupInstructions,
 * } from '@acedergren/oci-genai-provider/config';
 *
 * // Check for environment-based profile
 * const envProfile = profileFromEnvironment();
 * if (envProfile) {
 *   console.log(`Using profile from environment: ${envProfile.region}`);
 * } else {
 *   console.log(getSetupInstructions());
 * }
 * ```
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { OCIProfile } from './types';

/**
 * Available OCI regions with GenAI service support
 *
 * These regions have OCI Generative AI service available.
 * Not all models are available in all regions - check OCI documentation.
 */
export const OCI_REGIONS = [
  { id: 'eu-frankfurt-1', name: 'Germany Central (Frankfurt)' },
  { id: 'eu-stockholm-1', name: 'Sweden Central (Stockholm)' },
  { id: 'us-ashburn-1', name: 'US East (Ashburn)' },
  { id: 'us-chicago-1', name: 'US Midwest (Chicago)' },
  { id: 'us-phoenix-1', name: 'US West (Phoenix)' },
  { id: 'uk-london-1', name: 'UK South (London)' },
  { id: 'ap-tokyo-1', name: 'Japan East (Tokyo)' },
  { id: 'ap-osaka-1', name: 'Japan Central (Osaka)' },
  { id: 'ap-mumbai-1', name: 'India West (Mumbai)' },
  { id: 'ap-sydney-1', name: 'Australia East (Sydney)' },
  { id: 'ap-melbourne-1', name: 'Australia Southeast (Melbourne)' },
  { id: 'ca-toronto-1', name: 'Canada Southeast (Toronto)' },
  { id: 'ca-montreal-1', name: 'Canada Northeast (Montreal)' },
  { id: 'sa-saopaulo-1', name: 'Brazil East (São Paulo)' },
  { id: 'me-dubai-1', name: 'UAE East (Dubai)' },
  { id: 'me-jeddah-1', name: 'Saudi Arabia West (Jeddah)' },
] as const;

export type OCIRegionId = (typeof OCI_REGIONS)[number]['id'];

/**
 * Information needed for manual OCI setup
 *
 * These values are required to create an ~/.oci/config file manually.
 */
export interface ManualSetupInfo {
  /** User OCID (ocid1.user.oc1...) */
  user: string;
  /** API key fingerprint (aa:bb:cc:...) */
  fingerprint: string;
  /** Path to private key file */
  keyFilePath: string;
  /** Tenancy OCID (ocid1.tenancy.oc1...) */
  tenancy: string;
  /** OCI region */
  region: OCIRegionId | string;
  /** Profile name (e.g., "DEFAULT", "FRANKFURT") */
  profileName: string;
}

/**
 * Create ~/.oci directory if it doesn't exist
 *
 * @returns Path to the OCI directory
 */
export function ensureOCIDirectory(): string {
  const ociDir = path.join(os.homedir(), '.oci');
  if (!fs.existsSync(ociDir)) {
    fs.mkdirSync(ociDir, { recursive: true, mode: 0o700 });
  }
  return ociDir;
}

/**
 * Generate OCI config file content from manual setup info
 *
 * @param info - Manual setup information
 * @returns INI-formatted config content
 */
export function generateConfigContent(info: ManualSetupInfo): string {
  return `[${info.profileName}]
user=${info.user}
fingerprint=${info.fingerprint}
key_file=${info.keyFilePath}
tenancy=${info.tenancy}
region=${info.region}
`;
}

/**
 * Write OCI config file
 *
 * @param info - Manual setup information
 * @param append - Append to existing config (default: false)
 *
 * @example
 * ```typescript
 * writeOCIConfig({
 *   user: 'ocid1.user.oc1..aaaa...',
 *   fingerprint: 'aa:bb:cc:...',
 *   keyFilePath: '~/.oci/oci_api_key.pem',
 *   tenancy: 'ocid1.tenancy.oc1..aaaa...',
 *   region: 'eu-frankfurt-1',
 *   profileName: 'FRANKFURT',
 * });
 * ```
 */
export function writeOCIConfig(info: ManualSetupInfo, append = false): void {
  const ociDir = ensureOCIDirectory();
  const configPath = path.join(ociDir, 'config');

  const content = generateConfigContent(info);

  if (append && fs.existsSync(configPath)) {
    fs.appendFileSync(configPath, '\n' + content);
  } else {
    fs.writeFileSync(configPath, content, { mode: 0o600 });
  }
}

/**
 * Create a profile from environment variables
 *
 * Required environment variables:
 * - OCI_USER_OCID: User OCID
 * - OCI_FINGERPRINT: API key fingerprint
 * - OCI_KEY_FILE: Path to private key file
 * - OCI_TENANCY_OCID: Tenancy OCID
 * - OCI_REGION: OCI region
 *
 * @returns Profile or undefined if required env vars are not set
 *
 * @example
 * ```typescript
 * const profile = profileFromEnvironment();
 * if (profile) {
 *   console.log(`Using ${profile.name} profile from environment`);
 * }
 * ```
 */
export function profileFromEnvironment(): OCIProfile | undefined {
  const user = process.env.OCI_USER_OCID;
  const fingerprint = process.env.OCI_FINGERPRINT;
  const keyFile = process.env.OCI_KEY_FILE;
  const tenancy = process.env.OCI_TENANCY_OCID;
  const region = process.env.OCI_REGION;

  if (!user || !fingerprint || !keyFile || !tenancy || !region) {
    return undefined;
  }

  const expandedKeyFile = keyFile.startsWith('~')
    ? path.join(os.homedir(), keyFile.slice(1))
    : keyFile;

  return {
    name: 'ENV',
    user,
    fingerprint,
    keyFile: expandedKeyFile,
    keyFileValid: fs.existsSync(expandedKeyFile),
    tenancy,
    region,
  };
}

/**
 * Get setup instructions for users without OCI CLI
 *
 * Returns human-readable instructions for setting up OCI credentials.
 *
 * @returns Setup instructions string
 */
export function getSetupInstructions(): string {
  return `
To use OCI GenAI, you need OCI credentials configured.

Option 1: Install OCI CLI (Recommended)
  1. Install: https://docs.oracle.com/iaas/Content/API/SDKDocs/cliinstall.htm
  2. Run: oci setup config
  3. Re-run this setup tool

Option 2: Manual Configuration
  1. Create an API key in OCI Console (Identity > Users > Your User > API Keys)
  2. Download the private key
  3. Note your User OCID, Tenancy OCID, and Fingerprint
  4. Create ~/.oci/config with these values

Option 3: Environment Variables
  Set these in your shell:
    export OCI_USER_OCID=ocid1.user.oc1..aaaa...
    export OCI_FINGERPRINT=aa:bb:cc:...
    export OCI_KEY_FILE=~/.oci/oci_api_key.pem
    export OCI_TENANCY_OCID=ocid1.tenancy.oc1..aaaa...
    export OCI_REGION=eu-frankfurt-1
    export OCI_COMPARTMENT_ID=ocid1.compartment.oc1..aaaa...
`;
}

/**
 * Known OCID types for validation
 */
const OCID_TYPES = [
  'user',
  'compartment',
  'tenancy',
  'instance',
  'group',
  'policy',
  'vcn',
  'subnet',
] as const;

type OCIDType = (typeof OCID_TYPES)[number];

/**
 * Validate an OCID format
 *
 * @param ocid - OCID to validate
 * @param type - Expected type (e.g., 'user', 'compartment', 'tenancy')
 * @returns true if OCID format is valid
 */
export function isValidOCID(ocid: string, type?: OCIDType): boolean {
  // Basic OCID format: ocid1.<type>.<realm>.<region>.<unique-id>
  const basicPattern = /^ocid1\.[a-z]+\.[a-z0-9]+\..+$/;
  if (!basicPattern.test(ocid)) {
    return false;
  }

  if (type) {
    // Extract the type from the OCID (second segment)
    const parts = ocid.split('.');
    if (parts.length < 3) {
      return false;
    }
    const ocidType = parts[1];
    return ocidType === type;
  }

  return true;
}

/**
 * Get region name from region ID
 *
 * @param regionId - Region identifier (e.g., 'eu-frankfurt-1')
 * @returns Region display name or the ID if not found
 */
export function getRegionName(regionId: string): string {
  const region = OCI_REGIONS.find((r) => r.id === regionId);
  return region?.name || regionId;
}
