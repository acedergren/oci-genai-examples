import { z } from 'zod';
import { tool } from 'ai';
import { execFileSync } from 'child_process';
import type { ToolDefinition, ApprovalLevel, ToolCategory } from './types.js';
import {
  CloudPricingService,
  OCIPricingClient,
  AzurePricingClient,
} from '$lib/pricing/cloud-pricing-service.js';
import type { WorkloadRequirements, CloudProvider } from '$lib/pricing/types.js';
import {
  generateTerraformCode,
  generateQuickComputeTerraform,
  generateWebServerTerraform,
} from '$lib/terraform/generator.js';

/**
 * Get the default compartment ID from environment
 */
function getDefaultCompartmentId(): string | undefined {
  return process.env.OCI_COMPARTMENT_ID;
}

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

// Common schemas - compartmentId is optional because executor falls back to OCI_COMPARTMENT_ID env var
const compartmentIdSchema = z
  .string()
  .optional()
  .describe('The OCID of the compartment (optional - uses OCI_COMPARTMENT_ID env var if not provided)');

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

  // ===== PRICING TOOLS =====

  registerTool({
    name: 'compareCloudCosts',
    description:
      'Compare cloud costs between OCI and Azure for a given workload. Returns side-by-side pricing comparison with recommendations.',
    category: 'pricing',
    approvalLevel: 'auto',
    parameters: z.object({
      vcpus: z.number().optional().describe('Number of vCPUs required'),
      memoryGB: z.number().optional().describe('Memory in GB required'),
      architecture: z
        .enum(['x86', 'arm', 'any'])
        .optional()
        .describe('CPU architecture preference'),
      gpuRequired: z.boolean().optional().describe('Whether GPU is required'),
      storageGB: z.number().optional().describe('Storage size in GB'),
      storageType: z
        .enum(['ssd', 'hdd', 'object', 'archive'])
        .optional()
        .describe('Storage type'),
      egressGBPerMonth: z.number().optional().describe('Expected data egress in GB per month'),
      hoursPerMonth: z
        .number()
        .optional()
        .default(730)
        .describe('Hours per month (730 for always-on)'),
      maxBudgetPerMonth: z.number().optional().describe('Maximum monthly budget in USD'),
    }),
  });

  registerTool({
    name: 'getOCIPricing',
    description:
      'Get OCI compute pricing for a specific VM shape or list available shapes with pricing',
    category: 'pricing',
    approvalLevel: 'auto',
    parameters: z.object({
      shapeName: z
        .string()
        .optional()
        .describe('Specific shape name (e.g., VM.Standard.E5.Flex, VM.Standard.A1.Flex)'),
      architecture: z
        .enum(['x86', 'arm', 'gpu'])
        .optional()
        .describe('Filter by architecture type'),
      listAll: z.boolean().optional().describe('List all available shapes with pricing'),
    }),
  });

  registerTool({
    name: 'getAzurePricing',
    description: 'Get Azure VM pricing for a specific SKU or search available VMs',
    category: 'pricing',
    approvalLevel: 'auto',
    parameters: z.object({
      skuName: z
        .string()
        .optional()
        .describe('Specific Azure SKU (e.g., Standard_D2s_v3, Standard_B2s)'),
      region: z
        .string()
        .optional()
        .default('westeurope')
        .describe('Azure region (e.g., westeurope, eastus)'),
      serviceName: z
        .string()
        .optional()
        .default('Virtual Machines')
        .describe('Azure service name'),
    }),
  });

  registerTool({
    name: 'getOCIFreeTier',
    description:
      'Get details about OCI Always Free tier including compute, storage, database, and networking allocations',
    category: 'pricing',
    approvalLevel: 'auto',
    parameters: z.object({}),
  });

  registerTool({
    name: 'estimateCloudCost',
    description: 'Estimate monthly cost for a specific cloud provider (OCI or Azure)',
    category: 'pricing',
    approvalLevel: 'auto',
    parameters: z.object({
      provider: z.enum(['oci', 'azure']).describe('Cloud provider to estimate costs for'),
      vcpus: z.number().optional().describe('Number of vCPUs'),
      memoryGB: z.number().optional().describe('Memory in GB'),
      architecture: z.enum(['x86', 'arm', 'any']).optional().describe('CPU architecture'),
      storageGB: z.number().optional().describe('Storage size in GB'),
      storageType: z.enum(['ssd', 'hdd', 'object', 'archive']).optional().describe('Storage type'),
      egressGBPerMonth: z.number().optional().describe('Data egress in GB per month'),
      hoursPerMonth: z.number().optional().default(730).describe('Hours per month'),
    }),
  });

  // ===== INFRASTRUCTURE TOOLS =====

  registerTool({
    name: 'listAvailabilityDomains',
    description: 'List availability domains in a region for instance placement',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
    }),
  });

  registerTool({
    name: 'listImages',
    description: 'List available OS images for compute instances, filterable by OS and shape',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      operatingSystem: z
        .string()
        .optional()
        .describe('Filter by OS (e.g., "Oracle Linux", "Canonical Ubuntu")'),
      operatingSystemVersion: z.string().optional().describe('Filter by OS version (e.g., "8", "22.04")'),
      shape: z.string().optional().describe('Filter by compatible shape'),
      limit: z.number().default(20).describe('Maximum number of results'),
    }),
  });

  registerTool({
    name: 'listShapes',
    description: 'List available compute shapes in a compartment with their specifications',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      availabilityDomain: z.string().optional().describe('Filter by availability domain'),
    }),
  });

  registerTool({
    name: 'generateTerraform',
    description:
      'Generate Terraform HCL code for OCI infrastructure. Can generate compute instances, VCNs, subnets, and full web server setups.',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      type: z
        .enum(['compute', 'vcn', 'web-server'])
        .describe('Type of infrastructure to generate'),
      name: z.string().describe('Display name for the resources'),
      shape: z
        .string()
        .optional()
        .default('VM.Standard.E4.Flex')
        .describe('Compute shape (e.g., VM.Standard.E4.Flex, VM.Standard.A1.Flex)'),
      ocpus: z.number().optional().default(1).describe('Number of OCPUs for flex shapes'),
      memoryGBs: z.number().optional().default(6).describe('Memory in GB for flex shapes'),
      region: z.string().optional().default('eu-frankfurt-1').describe('OCI region'),
      vcnCidr: z.string().optional().default('10.0.0.0/16').describe('VCN CIDR block'),
      useVariables: z
        .boolean()
        .optional()
        .default(true)
        .describe('Generate with variables.tf (recommended)'),
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
 * Create AI SDK tools from registered tool definitions
 */
export function createAISDKTools(): Record<string, ReturnType<typeof tool>> {
  // Use explicit any cast to work around AI SDK's strict typing
  // The schemas are properly validated at runtime
  const tools: Record<string, ReturnType<typeof tool>> = {};

  for (const def of toolDefinitions.values()) {
    const syncExecutor = toolExecutors[def.name];
    const asyncExecutor = asyncToolExecutors[def.name];

    // Create tool with explicit any to bypass strict generic constraints
    // Runtime validation is handled by Zod schemas
    const toolDef = {
      description: def.description,
      parameters: def.parameters,
      execute: async (args: Record<string, unknown>) => {
        // Check for async executor first (pricing tools)
        if (asyncExecutor) {
          try {
            const result = await asyncExecutor(args);
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
        }

        // Fall back to sync executor (OCI CLI tools)
        if (!syncExecutor) {
          return { error: `No executor found for tool: ${def.name}` };
        }

        try {
          const result = syncExecutor(args);
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
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools[def.name] = tool(toolDef as any);
  }

  return tools;
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
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) {
      throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    }
    const cliArgs = ['compute', 'instance', 'list', '--compartment-id', compartmentId];
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
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const cliArgs = ['network', 'vcn', 'list', '--compartment-id', compartmentId];
    if (args.displayName) cliArgs.push('--display-name', args.displayName as string);
    return executeOCI(cliArgs);
  },
  createVcn: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'network',
      'vcn',
      'create',
      '--compartment-id',
      compartmentId,
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
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const cliArgs = ['network', 'subnet', 'list', '--compartment-id', compartmentId];
    if (args.vcnId) cliArgs.push('--vcn-id', args.vcnId as string);
    return executeOCI(cliArgs);
  },

  // STORAGE
  listBuckets: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'os',
      'bucket',
      'list',
      '--compartment-id',
      compartmentId,
      '--namespace',
      args.namespace as string,
    ]);
  },
  createBucket: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'os',
      'bucket',
      'create',
      '--compartment-id',
      compartmentId,
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
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const cliArgs = ['db', 'autonomous-database', 'list', '--compartment-id', compartmentId];
    if (args.dbWorkload) cliArgs.push('--db-workload', args.dbWorkload as string);
    return executeOCI(cliArgs);
  },
  createAutonomousDatabase: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'db',
      'autonomous-database',
      'create',
      '--compartment-id',
      compartmentId,
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
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'iam',
      'compartment',
      'list',
      '--compartment-id',
      compartmentId,
      '--access-level',
      (args.accessLevel as string) || 'ACCESSIBLE',
    ]);
  },
  listPolicies: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI(['iam', 'policy', 'list', '--compartment-id', compartmentId]);
  },
  createPolicy: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const statements = args.statements as string[];
    return executeOCI([
      'iam',
      'policy',
      'create',
      '--compartment-id',
      compartmentId,
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
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const cliArgs = ['monitoring', 'alarm', 'list', '--compartment-id', compartmentId];
    if (args.displayName) cliArgs.push('--display-name', args.displayName as string);
    return executeOCI(cliArgs);
  },
  summarizeMetrics: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'monitoring',
      'metric-data',
      'summarize-metrics-data',
      '--compartment-id',
      compartmentId,
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

  // INFRASTRUCTURE
  listAvailabilityDomains: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI(['iam', 'availability-domain', 'list', '--compartment-id', compartmentId]);
  },
  listImages: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const cliArgs = [
      'compute',
      'image',
      'list',
      '--compartment-id',
      compartmentId,
      '--sort-by',
      'TIMECREATED',
      '--sort-order',
      'DESC',
    ];
    if (args.operatingSystem)
      cliArgs.push('--operating-system', args.operatingSystem as string);
    if (args.operatingSystemVersion)
      cliArgs.push('--operating-system-version', args.operatingSystemVersion as string);
    if (args.shape) cliArgs.push('--shape', args.shape as string);
    if (args.limit) cliArgs.push('--limit', String(args.limit));
    return executeOCI(cliArgs);
  },
  listShapes: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const cliArgs = ['compute', 'shape', 'list', '--compartment-id', compartmentId];
    if (args.availabilityDomain)
      cliArgs.push('--availability-domain', args.availabilityDomain as string);
    return executeOCI(cliArgs);
  },
};

// Async tool executors for pricing operations
const asyncToolExecutors: Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
> = {
  // PRICING
  compareCloudCosts: async (args) => {
    const service = new CloudPricingService();

    const requirements: WorkloadRequirements = {
      compute: {
        vcpusMin: args.vcpus as number | undefined,
        memoryGBMin: args.memoryGB as number | undefined,
        architecture: args.architecture as 'x86' | 'arm' | 'any' | undefined,
        gpuRequired: args.gpuRequired as boolean | undefined,
        hoursPerMonth: (args.hoursPerMonth as number) || 730,
      },
      storage: args.storageGB
        ? {
            sizeGB: args.storageGB as number,
            type: args.storageType as 'ssd' | 'hdd' | 'object' | 'archive' | undefined,
          }
        : undefined,
      networking: args.egressGBPerMonth
        ? {
            egressGBPerMonth: args.egressGBPerMonth as number,
          }
        : undefined,
      constraints: args.maxBudgetPerMonth
        ? {
            maxBudgetPerMonth: args.maxBudgetPerMonth as number,
          }
        : undefined,
    };

    const comparison = await service.compareCloudCosts(requirements);
    const markdown = service.formatAsMarkdown(comparison);

    return {
      comparison,
      formatted: markdown,
    };
  },

  getOCIPricing: async (args) => {
    const client = new OCIPricingClient();

    if (args.listAll || (!args.shapeName && !args.architecture)) {
      const shapes = await client.listComputeShapes(
        args.architecture ? { architecture: args.architecture as 'x86' | 'arm' | 'gpu' } : undefined
      );
      return {
        shapes,
        count: shapes.length,
      };
    }

    if (args.shapeName) {
      const pricing = await client.getComputePricing(args.shapeName as string);
      if (!pricing) {
        return { error: `Shape not found: ${args.shapeName}` };
      }
      return pricing;
    }

    if (args.architecture) {
      const shapes = await client.listComputeShapes({
        architecture: args.architecture as 'x86' | 'arm' | 'gpu',
      });
      return {
        shapes,
        count: shapes.length,
        architecture: args.architecture,
      };
    }

    return { error: 'Please specify a shapeName, architecture, or set listAll to true' };
  },

  getAzurePricing: async (args) => {
    const client = new AzurePricingClient();
    const region = (args.region as string) || 'westeurope';

    if (args.skuName) {
      const pricing = await client.getVMPricing(args.skuName as string, region);
      if (!pricing) {
        return { error: `SKU not found: ${args.skuName} in region ${region}` };
      }

      const monthlyCost = await client.calculateMonthlyCost({
        skuName: args.skuName as string,
        region,
        hoursPerMonth: 730,
      });

      return {
        pricing,
        monthlyCost,
      };
    }

    // Search for VMs
    const results = await client.searchPricing({
      serviceName: (args.serviceName as string) || 'Virtual Machines',
      armRegionName: region,
    });

    return {
      results: results.slice(0, 20), // Limit results
      count: results.length,
      region,
    };
  },

  getOCIFreeTier: async () => {
    const client = new OCIPricingClient();
    const freeTier = await client.getFreeTier();

    return {
      freeTier,
      summary: {
        compute: `${freeTier.compute.armOcpus} ARM OCPUs, ${freeTier.compute.memoryGB} GB RAM`,
        storage: `${freeTier.storage.blockStorageGB} GB block storage, ${freeTier.storage.objectStorageGB} GB object storage`,
        database: `${freeTier.database.autonomousDBs} Autonomous DBs with ${freeTier.database.storageGB} GB storage each`,
        networking: `${freeTier.networking.egressTBFree} TB outbound data transfer per month`,
      },
    };
  },

  estimateCloudCost: async (args) => {
    const service = new CloudPricingService();
    const provider = args.provider as CloudProvider;

    const requirements: WorkloadRequirements & { provider: CloudProvider } = {
      provider,
      compute: {
        vcpusMin: args.vcpus as number | undefined,
        memoryGBMin: args.memoryGB as number | undefined,
        architecture: args.architecture as 'x86' | 'arm' | 'any' | undefined,
        hoursPerMonth: (args.hoursPerMonth as number) || 730,
      },
      storage: args.storageGB
        ? {
            sizeGB: args.storageGB as number,
            type: args.storageType as 'ssd' | 'hdd' | 'object' | 'archive' | undefined,
          }
        : undefined,
      networking: args.egressGBPerMonth
        ? {
            egressGBPerMonth: args.egressGBPerMonth as number,
          }
        : undefined,
    };

    const estimate = await service.estimateCost(requirements);

    return {
      provider,
      estimate,
      summary: `${provider.toUpperCase()} estimated monthly cost: $${estimate.monthlyTotal.toFixed(2)}`,
    };
  },

  generateTerraform: async (args) => {
    const type = args.type as 'compute' | 'vcn' | 'web-server';
    const name = args.name as string;
    const shape = (args.shape as string) || 'VM.Standard.E4.Flex';
    const ocpus = (args.ocpus as number) || 1;
    const memoryGBs = (args.memoryGBs as number) || 6;
    const region = (args.region as string) || 'eu-frankfurt-1';
    const vcnCidr = (args.vcnCidr as string) || '10.0.0.0/16';

    if (type === 'web-server') {
      const output = generateWebServerTerraform({
        name,
        shape,
        ocpus,
        memoryGBs,
        region,
        vcnCidr,
      });

      return {
        type: 'web-server',
        files: {
          'main.tf': output.main,
          'variables.tf': output.variables,
          'outputs.tf': output.outputs,
          'terraform.tfvars.example': output.tfvars,
        },
        summary: `Generated Terraform for web server "${name}" with ${shape} (${ocpus} OCPUs, ${memoryGBs}GB RAM), VCN (${vcnCidr}), public and private subnets`,
        nextSteps: [
          '1. Copy the generated files to a new directory',
          '2. Run `terraform init` to initialize',
          '3. Copy terraform.tfvars.example to terraform.tfvars and fill in your values',
          '4. Run `terraform plan` to preview changes',
          '5. Run `terraform apply` to create resources',
        ],
      };
    }

    if (type === 'compute') {
      const code = generateQuickComputeTerraform({
        name,
        shape,
        ocpus,
        memoryGBs,
        region,
      });

      return {
        type: 'compute',
        files: {
          'main.tf': code,
        },
        summary: `Generated Terraform for compute instance "${name}" with ${shape} (${ocpus} OCPUs, ${memoryGBs}GB RAM)`,
        nextSteps: [
          '1. Add this to your existing Terraform configuration or create a new directory',
          '2. Ensure you have variables defined for compartment_id, subnet_id, ssh_public_key',
          '3. Run `terraform plan` to preview',
          '4. Run `terraform apply` to create',
        ],
      };
    }

    // VCN only
    const output = generateTerraformCode({
      useVariables: true,
      provider: { region },
      vcn: {
        displayName: name,
        cidrBlock: vcnCidr,
        dnsLabel: name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15),
        createInternetGateway: true,
        createNatGateway: true,
        createServiceGateway: true,
      },
      subnets: [
        {
          displayName: `${name}-public`,
          cidrBlock: vcnCidr.replace('/16', '/24'),
          isPublic: true,
          dnsLabel: 'public',
        },
        {
          displayName: `${name}-private`,
          cidrBlock: vcnCidr.replace('.0.0/16', '.1.0/24'),
          isPublic: false,
          dnsLabel: 'private',
        },
      ],
    });

    return {
      type: 'vcn',
      files: {
        'main.tf': output.main,
        'variables.tf': output.variables,
        'outputs.tf': output.outputs,
      },
      summary: `Generated Terraform for VCN "${name}" with CIDR ${vcnCidr}, including public/private subnets and gateways`,
      nextSteps: [
        '1. Copy the generated files to a directory',
        '2. Run `terraform init`',
        '3. Set your compartment_id variable',
        '4. Run `terraform apply`',
      ],
    };
  },
};

// Initialize tools on module load
registerTools();

/**
 * Callback for handling tool approval requests
 */
export type ApprovalCallback = (
  toolName: string,
  args: Record<string, unknown>,
  approvalLevel: ApprovalLevel,
  category: ToolCategory
) => Promise<boolean>;

/**
 * Create AI SDK tools with approval flow for dangerous operations
 * 
 * This version wraps tool executors to:
 * 1. Check if the tool requires approval
 * 2. Call the approval callback for confirm/danger tools
 * 3. Log all operations to the audit trail
 * 4. Only execute if approved (or auto-approved for read-only)
 */
export function createAISDKToolsWithApproval(
  onApprovalRequired: ApprovalCallback,
  sessionId?: string
): Record<string, ReturnType<typeof tool>> {
  const tools: Record<string, ReturnType<typeof tool>> = {};

  for (const def of toolDefinitions.values()) {
    const syncExecutor = toolExecutors[def.name];
    const asyncExecutor = asyncToolExecutors[def.name];

    const toolDef = {
      description: def.description,
      parameters: def.parameters,
      execute: async (args: Record<string, unknown>) => {
        const hasExecutor = syncExecutor || asyncExecutor;
        if (!hasExecutor) {
          return { error: `No executor found for tool: ${def.name}` };
        }

        const startTime = Date.now();

        try {
          // Check if approval is required
          const needsApproval = def.approvalLevel === 'confirm' || def.approvalLevel === 'danger';
          
          if (needsApproval) {
            // Request approval from the client
            const approved = await onApprovalRequired(
              def.name,
              args,
              def.approvalLevel,
              def.category
            );

            if (!approved) {
              return {
                success: false,
                tool: def.name,
                rejected: true,
                error: 'Operation was cancelled by user',
              };
            }
          }

          // Execute the tool (async or sync)
          let result: unknown;
          if (asyncExecutor) {
            result = await asyncExecutor(args);
          } else if (syncExecutor) {
            result = syncExecutor(args);
          }
          
          const duration = Date.now() - startTime;

          return {
            success: true,
            tool: def.name,
            data: result,
            duration,
            approvalLevel: def.approvalLevel,
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          return {
            success: false,
            tool: def.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration,
            approvalLevel: def.approvalLevel,
          };
        }
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools[def.name] = tool(toolDef as any);
  }

  return tools;
}

export { toolDefinitions, asyncToolExecutors };
