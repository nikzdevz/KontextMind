/**
 * Secret Redaction
 *
 * Redacts secrets from text before logging or output.
 */

const REDACTED_PLACEHOLDER = '***REDACTED***';

const REDACT_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  {
    pattern: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: '$1************',
  },
  {
    pattern: /(\baws_secret_access_key\s*[=:]\s*)["']?[A-Za-z0-9/+=]{40}["']?/gi,
    replacement: '$1***REDACTED***',
  },
  {
    pattern: /-----BEGIN[^-]+PRIVATE KEY-----[^-]+-----END[^-]+PRIVATE KEY-----/g,
    replacement: '-----BEGIN PRIVATE KEY-----\n***REDACTED***\n-----END PRIVATE KEY-----',
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: 'eyJ...***...***',
  },
  {
    pattern: /(postgres|mysql|mongodb|redis):\/\/[^\s'"`]+:[^\s'"`]+@[^\s'"`]+/gi,
    replacement: '$1://user:***REDACTED***@host/db',
  },
  {
    pattern: /(\bapi[_-]?key\s*[=:]\s*)["']?[A-Za-z0-9_-]{20,}["']?/gi,
    replacement: '$1***REDACTED***',
  },
  {
    pattern: /(bearer\s+)[A-Za-z0-9_-]{20,}/gi,
    replacement: '$1***REDACTED***',
  },
  {
    pattern: /(\bpassword\s*[=:]\s*)["'][^"']{8,}["']/gi,
    replacement: '$1"***REDACTED***"',
  },
  {
    pattern: /(\bsecret\s*[=:]\s*)["'][^"']{12,}["']/gi,
    replacement: '$1"***REDACTED***"',
  },
  {
    pattern: /(\btoken\s*[=:]\s*)["'][A-Za-z0-9_-]{16,}["']/gi,
    replacement: '$1"***REDACTED***"',
  },
];

export interface RedactionResult {
  text: string;
  redactions: number;
  redactionTypes: string[];
}

export function redactSecrets(text: string): RedactionResult {
  if (!text) {
    return { text: '', redactions: 0, redactionTypes: [] };
  }

  let result = text;
  const typesFound = new Set<string>();

  for (const { pattern, replacement } of REDACT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(result)) {
      typesFound.add(pattern.source.substring(0, 30));
      result = result.replace(regex, replacement);
    }
  }

  return {
    text: result,
    redactions: typesFound.size,
    redactionTypes: Array.from(typesFound),
  };
}

export function redactForLog(data: unknown): string {
  if (typeof data === 'string') {
    return redactSecrets(data).text;
  }

  if (data === null || data === undefined) {
    return String(data);
  }

  if (Array.isArray(data)) {
    return `[${data.map(redactForLog).join(', ')}]`;
  }

  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSecretKey =
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey.includes('credential') ||
        lowerKey.includes('auth');

      if (isSecretKey) {
        redacted[key] = REDACTED_PLACEHOLDER;
      } else if (typeof value === 'string') {
        redacted[key] = redactSecrets(value).text;
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = JSON.parse(redactForLog(value));
      } else {
        redacted[key] = value;
      }
    }
    return JSON.stringify(redacted);
  }

  return String(data);
}

export function createRedactingWriteStream(
  write: (chunk: string) => void
): (chunk: string) => void {
  return (chunk: string) => {
    const redacted = redactSecrets(chunk);
    write(redacted.text);
  };
}