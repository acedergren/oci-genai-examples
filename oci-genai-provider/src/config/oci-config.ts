/**
 * OCI Config Parser
 *
 * Parses ~/.oci/config to discover available profiles with their
 * regions, credentials, and tenancy information. This module is
 * the foundation for auto-discovery in the setup CLI.
 *
 * @example
 * ```typescript
 * import { parseOCIConfig, getProfile, hasOCIConfig } from '@acedergren/oci-genai-provider/config';
 *
 * // Check if OCI config exists
 * if (hasOCIConfig()) {
 *   // Parse all profiles
 *   const result = parseOCIConfig();
 *   console.log(`Found ${result.profiles.length} profile(s)`);
 *
 *   // Get a specific profile
 *   const profile = getProfile('FRANKFURT');
 *   console.log(`Region: ${profile?.region}`);
 * }
 * ```
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { OCIProfile, OCIConfigResult } from './types';

/**
 * Default OCI config file location
 */
const DEFAULT_CONFIG_PATH = '~/.oci/config';

/**
 * Expand ~ to home directory in paths
 *
 * @param filePath - Path that may start with ~
 * @returns Expanded absolute path
 *
 * @example
 * ```typescript
 * expandPath('~/.oci/key.pem') // => '/home/user/.oci/key.pem'
 * expandPath('/absolute/path') // => '/absolute/path'
 * ```
 */
export function expandPath(filePath: string): string {
  if (!filePath) return filePath;
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Get the OCI config file path
 *
 * Returns the path specified in OCI_CONFIG_FILE environment variable,
 * or the default ~/.oci/config path.
 *
 * @returns Resolved config file path
 */
export function getConfigPath(): string {
  return expandPath(process.env.OCI_CONFIG_FILE || DEFAULT_CONFIG_PATH);
}

/**
 * Check if OCI config file exists and has content
 *
 * Use this before attempting to parse to give users helpful
 * guidance when config is missing.
 *
 * @returns true if config exists and is non-empty
 *
 * @example
 * ```typescript
 * if (!hasOCIConfig()) {
 *   console.log('Please run: oci setup config');
 * }
 * ```
 */
export function hasOCIConfig(): boolean {
  const configPath = getConfigPath();
  try {
    return fs.existsSync(configPath) && fs.statSync(configPath).size > 0;
  } catch {
    return false;
  }
}

/**
 * Parse INI-style OCI config file
 *
 * Handles the OCI config format with [SECTION] headers and key=value pairs.
 * Comments (#, ;) and empty lines are ignored.
 *
 * @internal
 */
function parseINI(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = '';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    // Section header [SECTION_NAME]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result[currentSection] = {};
      continue;
    }

    // Key=value pair
    const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (kvMatch && currentSection) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      result[currentSection][key] = value;
    }
  }

  return result;
}

/**
 * Parse ~/.oci/config and return all profiles
 *
 * This is the main entry point for config discovery. It reads the
 * OCI config file and extracts all profiles with their settings.
 *
 * @param configPath - Optional custom config path (defaults to ~/.oci/config)
 * @returns Parsed config result with profiles
 *
 * @example
 * ```typescript
 * const result = parseOCIConfig();
 *
 * if (result.found) {
 *   for (const profile of result.profiles) {
 *     console.log(`${profile.name}: ${profile.region}`);
 *   }
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function parseOCIConfig(configPath?: string): OCIConfigResult {
  const resolvedPath = configPath ? expandPath(configPath) : getConfigPath();

  if (!fs.existsSync(resolvedPath)) {
    return {
      found: false,
      path: resolvedPath,
      profiles: [],
      error: `Config file not found at ${resolvedPath}`,
    };
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const parsed = parseINI(content);

    const profiles: OCIProfile[] = Object.entries(parsed).map(([name, values]) => {
      const keyFile = expandPath(values.key_file || '');
      const keyFileValid = keyFile ? fs.existsSync(keyFile) : false;

      return {
        name,
        region: values.region || '',
        user: values.user || '',
        tenancy: values.tenancy || '',
        fingerprint: values.fingerprint || '',
        keyFile,
        keyFileValid,
      };
    });

    return {
      found: true,
      path: resolvedPath,
      profiles,
    };
  } catch (error) {
    return {
      found: false,
      path: resolvedPath,
      profiles: [],
      error: `Failed to parse config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get a specific profile by name
 *
 * Convenience function for getting a single profile. Returns undefined
 * if the profile doesn't exist or config file is not found.
 *
 * @param profileName - Profile name (default: 'DEFAULT')
 * @returns Profile or undefined if not found
 *
 * @example
 * ```typescript
 * const profile = getProfile('FRANKFURT');
 * if (profile) {
 *   console.log(`Using region: ${profile.region}`);
 * }
 * ```
 */
export function getProfile(profileName = 'DEFAULT'): OCIProfile | undefined {
  const result = parseOCIConfig();
  if (!result.found) return undefined;
  return result.profiles.find((p) => p.name === profileName);
}
