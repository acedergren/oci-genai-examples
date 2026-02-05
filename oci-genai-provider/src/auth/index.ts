import * as common from 'oci-common';
import type { OCIConfig } from '../types';

/**
 * Get compartment ID from config, environment, or config file
 */
export function getCompartmentId(config: OCIConfig): string {
  // Priority: config > environment > error
  const compartmentId = config.compartmentId || process.env.OCI_COMPARTMENT_ID;

  if (!compartmentId) {
    throw new Error(
      'Compartment ID not found. Provide via config.compartmentId or OCI_COMPARTMENT_ID environment variable.'
    );
  }

  return compartmentId;
}

/**
 * Get region from config or environment
 */
export function getRegion(config: OCIConfig): string {
  return config.region || process.env.OCI_REGION || 'eu-frankfurt-1';
}

/**
 * Create OCI authentication provider based on configuration
 */
export async function createAuthProvider(
  config: OCIConfig
): Promise<common.AuthenticationDetailsProvider> {
  const authMethod = config.auth || 'config_file';

  switch (authMethod) {
    case 'config_file': {
      const configPath = config.configPath || undefined;
      const profile = config.profile || 'DEFAULT';

      return new common.ConfigFileAuthenticationDetailsProvider(configPath, profile);
    }

    case 'instance_principal': {
      const builder = new common.InstancePrincipalsAuthenticationDetailsProviderBuilder();
      return await builder.build();
    }

    case 'resource_principal': {
      return common.ResourcePrincipalAuthenticationDetailsProvider.builder();
    }

    case 'api_key': {
      // Environment variable-based authentication for serverless environments
      const tenancyId = process.env.OCI_TENANCY_OCID;
      const userId = process.env.OCI_USER_OCID;
      const fingerprint = process.env.OCI_FINGERPRINT;
      const privateKey = process.env.OCI_PRIVATE_KEY;
      const passphrase = process.env.OCI_PRIVATE_KEY_PASSPHRASE || null;

      if (!tenancyId || !userId || !fingerprint || !privateKey) {
        throw new Error(
          'API key authentication requires environment variables: ' +
            'OCI_TENANCY_OCID, OCI_USER_OCID, OCI_FINGERPRINT, OCI_PRIVATE_KEY. ' +
            'Optionally set OCI_PRIVATE_KEY_PASSPHRASE if key is encrypted.'
        );
      }

      const region = getRegion(config);
      return new common.SimpleAuthenticationDetailsProvider(
        tenancyId,
        userId,
        fingerprint,
        privateKey,
        passphrase,
        common.Region.fromRegionId(region)
      );
    }

    default:
      throw new Error(
        `Unsupported authentication method: ${authMethod as string}. ` +
          `Supported methods: config_file, instance_principal, resource_principal, api_key`
      );
  }
}
