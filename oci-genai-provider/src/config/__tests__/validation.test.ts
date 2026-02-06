/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock OCI SDK before imports
const mockGetUser = jest.fn<any>();
const mockAuthProvider = {
  getUser: jest.fn<any>().mockResolvedValue('ocid1.user.oc1..testuser'),
};

jest.mock('oci-identity', () => ({
  IdentityClient: jest.fn().mockImplementation(() => ({
    getUser: mockGetUser,
  })),
}));

jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => mockAuthProvider),
}));

// Import after mocks
import { validateCredentials } from '../validation';

describe('validateCredentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the default mock for authProvider.getUser
    mockAuthProvider.getUser.mockResolvedValue('ocid1.user.oc1..testuser');
  });

  it('should return valid=true for working credentials', async () => {
    mockGetUser.mockResolvedValue({
      user: {
        name: 'test-user',
        email: 'test@example.com',
      },
    });

    const result = await validateCredentials('DEFAULT');

    expect(result.valid).toBe(true);
    expect(result.userName).toBe('test-user');
    expect(result.userEmail).toBe('test@example.com');
  });

  it('should return valid=false for authentication failures', async () => {
    const authError = new Error('NotAuthenticated: Invalid API key');
    mockGetUser.mockRejectedValue(authError);

    const result = await validateCredentials('DEFAULT');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Authentication failed');
  });

  it('should return valid=false for timeout errors', async () => {
    const timeoutError = new Error('Request timeout: Connection aborted');
    mockGetUser.mockRejectedValue(timeoutError);

    const result = await validateCredentials('DEFAULT');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('should return valid=false for missing key file', async () => {
    const keyError = new Error('key_file not found');
    mockGetUser.mockRejectedValue(keyError);

    const result = await validateCredentials('DEFAULT');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('key');
  });

  it('should handle generic errors gracefully', async () => {
    mockGetUser.mockRejectedValue(new Error('Unknown error occurred'));

    const result = await validateCredentials('DEFAULT');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Validation failed');
    expect(result.error).toContain('Unknown error occurred');
  });

  it('should use DEFAULT profile when none specified', async () => {
    mockGetUser.mockResolvedValue({
      user: {
        name: 'default-user',
        email: 'default@example.com',
      },
    });

    const result = await validateCredentials();

    expect(result.valid).toBe(true);
    expect(result.userName).toBe('default-user');
  });
});
