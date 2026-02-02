import { z } from 'zod';
import { registerTool } from '../registry.js';

const compartmentIdSchema = z.string().describe('The OCID of the compartment');

/**
 * List compartments
 */
registerTool({
  name: 'listCompartments',
  description: 'List compartments in the tenancy or a parent compartment',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema.describe('Parent compartment OCID'),
    accessLevel: z.enum(['ANY', 'ACCESSIBLE']).default('ACCESSIBLE'),
    compartmentIdInSubtree: z.boolean().default(false),
  }),
  execute: async (args) => {
    return { compartments: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Get compartment details
 */
registerTool({
  name: 'getCompartment',
  description: 'Get detailed information about a compartment',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
  }),
  execute: async (args) => {
    return { compartment: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Create compartment
 */
registerTool({
  name: 'createCompartment',
  description: 'Create a new compartment',
  category: 'identity',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema.describe('Parent compartment OCID'),
    name: z.string().describe('Name for the compartment'),
    description: z.string().describe('Description'),
  }),
  execute: async (args) => {
    return { compartment: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * List users
 */
registerTool({
  name: 'listUsers',
  description: 'List users in the tenancy',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema.describe('Tenancy OCID'),
  }),
  execute: async (args) => {
    return { users: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List groups
 */
registerTool({
  name: 'listGroups',
  description: 'List groups in the tenancy',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema.describe('Tenancy OCID'),
  }),
  execute: async (args) => {
    return { groups: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List policies
 */
registerTool({
  name: 'listPolicies',
  description: 'List policies in a compartment',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
  }),
  execute: async (args) => {
    return { policies: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Get policy
 */
registerTool({
  name: 'getPolicy',
  description: 'Get detailed information about a policy including statements',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({
    policyId: z.string().describe('The OCID of the policy'),
  }),
  execute: async (args) => {
    return { policy: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Create policy
 */
registerTool({
  name: 'createPolicy',
  description: 'Create a new IAM policy',
  category: 'identity',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    name: z.string().describe('Policy name'),
    description: z.string().describe('Policy description'),
    statements: z.array(z.string()).describe('Policy statements'),
  }),
  execute: async (args) => {
    return { policy: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * List availability domains
 */
registerTool({
  name: 'listAvailabilityDomains',
  description: 'List availability domains in a compartment',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
  }),
  execute: async (args) => {
    return { availabilityDomains: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List regions
 */
registerTool({
  name: 'listRegions',
  description: 'List subscribed regions for the tenancy',
  category: 'identity',
  approvalLevel: 'auto',
  schema: z.object({}),
  execute: async (args) => {
    return { regions: [], message: 'OCI SDK integration pending' };
  },
});
