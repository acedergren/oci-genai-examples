import { z } from 'zod';
import { tool } from 'ai';
import { execFileSync } from 'child_process';
import type { ToolDefinition, ApprovalLevel, ToolCategory } from './types.js';

/**
 * Execute an OCI CLI command safely
 */
function executeOCI(args: string[]): unknown {
  try {
    const output = execFileSync('oci', args, {
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return JSON.parse(output);
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string };
    throw new Error(`OCI CLI error: ${execError.stderr || execError.message}`);
  }
}

/**
 * Tool registry for OCI operations
 */
const toolDefinitions: Map<string, ToolDefinition> = new Map();

// Common schemas
const compartmentIdSchema = z.string().describe('The OCID of the compartment');

/**
 * Register all OCI tools
 */
function registerTools() {
  // ===== COMPUTE TOOLS =====

  registerTool({
    name: 'listInstances',
    description: 'List compute instances in a compartment with optional filters',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      displayName: z.string().optional().describe('Filter by display name'),
      lifecycleState: z.enum(['RUNNING', 'STOPPED', 'TERMINATED']).optional(),
      limit: z.number().default(50).describe('Maximum number of results'),
    }),
  });

  registerTool({
    name: 'getInstance',
    description: 'Get detailed information about a specific compute instance',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
    }),
  });

  registerTool({
    name: 'launchInstance',
    description: 'Launch a new compute instance with specified configuration',
    category: 'compute',
    approvalLevel: 'confirm',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      availabilityDomain: z.string().describe('The availability domain'),
      displayName: z.string().describe('Display name for the instance'),
      shape: z.string().describe('The shape (e.g., VM.Standard.E4.Flex)'),
      imageId: z.string().describe('The OCID of the image'),
      subnetId: z.string().describe('The OCID of the subnet'),
    }),
  });

  registerTool({
    name: 'stopInstance',
    description: 'Stop a running compute instance',
    category: 'compute',
    approvalLevel: 'danger',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
    }),
  });

  registerTool({
    name: 'terminateInstance',
    description: 'Permanently terminate and delete a compute instance',
    category: 'compute',
    approvalLevel: 'danger',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
      preserveBootVolume: z.boolean().default(false),
    }),
  });

  // ===== NETWORKING TOOLS =====

  registerTool({
    name: 'listVcns',
    description: 'List Virtual Cloud Networks in a compartment',
    category: 'networking',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      displayName: z.string().optional(),
    }),
  });

  registerTool({
    name: 'createVcn',
    description: 'Create a new Virtual Cloud Network',
    category: 'networking',
    approvalLevel: 'confirm',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      displayName: z.string().describe('Display name for the VCN'),
      cidrBlock: z.string().describe('CIDR block (e.g., 10.0.0.0/16)'),
    }),
  });

  registerTool({
    name: 'deleteVcn',
    description: 'Delete a Virtual Cloud Network',
    category: 'networking',
    approvalLevel: 'danger',
    parameters: z.object({
      vcnId: z.string().describe('The OCID of the VCN'),
    }),
  });

  registerTool({
    name: 'listSubnets',
    description: 'List subnets in a compartment or VCN',
    category: 'networking',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      vcnId: z.string().optional().describe('Filter by VCN'),
    }),
  });

  // ===== STORAGE TOOLS =====

  registerTool({
    name: 'listBuckets',
    description: 'List Object Storage buckets in a compartment',
    category: 'storage',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      namespace: z.string().describe('The Object Storage namespace'),
    }),
  });

  registerTool({
    name: 'createBucket',
    description: 'Create a new Object Storage bucket',
    category: 'storage',
    approvalLevel: 'confirm',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      namespace: z.string(),
      name: z.string().describe('Name for the bucket'),
      publicAccessType: z.enum(['NoPublicAccess', 'ObjectRead']).default('NoPublicAccess'),
    }),
  });

  registerTool({
    name: 'deleteBucket',
    description: 'Delete an Object Storage bucket',
    category: 'storage',
    approvalLevel: 'danger',
    parameters: z.object({
      namespace: z.string(),
      bucketName: z.string(),
    }),
  });

  // ===== DATABASE TOOLS =====

  registerTool({
    name: 'listAutonomousDatabases',
    description: 'List Autonomous Databases in a compartment',
    category: 'database',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      dbWorkload: z.enum(['OLTP', 'DW', 'AJD', 'APEX']).optional(),
    }),
  });

  registerTool({
    name: 'createAutonomousDatabase',
    description: 'Create a new Autonomous Database',
    category: 'database',
    approvalLevel: 'confirm',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      displayName: z.string(),
      dbName: z.string().describe('Database name (alphanumeric, 14 chars max)'),
      dbWorkload: z.enum(['OLTP', 'DW', 'AJD', 'APEX']),
      cpuCoreCount: z.number(),
      dataStorageSizeInTBs: z.number(),
    }),
  });

  registerTool({
    name: 'terminateAutonomousDatabase',
    description: 'Permanently terminate an Autonomous Database',
    category: 'database',
    approvalLevel: 'danger',
    parameters: z.object({
      autonomousDatabaseId: z.string(),
    }),
  });

  // ===== IDENTITY TOOLS =====

  registerTool({
    name: 'listCompartments',
    description: 'List compartments in the tenancy or a parent compartment',
    category: 'identity',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      accessLevel: z.enum(['ANY', 'ACCESSIBLE']).default('ACCESSIBLE'),
    }),
  });

  registerTool({
    name: 'listPolicies',
    description: 'List IAM policies in a compartment',
    category: 'identity',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
    }),
  });

  registerTool({
    name: 'createPolicy',
    description: 'Create a new IAM policy',
    category: 'identity',
    approvalLevel: 'confirm',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      name: z.string(),
      description: z.string(),
      statements: z.array(z.string()),
    }),
  });

  // ===== OBSERVABILITY TOOLS =====

  registerTool({
    name: 'listAlarms',
    description: 'List monitoring alarms in a compartment',
    category: 'observability',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      displayName: z.string().optional(),
    }),
  });

  registerTool({
    name: 'summarizeMetrics',
    description: 'Query metric data with aggregation',
    category: 'observability',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      namespace: z.string().describe('Metric namespace'),
      query: z.string().describe('MQL query string'),
      startTime: z.string().describe('Start time (ISO 8601)'),
      endTime: z.string().describe('End time (ISO 8601)'),
    }),
  });
}

function registerTool(definition: ToolDefinition) {
  toolDefinitions.set(definition.name, definition);
}

/**
 * Get a tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return toolDefinitions.get(name);
}

/**
 * Get all tool definitions
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  return Array.from(toolDefinitions.values());
}

/**
 * Get tool definitions by category
 */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return getAllToolDefinitions().filter((t) => t.category === category);
}

/**
 * Tool executors that map tool names to OCI CLI commands
 */
const toolExecutors: Record<string, (args: Record<string, unknown>) => unknown> = {
  // COMPUTE
  listInstances: (args) => {
    const cliArgs = [
      'compute',
      'instance',
      'list',
      '--compartment-id',
      args.compartmentId as string,
    ];
    if (args.displayName) cliArgs.push('--display-name', args.displayName as string);
    if (args.lifecycleState) cliArgs.push('--lifecycle-state', args.lifecycleState as string);
    if (args.limit) cliArgs.push('--limit', String(args.limit));
    return executeOCI(cliArgs);
  },
  getInstance: (args) => {
    return executeOCI(['compute', 'instance', 'get', '--instance-id', args.instanceId as string]);
  },
  launchInstance: (args) => {
    return executeOCI([
      'compute',
      'instance',
      'launch',
      '--compartment-id',
      args.compartmentId as string,
      '--availability-domain',
      args.availabilityDomain as string,
      '--display-name',
      args.displayName as string,
      '--shape',
      args.shape as string,
      '--image-id',
      args.imageId as string,
      '--subnet-id',
      args.subnetId as string,
    ]);
  },
  stopInstance: (args) => {
    return executeOCI([
      'compute',
      'instance',
      'action',
      '--action',
      'STOP',
      '--instance-id',
      args.instanceId as string,
    ]);
  },
  terminateInstance: (args) => {
    const cliArgs = [
      'compute',
      'instance',
      'terminate',
      '--instance-id',
      args.instanceId as string,
      '--force',
    ];
    if (args.preserveBootVolume) cliArgs.push('--preserve-boot-volume', 'true');
    return executeOCI(cliArgs);
  },

  // NETWORKING
  listVcns: (args) => {
    const cliArgs = ['network', 'vcn', 'list', '--compartment-id', args.compartmentId as string];
    if (args.displayName) cliArgs.push('--display-name', args.displayName as string);
    return executeOCI(cliArgs);
  },
  createVcn: (args) => {
    return executeOCI([
      'network',
      'vcn',
      'create',
      '--compartment-id',
      args.compartmentId as string,
      '--display-name',
      args.displayName as string,
      '--cidr-block',
      args.cidrBlock as string,
    ]);
  },
  deleteVcn: (args) => {
    return executeOCI(['network', 'vcn', 'delete', '--vcn-id', args.vcnId as string, '--force']);
  },
  listSubnets: (args) => {
    const cliArgs = ['network', 'subnet', 'list', '--compartment-id', args.compartmentId as string];
    if (args.vcnId) cliArgs.push('--vcn-id', args.vcnId as string);
    return executeOCI(cliArgs);
  },

  // STORAGE
  listBuckets: (args) => {
    return executeOCI([
      'os',
      'bucket',
      'list',
      '--compartment-id',
      args.compartmentId as string,
      '--namespace',
      args.namespace as string,
    ]);
  },
  createBucket: (args) => {
    return executeOCI([
      'os',
      'bucket',
      'create',
      '--compartment-id',
      args.compartmentId as string,
      '--namespace',
      args.namespace as string,
      '--name',
      args.name as string,
      '--public-access-type',
      args.publicAccessType as string,
    ]);
  },
  deleteBucket: (args) => {
    return executeOCI([
      'os',
      'bucket',
      'delete',
      '--namespace',
      args.namespace as string,
      '--bucket-name',
      args.bucketName as string,
      '--force',
    ]);
  },

  // DATABASE
  listAutonomousDatabases: (args) => {
    const cliArgs = [
      'db',
      'autonomous-database',
      'list',
      '--compartment-id',
      args.compartmentId as string,
    ];
    if (args.dbWorkload) cliArgs.push('--db-workload', args.dbWorkload as string);
    return executeOCI(cliArgs);
  },
  createAutonomousDatabase: (args) => {
    return executeOCI([
      'db',
      'autonomous-database',
      'create',
      '--compartment-id',
      args.compartmentId as string,
      '--display-name',
      args.displayName as string,
      '--db-name',
      args.dbName as string,
      '--db-workload',
      args.dbWorkload as string,
      '--cpu-core-count',
      String(args.cpuCoreCount),
      '--data-storage-size-in-tbs',
      String(args.dataStorageSizeInTBs),
    ]);
  },
  terminateAutonomousDatabase: (args) => {
    return executeOCI([
      'db',
      'autonomous-database',
      'delete',
      '--autonomous-database-id',
      args.autonomousDatabaseId as string,
      '--force',
    ]);
  },

  // IDENTITY
  listCompartments: (args) => {
    return executeOCI([
      'iam',
      'compartment',
      'list',
      '--compartment-id',
      args.compartmentId as string,
      '--access-level',
      args.accessLevel as string,
    ]);
  },
  listPolicies: (args) => {
    return executeOCI(['iam', 'policy', 'list', '--compartment-id', args.compartmentId as string]);
  },
  createPolicy: (args) => {
    const statements = args.statements as string[];
    return executeOCI([
      'iam',
      'policy',
      'create',
      '--compartment-id',
      args.compartmentId as string,
      '--name',
      args.name as string,
      '--description',
      args.description as string,
      '--statements',
      JSON.stringify(statements),
    ]);
  },

  // OBSERVABILITY
  listAlarms: (args) => {
    const cliArgs = [
      'monitoring',
      'alarm',
      'list',
      '--compartment-id',
      args.compartmentId as string,
    ];
    if (args.displayName) cliArgs.push('--display-name', args.displayName as string);
    return executeOCI(cliArgs);
  },
  summarizeMetrics: (args) => {
    return executeOCI([
      'monitoring',
      'metric-data',
      'summarize-metrics-data',
      '--compartment-id',
      args.compartmentId as string,
      '--namespace',
      args.namespace as string,
      '--query-text',
      args.query as string,
      '--start-time',
      args.startTime as string,
      '--end-time',
      args.endTime as string,
    ]);
  },
};

/**
 * Convert tool definitions to AI SDK tools format
 * These tools execute real OCI CLI commands
 */
export function createAISDKTools() {
  const tools: Record<string, ReturnType<typeof tool>> = {};

  for (const def of toolDefinitions.values()) {
    const executor = toolExecutors[def.name];

    tools[def.name] = tool({
      description: def.description,
      parameters: def.parameters,
      execute: async (args) => {
        if (!executor) {
          return { error: `No executor found for tool: ${def.name}` };
        }

        try {
          const result = executor(args);
          return {
            success: true,
            tool: def.name,
            data: result,
          };
        } catch (error) {
          return {
            success: false,
            tool: def.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });
  }

  return tools;
}

// Initialize tools on module load
registerTools();

export { toolDefinitions };
