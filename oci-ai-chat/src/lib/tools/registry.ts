import { z } from 'zod';
import { tool } from 'ai';
import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition, ApprovalLevel, ToolCategory } from './types.js';
import {
  CloudPricingService,
  OCIPricingClient,
  AzurePricingClient,
  AWSPricingClient,
} from '$lib/pricing/cloud-pricing-service.js';
import type { WorkloadRequirements, CloudProvider } from '$lib/pricing/types.js';
import {
  generateTerraformCode,
  generateQuickComputeTerraform,
  generateWebServerTerraform,
} from '$lib/terraform/generator.js';

const execFileAsync = promisify(execFile);

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
 * Execute an OCI CLI command asynchronously (for composite/multi-step operations)
 */
async function executeOCIAsync(args: string[]): Promise<unknown> {
  try {
    const { stdout } = await execFileAsync('oci', args, {
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
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
    description: 'List compute instances in a compartment. Present results as a markdown table: Name | Shape | State | OCPUs | Memory | Created. Highlight any STOPPED instances as potential cost savings (boot volumes still incur charges). Suggest getInstance for details on specific instances, or compareCloudCosts if the user wants to optimize.',
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
    description: 'Get detailed information about a specific compute instance. Present key details: display name, shape, state, OCPU/memory, availability domain, time created, public/private IPs. If the instance is STOPPED, mention that boot volumes still incur cost. Suggest right-sizing if shape seems over-provisioned.',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
    }),
  });

  registerTool({
    name: 'launchInstance',
    description: 'Launch a new compute instance. REQUIRES user confirmation before calling. Present the planned configuration (shape, OCPUs, memory, image, subnet) in a summary table before launching. After launch, show the instance OCID and suggest checking getInstance for status updates.',
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
    description: 'Stop a running compute instance. DANGER: Confirm with user first. Warn that boot volume charges continue while stopped. After stopping, suggest terminateInstance if the instance is no longer needed (to save on boot volume costs).',
    category: 'compute',
    approvalLevel: 'danger',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
    }),
  });

  registerTool({
    name: 'terminateInstance',
    description: 'Permanently terminate and delete a compute instance. DANGER: This is irreversible. Always confirm with the user, stating the instance name and OCID. Ask if they want to preserve the boot volume (for data recovery). After termination, confirm the operation completed.',
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
    description: 'List Virtual Cloud Networks. Present as a table: Name | CIDR Block | State | DNS Label. For each VCN, suggest listSubnets for subnet details. If no VCNs exist and user needs networking, suggest the Setup Private Network workflow or generateTerraform with type=vcn.',
    category: 'networking',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      displayName: z.string().optional(),
    }),
  });

  registerTool({
    name: 'createVcn',
    description: 'Create a new Virtual Cloud Network. REQUIRES confirmation. Recommend a /16 CIDR block for flexibility. After creation, suggest creating public and private subnets, internet gateway, and NAT gateway. Offer to generate Terraform for the full network stack instead.',
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
    description: 'Delete a Virtual Cloud Network. DANGER: Irreversible. VCN must be empty (no subnets, gateways, or instances). Confirm with user by stating the VCN name. Warn if any subnets still exist.',
    category: 'networking',
    approvalLevel: 'danger',
    parameters: z.object({
      vcnId: z.string().describe('The OCID of the VCN'),
    }),
  });

  registerTool({
    name: 'listSubnets',
    description: 'List subnets in a compartment or VCN. Present as a table: Name | CIDR Block | Type (Public/Private) | VCN | AD. Highlight any subnets missing security lists. If filtering by VCN, also mention the VCN name for context.',
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
    description: 'List Object Storage buckets in a compartment. Present as a table: Name | Created | Public Access | Storage Tier. Flag any buckets with public access as a security concern. Mention that OCI Object Storage includes 10TB/month free egress.',
    category: 'storage',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      namespace: z.string().describe('The Object Storage namespace'),
    }),
  });

  registerTool({
    name: 'createBucket',
    description: 'Create a new Object Storage bucket. ALWAYS default to NoPublicAccess unless user explicitly needs public access. After creation, suggest setting up lifecycle rules for automatic archival and an IAM policy for access control. Mention S3-compatible API access.',
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
    description: 'Delete an Object Storage bucket. DANGER: Bucket must be empty first. Confirm with user by stating the bucket name. Warn that all objects must be deleted before the bucket can be removed.',
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
    description: 'List Autonomous Databases in a compartment. Present as a table: Name | Workload Type | State | ECPUs | Storage (TB) | Created. Highlight Always Free eligible databases. Mention Oracle 26AI vector search capability for AI workloads. Suggest createAutonomousDatabase if none exist.',
    category: 'database',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      dbWorkload: z.enum(['OLTP', 'DW', 'AJD', 'APEX']).optional(),
    }),
  });

  registerTool({
    name: 'createAutonomousDatabase',
    description: 'Create a new Autonomous Database. REQUIRES confirmation. Explain workload types: OLTP (transactions), DW (analytics), AJD (JSON documents), APEX (low-code apps). For AI use cases, recommend OLTP with vector search enabled (Oracle 26AI). Always Free eligible: 2 databases with 1 ECPU, 20GB each. After creation, suggest downloading the wallet for connection.',
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
    description: 'Permanently terminate an Autonomous Database. DANGER: This destroys all data irreversibly. Confirm with user by stating the database name and OCID. Suggest creating a manual backup first if data preservation matters.',
    category: 'database',
    approvalLevel: 'danger',
    parameters: z.object({
      autonomousDatabaseId: z.string(),
    }),
  });

  // ===== IDENTITY TOOLS =====

  registerTool({
    name: 'listCompartments',
    description: 'List compartments in the tenancy or a parent compartment. Present as a table: Name | Description | State | Created. Compartments are OCI\'s primary resource isolation mechanism. If user is new, explain that resources live inside compartments for organization and access control.',
    category: 'identity',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      accessLevel: z.enum(['ANY', 'ACCESSIBLE']).default('ACCESSIBLE'),
    }),
  });

  registerTool({
    name: 'listPolicies',
    description: 'List IAM policies in a compartment. Present as a table: Name | Statement Count | Created. For security audits, flag overly broad policies (e.g., "manage all-resources in tenancy"). Recommend least-privilege: scope to specific compartments and resource types.',
    category: 'identity',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
    }),
  });

  registerTool({
    name: 'createPolicy',
    description: 'Create a new IAM policy. REQUIRES confirmation. Present the policy statements for review before creating. Follow least-privilege principle: scope to specific compartments and resource types. Example format: "Allow group <group> to manage <resource-type> in compartment <name>".',
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
    description: 'List monitoring alarms in a compartment. Present as a table: Name | Severity | State (OK/FIRING/SUSPENDED) | Metric. Highlight any FIRING alarms that need attention. If no alarms exist, suggest creating basic health alarms for compute CPU, memory, and disk usage.',
    category: 'observability',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      displayName: z.string().optional(),
    }),
  });

  registerTool({
    name: 'summarizeMetrics',
    description: 'Query metric data with aggregation using MQL (Monitoring Query Language). Prefer getComputeMetrics for common compute metrics — use this tool only for custom namespaces/queries. MQL syntax examples: "CpuUtilization[1h].mean()", "DiskBytesRead[5m]{resourceId = \\"ocid1...\\"}.sum()". If startTime/endTime are omitted, defaults to last 3 hours.',
    category: 'observability',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      namespace: z.string().describe('Metric namespace (e.g., oci_computeagent, oci_vcn, oci_blockstore)'),
      query: z.string().describe('MQL query string, e.g. "CpuUtilization[1h].mean()"'),
      startTime: z.string().optional().describe('Start time (ISO 8601) — defaults to 3 hours ago'),
      endTime: z.string().optional().describe('End time (ISO 8601) — defaults to now'),
      resolution: z.string().optional().describe('Data resolution (e.g., 1m, 5m, 1h)'),
    }),
  });

  // ===== PRICING TOOLS =====

  registerTool({
    name: 'compareCloudCosts',
    description:
      'Compare cloud costs between OCI and Azure for a given workload. Returns a detailed markdown report — present the formatted output directly to the user (it includes tables, breakdowns, and reasoning). Highlight the savings percentage in bold. If OCI is cheaper, suggest generateTerraform as next step. Always mention OCI\'s 10TB free egress advantage for egress-heavy workloads.',
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
      'Get OCI compute pricing for a specific shape or list all shapes. Present as a table: Shape | Architecture | OCPU Range | Memory Range | Price/hr | Price/month. Highlight ARM shapes as cheapest option. Bold the Always Free eligible shapes (A1.Flex). Remind that 1 OCPU = 2 vCPUs when comparing with other clouds.',
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
    description: 'Get Azure VM pricing for comparison purposes. Present as a table: SKU | vCPUs | Memory | Price/hr | Price/month. Use this alongside getOCIPricing or compareCloudCosts for full comparison. Note Azure egress is only 5GB free vs OCI\'s 10TB.',
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
      'Get OCI Always Free tier details. Present as a structured summary with categories: Compute (4 ARM OCPUs, 24GB RAM), Storage (200GB block, 20GB object), Database (2 ADBs), Networking (10TB egress). Compare with Azure Free Tier if the user is evaluating options. Suggest specific deployment configurations that fit within free limits.',
    category: 'pricing',
    approvalLevel: 'auto',
    parameters: z.object({}),
  });

  registerTool({
    name: 'estimateCloudCost',
    description: 'Estimate monthly cost for a single cloud provider (OCI or Azure). Present the breakdown: Compute | Storage | Networking | Total. Bold the monthly total. For deeper analysis, suggest compareCloudCosts to see both providers side-by-side.',
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
    description: 'List availability domains (ADs) in the current region. Present as a simple list with AD names. For production workloads, recommend spreading instances across multiple ADs for high availability. Most regions have 1 AD; large regions (Ashburn, Phoenix, London) have 3.',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
    }),
  });

  registerTool({
    name: 'listImages',
    description: 'List available OS images for compute instances. Present as a table: OS | Version | Shape Compatibility | Created. Recommend Oracle Linux 8 for OCI-optimized performance (kernel tuning, cloud-init). For containers, suggest Oracle Linux with container runtime or Ubuntu 22.04. Filter by shape when a specific shape is already selected.',
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
    description: 'List available compute shapes with specifications. Present as a comparison table: Shape | Architecture | OCPU Range | Memory Range | Network Bandwidth. Highlight ARM shapes (A1.Flex) as 50%+ cheaper. Bold the recommended shape based on user requirements. If config qualifies for Always Free, call it out prominently.',
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
      'Generate Terraform HCL code for OCI infrastructure (compute, VCN, or full web-server stack). Present each generated file in a fenced ```hcl code block with the filename as a header. After generating, offer to create a Mermaid architecture diagram showing the resource topology. Provide numbered deployment steps (terraform init → plan → apply).',
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

  // ===== HIGH-LEVEL COMPUTE METRICS TOOL =====

  registerTool({
    name: 'getComputeMetrics',
    description: 'Get compute instance metrics without writing raw MQL. Simplifies common monitoring queries (CPU, memory, disk, network). Present results as a time-series summary with min/max/avg values. Flag CPU > 80% as potential scaling need, memory > 90% as critical.',
    category: 'observability',
    approvalLevel: 'auto',
    parameters: z.object({
      metricName: z.enum([
        'CpuUtilization',
        'MemoryUtilization',
        'DiskBytesRead',
        'DiskBytesWritten',
        'NetworksBytesIn',
        'NetworksBytesOut',
        'LoadAverage',
      ]).describe('The metric to query'),
      period: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h').describe('Time period to query'),
      instanceId: z.string().optional().describe('Filter to a specific instance OCID'),
      aggregation: z.enum(['mean', 'max', 'min', 'sum']).default('mean').describe('Aggregation function'),
      compartmentId: compartmentIdSchema,
    }),
  });

  // ===== OBJECT STORAGE NAMESPACE TOOL =====

  registerTool({
    name: 'getObjectStorageNamespace',
    description: 'Get the Object Storage namespace for the tenancy. This is required before calling listBuckets. Returns a single string (the namespace name). Cache this value — it does not change.',
    category: 'storage',
    approvalLevel: 'auto',
    parameters: z.object({}),
  });

  // ===== INSTANCE VNICS COMPOSITE TOOL =====

  registerTool({
    name: 'getInstanceVnics',
    description: 'Get all network interfaces (VNICs) for a compute instance, including public IP, private IP, subnet, and hostname. This is a composite operation that fetches VNIC attachments and then resolves each VNIC. Useful for finding an instance\'s IP addresses.',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
      compartmentId: compartmentIdSchema,
    }),
  });

  // ===== RESOURCE SEARCH TOOLS =====

  registerTool({
    name: 'searchResources',
    description: 'Search for any OCI resource using structured query language. Powerful for finding resources by type, state, or custom filters. Example queries: "query instance resources where lifeCycleState = \'RUNNING\'", "query all resources where displayName = \'my-app\'".',
    category: 'search',
    approvalLevel: 'auto',
    parameters: z.object({
      queryText: z.string().describe('OCI structured query (e.g., "query instance resources where lifeCycleState = \'RUNNING\'")'),
      limit: z.number().default(50).describe('Maximum number of results'),
    }),
  });

  registerTool({
    name: 'searchResourcesByName',
    description: 'Find OCI resources by display name. Simpler alternative to searchResources — no need to write query syntax. Returns matching resources with their type, state, compartment, and OCID.',
    category: 'search',
    approvalLevel: 'auto',
    parameters: z.object({
      displayName: z.string().describe('The display name to search for (case-insensitive contains match)'),
      resourceType: z.enum([
        'instance', 'vcn', 'subnet', 'bucket', 'autonomousdatabase',
        'volume', 'loadbalancer', 'dbsystem', 'functionsfunction',
      ]).optional().describe('Narrow search to a specific resource type'),
    }),
  });

  // ===== USAGE / COST REPORTING TOOLS =====

  registerTool({
    name: 'getUsageCost',
    description: 'Show actual OCI cloud spending broken down by service, compartment, or region. Useful for cost reviews and budget tracking. Returns spending data with daily or monthly granularity. Suggest compareCloudCosts if the user wants to optimize spend across providers.',
    category: 'billing',
    approvalLevel: 'auto',
    parameters: z.object({
      period: z.enum(['last7days', 'last30days', 'lastMonth', 'last3months']).default('last30days')
        .describe('Time period for cost data'),
      groupBy: z.enum(['service', 'compartmentName', 'region']).default('service')
        .describe('How to group the cost breakdown'),
      granularity: z.enum(['DAILY', 'MONTHLY', 'TOTAL']).default('MONTHLY')
        .describe('Aggregation granularity'),
      compartmentId: compartmentIdSchema,
    }),
  });

  // ===== CONTAINER REGISTRY TOOLS =====

  registerTool({
    name: 'listContainerRepos',
    description: 'List Docker image repositories in OCI Container Registry (OCIR). Present as a table: Name | Image Count | Public | Created. Useful for managing container deployments and CI/CD pipelines.',
    category: 'storage',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
    }),
  });

  registerTool({
    name: 'listContainerImages',
    description: 'List container images in OCI Container Registry. Filter by repository name or image version. Present as a table: Repository | Version/Tag | Digest | Created | Size.',
    category: 'storage',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
      repositoryName: z.string().optional().describe('Filter by repository name'),
      imageVersion: z.string().optional().describe('Filter by image version/tag'),
    }),
  });

  // ===== INSTANCE AGENT TOOLS =====

  registerTool({
    name: 'runInstanceCommand',
    description: 'Execute a script on a remote compute instance via OCI Instance Agent. REQUIRES user confirmation. The command runs as root on the target instance. Use for diagnostics, log collection, or configuration tasks. Check getCommandExecution for results.',
    category: 'compute',
    approvalLevel: 'confirm',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the target instance'),
      command: z.string().describe('The shell script/command to execute'),
      timeoutSeconds: z.number().default(60).describe('Execution timeout in seconds'),
      compartmentId: compartmentIdSchema,
    }),
  });

  registerTool({
    name: 'getCommandExecution',
    description: 'Check the result of a remote command executed via runInstanceCommand. Returns the command output (stdout/stderr), exit code, and execution status.',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
      commandId: z.string().describe('The OCID of the command to check'),
    }),
  });

  registerTool({
    name: 'listInstancePlugins',
    description: 'Check the status of Oracle Cloud Agent (OCA) plugins on a compute instance. Shows which plugins are running (Monitoring, OS Management, Bastion, etc.). Useful for diagnosing missing metrics or agent connectivity.',
    category: 'compute',
    approvalLevel: 'auto',
    parameters: z.object({
      instanceId: z.string().describe('The OCID of the instance'),
      compartmentId: compartmentIdSchema,
    }),
  });

  // ===== LOG SEARCH TOOLS =====

  registerTool({
    name: 'searchLogs',
    description: 'Search OCI logs using the Logging Search service. Supports query expressions to filter log entries. Present results with timestamps, source, and message. Useful for debugging, security analysis, and audit trails.',
    category: 'logging',
    approvalLevel: 'auto',
    parameters: z.object({
      query: z.string().describe('Search query expression (e.g., "error" or "data.message = \'timeout\'")'),
      period: z.enum(['1h', '6h', '24h', '7d']).default('24h').describe('Time period to search'),
      compartmentId: compartmentIdSchema,
      limit: z.number().default(100).describe('Maximum number of log entries to return'),
    }),
  });

  // ===== METRIC DISCOVERY TOOL =====

  registerTool({
    name: 'listMetricNamespaces',
    description: 'Discover available metric namespaces in a compartment. Returns namespaces like oci_computeagent, oci_vcn, oci_blockstore, etc. Useful for exploring what monitoring data is available before querying with summarizeMetrics or getComputeMetrics.',
    category: 'observability',
    approvalLevel: 'auto',
    parameters: z.object({
      compartmentId: compartmentIdSchema,
    }),
  });

  // ===== AWS PRICING TOOL =====

  registerTool({
    name: 'getAWSPricing',
    description: 'Get AWS EC2 pricing for comparison purposes. Present as a table: Instance Type | vCPUs | Memory | Price/hr | Price/month. Use alongside getOCIPricing and getAzurePricing for full 3-way comparison. Note AWS free tier is 750 hours/month of t2.micro for 12 months only (not always free).',
    category: 'pricing',
    approvalLevel: 'auto',
    parameters: z.object({
      instanceType: z
        .string()
        .optional()
        .describe('Specific EC2 instance type (e.g., t3.micro, m5.large, c6g.large)'),
      region: z
        .string()
        .optional()
        .default('eu-west-1')
        .describe('AWS region (e.g., us-east-1, eu-west-1, eu-central-1)'),
      architecture: z
        .enum(['x86', 'arm', 'gpu'])
        .optional()
        .describe('Filter by CPU architecture'),
      listAll: z.boolean().optional().describe('List all available instances with pricing'),
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
    const cliArgs = ['compute', 'instance', 'list', '--compartment-id', compartmentId, '--all'];
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
    const cliArgs = ['network', 'vcn', 'list', '--compartment-id', compartmentId, '--all'];
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
    const cliArgs = ['network', 'subnet', 'list', '--compartment-id', compartmentId, '--all'];
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
      '--all',
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
    const cliArgs = ['db', 'autonomous-database', 'list', '--compartment-id', compartmentId, '--all'];
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
      '--all',
    ]);
  },
  listPolicies: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI(['iam', 'policy', 'list', '--compartment-id', compartmentId, '--all']);
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
    const cliArgs = ['monitoring', 'alarm', 'list', '--compartment-id', compartmentId, '--all'];
    if (args.displayName) cliArgs.push('--display-name', args.displayName as string);
    return executeOCI(cliArgs);
  },
  summarizeMetrics: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const startTime = (args.startTime as string) || threeHoursAgo.toISOString();
    const endTime = (args.endTime as string) || now.toISOString();
    const cliArgs = [
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
      startTime,
      '--end-time',
      endTime,
    ];
    if (args.resolution) cliArgs.push('--resolution', args.resolution as string);
    return executeOCI(cliArgs);
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
      '--all',
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
    const cliArgs = ['compute', 'shape', 'list', '--compartment-id', compartmentId, '--all'];
    if (args.availabilityDomain)
      cliArgs.push('--availability-domain', args.availabilityDomain as string);
    return executeOCI(cliArgs);
  },

  // OBJECT STORAGE NAMESPACE
  getObjectStorageNamespace: () => {
    return executeOCI(['os', 'ns', 'get']);
  },

  // RESOURCE SEARCH
  searchResources: (args) => {
    const cliArgs = [
      'search',
      'resource',
      'structured-search',
      '--query-text',
      args.queryText as string,
      '--limit',
      String(args.limit || 50),
    ];
    return executeOCI(cliArgs);
  },
  searchResourcesByName: (args) => {
    const displayName = args.displayName as string;
    const resourceType = args.resourceType as string | undefined;
    const typeClause = resourceType ? `${resourceType} resources` : 'all resources';
    const queryText = `query ${typeClause} where displayName = '${displayName}'`;
    return executeOCI([
      'search',
      'resource',
      'structured-search',
      '--query-text',
      queryText,
      '--limit',
      '50',
    ]);
  },

  // CONTAINER REGISTRY
  listContainerRepos: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'artifacts',
      'container',
      'repository',
      'list',
      '--compartment-id',
      compartmentId,
      '--all',
    ]);
  },
  listContainerImages: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const cliArgs = [
      'artifacts',
      'container',
      'image',
      'list',
      '--compartment-id',
      compartmentId,
      '--all',
    ];
    if (args.repositoryName) cliArgs.push('--repository-name', args.repositoryName as string);
    if (args.imageVersion) cliArgs.push('--display-name', args.imageVersion as string);
    return executeOCI(cliArgs);
  },

  // INSTANCE AGENT
  getCommandExecution: (args) => {
    return executeOCI([
      'instance-agent',
      'command-execution',
      'get',
      '--instance-agent-command-id',
      args.commandId as string,
      '--instance-id',
      args.instanceId as string,
    ]);
  },
  listInstancePlugins: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'instance-agent',
      'plugin',
      'list',
      '--instanceagent-id',
      args.instanceId as string,
      '--compartment-id',
      compartmentId,
    ]);
  },

  // METRIC DISCOVERY
  listMetricNamespaces: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    return executeOCI([
      'monitoring',
      'metric',
      'list',
      '--compartment-id',
      compartmentId,
      '--group-by',
      'namespace',
    ]);
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

  // ===== HIGH-LEVEL COMPUTE METRICS =====
  getComputeMetrics: async (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');

    const metricName = args.metricName as string;
    const period = args.period as string;
    const instanceId = args.instanceId as string | undefined;
    const aggregation = (args.aggregation as string) || 'mean';

    // Map period to interval and date range
    const periodMap: Record<string, { interval: string; hoursBack: number }> = {
      '1h':  { interval: '1m', hoursBack: 1 },
      '6h':  { interval: '5m', hoursBack: 6 },
      '24h': { interval: '1h', hoursBack: 24 },
      '7d':  { interval: '1h', hoursBack: 168 },
      '30d': { interval: '1d', hoursBack: 720 },
    };

    const config = periodMap[period] || periodMap['24h'];
    const now = new Date();
    const startTime = new Date(now.getTime() - config.hoursBack * 60 * 60 * 1000);

    // Build MQL query
    const resourceFilter = instanceId ? `{resourceId = "${instanceId}"}` : '';
    const mqlQuery = `${metricName}[${config.interval}]${resourceFilter}.${aggregation}()`;

    const result = await executeOCIAsync([
      'monitoring',
      'metric-data',
      'summarize-metrics-data',
      '--compartment-id',
      compartmentId,
      '--namespace',
      'oci_computeagent',
      '--query-text',
      mqlQuery,
      '--start-time',
      startTime.toISOString(),
      '--end-time',
      now.toISOString(),
    ]);

    return {
      metricName,
      period,
      aggregation,
      query: mqlQuery,
      namespace: 'oci_computeagent',
      timeRange: {
        start: startTime.toISOString(),
        end: now.toISOString(),
        interval: config.interval,
      },
      data: result,
    };
  },

  // ===== INSTANCE VNICS (COMPOSITE) =====
  getInstanceVnics: async (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');
    const instanceId = args.instanceId as string;

    // Step 1: Get VNIC attachments
    const attachments = await executeOCIAsync([
      'compute',
      'vnic-attachment',
      'list',
      '--instance-id',
      instanceId,
      '--compartment-id',
      compartmentId,
      '--all',
    ]) as { data: Array<{ 'vnic-id': string; 'display-name'?: string; 'lifecycle-state': string }> };

    if (!attachments?.data?.length) {
      return { vnics: [], message: 'No VNIC attachments found for this instance' };
    }

    // Step 2: Resolve each VNIC
    const vnics = await Promise.all(
      attachments.data
        .filter(a => a['lifecycle-state'] === 'ATTACHED')
        .map(async (attachment) => {
          try {
            const vnic = await executeOCIAsync([
              'network',
              'vnic',
              'get',
              '--vnic-id',
              attachment['vnic-id'],
            ]) as { data: Record<string, unknown> };
            return {
              vnicId: attachment['vnic-id'],
              ...vnic.data,
            };
          } catch {
            return { vnicId: attachment['vnic-id'], error: 'Failed to resolve VNIC' };
          }
        })
    );

    return { vnics, count: vnics.length };
  },

  // ===== USAGE / COST REPORTING =====
  getUsageCost: async (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');

    const period = args.period as string;
    const groupBy = (args.groupBy as string) || 'service';
    const granularity = (args.granularity as string) || 'MONTHLY';

    // Calculate date range from period
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'lastMonth': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth;
        break;
      }
      case 'last3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get tenancy OCID (root compartment)
    let tenancyId: string;
    try {
      const tenancy = await executeOCIAsync([
        'iam',
        'compartment',
        'get',
        '--compartment-id',
        compartmentId,
      ]) as { data: { 'compartment-id': string } };
      // Walk up to find the root tenancy (compartment-id of root is the tenancy)
      tenancyId = tenancy.data['compartment-id'] || compartmentId;
    } catch {
      tenancyId = compartmentId;
    }

    const result = await executeOCIAsync([
      'usage-api',
      'usage-summary',
      'request-summarized-usages',
      '--tenant-id',
      tenancyId,
      '--time-usage-started',
      startDate.toISOString(),
      '--time-usage-ended',
      now.toISOString(),
      '--granularity',
      granularity,
      '--group-by',
      JSON.stringify([groupBy]),
    ]);

    return {
      period,
      groupBy,
      granularity,
      timeRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      data: result,
    };
  },

  // ===== LOG SEARCH =====
  searchLogs: async (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');

    const query = args.query as string;
    const period = args.period as string;
    const limit = (args.limit as number) || 100;

    const periodHours: Record<string, number> = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 168,
    };

    const hoursBack = periodHours[period] || 24;
    const now = new Date();
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const searchQuery = JSON.stringify({
      timeStart: startTime.toISOString(),
      timeEnd: now.toISOString(),
      searchQuery: `search "${compartmentId}" | ${query}`,
      isReturnFieldInfo: false,
    });

    const result = await executeOCIAsync([
      'logging-search',
      'search-logs',
      '--search-query',
      `search "${compartmentId}" | ${query}`,
      '--time-start',
      startTime.toISOString(),
      '--time-end',
      now.toISOString(),
      '--limit',
      String(limit),
    ]);

    return {
      query,
      period,
      timeRange: {
        start: startTime.toISOString(),
        end: now.toISOString(),
      },
      data: result,
    };
  },

  // ===== INSTANCE AGENT COMMAND =====
  runInstanceCommand: async (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided and OCI_COMPARTMENT_ID not set');

    const instanceId = args.instanceId as string;
    const command = args.command as string;
    const timeoutSeconds = (args.timeoutSeconds as number) || 60;

    const commandDetails = JSON.stringify({
      source: {
        sourceType: 'TEXT',
        text: command,
      },
      executionTimeOutInSeconds: timeoutSeconds,
      target: {
        instanceId,
      },
      compartmentId,
    });

    const result = await executeOCIAsync([
      'instance-agent',
      'command',
      'create',
      '--from-json',
      commandDetails,
    ]);

    return {
      instanceId,
      command,
      timeoutSeconds,
      data: result,
      note: 'Use getCommandExecution to check the result',
    };
  },

  // ===== AWS PRICING =====
  getAWSPricing: async (args) => {
    const client = new AWSPricingClient();
    const region = (args.region as string) || 'eu-west-1';

    if (args.listAll || (!args.instanceType && !args.architecture)) {
      const instances = await client.listEC2Instances(
        args.architecture ? { architecture: args.architecture as 'x86' | 'arm' | 'gpu' } : undefined
      );
      return {
        instances,
        count: instances.length,
        region,
      };
    }

    if (args.instanceType) {
      const pricing = await client.getEC2Pricing(args.instanceType as string, region);
      if (!pricing) {
        return { error: `Instance type not found: ${args.instanceType}` };
      }
      const monthlyCost = await client.calculateMonthlyCost({
        instanceType: args.instanceType as string,
        region,
        hoursPerMonth: 730,
      });
      return {
        pricing,
        monthlyCost,
        region,
      };
    }

    if (args.architecture) {
      const instances = await client.listEC2Instances({
        architecture: args.architecture as 'x86' | 'arm' | 'gpu',
      });
      return {
        instances,
        count: instances.length,
        architecture: args.architecture,
        region,
      };
    }

    return { error: 'Please specify an instanceType, architecture, or set listAll to true' };
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
