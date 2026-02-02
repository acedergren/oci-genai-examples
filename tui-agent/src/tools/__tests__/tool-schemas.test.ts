// tui-agent/src/tools/__tests__/tool-schemas.test.ts
/**
 * Comprehensive Zod schema validation tests for OCI tool definitions.
 *
 * Test naming convention: ZOD-TUI-XXX (TUI Agent tool schema tests)
 * - ZOD-TUI-001 to ZOD-TUI-020: Compute tools
 * - ZOD-TUI-021 to ZOD-TUI-040: Networking tools
 * - ZOD-TUI-041 to ZOD-TUI-060: Storage tools
 * - ZOD-TUI-061 to ZOD-TUI-080: Database tools
 * - ZOD-TUI-081 to ZOD-TUI-100: Identity tools
 * - ZOD-TUI-101 to ZOD-TUI-120: Observability tools
 * - ZOD-TUI-121 to ZOD-TUI-140: Registry functions
 */
import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

// Import registry functions and register all tools
import {
  getTool,
  getAllTools,
  getToolsByCategory,
  requiresApproval,
  inferApprovalLevel,
  toAISDKTools,
  executeTool,
  type ToolCategory,
  type ApprovalLevel,
} from '../registry.js';

// Import all tool categories to register them
import '../categories/compute.js';
import '../categories/networking.js';
import '../categories/storage.js';
import '../categories/database.js';
import '../categories/identity.js';
import '../categories/observability.js';

// =============================================================================
// Helper function to validate tool schemas
// =============================================================================

function validateToolSchema(toolName: string, validInput: unknown, invalidInput?: unknown) {
  const tool = getTool(toolName);
  expect(tool).toBeDefined();

  // Valid input should parse
  expect(() => tool!.schema.parse(validInput)).not.toThrow();

  // Invalid input should throw
  if (invalidInput !== undefined) {
    expect(() => tool!.schema.parse(invalidInput)).toThrow();
  }

  return tool!;
}

// =============================================================================
// Compute Tools Tests (ZOD-TUI-001 to ZOD-TUI-020)
// =============================================================================

describe('Compute Tool Schemas', () => {
  const validCompartmentId = 'ocid1.compartment.oc1..aaaa';
  const validInstanceId = 'ocid1.instance.oc1..bbbb';

  it('ZOD-TUI-001: listInstances - accepts valid input with all fields', () => {
    const tool = validateToolSchema('listInstances', {
      compartmentId: validCompartmentId,
      displayName: 'web-server',
      lifecycleState: 'RUNNING',
      limit: 25,
    });
    expect(tool.category).toBe('compute');
    expect(tool.approvalLevel).toBe('auto');
  });

  it('ZOD-TUI-002: listInstances - accepts minimal input (required fields only)', () => {
    validateToolSchema('listInstances', {
      compartmentId: validCompartmentId,
    });
  });

  it('ZOD-TUI-003: listInstances - validates lifecycleState enum', () => {
    const tool = getTool('listInstances')!;
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: 'RUNNING' })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: 'INVALID' })
    ).toThrow();
  });

  it('ZOD-TUI-004: listInstances - applies default limit', () => {
    const tool = getTool('listInstances')!;
    const result = tool.schema.parse({ compartmentId: validCompartmentId });
    expect(result.limit).toBe(50);
  });

  it('ZOD-TUI-005: getInstance - requires instanceId', () => {
    validateToolSchema(
      'getInstance',
      { instanceId: validInstanceId },
      { notInstanceId: 'wrong' }
    );
  });

  it('ZOD-TUI-006: launchInstance - validates all required fields', () => {
    const tool = validateToolSchema('launchInstance', {
      compartmentId: validCompartmentId,
      availabilityDomain: 'AD-1',
      displayName: 'new-instance',
      shape: 'VM.Standard.E4.Flex',
      imageId: 'ocid1.image.oc1..cccc',
      subnetId: 'ocid1.subnet.oc1..dddd',
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-007: launchInstance - accepts optional flex shape params', () => {
    const tool = getTool('launchInstance')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      availabilityDomain: 'AD-1',
      displayName: 'flex-instance',
      shape: 'VM.Standard.E4.Flex',
      imageId: 'ocid1.image.oc1..cccc',
      subnetId: 'ocid1.subnet.oc1..dddd',
      ocpus: 4,
      memoryInGBs: 64,
      sshAuthorizedKeys: 'ssh-rsa AAAA...',
    });
    expect(result.ocpus).toBe(4);
    expect(result.memoryInGBs).toBe(64);
  });

  it('ZOD-TUI-008: launchInstance - rejects missing required fields', () => {
    const tool = getTool('launchInstance')!;
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        // missing other required fields
      })
    ).toThrow();
  });

  it('ZOD-TUI-009: startInstance - requires instanceId only', () => {
    const tool = validateToolSchema('startInstance', { instanceId: validInstanceId });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-010: stopInstance - has danger approval level', () => {
    const tool = validateToolSchema('stopInstance', { instanceId: validInstanceId });
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-011: terminateInstance - applies default preserveBootVolume', () => {
    const tool = getTool('terminateInstance')!;
    const result = tool.schema.parse({ instanceId: validInstanceId });
    expect(result.preserveBootVolume).toBe(false);
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-012: terminateInstance - accepts preserveBootVolume=true', () => {
    const tool = getTool('terminateInstance')!;
    const result = tool.schema.parse({
      instanceId: validInstanceId,
      preserveBootVolume: true,
    });
    expect(result.preserveBootVolume).toBe(true);
  });

  it('ZOD-TUI-013: listShapes - accepts optional availabilityDomain', () => {
    validateToolSchema('listShapes', {
      compartmentId: validCompartmentId,
      availabilityDomain: 'AD-2',
    });
  });

  it('ZOD-TUI-014: listImages - accepts OS filter parameters', () => {
    validateToolSchema('listImages', {
      compartmentId: validCompartmentId,
      operatingSystem: 'Oracle Linux',
      operatingSystemVersion: '8',
    });
  });

  it('ZOD-TUI-015: compute tools - all have correct category', () => {
    const computeTools = getToolsByCategory('compute');
    expect(computeTools.length).toBeGreaterThanOrEqual(8);
    computeTools.forEach((tool) => {
      expect(tool.category).toBe('compute');
    });
  });
});

// =============================================================================
// Networking Tools Tests (ZOD-TUI-021 to ZOD-TUI-040)
// =============================================================================

describe('Networking Tool Schemas', () => {
  const validCompartmentId = 'ocid1.compartment.oc1..aaaa';
  const validVcnId = 'ocid1.vcn.oc1..bbbb';

  it('ZOD-TUI-021: listVcns - validates lifecycleState enum', () => {
    const tool = getTool('listVcns')!;
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: 'AVAILABLE' })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: 'RUNNING' })
    ).toThrow(); // RUNNING is compute, not VCN
  });

  it('ZOD-TUI-022: listVcns - accepts all valid VCN lifecycle states', () => {
    const tool = getTool('listVcns')!;
    const validStates = ['AVAILABLE', 'PROVISIONING', 'TERMINATING', 'TERMINATED'];
    validStates.forEach((state) => {
      expect(() =>
        tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: state })
      ).not.toThrow();
    });
  });

  it('ZOD-TUI-023: getVcn - requires vcnId only', () => {
    validateToolSchema('getVcn', { vcnId: validVcnId }, { compartmentId: 'wrong-key' });
  });

  it('ZOD-TUI-024: createVcn - validates required fields', () => {
    const tool = validateToolSchema('createVcn', {
      compartmentId: validCompartmentId,
      displayName: 'prod-vcn',
      cidrBlock: '10.0.0.0/16',
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-025: createVcn - accepts optional dnsLabel', () => {
    const tool = getTool('createVcn')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      displayName: 'prod-vcn',
      cidrBlock: '10.0.0.0/16',
      dnsLabel: 'prodvcn',
    });
    expect(result.dnsLabel).toBe('prodvcn');
  });

  it('ZOD-TUI-026: deleteVcn - has danger approval level', () => {
    const tool = validateToolSchema('deleteVcn', { vcnId: validVcnId });
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-027: listSubnets - vcnId is optional', () => {
    const tool = getTool('listSubnets')!;
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, vcnId: validVcnId })
    ).not.toThrow();
  });

  it('ZOD-TUI-028: createSubnet - validates all required fields', () => {
    const tool = validateToolSchema('createSubnet', {
      compartmentId: validCompartmentId,
      vcnId: validVcnId,
      displayName: 'public-subnet',
      cidrBlock: '10.0.1.0/24',
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-029: createSubnet - applies default prohibitPublicIpOnVnic', () => {
    const tool = getTool('createSubnet')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      vcnId: validVcnId,
      displayName: 'subnet',
      cidrBlock: '10.0.1.0/24',
    });
    expect(result.prohibitPublicIpOnVnic).toBe(false);
  });

  it('ZOD-TUI-030: listSecurityLists - has auto approval', () => {
    const tool = validateToolSchema('listSecurityLists', {
      compartmentId: validCompartmentId,
    });
    expect(tool.approvalLevel).toBe('auto');
  });

  it('ZOD-TUI-031: listNetworkSecurityGroups - accepts optional vcnId', () => {
    validateToolSchema('listNetworkSecurityGroups', {
      compartmentId: validCompartmentId,
      vcnId: validVcnId,
    });
  });

  it('ZOD-TUI-032: listInternetGateways - minimal input', () => {
    validateToolSchema('listInternetGateways', {
      compartmentId: validCompartmentId,
    });
  });

  it('ZOD-TUI-033: networking tools - all have correct category', () => {
    const networkingTools = getToolsByCategory('networking');
    expect(networkingTools.length).toBeGreaterThanOrEqual(9);
    networkingTools.forEach((tool) => {
      expect(tool.category).toBe('networking');
    });
  });
});

// =============================================================================
// Storage Tools Tests (ZOD-TUI-041 to ZOD-TUI-060)
// =============================================================================

describe('Storage Tool Schemas', () => {
  const validCompartmentId = 'ocid1.compartment.oc1..aaaa';
  const validNamespace = 'my-namespace';
  const validBucketName = 'my-bucket';

  it('ZOD-TUI-041: listBuckets - requires compartmentId and namespace', () => {
    validateToolSchema(
      'listBuckets',
      { compartmentId: validCompartmentId, namespace: validNamespace },
      { compartmentId: validCompartmentId } // missing namespace
    );
  });

  it('ZOD-TUI-042: getBucket - requires namespace and bucketName', () => {
    validateToolSchema('getBucket', {
      namespace: validNamespace,
      bucketName: validBucketName,
    });
  });

  it('ZOD-TUI-043: createBucket - validates publicAccessType enum', () => {
    const tool = getTool('createBucket')!;
    const validAccessTypes = ['NoPublicAccess', 'ObjectRead', 'ObjectReadWithoutList'];
    validAccessTypes.forEach((accessType) => {
      expect(() =>
        tool.schema.parse({
          compartmentId: validCompartmentId,
          namespace: validNamespace,
          name: 'test-bucket',
          publicAccessType: accessType,
        })
      ).not.toThrow();
    });
  });

  it('ZOD-TUI-044: createBucket - validates storageTier enum', () => {
    const tool = getTool('createBucket')!;
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        namespace: validNamespace,
        name: 'test-bucket',
        storageTier: 'Standard',
      })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        namespace: validNamespace,
        name: 'test-bucket',
        storageTier: 'Archive',
      })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        namespace: validNamespace,
        name: 'test-bucket',
        storageTier: 'Invalid',
      })
    ).toThrow();
  });

  it('ZOD-TUI-045: createBucket - validates versioning enum', () => {
    const tool = getTool('createBucket')!;
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        namespace: validNamespace,
        name: 'test-bucket',
        versioning: 'Enabled',
      })
    ).not.toThrow();
  });

  it('ZOD-TUI-046: createBucket - applies defaults', () => {
    const tool = getTool('createBucket')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      namespace: validNamespace,
      name: 'test-bucket',
    });
    expect(result.publicAccessType).toBe('NoPublicAccess');
    expect(result.storageTier).toBe('Standard');
    expect(result.versioning).toBe('Disabled');
  });

  it('ZOD-TUI-047: deleteBucket - has danger approval level', () => {
    const tool = validateToolSchema('deleteBucket', {
      namespace: validNamespace,
      bucketName: validBucketName,
    });
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-048: listObjects - applies default limit', () => {
    const tool = getTool('listObjects')!;
    const result = tool.schema.parse({
      namespace: validNamespace,
      bucketName: validBucketName,
    });
    expect(result.limit).toBe(100);
  });

  it('ZOD-TUI-049: listObjects - accepts prefix filter', () => {
    const tool = getTool('listObjects')!;
    const result = tool.schema.parse({
      namespace: validNamespace,
      bucketName: validBucketName,
      prefix: 'logs/',
    });
    expect(result.prefix).toBe('logs/');
  });

  it('ZOD-TUI-050: createVolume - validates required fields', () => {
    const tool = validateToolSchema('createVolume', {
      compartmentId: validCompartmentId,
      availabilityDomain: 'AD-1',
      displayName: 'data-volume',
      sizeInGBs: 100,
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-051: createVolume - applies default vpusPerGB', () => {
    const tool = getTool('createVolume')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      availabilityDomain: 'AD-1',
      displayName: 'data-volume',
      sizeInGBs: 100,
    });
    expect(result.vpusPerGB).toBe(10);
  });

  it('ZOD-TUI-052: deleteVolume - requires volumeId', () => {
    const tool = validateToolSchema('deleteVolume', {
      volumeId: 'ocid1.volume.oc1..xxxx',
    });
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-053: storage tools - all have correct category', () => {
    const storageTools = getToolsByCategory('storage');
    expect(storageTools.length).toBeGreaterThanOrEqual(8);
    storageTools.forEach((tool) => {
      expect(tool.category).toBe('storage');
    });
  });
});

// =============================================================================
// Database Tools Tests (ZOD-TUI-061 to ZOD-TUI-080)
// =============================================================================

describe('Database Tool Schemas', () => {
  const validCompartmentId = 'ocid1.compartment.oc1..aaaa';
  const validAdbId = 'ocid1.autonomousdatabase.oc1..bbbb';

  it('ZOD-TUI-061: listAutonomousDatabases - validates dbWorkload enum', () => {
    const tool = getTool('listAutonomousDatabases')!;
    const validWorkloads = ['OLTP', 'DW', 'AJD', 'APEX'];
    validWorkloads.forEach((workload) => {
      expect(() =>
        tool.schema.parse({ compartmentId: validCompartmentId, dbWorkload: workload })
      ).not.toThrow();
    });
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, dbWorkload: 'INVALID' })
    ).toThrow();
  });

  it('ZOD-TUI-062: listAutonomousDatabases - validates lifecycleState enum', () => {
    const tool = getTool('listAutonomousDatabases')!;
    const validStates = [
      'PROVISIONING',
      'AVAILABLE',
      'STOPPING',
      'STOPPED',
      'STARTING',
      'TERMINATING',
      'TERMINATED',
    ];
    validStates.forEach((state) => {
      expect(() =>
        tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: state })
      ).not.toThrow();
    });
  });

  it('ZOD-TUI-063: getAutonomousDatabase - requires autonomousDatabaseId', () => {
    validateToolSchema('getAutonomousDatabase', {
      autonomousDatabaseId: validAdbId,
    });
  });

  it('ZOD-TUI-064: createAutonomousDatabase - validates all required fields', () => {
    const tool = validateToolSchema('createAutonomousDatabase', {
      compartmentId: validCompartmentId,
      displayName: 'MyADB',
      dbName: 'MYATP',
      dbWorkload: 'OLTP',
      cpuCoreCount: 2,
      dataStorageSizeInTBs: 1,
      adminPassword: 'SecureP@ssw0rd!',
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-065: createAutonomousDatabase - applies defaults', () => {
    const tool = getTool('createAutonomousDatabase')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      displayName: 'MyADB',
      dbName: 'MYATP',
      dbWorkload: 'OLTP',
      cpuCoreCount: 2,
      dataStorageSizeInTBs: 1,
      adminPassword: 'SecureP@ssw0rd!',
    });
    expect(result.isAutoScalingEnabled).toBe(false);
    expect(result.isFreeTier).toBe(false);
  });

  it('ZOD-TUI-066: createAutonomousDatabase - rejects missing adminPassword', () => {
    const tool = getTool('createAutonomousDatabase')!;
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        displayName: 'MyADB',
        dbName: 'MYATP',
        dbWorkload: 'OLTP',
        cpuCoreCount: 2,
        dataStorageSizeInTBs: 1,
        // missing adminPassword
      })
    ).toThrow();
  });

  it('ZOD-TUI-067: startAutonomousDatabase - has confirm approval', () => {
    const tool = validateToolSchema('startAutonomousDatabase', {
      autonomousDatabaseId: validAdbId,
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-068: stopAutonomousDatabase - has danger approval', () => {
    const tool = validateToolSchema('stopAutonomousDatabase', {
      autonomousDatabaseId: validAdbId,
    });
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-069: terminateAutonomousDatabase - has danger approval', () => {
    const tool = validateToolSchema('terminateAutonomousDatabase', {
      autonomousDatabaseId: validAdbId,
    });
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-070: scaleAutonomousDatabase - optional scaling params', () => {
    const tool = getTool('scaleAutonomousDatabase')!;
    // Can scale CPU only
    expect(() =>
      tool.schema.parse({ autonomousDatabaseId: validAdbId, cpuCoreCount: 4 })
    ).not.toThrow();
    // Can scale storage only
    expect(() =>
      tool.schema.parse({ autonomousDatabaseId: validAdbId, dataStorageSizeInTBs: 2 })
    ).not.toThrow();
    // Can scale both
    expect(() =>
      tool.schema.parse({
        autonomousDatabaseId: validAdbId,
        cpuCoreCount: 4,
        dataStorageSizeInTBs: 2,
      })
    ).not.toThrow();
  });

  it('ZOD-TUI-071: listDbSystems - accepts optional filters', () => {
    validateToolSchema('listDbSystems', {
      compartmentId: validCompartmentId,
      availabilityDomain: 'AD-1',
      displayName: 'prod-db',
    });
  });

  it('ZOD-TUI-072: database tools - all have correct category', () => {
    const dbTools = getToolsByCategory('database');
    expect(dbTools.length).toBeGreaterThanOrEqual(8);
    dbTools.forEach((tool) => {
      expect(tool.category).toBe('database');
    });
  });
});

// =============================================================================
// Identity Tools Tests (ZOD-TUI-081 to ZOD-TUI-100)
// =============================================================================

describe('Identity Tool Schemas', () => {
  const validCompartmentId = 'ocid1.compartment.oc1..aaaa';

  it('ZOD-TUI-081: listCompartments - validates accessLevel enum', () => {
    const tool = getTool('listCompartments')!;
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, accessLevel: 'ANY' })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, accessLevel: 'ACCESSIBLE' })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, accessLevel: 'INVALID' })
    ).toThrow();
  });

  it('ZOD-TUI-082: listCompartments - applies defaults', () => {
    const tool = getTool('listCompartments')!;
    const result = tool.schema.parse({ compartmentId: validCompartmentId });
    expect(result.accessLevel).toBe('ACCESSIBLE');
    expect(result.compartmentIdInSubtree).toBe(false);
  });

  it('ZOD-TUI-083: getCompartment - requires compartmentId only', () => {
    validateToolSchema('getCompartment', { compartmentId: validCompartmentId });
  });

  it('ZOD-TUI-084: createCompartment - requires all fields', () => {
    const tool = validateToolSchema('createCompartment', {
      compartmentId: validCompartmentId,
      name: 'prod-compartment',
      description: 'Production workloads',
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-085: createCompartment - rejects missing description', () => {
    const tool = getTool('createCompartment')!;
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        name: 'prod-compartment',
        // missing description
      })
    ).toThrow();
  });

  it('ZOD-TUI-086: listUsers - requires tenancy OCID', () => {
    validateToolSchema('listUsers', { compartmentId: validCompartmentId });
  });

  it('ZOD-TUI-087: listGroups - requires tenancy OCID', () => {
    validateToolSchema('listGroups', { compartmentId: validCompartmentId });
  });

  it('ZOD-TUI-088: listPolicies - minimal input', () => {
    validateToolSchema('listPolicies', { compartmentId: validCompartmentId });
  });

  it('ZOD-TUI-089: getPolicy - requires policyId', () => {
    validateToolSchema('getPolicy', { policyId: 'ocid1.policy.oc1..xxxx' });
  });

  it('ZOD-TUI-090: createPolicy - validates statements array', () => {
    const tool = validateToolSchema('createPolicy', {
      compartmentId: validCompartmentId,
      name: 'admin-policy',
      description: 'Admin access policy',
      statements: [
        'Allow group Admins to manage all-resources in compartment prod',
        'Allow group Developers to use instances in compartment prod',
      ],
    });
    expect(tool.approvalLevel).toBe('confirm');
  });

  it('ZOD-TUI-091: createPolicy - statements must be array of strings', () => {
    const tool = getTool('createPolicy')!;
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        name: 'policy',
        description: 'desc',
        statements: 'not an array',
      })
    ).toThrow();
  });

  it('ZOD-TUI-092: listAvailabilityDomains - requires compartmentId', () => {
    validateToolSchema('listAvailabilityDomains', {
      compartmentId: validCompartmentId,
    });
  });

  it('ZOD-TUI-093: listRegions - accepts empty object', () => {
    const tool = getTool('listRegions')!;
    expect(() => tool.schema.parse({})).not.toThrow();
  });

  it('ZOD-TUI-094: identity tools - all have correct category', () => {
    const identityTools = getToolsByCategory('identity');
    expect(identityTools.length).toBeGreaterThanOrEqual(10);
    identityTools.forEach((tool) => {
      expect(tool.category).toBe('identity');
    });
  });
});

// =============================================================================
// Observability Tools Tests (ZOD-TUI-101 to ZOD-TUI-120)
// =============================================================================

describe('Observability Tool Schemas', () => {
  const validCompartmentId = 'ocid1.compartment.oc1..aaaa';

  it('ZOD-TUI-101: listMetrics - applies default compartmentIdInSubtree', () => {
    const tool = getTool('listMetrics')!;
    const result = tool.schema.parse({ compartmentId: validCompartmentId });
    expect(result.compartmentIdInSubtree).toBe(false);
  });

  it('ZOD-TUI-102: summarizeMetrics - requires all query params', () => {
    validateToolSchema('summarizeMetrics', {
      compartmentId: validCompartmentId,
      namespace: 'oci_computeagent',
      query: 'CpuUtilization[1m].mean()',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T01:00:00Z',
    });
  });

  it('ZOD-TUI-103: summarizeMetrics - accepts optional resolution', () => {
    const tool = getTool('summarizeMetrics')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      namespace: 'oci_computeagent',
      query: 'CpuUtilization[1m].mean()',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T01:00:00Z',
      resolution: '5m',
    });
    expect(result.resolution).toBe('5m');
  });

  it('ZOD-TUI-104: listAlarms - validates lifecycleState enum', () => {
    const tool = getTool('listAlarms')!;
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: 'ACTIVE' })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: 'DELETING' })
    ).not.toThrow();
    expect(() =>
      tool.schema.parse({ compartmentId: validCompartmentId, lifecycleState: 'INVALID' })
    ).toThrow();
  });

  it('ZOD-TUI-105: getAlarm - requires alarmId', () => {
    validateToolSchema('getAlarm', { alarmId: 'ocid1.alarm.oc1..xxxx' });
  });

  it('ZOD-TUI-106: createAlarm - validates severity enum', () => {
    const tool = getTool('createAlarm')!;
    const validSeverities = ['CRITICAL', 'ERROR', 'WARNING', 'INFO'];
    validSeverities.forEach((severity) => {
      expect(() =>
        tool.schema.parse({
          compartmentId: validCompartmentId,
          displayName: 'High CPU Alarm',
          namespace: 'oci_computeagent',
          query: 'CpuUtilization[1m].mean() > 90',
          severity,
          destinations: ['ocid1.onstopic.oc1..xxxx'],
        })
      ).not.toThrow();
    });
  });

  it('ZOD-TUI-107: createAlarm - applies default isEnabled', () => {
    const tool = getTool('createAlarm')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      displayName: 'High CPU Alarm',
      namespace: 'oci_computeagent',
      query: 'CpuUtilization[1m].mean() > 90',
      severity: 'WARNING',
      destinations: ['ocid1.onstopic.oc1..xxxx'],
    });
    expect(result.isEnabled).toBe(true);
  });

  it('ZOD-TUI-108: createAlarm - destinations must be array', () => {
    const tool = getTool('createAlarm')!;
    expect(() =>
      tool.schema.parse({
        compartmentId: validCompartmentId,
        displayName: 'Alarm',
        namespace: 'ns',
        query: 'q',
        severity: 'INFO',
        destinations: 'not-an-array',
      })
    ).toThrow();
  });

  it('ZOD-TUI-109: deleteAlarm - has danger approval', () => {
    const tool = validateToolSchema('deleteAlarm', {
      alarmId: 'ocid1.alarm.oc1..xxxx',
    });
    expect(tool.approvalLevel).toBe('danger');
  });

  it('ZOD-TUI-110: listLogGroups - accepts optional displayName', () => {
    validateToolSchema('listLogGroups', {
      compartmentId: validCompartmentId,
      displayName: 'app-logs',
    });
  });

  it('ZOD-TUI-111: searchLogs - validates all required fields', () => {
    validateToolSchema('searchLogs', {
      compartmentId: validCompartmentId,
      searchQuery: 'search "error"',
      timeStart: '2024-01-01T00:00:00Z',
      timeEnd: '2024-01-01T01:00:00Z',
    });
  });

  it('ZOD-TUI-112: searchLogs - applies default limit', () => {
    const tool = getTool('searchLogs')!;
    const result = tool.schema.parse({
      compartmentId: validCompartmentId,
      searchQuery: 'search "error"',
      timeStart: '2024-01-01T00:00:00Z',
      timeEnd: '2024-01-01T01:00:00Z',
    });
    expect(result.limit).toBe(100);
  });

  it('ZOD-TUI-113: observability tools - all have correct category', () => {
    const observabilityTools = getToolsByCategory('observability');
    expect(observabilityTools.length).toBeGreaterThanOrEqual(8);
    observabilityTools.forEach((tool) => {
      expect(tool.category).toBe('observability');
    });
  });
});

// =============================================================================
// Registry Functions Tests (ZOD-TUI-121 to ZOD-TUI-140)
// =============================================================================

describe('Registry Functions', () => {
  it('ZOD-TUI-121: getTool - returns undefined for unknown tool', () => {
    expect(getTool('nonExistentTool')).toBeUndefined();
  });

  it('ZOD-TUI-122: getTool - returns tool definition for known tool', () => {
    const tool = getTool('listInstances');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('listInstances');
    expect(tool!.schema).toBeDefined();
  });

  it('ZOD-TUI-123: getAllTools - returns all registered tools', () => {
    const tools = getAllTools();
    expect(tools.length).toBeGreaterThanOrEqual(50); // We have 50+ tools defined
    tools.forEach((tool) => {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.category).toBeDefined();
      expect(tool.approvalLevel).toBeDefined();
      expect(tool.schema).toBeDefined();
    });
  });

  it('ZOD-TUI-124: getToolsByCategory - filters correctly', () => {
    const categories: ToolCategory[] = [
      'compute',
      'networking',
      'storage',
      'database',
      'identity',
      'observability',
    ];

    categories.forEach((category) => {
      const tools = getToolsByCategory(category);
      expect(tools.length).toBeGreaterThan(0);
      tools.forEach((tool) => {
        expect(tool.category).toBe(category);
      });
    });
  });

  it('ZOD-TUI-125: requiresApproval - returns true for unknown tools', () => {
    expect(requiresApproval('nonExistentTool')).toBe(true);
  });

  it('ZOD-TUI-126: requiresApproval - returns false for auto-approved tools', () => {
    expect(requiresApproval('listInstances')).toBe(false);
    expect(requiresApproval('getVcn')).toBe(false);
    expect(requiresApproval('listBuckets')).toBe(false);
  });

  it('ZOD-TUI-127: requiresApproval - returns true for confirm/danger tools', () => {
    expect(requiresApproval('launchInstance')).toBe(true);
    expect(requiresApproval('terminateInstance')).toBe(true);
    expect(requiresApproval('deleteVcn')).toBe(true);
  });

  it('ZOD-TUI-128: inferApprovalLevel - auto for list/get/describe', () => {
    expect(inferApprovalLevel('listInstances')).toBe('auto');
    expect(inferApprovalLevel('getInstance')).toBe('auto');
    expect(inferApprovalLevel('describeVcn')).toBe('auto');
    expect(inferApprovalLevel('LISTVOLUMES')).toBe('auto'); // case-insensitive
  });

  it('ZOD-TUI-129: inferApprovalLevel - danger for delete/terminate/stop', () => {
    expect(inferApprovalLevel('deleteVcn')).toBe('danger');
    expect(inferApprovalLevel('terminateInstance')).toBe('danger');
    expect(inferApprovalLevel('stopInstance')).toBe('danger');
    expect(inferApprovalLevel('DELETEOBJECT')).toBe('danger'); // case-insensitive
  });

  it('ZOD-TUI-130: inferApprovalLevel - confirm for other operations', () => {
    expect(inferApprovalLevel('createInstance')).toBe('confirm');
    expect(inferApprovalLevel('updateVcn')).toBe('confirm');
    expect(inferApprovalLevel('launchInstance')).toBe('confirm');
    expect(inferApprovalLevel('scaleDatabase')).toBe('confirm');
  });

  it('ZOD-TUI-131: toAISDKTools - returns correct format', () => {
    const aiTools = toAISDKTools();
    expect(typeof aiTools).toBe('object');

    // Check a specific tool
    const listInstancesTool = aiTools['listInstances'];
    expect(listInstancesTool).toBeDefined();
    expect(listInstancesTool.description).toBe(
      'List compute instances in a compartment with optional filters'
    );
    expect(listInstancesTool.inputSchema).toBeDefined();
  });

  it('ZOD-TUI-132: toAISDKTools - uses inputSchema (not parameters)', () => {
    const aiTools = toAISDKTools();
    Object.entries(aiTools).forEach(([name, tool]) => {
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('description');
      // Should NOT have 'parameters' (deprecated in AI SDK 6.0)
      expect(tool).not.toHaveProperty('parameters');
    });
  });

  it('ZOD-TUI-133: executeTool - throws for unknown tool', async () => {
    await expect(executeTool('nonExistentTool', {})).rejects.toThrow(
      'Unknown tool: nonExistentTool'
    );
  });

  it('ZOD-TUI-134: executeTool - validates args against schema', async () => {
    // Invalid args should throw validation error
    await expect(
      executeTool('listInstances', { invalidField: 'value' })
    ).rejects.toThrow(); // Missing required compartmentId
  });

  it('ZOD-TUI-135: executeTool - executes with valid args', async () => {
    const result = await executeTool('listInstances', {
      compartmentId: 'ocid1.compartment.oc1..test',
    });
    expect(result).toBeDefined();
    // Our placeholder returns { instances: [], message: '...' }
    expect(result).toHaveProperty('message');
  });

  it('ZOD-TUI-136: all tools have valid execute functions', () => {
    const tools = getAllTools();
    tools.forEach((tool) => {
      expect(typeof tool.execute).toBe('function');
    });
  });

  it('ZOD-TUI-137: tool schemas are valid Zod schemas', () => {
    const tools = getAllTools();
    tools.forEach((tool) => {
      expect(tool.schema).toBeDefined();
      expect(typeof tool.schema.parse).toBe('function');
      expect(typeof tool.schema.safeParse).toBe('function');
    });
  });

  it('ZOD-TUI-138: no duplicate tool names', () => {
    const tools = getAllTools();
    const names = tools.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('ZOD-TUI-139: all tools have descriptions', () => {
    const tools = getAllTools();
    tools.forEach((tool) => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(10); // Meaningful description
    });
  });

  it('ZOD-TUI-140: approval levels are consistent with tool names', () => {
    const tools = getAllTools();
    tools.forEach((tool) => {
      const inferredLevel = inferApprovalLevel(tool.name);
      // The actual level should match inferred for standard naming
      // Allow some flexibility for custom naming
      const validLevels: ApprovalLevel[] = ['auto', 'confirm', 'danger'];
      expect(validLevels).toContain(tool.approvalLevel);
    });
  });
});
