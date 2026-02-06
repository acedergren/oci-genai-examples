/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock OCI SDK before imports
const mockListCompartments = jest.fn<any>();
const mockGetTenancy = jest.fn<any>();
const mockAuthProvider = {
  getTenantId: jest.fn<any>().mockResolvedValue('ocid1.tenancy.oc1..testtenancy'),
};

jest.mock('oci-identity', () => ({
  IdentityClient: jest.fn().mockImplementation(() => ({
    listCompartments: mockListCompartments,
    getTenancy: mockGetTenancy,
  })),
}));

jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => mockAuthProvider),
}));

// Import after mocks
import { discoverCompartments } from '../discovery';

describe('discoverCompartments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mocks
    mockAuthProvider.getTenantId.mockResolvedValue('ocid1.tenancy.oc1..testtenancy');
    mockGetTenancy.mockResolvedValue({
      tenancy: {
        name: 'Test Tenancy',
      },
    });
  });

  it('should discover compartments from OCI API', async () => {
    mockListCompartments.mockResolvedValue({
      items: [
        {
          id: 'ocid1.compartment.oc1..aaa',
          name: 'dev',
          description: 'Development environment',
          lifecycleState: 'ACTIVE',
        },
        {
          id: 'ocid1.compartment.oc1..bbb',
          name: 'prod',
          description: 'Production environment',
          lifecycleState: 'ACTIVE',
        },
      ],
    });

    const result = await discoverCompartments('DEFAULT');

    // Should include root tenancy + 2 compartments
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Test Tenancy');
    expect(result[0].id).toBe('ocid1.tenancy.oc1..testtenancy');
    expect(result[1].name).toBe('dev');
    expect(result[2].name).toBe('prod');
  });

  it('should exclude root compartment when includeRoot=false', async () => {
    mockListCompartments.mockResolvedValue({
      items: [
        {
          id: 'ocid1.compartment.oc1..aaa',
          name: 'dev',
          description: 'Development',
          lifecycleState: 'ACTIVE',
        },
      ],
    });

    const result = await discoverCompartments('DEFAULT', false);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('dev');
  });

  it('should handle empty compartment list', async () => {
    mockListCompartments.mockResolvedValue({
      items: [],
    });

    const result = await discoverCompartments('DEFAULT');

    // Just the root tenancy
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Tenancy');
  });

  it('should include compartment descriptions', async () => {
    mockListCompartments.mockResolvedValue({
      items: [
        {
          id: 'ocid1.compartment.oc1..aaa',
          name: 'test-compartment',
          description: 'This is a test compartment',
          lifecycleState: 'ACTIVE',
        },
      ],
    });

    const result = await discoverCompartments('DEFAULT');

    expect(result[1].description).toBe('This is a test compartment');
  });

  it('should preserve lifecycle state', async () => {
    mockListCompartments.mockResolvedValue({
      items: [
        {
          id: 'ocid1.compartment.oc1..aaa',
          name: 'active-compartment',
          description: 'Active',
          lifecycleState: 'ACTIVE',
        },
      ],
    });

    const result = await discoverCompartments('DEFAULT');

    expect(result[1].lifecycleState).toBe('ACTIVE');
  });

  it('should use DEFAULT profile when none specified', async () => {
    mockListCompartments.mockResolvedValue({
      items: [],
    });

    const result = await discoverCompartments();

    expect(result).toHaveLength(1);
  });
});
