import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logToolExecution, logToolApproval } from '$lib/server/audit.js';
import { getToolDefinition, requiresApproval, getToolWarning } from '$lib/tools/index.js';
import { createLogger } from '$lib/server/logger.js';
import { execFileSync } from 'child_process';
import type { PendingApproval } from '$lib/tools/types.js';

const log = createLogger('execute');

/**
 * Execute an OCI CLI command safely
 */
function executeOCI(args: string[]): unknown {
  try {
    const output = execFileSync('oci', args, {
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(output);
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string };
    throw new Error(`OCI CLI error: ${execError.stderr || execError.message}`);
  }
}

/**
 * Get the default compartment ID from environment
 */
function getDefaultCompartmentId(): string | undefined {
  return process.env.OCI_COMPARTMENT_ID;
}

/**
 * Tool executor mapping (simplified version for execute endpoint)
 */
const toolExecutors: Record<string, (args: Record<string, unknown>) => unknown> = {
  // COMPUTE
  stopInstance: (args) => {
    return executeOCI([
      'compute', 'instance', 'action',
      '--action', 'STOP',
      '--instance-id', args.instanceId as string,
    ]);
  },
  terminateInstance: (args) => {
    const cliArgs = [
      'compute', 'instance', 'terminate',
      '--instance-id', args.instanceId as string,
      '--force',
    ];
    if (args.preserveBootVolume) cliArgs.push('--preserve-boot-volume', 'true');
    return executeOCI(cliArgs);
  },
  launchInstance: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided');
    return executeOCI([
      'compute', 'instance', 'launch',
      '--compartment-id', compartmentId,
      '--availability-domain', args.availabilityDomain as string,
      '--display-name', args.displayName as string,
      '--shape', args.shape as string,
      '--image-id', args.imageId as string,
      '--subnet-id', args.subnetId as string,
    ]);
  },

  // NETWORKING
  createVcn: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided');
    return executeOCI([
      'network', 'vcn', 'create',
      '--compartment-id', compartmentId,
      '--display-name', args.displayName as string,
      '--cidr-block', args.cidrBlock as string,
    ]);
  },
  deleteVcn: (args) => {
    return executeOCI(['network', 'vcn', 'delete', '--vcn-id', args.vcnId as string, '--force']);
  },

  // STORAGE
  createBucket: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided');
    return executeOCI([
      'os', 'bucket', 'create',
      '--compartment-id', compartmentId,
      '--namespace', args.namespace as string,
      '--name', args.name as string,
      '--public-access-type', (args.publicAccessType as string) || 'NoPublicAccess',
    ]);
  },
  deleteBucket: (args) => {
    return executeOCI([
      'os', 'bucket', 'delete',
      '--namespace', args.namespace as string,
      '--bucket-name', args.bucketName as string,
      '--force',
    ]);
  },

  // DATABASE
  createAutonomousDatabase: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided');
    return executeOCI([
      'db', 'autonomous-database', 'create',
      '--compartment-id', compartmentId,
      '--display-name', args.displayName as string,
      '--db-name', args.dbName as string,
      '--db-workload', args.dbWorkload as string,
      '--cpu-core-count', String(args.cpuCoreCount),
      '--data-storage-size-in-tbs', String(args.dataStorageSizeInTBs),
    ]);
  },
  terminateAutonomousDatabase: (args) => {
    return executeOCI([
      'db', 'autonomous-database', 'delete',
      '--autonomous-database-id', args.autonomousDatabaseId as string,
      '--force',
    ]);
  },

  // IDENTITY
  createPolicy: (args) => {
    const compartmentId = (args.compartmentId as string) || getDefaultCompartmentId();
    if (!compartmentId) throw new Error('No compartmentId provided');
    const statements = args.statements as string[];
    return executeOCI([
      'iam', 'policy', 'create',
      '--compartment-id', compartmentId,
      '--name', args.name as string,
      '--description', args.description as string,
      '--statements', JSON.stringify(statements),
    ]);
  },
};

/**
 * GET /api/tools/execute?toolName=xxx
 * Get approval requirements for a tool
 */
export const GET: RequestHandler = async ({ url }) => {
  const toolName = url.searchParams.get('toolName');
  
  if (!toolName) {
    return json({ error: 'Missing toolName parameter' }, { status: 400 });
  }

  const toolDef = getToolDefinition(toolName);
  
  if (!toolDef) {
    return json({ error: `Unknown tool: ${toolName}` }, { status: 404 });
  }

  const warning = getToolWarning(toolName);
  const needsApproval = requiresApproval(toolDef.approvalLevel);

  return json({
    toolName,
    category: toolDef.category,
    approvalLevel: toolDef.approvalLevel,
    requiresApproval: needsApproval,
    warning: warning?.warning,
    impact: warning?.impact,
    description: toolDef.description,
  });
};

/**
 * POST /api/tools/execute
 * Execute a tool after approval
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { toolCallId, toolName, args, approved, sessionId } = body;

  if (!toolName || !args) {
    return json({ error: 'Missing toolName or args' }, { status: 400 });
  }

  const toolDef = getToolDefinition(toolName);
  
  if (!toolDef) {
    return json({ error: `Unknown tool: ${toolName}` }, { status: 404 });
  }

  const needsApproval = requiresApproval(toolDef.approvalLevel);

  // If tool requires approval, check that it was explicitly approved
  if (needsApproval && approved !== true) {
    // Log rejection
    logToolApproval(
      toolName,
      toolDef.category,
      toolDef.approvalLevel,
      args,
      false,
      sessionId
    );

    return json({ 
      success: false, 
      rejected: true,
      error: 'Tool requires explicit approval',
      toolName,
      approvalLevel: toolDef.approvalLevel,
    }, { status: 403 });
  }

  // Log approval if it was required
  if (needsApproval) {
    logToolApproval(
      toolName,
      toolDef.category,
      toolDef.approvalLevel,
      args,
      true,
      sessionId
    );
  }

  // Execute the tool
  const executor = toolExecutors[toolName];
  
  if (!executor) {
    return json({ 
      error: `No executor for tool: ${toolName}. This tool may be read-only and executed directly.` 
    }, { status: 400 });
  }

  const startTime = Date.now();
  
  try {
    const result = executor(args);
    const duration = Date.now() - startTime;

    log.info({ toolName, duration }, 'tool executed');

    // Log successful execution
    logToolExecution(
      toolName,
      toolDef.category,
      toolDef.approvalLevel,
      args,
      true,
      duration,
      undefined,
      sessionId
    );

    return json({
      success: true,
      toolCallId,
      toolName,
      data: result,
      duration,
      approvalLevel: toolDef.approvalLevel,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error({ toolName, duration, err: errorMessage }, 'tool execution failed');

    // Log failed execution
    logToolExecution(
      toolName,
      toolDef.category,
      toolDef.approvalLevel,
      args,
      false,
      duration,
      errorMessage,
      sessionId
    );

    return json({
      success: false,
      toolCallId,
      toolName,
      error: errorMessage,
      duration,
      approvalLevel: toolDef.approvalLevel,
    }, { status: 500 });
  }
};
