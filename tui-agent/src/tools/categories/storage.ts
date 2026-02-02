import { z } from 'zod';
import { registerTool } from '../registry.js';

const compartmentIdSchema = z.string().describe('The OCID of the compartment');
const bucketNameSchema = z.string().describe('The name of the bucket');
const namespaceSchema = z.string().describe('The Object Storage namespace');

/**
 * List buckets
 */
registerTool({
  name: 'listBuckets',
  description: 'List Object Storage buckets in a compartment',
  category: 'storage',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    namespace: namespaceSchema,
  }),
  execute: async (args) => {
    return { buckets: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Get bucket details
 */
registerTool({
  name: 'getBucket',
  description: 'Get detailed information about a bucket',
  category: 'storage',
  approvalLevel: 'auto',
  schema: z.object({
    namespace: namespaceSchema,
    bucketName: bucketNameSchema,
  }),
  execute: async (args) => {
    return { bucket: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Create bucket
 */
registerTool({
  name: 'createBucket',
  description: 'Create a new Object Storage bucket',
  category: 'storage',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    namespace: namespaceSchema,
    name: z.string().describe('Name for the bucket'),
    publicAccessType: z.enum(['NoPublicAccess', 'ObjectRead', 'ObjectReadWithoutList']).default('NoPublicAccess'),
    storageTier: z.enum(['Standard', 'Archive']).default('Standard'),
    versioning: z.enum(['Enabled', 'Disabled']).default('Disabled'),
  }),
  execute: async (args) => {
    return { bucket: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Delete bucket
 */
registerTool({
  name: 'deleteBucket',
  description: 'Delete an Object Storage bucket (must be empty)',
  category: 'storage',
  approvalLevel: 'danger',
  schema: z.object({
    namespace: namespaceSchema,
    bucketName: bucketNameSchema,
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * List objects in bucket
 */
registerTool({
  name: 'listObjects',
  description: 'List objects in a bucket',
  category: 'storage',
  approvalLevel: 'auto',
  schema: z.object({
    namespace: namespaceSchema,
    bucketName: bucketNameSchema,
    prefix: z.string().optional().describe('Filter by prefix'),
    limit: z.number().default(100),
  }),
  execute: async (args) => {
    return { objects: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List block volumes
 */
registerTool({
  name: 'listVolumes',
  description: 'List block volumes in a compartment',
  category: 'storage',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    availabilityDomain: z.string().optional(),
    displayName: z.string().optional(),
  }),
  execute: async (args) => {
    return { volumes: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Create block volume
 */
registerTool({
  name: 'createVolume',
  description: 'Create a new block volume',
  category: 'storage',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    availabilityDomain: z.string().describe('The availability domain'),
    displayName: z.string().describe('Display name for the volume'),
    sizeInGBs: z.number().describe('Size in GB'),
    vpusPerGB: z.number().default(10).describe('Performance units per GB'),
  }),
  execute: async (args) => {
    return { volume: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Delete block volume
 */
registerTool({
  name: 'deleteVolume',
  description: 'Delete a block volume',
  category: 'storage',
  approvalLevel: 'danger',
  schema: z.object({
    volumeId: z.string().describe('The OCID of the volume'),
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});
