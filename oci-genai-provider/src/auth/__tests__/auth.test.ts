import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createAuthProvider, getCompartmentId, getRegion } from '../index';
import type { OCIConfig } from '../../types';

// Mock OCI SDK
jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => ({
    type: 'config_file',
  })),
  InstancePrincipalsAuthenticationDetailsProviderBuilder: jest.fn().mockImplementation(() => ({
    // @ts-expect-error - Jest mock type limitation
    build: jest.fn().mockResolvedValue({ type: 'instance_principal' }),
  })),
  ResourcePrincipalAuthenticationDetailsProvider: {
    builder: jest.fn().mockReturnValue({ type: 'resource_principal' }),
  },
  Region: {
    EU_FRANKFURT_1: 'eu-frankfurt-1',
  },
}));

describe('createAuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create config file auth provider by default', async () => {
    const config: OCIConfig = {
      region: 'eu-frankfurt-1',
    };

    const provider = await createAuthProvider(config);

    expect(provider).toBeDefined();
  });

  it('should use custom profile when provided', async () => {
    const config: OCIConfig = {
      region: 'eu-frankfurt-1',
      profile: 'FRANKFURT',
    };

    const provider = await createAuthProvider(config);

    expect(provider).toBeDefined();
  });

  it('should create instance principal auth when specified', async () => {
    const config: OCIConfig = {
      region: 'eu-frankfurt-1',
      auth: 'instance_principal',
    };

    const provider = await createAuthProvider(config);

    expect(provider).toBeDefined();
  });

  it('should throw error for unsupported auth method', async () => {
    const config: OCIConfig = {
      region: 'eu-frankfurt-1',
      auth: 'unsupported' as OCIConfig['auth'],
    };

    await expect(createAuthProvider(config)).rejects.toThrow('Unsupported authentication method');
  });

  it('should create resource principal auth when specified', async () => {
    const config: OCIConfig = {
      region: 'eu-frankfurt-1',
      auth: 'resource_principal',
    };

    const provider = await createAuthProvider(config);

    expect(provider).toBeDefined();
  });

  it('should use custom config path when provided', async () => {
    const config: OCIConfig = {
      region: 'eu-frankfurt-1',
      configPath: '/custom/path/.oci/config',
    };

    const provider = await createAuthProvider(config);

    expect(provider).toBeDefined();
  });
});

describe('getCompartmentId', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return compartment ID from config', () => {
    const config: OCIConfig = {
      compartmentId: 'ocid1.compartment.oc1..config',
    };

    expect(getCompartmentId(config)).toBe('ocid1.compartment.oc1..config');
  });

  it('should return compartment ID from environment when not in config', () => {
    process.env.OCI_COMPARTMENT_ID = 'ocid1.compartment.oc1..env';
    const config: OCIConfig = {};

    expect(getCompartmentId(config)).toBe('ocid1.compartment.oc1..env');
  });

  it('should prioritize config over environment', () => {
    process.env.OCI_COMPARTMENT_ID = 'ocid1.compartment.oc1..env';
    const config: OCIConfig = {
      compartmentId: 'ocid1.compartment.oc1..config',
    };

    expect(getCompartmentId(config)).toBe('ocid1.compartment.oc1..config');
  });

  it('should throw error when no compartment ID available', () => {
    delete process.env.OCI_COMPARTMENT_ID;
    const config: OCIConfig = {};

    expect(() => getCompartmentId(config)).toThrow('Compartment ID not found');
  });
});

describe('getRegion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return region from config', () => {
    const config: OCIConfig = {
      region: 'us-ashburn-1',
    };

    expect(getRegion(config)).toBe('us-ashburn-1');
  });

  it('should return region from environment when not in config', () => {
    process.env.OCI_REGION = 'eu-stockholm-1';
    const config: OCIConfig = {};

    expect(getRegion(config)).toBe('eu-stockholm-1');
  });

  it('should use Frankfurt as default', () => {
    delete process.env.OCI_REGION;
    const config: OCIConfig = {};

    expect(getRegion(config)).toBe('eu-frankfurt-1');
  });

  it('should prioritize config over environment', () => {
    process.env.OCI_REGION = 'eu-stockholm-1';
    const config: OCIConfig = {
      region: 'us-ashburn-1',
    };

    expect(getRegion(config)).toBe('us-ashburn-1');
  });
});
