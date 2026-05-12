/**
 * Security Module
 *
 * Phase 8: Security, secret scanning, redaction, and prompt injection protection
 */

export {
  scanForSecrets,
  hasSecret,
  detectSecretType,
  type SecretType,
  type Severity,
  type SecretMatch,
  type SecretScanResult,
} from './secret-scanner.js';

export {
  redactSecrets,
  redactForLog,
  createRedactingWriteStream,
  type RedactionResult,
} from './redact.js';

export {
  classifyContent,
  isTrusted,
  isUntrusted,
  containsInjectionAttempt,
  analyzeForInjection,
  getPromptWarning,
  PROMPT_INJECTION_WARNING,
  type TrustLevel,
  type ContentSource,
  type InjectionAnalysis,
} from './prompt-injection.js';

export {
  logCostEvent,
  getCostSummary,
  estimateCost,
  estimateTokens,
  parseCostLog,
  type CostEntry,
  type CostSummary,
} from './cost-tracking.js';

export {
  logAuditEvent,
  getAuditSummary,
  getAuditLogEntries,
  clearAuditLogs,
  type AuditEvent,
  type AuditEventType,
  type AuditSummary,
} from './audit.js';