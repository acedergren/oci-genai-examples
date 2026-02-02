import { z } from 'zod';
import { registerTool } from '../registry.js';

const compartmentIdSchema = z.string().describe('The OCID of the compartment');

/**
 * List Autonomous Databases
 */
registerTool({
  name: 'listAutonomousDatabases',
  description: 'List Autonomous Databases in a compartment',
  category: 'database',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().optional(),
    dbWorkload: z.enum(['OLTP', 'DW', 'AJD', 'APEX']).optional(),
    lifecycleState: z.enum(['PROVISIONING', 'AVAILABLE', 'STOPPING', 'STOPPED', 'STARTING', 'TERMINATING', 'TERMINATED']).optional(),
  }),
  execute: async (args) => {
    return { autonomousDatabases: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Get Autonomous Database details
 */
registerTool({
  name: 'getAutonomousDatabase',
  description: 'Get detailed information about an Autonomous Database',
  category: 'database',
  approvalLevel: 'auto',
  schema: z.object({
    autonomousDatabaseId: z.string().describe('The OCID of the Autonomous Database'),
  }),
  execute: async (args) => {
    return { autonomousDatabase: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Create Autonomous Database
 */
registerTool({
  name: 'createAutonomousDatabase',
  description: 'Create a new Autonomous Database',
  category: 'database',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().describe('Display name'),
    dbName: z.string().describe('Database name (alphanumeric, 14 chars max)'),
    dbWorkload: z.enum(['OLTP', 'DW', 'AJD', 'APEX']).describe('Workload type'),
    cpuCoreCount: z.number().describe('Number of CPU cores'),
    dataStorageSizeInTBs: z.number().describe('Storage size in TB'),
    adminPassword: z.string().describe('Admin password'),
    isAutoScalingEnabled: z.boolean().default(false),
    isFreeTier: z.boolean().default(false),
  }),
  execute: async (args) => {
    return { autonomousDatabase: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Start Autonomous Database
 */
registerTool({
  name: 'startAutonomousDatabase',
  description: 'Start a stopped Autonomous Database',
  category: 'database',
  approvalLevel: 'confirm',
  schema: z.object({
    autonomousDatabaseId: z.string().describe('The OCID of the Autonomous Database'),
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * Stop Autonomous Database
 */
registerTool({
  name: 'stopAutonomousDatabase',
  description: 'Stop an Autonomous Database',
  category: 'database',
  approvalLevel: 'danger',
  schema: z.object({
    autonomousDatabaseId: z.string().describe('The OCID of the Autonomous Database'),
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * Terminate Autonomous Database
 */
registerTool({
  name: 'terminateAutonomousDatabase',
  description: 'Permanently terminate an Autonomous Database',
  category: 'database',
  approvalLevel: 'danger',
  schema: z.object({
    autonomousDatabaseId: z.string().describe('The OCID of the Autonomous Database'),
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * Scale Autonomous Database
 */
registerTool({
  name: 'scaleAutonomousDatabase',
  description: 'Scale CPU or storage for an Autonomous Database',
  category: 'database',
  approvalLevel: 'confirm',
  schema: z.object({
    autonomousDatabaseId: z.string().describe('The OCID of the Autonomous Database'),
    cpuCoreCount: z.number().optional().describe('New CPU core count'),
    dataStorageSizeInTBs: z.number().optional().describe('New storage size in TB'),
  }),
  execute: async (args) => {
    return { autonomousDatabase: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * List DB Systems
 */
registerTool({
  name: 'listDbSystems',
  description: 'List DB Systems (BaseDB) in a compartment',
  category: 'database',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    availabilityDomain: z.string().optional(),
    displayName: z.string().optional(),
  }),
  execute: async (args) => {
    return { dbSystems: [], message: 'OCI SDK integration pending' };
  },
});
