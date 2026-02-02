import { z } from 'zod';
import { registerTool } from '../registry.js';

// Common schemas
const compartmentIdSchema = z.string().describe('The OCID of the compartment');
const instanceIdSchema = z.string().describe('The OCID of the instance');

/**
 * List compute instances in a compartment
 */
registerTool({
  name: 'listInstances',
  description: 'List compute instances in a compartment with optional filters',
  category: 'compute',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().optional().describe('Filter by display name'),
    lifecycleState: z.enum(['RUNNING', 'STOPPED', 'TERMINATED']).optional(),
    limit: z.number().default(50).describe('Maximum number of results'),
  }),
  execute: async (args) => {
    // Implementation will use OCI SDK
    // For now, return placeholder
    return { instances: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Get instance details
 */
registerTool({
  name: 'getInstance',
  description: 'Get detailed information about a specific compute instance',
  category: 'compute',
  approvalLevel: 'auto',
  schema: z.object({
    instanceId: instanceIdSchema,
  }),
  execute: async (args) => {
    return { instance: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Launch a new compute instance
 */
registerTool({
  name: 'launchInstance',
  description: 'Launch a new compute instance with specified configuration',
  category: 'compute',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    availabilityDomain: z.string().describe('The availability domain'),
    displayName: z.string().describe('Display name for the instance'),
    shape: z.string().describe('The shape (e.g., VM.Standard.E4.Flex)'),
    imageId: z.string().describe('The OCID of the image'),
    subnetId: z.string().describe('The OCID of the subnet'),
    ocpus: z.number().optional().describe('Number of OCPUs (for flex shapes)'),
    memoryInGBs: z.number().optional().describe('Memory in GB (for flex shapes)'),
    sshAuthorizedKeys: z.string().optional().describe('SSH public key'),
  }),
  execute: async (args) => {
    return { instance: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Start a stopped instance
 */
registerTool({
  name: 'startInstance',
  description: 'Start a stopped compute instance',
  category: 'compute',
  approvalLevel: 'confirm',
  schema: z.object({
    instanceId: instanceIdSchema,
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * Stop a running instance
 */
registerTool({
  name: 'stopInstance',
  description: 'Stop a running compute instance (graceful shutdown)',
  category: 'compute',
  approvalLevel: 'danger',
  schema: z.object({
    instanceId: instanceIdSchema,
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * Terminate an instance
 */
registerTool({
  name: 'terminateInstance',
  description: 'Permanently terminate and delete a compute instance',
  category: 'compute',
  approvalLevel: 'danger',
  schema: z.object({
    instanceId: instanceIdSchema,
    preserveBootVolume: z.boolean().default(false).describe('Keep the boot volume'),
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * List available shapes
 */
registerTool({
  name: 'listShapes',
  description: 'List available compute shapes in a compartment',
  category: 'compute',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    availabilityDomain: z.string().optional(),
  }),
  execute: async (args) => {
    return { shapes: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List compute images
 */
registerTool({
  name: 'listImages',
  description: 'List available compute images',
  category: 'compute',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    operatingSystem: z.string().optional().describe('Filter by OS (e.g., Oracle Linux)'),
    operatingSystemVersion: z.string().optional(),
  }),
  execute: async (args) => {
    return { images: [], message: 'OCI SDK integration pending' };
  },
});
