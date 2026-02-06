import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Mock node:fs before importing the module under test
jest.mock('node:fs');

const mockFs = jest.mocked(fs);

// Import after mocks are set up
import { parseOCIConfig, expandPath, hasOCIConfig, getConfigPath, getProfile } from '../oci-config';

// Helper to get expected config path
const getExpectedConfigPath = () => path.join(os.homedir(), '.oci/config');

describe('parseOCIConfig', () => {
  const expectedConfigPath = getExpectedConfigPath();

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OCI_CONFIG_FILE;
  });

  it('should parse a valid OCI config file', () => {
    const homeDir = os.homedir();
    const configContent = `
[DEFAULT]
user=ocid1.user.oc1..aaaadefault
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
key_file=~/.oci/oci_api_key.pem
tenancy=ocid1.tenancy.oc1..aaaatenancy
region=us-ashburn-1

[FRANKFURT]
user=ocid1.user.oc1..aaaafrankfurt
fingerprint=11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00
key_file=~/.oci/frankfurt_key.pem
tenancy=ocid1.tenancy.oc1..aaaatenancy
region=eu-frankfurt-1
`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === expectedConfigPath) return true;
      if (p === path.join(homeDir, '.oci/oci_api_key.pem')) return true;
      if (p === path.join(homeDir, '.oci/frankfurt_key.pem')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(configContent);
    mockFs.statSync.mockReturnValue({ size: configContent.length } as fs.Stats);

    const result = parseOCIConfig();

    expect(result.found).toBe(true);
    expect(result.profiles).toHaveLength(2);
    expect(result.profiles[0].name).toBe('DEFAULT');
    expect(result.profiles[0].region).toBe('us-ashburn-1');
    expect(result.profiles[0].user).toBe('ocid1.user.oc1..aaaadefault');
    expect(result.profiles[0].tenancy).toBe('ocid1.tenancy.oc1..aaaatenancy');
    expect(result.profiles[0].keyFileValid).toBe(true);
    expect(result.profiles[1].name).toBe('FRANKFURT');
    expect(result.profiles[1].region).toBe('eu-frankfurt-1');
    expect(result.profiles[1].keyFileValid).toBe(true);
  });

  it('should return found=false when config file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = parseOCIConfig();

    expect(result.found).toBe(false);
    expect(result.profiles).toHaveLength(0);
    expect(result.error).toContain('not found');
  });

  it('should handle missing key files gracefully', () => {
    const configContent = `
[DEFAULT]
user=ocid1.user.oc1..aaaa
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
key_file=~/.oci/missing_key.pem
tenancy=ocid1.tenancy.oc1..aaaa
region=us-ashburn-1
`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === expectedConfigPath) return true;
      return false; // key file doesn't exist
    });
    mockFs.readFileSync.mockReturnValue(configContent);
    mockFs.statSync.mockReturnValue({ size: configContent.length } as fs.Stats);

    const result = parseOCIConfig();

    expect(result.found).toBe(true);
    expect(result.profiles[0].keyFileValid).toBe(false);
  });

  it('should handle comments and empty lines', () => {
    const homeDir = os.homedir();
    const configContent = `
# This is a comment
; This is also a comment

[DEFAULT]
user=ocid1.user.oc1..aaaa
# inline comment above fingerprint
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
key_file=~/.oci/key.pem
tenancy=ocid1.tenancy.oc1..aaaa
region=us-ashburn-1

`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === expectedConfigPath) return true;
      if (p === path.join(homeDir, '.oci/key.pem')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(configContent);
    mockFs.statSync.mockReturnValue({ size: configContent.length } as fs.Stats);

    const result = parseOCIConfig();

    expect(result.found).toBe(true);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].name).toBe('DEFAULT');
  });

  it('should handle custom config path', () => {
    const configContent = `
[CUSTOM]
user=ocid1.user.oc1..custom
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
key_file=/custom/path/key.pem
tenancy=ocid1.tenancy.oc1..custom
region=eu-stockholm-1
`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === '/custom/config') return true;
      if (p === '/custom/path/key.pem') return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(configContent);

    const result = parseOCIConfig('/custom/config');

    expect(result.found).toBe(true);
    expect(result.path).toBe('/custom/config');
    expect(result.profiles[0].name).toBe('CUSTOM');
    expect(result.profiles[0].keyFile).toBe('/custom/path/key.pem');
  });
});

describe('expandPath', () => {
  const homeDir = os.homedir();

  it('should expand ~ to home directory', () => {
    expect(expandPath('~/.oci/key.pem')).toBe(path.join(homeDir, '.oci/key.pem'));
  });

  it('should expand ~/subdir paths', () => {
    expect(expandPath('~/some/nested/path')).toBe(path.join(homeDir, 'some/nested/path'));
  });

  it('should leave absolute paths unchanged', () => {
    expect(expandPath('/absolute/path/key.pem')).toBe('/absolute/path/key.pem');
  });

  it('should leave relative paths unchanged', () => {
    expect(expandPath('relative/path/key.pem')).toBe('relative/path/key.pem');
  });

  it('should handle empty string', () => {
    expect(expandPath('')).toBe('');
  });
});

describe('hasOCIConfig', () => {
  const expectedConfigPath = getExpectedConfigPath();

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OCI_CONFIG_FILE;
  });

  it('should return true when config exists and has content', () => {
    mockFs.existsSync.mockImplementation((p) => p === expectedConfigPath);
    mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

    expect(hasOCIConfig()).toBe(true);
  });

  it('should return false when config does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    expect(hasOCIConfig()).toBe(false);
  });

  it('should return false when config is empty', () => {
    mockFs.existsSync.mockImplementation((p) => p === expectedConfigPath);
    mockFs.statSync.mockReturnValue({ size: 0 } as fs.Stats);

    expect(hasOCIConfig()).toBe(false);
  });

  it('should return false when statSync throws', () => {
    mockFs.existsSync.mockImplementation((p) => p === expectedConfigPath);
    mockFs.statSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    expect(hasOCIConfig()).toBe(false);
  });
});

describe('getConfigPath', () => {
  const originalEnv = process.env;
  const homeDir = os.homedir();

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OCI_CONFIG_FILE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return default path when OCI_CONFIG_FILE not set', () => {
    expect(getConfigPath()).toBe(path.join(homeDir, '.oci/config'));
  });

  it('should return OCI_CONFIG_FILE when set', () => {
    process.env.OCI_CONFIG_FILE = '/custom/oci/config';
    expect(getConfigPath()).toBe('/custom/oci/config');
  });

  it('should expand ~ in OCI_CONFIG_FILE', () => {
    process.env.OCI_CONFIG_FILE = '~/.custom-oci/config';
    expect(getConfigPath()).toBe(path.join(homeDir, '.custom-oci/config'));
  });
});

describe('getProfile', () => {
  const expectedConfigPath = getExpectedConfigPath();
  const homeDir = os.homedir();

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OCI_CONFIG_FILE;
  });

  it('should return profile by name', () => {
    const configContent = `
[DEFAULT]
user=ocid1.user.default
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
key_file=~/.oci/key.pem
tenancy=ocid1.tenancy.oc1..aaaa
region=us-ashburn-1

[FRANKFURT]
user=ocid1.user.frankfurt
fingerprint=11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00
key_file=~/.oci/frankfurt.pem
tenancy=ocid1.tenancy.oc1..aaaa
region=eu-frankfurt-1
`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === expectedConfigPath) return true;
      if (p === path.join(homeDir, '.oci/key.pem')) return true;
      if (p === path.join(homeDir, '.oci/frankfurt.pem')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(configContent);
    mockFs.statSync.mockReturnValue({ size: configContent.length } as fs.Stats);

    const defaultProfile = getProfile('DEFAULT');
    expect(defaultProfile?.user).toBe('ocid1.user.default');

    const frankfurtProfile = getProfile('FRANKFURT');
    expect(frankfurtProfile?.user).toBe('ocid1.user.frankfurt');
    expect(frankfurtProfile?.region).toBe('eu-frankfurt-1');
  });

  it('should return DEFAULT profile when no name specified', () => {
    const configContent = `
[DEFAULT]
user=ocid1.user.default
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
key_file=~/.oci/key.pem
tenancy=ocid1.tenancy.oc1..aaaa
region=us-ashburn-1
`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === expectedConfigPath) return true;
      if (p === path.join(homeDir, '.oci/key.pem')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(configContent);
    mockFs.statSync.mockReturnValue({ size: configContent.length } as fs.Stats);

    const profile = getProfile();
    expect(profile?.name).toBe('DEFAULT');
  });

  it('should return undefined for non-existent profile', () => {
    const configContent = `
[DEFAULT]
user=ocid1.user.default
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
key_file=~/.oci/key.pem
tenancy=ocid1.tenancy.oc1..aaaa
region=us-ashburn-1
`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === expectedConfigPath) return true;
      if (p === path.join(homeDir, '.oci/key.pem')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(configContent);
    mockFs.statSync.mockReturnValue({ size: configContent.length } as fs.Stats);

    const profile = getProfile('NONEXISTENT');
    expect(profile).toBeUndefined();
  });

  it('should return undefined when config file not found', () => {
    mockFs.existsSync.mockReturnValue(false);

    const profile = getProfile();
    expect(profile).toBeUndefined();
  });
});
