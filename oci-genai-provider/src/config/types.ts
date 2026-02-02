/**
 * Config module types for OCI auto-discovery
 *
 * These types support parsing ~/.oci/config and discovering
 * available profiles, regions, and compartments.
 */

/**
 * Parsed profile from ~/.oci/config
 *
 * Represents a single [PROFILE_NAME] section from the OCI config file.
 * All fields are extracted from the INI-style config.
 */
export interface OCIProfile {
  /** Profile name (e.g., "DEFAULT", "FRANKFURT") */
  name: string;
  /** Region (e.g., "eu-frankfurt-1") */
  region: string;
  /** User OCID */
  user: string;
  /** Tenancy OCID */
  tenancy: string;
  /** Key fingerprint */
  fingerprint: string;
  /** Path to private key file (expanded from ~) */
  keyFile: string;
  /** Whether key file exists and is readable */
  keyFileValid: boolean;
}

/**
 * Result of parsing ~/.oci/config
 *
 * Contains all discovered profiles and metadata about the config file itself.
 */
export interface OCIConfigResult {
  /** Whether config file was found */
  found: boolean;
  /** Path to config file */
  path: string;
  /** Parsed profiles */
  profiles: OCIProfile[];
  /** Error message if parsing failed */
  error?: string;
}

/**
 * Discovered compartment from OCI API
 *
 * Represents a compartment returned by the Identity service's ListCompartments API.
 */
export interface OCICompartment {
  /** Compartment OCID */
  id: string;
  /** Compartment name */
  name: string;
  /** Compartment description */
  description?: string;
  /** Lifecycle state (ACTIVE, INACTIVE, DELETING, etc.) */
  lifecycleState: string;
}

/**
 * Result of credential validation
 *
 * Returned by validateCredentials() after testing API connectivity.
 */
export interface ValidationResult {
  /** Whether credentials are valid */
  valid: boolean;
  /** User display name if valid */
  userName?: string;
  /** User email if valid */
  userEmail?: string;
  /** Error message if invalid */
  error?: string;
}
