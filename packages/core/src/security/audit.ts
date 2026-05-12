/**
 * Audit Event Tracking
 *
 * Track questions, reads, blocks, and other audit-worthy events.
 */

import * as fs from 'fs';
import * as path from 'path';

const AUDIT_LOGS_DIR = '.logs';

export type AuditEventType =
  | 'question_asked'
  | 'code_read'
  | 'code_blocked'
  | 'secret_detected'
  | 'summary_generated'
  | 'summary_stale'
  | 'security_event'
  | 'policy_violation'
  | 'api_request'
  | 'mcp_call';

export interface AuditEvent {
  timestamp: string;
  type: AuditEventType;
  details: Record<string, unknown>;
}

export interface AuditSummary {
  totalQuestions: number;
  rawCodeReads: number;
  blockedAttempts: number;
  secretsDetected: number;
  summariesGenerated: number;
  staleSummaries: number;
  securityEvents: number;
  apiRequests: number;
  mcpCalls: number;
  mostAccessedFiles: Array<{ path: string; count: number }>;
  lastBlockedEvent: string | null;
}

const LOG_FILES: Record<AuditEventType, string> = {
  question_asked: 'qna-events.log',
  code_read: 'read-events.log',
  code_blocked: 'security-events.log',
  secret_detected: 'security-events.log',
  summary_generated: 'summary-generation.log',
  summary_stale: 'summary-generation.log',
  security_event: 'security-events.log',
  policy_violation: 'security-events.log',
  api_request: 'api-events.log',
  mcp_call: 'mcp-events.log',
};

function ensureLogDir(): void {
  if (!fs.existsSync(AUDIT_LOGS_DIR)) {
    fs.mkdirSync(AUDIT_LOGS_DIR, { recursive: true });
  }
}

function getLogPath(type: AuditEventType): string {
  return path.join(AUDIT_LOGS_DIR, LOG_FILES[type]);
}

export function logAuditEvent(type: AuditEventType, details: Record<string, unknown> = {}): void {
  ensureLogDir();
  const event: AuditEvent = {
    timestamp: new Date().toISOString(),
    type,
    details,
  };
  const logPath = getLogPath(type);
  fs.appendFileSync(logPath, JSON.stringify(event) + '\n');
}

export function getAuditSummary(since?: Date): AuditSummary {
  const summary: AuditSummary = {
    totalQuestions: 0,
    rawCodeReads: 0,
    blockedAttempts: 0,
    secretsDetected: 0,
    summariesGenerated: 0,
    staleSummaries: 0,
    securityEvents: 0,
    apiRequests: 0,
    mcpCalls: 0,
    mostAccessedFiles: [],
    lastBlockedEvent: null,
  };

  const fileAccessCounts: Record<string, number> = {};

  ensureLogDir();
  const logFiles = fs.readdirSync(AUDIT_LOGS_DIR).filter((f) => f.endsWith('.log'));

  for (const logFile of logFiles) {
    const logPath = path.join(AUDIT_LOGS_DIR, logFile);
    try {
      const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const event: AuditEvent = JSON.parse(line);

          if (since && new Date(event.timestamp) < since) {
            continue;
          }

          switch (event.type) {
            case 'question_asked':
              summary.totalQuestions++;
              break;
            case 'code_read':
              summary.rawCodeReads++;
              if (event.details.path) {
                const filePath = String(event.details.path);
                fileAccessCounts[filePath] = (fileAccessCounts[filePath] || 0) + 1;
              }
              break;
            case 'code_blocked':
              summary.blockedAttempts++;
              if (!summary.lastBlockedEvent || event.timestamp > summary.lastBlockedEvent) {
                summary.lastBlockedEvent = event.timestamp;
              }
              break;
            case 'secret_detected':
              summary.secretsDetected++;
              break;
            case 'summary_generated':
              summary.summariesGenerated++;
              break;
            case 'summary_stale':
              summary.staleSummaries++;
              break;
            case 'security_event':
            case 'policy_violation':
              summary.securityEvents++;
              break;
            case 'api_request':
              summary.apiRequests++;
              break;
            case 'mcp_call':
              summary.mcpCalls++;
              break;
          }
        } catch {
          // Skip invalid entries
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  summary.mostAccessedFiles = Object.entries(fileAccessCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return summary;
}

export function getAuditLogEntries(
  type: AuditEventType,
  since?: Date,
  limit = 100
): AuditEvent[] {
  const entries: AuditEvent[] = [];
  const logPath = getLogPath(type);

  if (!fs.existsSync(logPath)) {
    return entries;
  }

  const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const event: AuditEvent = JSON.parse(line);
      if (since && new Date(event.timestamp) < since) {
        continue;
      }
      entries.push(event);
      if (entries.length >= limit) {
        break;
      }
    } catch {
      // Skip invalid entries
    }
  }

  return entries;
}

export function clearAuditLogs(): void {
  ensureLogDir();
  const logFiles = fs.readdirSync(AUDIT_LOGS_DIR).filter((f) => f.endsWith('.log'));

  for (const logFile of logFiles) {
    const logPath = path.join(AUDIT_LOGS_DIR, logFile);
    fs.unlinkSync(logPath);
  }
}