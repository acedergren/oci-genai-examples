import type { WorkflowStep, AgentPlan } from '$lib/components/panels/types.js';

/**
 * Pre-defined workflow templates for common OCI operations
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'compute' | 'networking' | 'database' | 'pricing' | 'storage' | 'security';
  steps: Omit<WorkflowStep, 'status'>[];
  /** Estimated duration in minutes */
  estimatedDuration: number;
  /** Tags for filtering/searching */
  tags: string[];
}

/**
 * Create an AgentPlan from a workflow template
 */
export function createPlanFromTemplate(template: WorkflowTemplate): AgentPlan {
  return {
    id: `${template.id}-${Date.now()}`,
    name: template.name,
    description: template.description,
    status: 'idle',
    steps: template.steps.map((step) => ({
      ...step,
      status: 'pending' as const,
    })),
  };
}

/**
 * Pre-defined workflow templates
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ===== COMPUTE WORKFLOWS =====
  {
    id: 'provision-web-server',
    name: 'Provision Web Server',
    description: 'Deploy a compute instance with networking for hosting web applications',
    icon: '🖥️',
    category: 'compute',
    estimatedDuration: 5,
    tags: ['compute', 'vm', 'web', 'deploy', 'terraform'],
    steps: [
      {
        id: '1',
        name: 'Gather Requirements',
        description: 'Collect compute specifications: vCPUs, memory, OS, and region preferences',
      },
      {
        id: '2',
        name: 'List Compartments',
        description: 'Find available compartments for deployment',
        toolName: 'listCompartments',
      },
      {
        id: '3',
        name: 'Check Availability Domains',
        description: 'List ADs in the region for instance placement',
        toolName: 'listAvailabilityDomains',
        dependencies: ['2'],
      },
      {
        id: '4',
        name: 'List Available Shapes',
        description: 'Show compute shapes matching requirements',
        toolName: 'listShapes',
        dependencies: ['3'],
      },
      {
        id: '5',
        name: 'List OS Images',
        description: 'Find compatible OS images for the selected shape',
        toolName: 'listImages',
        dependencies: ['4'],
      },
      {
        id: '6',
        name: 'Check Network Infrastructure',
        description: 'Analyze existing VCNs and subnets',
        toolName: 'listVcns',
        dependencies: ['2'],
      },
      {
        id: '7',
        name: 'Generate Terraform Code',
        description: 'Create infrastructure-as-code for the web server setup',
        toolName: 'generateTerraform',
        dependencies: ['4', '5', '6'],
      },
      {
        id: '8',
        name: 'Review & Deploy',
        description: 'Review configuration and optionally provision via OCI CLI',
        dependencies: ['7'],
      },
    ],
  },

  // ===== PRICING WORKFLOWS =====
  {
    id: 'cloud-cost-comparison',
    name: 'Cloud Cost Analysis',
    description: 'Compare OCI vs Azure pricing for your workload requirements',
    icon: '💰',
    category: 'pricing',
    estimatedDuration: 2,
    tags: ['pricing', 'cost', 'comparison', 'azure', 'oci'],
    steps: [
      {
        id: '1',
        name: 'Gather Workload Requirements',
        description: 'Collect vCPUs, memory, storage, and egress needs',
      },
      {
        id: '2',
        name: 'Fetch OCI Pricing',
        description: 'Get Oracle Cloud compute and storage costs',
        toolName: 'getOCIPricing',
        dependencies: ['1'],
      },
      {
        id: '3',
        name: 'Fetch Azure Pricing',
        description: 'Get Microsoft Azure VM and storage costs',
        toolName: 'getAzurePricing',
        dependencies: ['1'],
      },
      {
        id: '4',
        name: 'Compare & Analyze',
        description: 'Side-by-side cost comparison',
        toolName: 'compareCloudCosts',
        dependencies: ['2', '3'],
      },
      {
        id: '5',
        name: 'Generate Recommendation',
        description: 'AI-powered cost optimization suggestion',
        dependencies: ['4'],
      },
    ],
  },

  {
    id: 'oci-free-tier-setup',
    name: 'Free Tier Optimization',
    description: 'Maximize OCI Always Free tier resources for your project',
    icon: '🆓',
    category: 'pricing',
    estimatedDuration: 3,
    tags: ['free', 'always-free', 'optimization', 'starter'],
    steps: [
      {
        id: '1',
        name: 'Review Free Tier Limits',
        description: 'Check available Always Free resources',
        toolName: 'getOCIFreeTier',
      },
      {
        id: '2',
        name: 'Analyze Current Usage',
        description: 'List existing instances and resources',
        toolName: 'listInstances',
        dependencies: ['1'],
      },
      {
        id: '3',
        name: 'Identify Optimization',
        description: 'Recommend ARM shapes for best free tier value',
        dependencies: ['1', '2'],
      },
      {
        id: '4',
        name: 'Generate Setup Plan',
        description: 'Create step-by-step free tier deployment guide',
        dependencies: ['3'],
      },
    ],
  },

  // ===== DATABASE WORKFLOWS =====
  {
    id: 'setup-autonomous-database',
    name: 'Setup Autonomous Database',
    description: 'Provision an Oracle Autonomous Database with vector search capabilities',
    icon: '🗄️',
    category: 'database',
    estimatedDuration: 8,
    tags: ['database', 'adb', 'autonomous', 'vector', 'ai'],
    steps: [
      {
        id: '1',
        name: 'Define Database Requirements',
        description: 'Collect workload type, OCPU count, and storage needs',
      },
      {
        id: '2',
        name: 'Check Existing Databases',
        description: 'List Autonomous Databases in compartment',
        toolName: 'listAutonomousDatabases',
        dependencies: ['1'],
      },
      {
        id: '3',
        name: 'Select Configuration',
        description: 'Choose OLTP, Data Warehouse, JSON, or APEX workload',
        dependencies: ['1', '2'],
      },
      {
        id: '4',
        name: 'Create Database',
        description: 'Provision Autonomous Database',
        toolName: 'createAutonomousDatabase',
        dependencies: ['3'],
      },
      {
        id: '5',
        name: 'Configure Networking',
        description: 'Setup private endpoint or public access',
        dependencies: ['4'],
      },
      {
        id: '6',
        name: 'Download Wallet',
        description: 'Retrieve connection credentials',
        dependencies: ['4'],
      },
      {
        id: '7',
        name: 'Verify Connection',
        description: 'Test database connectivity',
        dependencies: ['6'],
      },
    ],
  },

  // ===== STORAGE WORKFLOWS =====
  {
    id: 'setup-object-storage',
    name: 'Setup Object Storage',
    description: 'Create and configure an Object Storage bucket with appropriate access controls',
    icon: '📦',
    category: 'storage',
    estimatedDuration: 3,
    tags: ['storage', 'bucket', 'object-storage', 's3-compatible'],
    steps: [
      {
        id: '1',
        name: 'Define Storage Requirements',
        description: 'Determine storage class, access patterns, and retention',
      },
      {
        id: '2',
        name: 'List Existing Buckets',
        description: 'Check current Object Storage usage',
        toolName: 'listBuckets',
        dependencies: ['1'],
      },
      {
        id: '3',
        name: 'Create Bucket',
        description: 'Provision new Object Storage bucket',
        toolName: 'createBucket',
        dependencies: ['1', '2'],
      },
      {
        id: '4',
        name: 'Configure Lifecycle',
        description: 'Setup object lifecycle rules for archival',
        dependencies: ['3'],
      },
      {
        id: '5',
        name: 'Setup IAM Policy',
        description: 'Create access policy for bucket',
        toolName: 'createPolicy',
        dependencies: ['3'],
      },
      {
        id: '6',
        name: 'Verify Access',
        description: 'Test bucket read/write operations',
        dependencies: ['5'],
      },
    ],
  },

  // ===== NETWORKING WORKFLOWS =====
  {
    id: 'setup-private-network',
    name: 'Setup Private Network',
    description: 'Create a secure VCN with public and private subnets',
    icon: '🔒',
    category: 'networking',
    estimatedDuration: 4,
    tags: ['networking', 'vcn', 'subnet', 'security'],
    steps: [
      {
        id: '1',
        name: 'Plan Network Architecture',
        description: 'Define CIDR blocks and subnet layout',
      },
      {
        id: '2',
        name: 'Check Existing VCNs',
        description: 'List Virtual Cloud Networks',
        toolName: 'listVcns',
        dependencies: ['1'],
      },
      {
        id: '3',
        name: 'Create VCN',
        description: 'Provision Virtual Cloud Network',
        toolName: 'createVcn',
        dependencies: ['1', '2'],
      },
      {
        id: '4',
        name: 'Create Public Subnet',
        description: 'Setup subnet with internet gateway',
        dependencies: ['3'],
      },
      {
        id: '5',
        name: 'Create Private Subnet',
        description: 'Setup subnet with NAT gateway',
        dependencies: ['3'],
      },
      {
        id: '6',
        name: 'Configure Security Lists',
        description: 'Define ingress/egress rules',
        dependencies: ['4', '5'],
      },
      {
        id: '7',
        name: 'Verify Connectivity',
        description: 'Test network routing',
        dependencies: ['6'],
      },
    ],
  },

  // ===== SECURITY WORKFLOWS =====
  {
    id: 'setup-iam-policy',
    name: 'Setup IAM Policies',
    description: 'Create compartment structure and IAM policies for team access',
    icon: '🛡️',
    category: 'security',
    estimatedDuration: 3,
    tags: ['iam', 'security', 'policy', 'access'],
    steps: [
      {
        id: '1',
        name: 'Define Access Requirements',
        description: 'Identify users, groups, and required permissions',
      },
      {
        id: '2',
        name: 'List Compartments',
        description: 'Review compartment hierarchy',
        toolName: 'listCompartments',
        dependencies: ['1'],
      },
      {
        id: '3',
        name: 'Review Existing Policies',
        description: 'Check current IAM policies',
        toolName: 'listPolicies',
        dependencies: ['2'],
      },
      {
        id: '4',
        name: 'Draft Policy Statements',
        description: 'Create policy statements for required access',
        dependencies: ['1', '3'],
      },
      {
        id: '5',
        name: 'Create Policy',
        description: 'Deploy IAM policy',
        toolName: 'createPolicy',
        dependencies: ['4'],
      },
      {
        id: '6',
        name: 'Verify Access',
        description: 'Test policy effectiveness',
        dependencies: ['5'],
      },
    ],
  },
];

/**
 * Get workflow templates by category
 */
export function getWorkflowsByCategory(category: WorkflowTemplate['category']): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Search workflow templates by name or tags
 */
export function searchWorkflows(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return WORKFLOW_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get a workflow template by ID
 */
export function getWorkflowById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
