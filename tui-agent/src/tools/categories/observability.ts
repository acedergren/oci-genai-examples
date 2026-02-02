import { z } from 'zod';
import { registerTool } from '../registry.js';

const compartmentIdSchema = z.string().describe('The OCID of the compartment');

/**
 * List metrics
 */
registerTool({
  name: 'listMetrics',
  description: 'List available metric namespaces and names',
  category: 'observability',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    compartmentIdInSubtree: z.boolean().default(false),
  }),
  execute: async (args) => {
    return { metricDefinitions: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Summarize metrics
 */
registerTool({
  name: 'summarizeMetrics',
  description: 'Query metric data with aggregation',
  category: 'observability',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    namespace: z.string().describe('Metric namespace (e.g., oci_computeagent)'),
    query: z.string().describe('MQL query string'),
    startTime: z.string().describe('Start time (ISO 8601)'),
    endTime: z.string().describe('End time (ISO 8601)'),
    resolution: z.string().optional().describe('Resolution (e.g., 1m, 5m, 1h)'),
  }),
  execute: async (args) => {
    return { metricData: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * List alarms
 */
registerTool({
  name: 'listAlarms',
  description: 'List monitoring alarms in a compartment',
  category: 'observability',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().optional(),
    lifecycleState: z.enum(['ACTIVE', 'DELETING', 'DELETED']).optional(),
  }),
  execute: async (args) => {
    return { alarms: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Get alarm
 */
registerTool({
  name: 'getAlarm',
  description: 'Get detailed information about an alarm',
  category: 'observability',
  approvalLevel: 'auto',
  schema: z.object({
    alarmId: z.string().describe('The OCID of the alarm'),
  }),
  execute: async (args) => {
    return { alarm: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Create alarm
 */
registerTool({
  name: 'createAlarm',
  description: 'Create a new monitoring alarm',
  category: 'observability',
  approvalLevel: 'confirm',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().describe('Alarm display name'),
    namespace: z.string().describe('Metric namespace'),
    query: z.string().describe('MQL alarm query'),
    severity: z.enum(['CRITICAL', 'ERROR', 'WARNING', 'INFO']),
    destinations: z.array(z.string()).describe('Notification topic OCIDs'),
    isEnabled: z.boolean().default(true),
    pendingDuration: z.string().optional().describe('Pending duration (e.g., PT5M)'),
  }),
  execute: async (args) => {
    return { alarm: null, message: 'OCI SDK integration pending' };
  },
});

/**
 * Delete alarm
 */
registerTool({
  name: 'deleteAlarm',
  description: 'Delete a monitoring alarm',
  category: 'observability',
  approvalLevel: 'danger',
  schema: z.object({
    alarmId: z.string().describe('The OCID of the alarm'),
  }),
  execute: async (args) => {
    return { success: true, message: 'OCI SDK integration pending' };
  },
});

/**
 * List log groups
 */
registerTool({
  name: 'listLogGroups',
  description: 'List logging service log groups',
  category: 'observability',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    displayName: z.string().optional(),
  }),
  execute: async (args) => {
    return { logGroups: [], message: 'OCI SDK integration pending' };
  },
});

/**
 * Search logs
 */
registerTool({
  name: 'searchLogs',
  description: 'Search logs using the logging query language',
  category: 'observability',
  approvalLevel: 'auto',
  schema: z.object({
    compartmentId: compartmentIdSchema,
    searchQuery: z.string().describe('Log search query'),
    timeStart: z.string().describe('Start time (ISO 8601)'),
    timeEnd: z.string().describe('End time (ISO 8601)'),
    limit: z.number().default(100),
  }),
  execute: async (args) => {
    return { results: [], message: 'OCI SDK integration pending' };
  },
});
