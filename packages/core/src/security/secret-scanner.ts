/**
 * Secret Scanner
 *
 * Detects secrets in files with pattern matching.
 * Respects .toolignore and never exposes actual secret values.
 */

import * as fs from 'fs';
import * as path from 'path';
import { walkDirectory, type WalkResult } from '../scanner/walk-files.js';

export type SecretType =
  | 'aws_access_key'
  | 'aws_secret'
  | 'private_key'
  | 'ssh_key'
  | 'jwt_token'
  | 'database_url'
  | 'api_key'
  | 'bearer_token'
  | 'password_assignment'
  | 'env_value'
  | 'generic_secret';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecretMatch {
  type: SecretType;
  severity: Severity;
  file: string;
  line: number;
  action: 'redacted' | 'skipped' | 'reported';
  preview: string;
}

export interface SecretScanResult {
  secrets: SecretMatch[];
  scanned: number;
  skipped: number;
  errors: string[];
  totalSecrets: number;
  criticalCount: number;
  highCount: number;
}

interface Pattern {
  type: SecretType;
  severity: Severity;
  pattern: RegExp;
  preview: (match: string) => string;
}

const SECRET_PATTERNS: Pattern[] = [
  {
    type: 'aws_access_key',
    severity: 'critical',
    pattern: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    preview: () => 'AKIA...',
  },
  {
    type: 'aws_secret',
    severity: 'critical',
    pattern: /(?:aws_secret_access_key|aws_secret|secret_key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi,
    preview: () => 'aws_secret=...',
  },
  {
    type: 'private_key',
    severity: 'critical',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    preview: () => '-----BEGIN PRIVATE KEY-----...',
  },
  {
    type: 'ssh_key',
    severity: 'high',
    pattern: /-----BEGIN (?:OPENSSH |DSA |EC |RSA )?PRIVATE KEY-----/g,
    preview: () => '-----BEGIN PRIVATE KEY-----...',
  },
  {
    type: 'jwt_token',
    severity: 'high',
    pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    preview: (m) => {
      const parts = m.split('.');
      return `${parts[0]}...${parts[2] ? parts[2].slice(-4) : ''}`;
    },
  },
  {
    type: 'database_url',
    severity: 'high',
    pattern: /(?:postgres|mysql|mongodb|redis|sqlite):\/\/[^\s'"`]+:[^\s'"`]+@[^\s'"`]+/gi,
    preview: () => 'postgresql://user:***@host/...',
  },
  {
    type: 'api_key',
    severity: 'high',
    pattern: /(?:api[_-]?key|apikey|api-secret)\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}["']?/gi,
    preview: () => 'api_key=...',
  },
  {
    type: 'bearer_token',
    severity: 'medium',
    pattern: /bearer\s+[A-Za-z0-9_-]{20,}/gi,
    preview: () => 'bearer ...',
  },
  {
    type: 'password_assignment',
    severity: 'medium',
    pattern: /(?:password|passwd|pwd|secret)\s*[=:]\s*["'][^"']{8,}["']/gi,
    preview: () => 'password=********',
  },
  {
    type: 'env_value',
    severity: 'low',
    pattern: /(?:export\s+)?[A-Z_][A-Z0-9_]*(?:_KEY|_SECRET|_TOKEN|_PASSWORD|_PASS|_AUTH|_CREDENTIALS)\s*[=:]/g,
    preview: () => 'EXPORT_SECRET_KEY=...',
  },
  {
    type: 'generic_secret',
    severity: 'low',
    pattern: /(?:token|secret|credential|auth)[_\-]?(?:string|text|value)?\s*[=:]\s*["'][A-Za-z0-9_-]{16,}["']/gi,
    preview: () => 'token=...',
  },
];

const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /\.toolignore/,
  /\.log(s)?\//,
  /\.obsmcp\//,
  /\.kontextmind\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.nuxt\//,
  /coverage\//,
];

const SECRET_FILE_PATTERNS = [
  /\.env(\.|\.local|\.development|\.production|\.test)?$/,
  /\.pem$/,
  /\.key$/,
  /\.pkcs8$/,
  /id_rsa/,
  /id_ed25519/,
  /\.p12$/,
  /\.pfx$/,
  /credentials\.json$/,
  /secrets\.ya?ml$/,
];

function shouldSkipFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return SKIP_PATTERNS.some((p) => p.test(normalized));
}

function isLikelySecretFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return SECRET_FILE_PATTERNS.some((p) => p.test(normalized));
}

function scanContent(content: string, filePath: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const pattern of SECRET_PATTERNS) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const matchedText = match[0];
        matches.push({
          type: pattern.type,
          severity: pattern.severity,
          file: filePath,
          line: lineNum + 1,
          action: 'redacted',
          preview: pattern.preview(matchedText),
        });
      }
    }
  }

  return matches;
}

export async function scanForSecrets(
  rootDir: string,
  options: {
    json?: boolean;
    failOnCritical?: boolean;
    exclude?: string[];
  } = {}
): Promise<SecretScanResult> {
  const result: SecretScanResult = {
    secrets: [],
    scanned: 0,
    skipped: 0,
    errors: [],
    totalSecrets: 0,
    criticalCount: 0,
    highCount: 0,
  };

  const excludePatterns = options.exclude || [];

  try {
    const walkResult = walkDirectory(rootDir, {
      maxFileSizeBytes: 10 * 1024 * 1024,
    });

    for (const filePath of walkResult.files) {
      if (shouldSkipFile(filePath)) {
        result.skipped++;
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matches = scanContent(content, filePath);

        for (const match of matches) {
          result.secrets.push(match);
          result.totalSecrets++;

          if (match.severity === 'critical') {
            result.criticalCount++;
          } else if (match.severity === 'high') {
            result.highCount++;
          }
        }

        result.scanned++;
      } catch (err) {
        result.errors.push(`Failed to read ${filePath}: ${err}`);
      }
    }
  } catch (err) {
    result.errors.push(`Scan failed: ${err}`);
  }

  return result;
}

export function hasSecret(content: string): boolean {
  for (const pattern of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    if (regex.test(content)) {
      return true;
    }
  }
  return false;
}

export function detectSecretType(content: string): SecretType | null {
  for (const pattern of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    if (regex.test(content)) {
      return pattern.type;
    }
  }
  return null;
}