import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createLogger } from './logger.js';

const log = createLogger('audit');

/**
 * Audit log entry for tool operations
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  sessionId?: string;
  userId?: string;
  
  // Tool information
  toolName: string;
  toolCategory: string;
  approvalLevel: 'auto' | 'confirm' | 'danger';
  
  // Operation details
  action: 'requested' | 'approved' | 'rejected' | 'executed' | 'failed';
  args: Record<string, unknown>;
  
  // For sensitive args, we redact values but keep keys for debugging
  redactedArgs?: Record<string, string>;
  
  // Result (only for executed/failed)
  success?: boolean;
  error?: string;
  duration?: number;
  
  // Context
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Sensitive parameter names that should be redacted in logs
 */
const SENSITIVE_PARAMS = [
  'password',
  'secret',
  'key',
  'token',
  'credential',
  'privateKey',
  'apiKey',
];

/**
 * Redact sensitive values from arguments
 */
function redactSensitiveArgs(args: Record<string, unknown>): Record<string, string> {
  const redacted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(args)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_PARAMS.some(param => lowerKey.includes(param));
    
    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.startsWith('ocid1.')) {
      // Keep OCIDs but truncate for readability
      redacted[key] = value.substring(0, 30) + '...';
    } else if (typeof value === 'object') {
      redacted[key] = '[object]';
    } else {
      redacted[key] = String(value);
    }
  }
  
  return redacted;
}

/**
 * Get the audit log directory path
 */
function getAuditLogDir(): string {
  const baseDir = process.env.AUDIT_LOG_DIR || join(process.cwd(), 'data', 'audit');
  
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }
  
  return baseDir;
}

/**
 * Get the current audit log file path (daily rotation)
 */
function getAuditLogPath(): string {
  const dir = getAuditLogDir();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(dir, `audit-${date}.jsonl`);
}

/**
 * Generate a unique audit log entry ID
 */
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `audit_${timestamp}_${random}`;
}

/**
 * Write an audit log entry
 */
export function writeAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'redactedArgs'>): void {
  const fullEntry: AuditLogEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    redactedArgs: redactSensitiveArgs(entry.args),
    ...entry,
  };
  
  const logPath = getAuditLogPath();
  const line = JSON.stringify(fullEntry) + '\n';
  
  try {
    appendFileSync(logPath, line, 'utf-8');
  } catch (error) {
    // Log if file write fails (don't throw - audit shouldn't break the app)
    log.error({ err: error, entry: fullEntry }, 'failed to write audit log');
  }
}

/**
 * Log a tool request (before approval)
 */
export function logToolRequest(
  toolName: string,
  toolCategory: string,
  approvalLevel: 'auto' | 'confirm' | 'danger',
  args: Record<string, unknown>,
  sessionId?: string,
  userId?: string
): string {
  const entryId = generateAuditId();
  
  writeAuditLog({
    toolName,
    toolCategory,
    approvalLevel,
    action: 'requested',
    args,
    sessionId,
    userId,
  });
  
  return entryId;
}

/**
 * Log a tool approval decision
 */
export function logToolApproval(
  toolName: string,
  toolCategory: string,
  approvalLevel: 'auto' | 'confirm' | 'danger',
  args: Record<string, unknown>,
  approved: boolean,
  sessionId?: string,
  userId?: string
): void {
  writeAuditLog({
    toolName,
    toolCategory,
    approvalLevel,
    action: approved ? 'approved' : 'rejected',
    args,
    sessionId,
    userId,
  });
}

/**
 * Log a tool execution result
 */
export function logToolExecution(
  toolName: string,
  toolCategory: string,
  approvalLevel: 'auto' | 'confirm' | 'danger',
  args: Record<string, unknown>,
  success: boolean,
  duration: number,
  error?: string,
  sessionId?: string,
  userId?: string
): void {
  writeAuditLog({
    toolName,
    toolCategory,
    approvalLevel,
    action: success ? 'executed' : 'failed',
    args,
    success,
    error,
    duration,
    sessionId,
    userId,
  });
}

/**
 * Audit log summary for a time period
 */
export interface AuditSummary {
  period: { start: string; end: string };
  totalRequests: number;
  byAction: Record<string, number>;
  byCategory: Record<string, number>;
  byApprovalLevel: Record<string, number>;
  failures: number;
  rejections: number;
}

/**
 * Parse audit log entries from a file (for reporting)
 */
export async function parseAuditLog(date: string): Promise<AuditLogEntry[]> {
  const { readFileSync } = await import('fs');
  const dir = getAuditLogDir();
  const logPath = join(dir, `audit-${date}.jsonl`);
  
  if (!existsSync(logPath)) {
    return [];
  }
  
  const content = readFileSync(logPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  return lines.map(line => JSON.parse(line) as AuditLogEntry);
}
