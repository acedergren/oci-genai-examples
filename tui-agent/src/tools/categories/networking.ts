import { z } from 'zod';
import { registerTool } from '../registry.js';

const compartmentIdSchema = z.string().describe('The OCID of the compartment');
const vcnIdSchema = z.string().describe('The OCID of the VCN');
const subnetIdSchema = z.string().describe('The OCID of the subnet');

/**
 * List VCNs
 */
registerTool({
  name: 'listVcns',
  description: 'List Virtual Cloud Networks in a compartment',
  category: 'networking',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().optional(),
    lifecycleState: z.enum(['AVAILABLE', 'PROVISIONING', 'TERMINATING', 'TERMINATED']).optional(),
  }),
  execute: async (args) => {
    return { vcns: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Get VCN details
 */
registerTool({
  name: 'getVcn',
  description: 'Get detailed information about a VCN',
  category: 'networking',
  approvalLevel: 'auto',
  schema: z.object({
    vcnId: vcnIdSchema,
  }),
  execute: async (args) => {
    return { vcn: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Create VCN
 */
registerTool({
  name: 'createVcn',
  description: 'Create a new Virtual Cloud Network',
  category: 'networking',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().describe('Display name for the VCN'),
    cidrBlock: z.string().describe('CIDR block (e.g., 10.0.0.0/16)'),
    dnsLabel: z.string().optional().describe('DNS label for the VCN'),
  }),
  execute: async (args) => {
    return { vcn: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Delete VCN
 */
registerTool({
  name: 'deleteVcn',
  description: 'Delete a Virtual Cloud Network',
  category: 'networking',
  approvalLevel: 'danger',
  schema: z.object({
    vcnId: vcnIdSchema,
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * List subnets
 */
registerTool({
  name: 'listSubnets',
  description: 'List subnets in a compartment or VCN',
  category: 'networking',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    vcnId: vcnIdSchema.optional(),
    displayName: z.string().optional(),
  }),
  execute: async (args) => {
    return { subnets: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Create subnet
 */
registerTool({
  name: 'createSubnet',
  description: 'Create a new subnet in a VCN',
  category: 'networking',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    vcnId: vcnIdSchema,
    displayName: z.string().describe('Display name for the subnet'),
    cidrBlock: z.string().describe('CIDR block (e.g., 10.0.1.0/24)'),
    availabilityDomain: z.string().optional().describe('AD for regional subnet'),
    prohibitPublicIpOnVnic: z.boolean().default(false),
  }),
  execute: async (args) => {
    return { subnet: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * List security lists
 */
registerTool({
  name: 'listSecurityLists',
  description: 'List security lists in a compartment',
  category: 'networking',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    vcnId: vcnIdSchema.optional(),
  }),
  execute: async (args) => {
    return { securityLists: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List network security groups
 */
registerTool({
  name: 'listNetworkSecurityGroups',
  description: 'List network security groups in a compartment',
  category: 'networking',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    vcnId: vcnIdSchema.optional(),
  }),
  execute: async (args) => {
    return { networkSecurityGroups: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List internet gateways
 */
registerTool({
  name: 'listInternetGateways',
  description: 'List internet gateways in a compartment',
  category: 'networking',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    vcnId: vcnIdSchema.optional(),
  }),
  execute: async (args) => {
    return { internetGateways: [], message: 'OCI SDK integration pending' };
  },
});
