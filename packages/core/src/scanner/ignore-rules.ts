import Ignore from 'ignore';
import { readFileSync, existsSync } from 'fs';

type IgnoreInstance = ReturnType<typeof Ignore>;

export interface IgnoreRule {
  pattern: string;
  isNegated: boolean;
}

export const DEFAULT_IGNORES = [
  '.git',
  'node_modules',
  'venv',
  '.venv',
  'dist',
  'build',
  'coverage',
  'target',
  'vendor',
  '.env',
  '*.pem',
  '*.key',
  '*.crt',
  'id_rsa',
  'id_rsa.pub',
  'credentials.json',
  'secrets',
  '*.min.js',
  '.DS_Store',
  '.cache',
  'tmp',
  'temp',
];

export const SECRET_SENSITIVE_PATTERNS = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.crt',
  'id_rsa',
  'id_rsa.pub',
  'credentials.json',
  'secrets',
  '*.pfx',
  '*.p12',
  '*.der',
  '*.gpg',
  '*.sig',
];

export function createIgnoreInstance(toolignoreContent?: string): IgnoreInstance {
  // The 'ignore' package uses a factory pattern - call as function, not constructor
  const IgnoreFactory = Ignore as unknown as () => IgnoreInstance;
  const ig = IgnoreFactory();

  for (const pattern of DEFAULT_IGNORES) {
    ig.add(pattern);
  }

  if (toolignoreContent) {
    const lines = toolignoreContent.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    for (const line of lines) {
      ig.add(line);
    }
  }

  return ig;
}

export function loadToolignore(projectRoot: string): string | null {
  const toolignorePath = `${projectRoot}/.toolignore`;

  if (!existsSync(toolignorePath)) {
    return null;
  }

  try {
    return readFileSync(toolignorePath, 'utf-8');
  } catch {
    return null;
  }
}

export function isSecretSensitive(path: string): boolean {
  const lowerPath = path.toLowerCase();

  for (const pattern of SECRET_SENSITIVE_PATTERNS) {
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (lowerPath.endsWith(ext)) {
        return true;
      }
    } else if (pattern.includes('*')) {
      // Handle patterns like .env.* by converting to regex-like matching
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      try {
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(lowerPath)) {
          return true;
        }
      } catch {
        // Fall through to other checks
      }
    } else if (pattern.startsWith('.')) {
      const basename = lowerPath.split('/').pop() || '';
      if (basename === pattern || lowerPath.includes(`/${pattern}`) || lowerPath.endsWith(`/${pattern}`)) {
        return true;
      }
    } else if (lowerPath.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  return false;
}

export function filterIgnoredPaths(paths: string[], toolignoreContent?: string): { included: string[]; ignored: { path: string; reason: string }[] } {
  const ig = createIgnoreInstance(toolignoreContent);
  const included: string[] = [];
  const ignored: { path: string; reason: string }[] = [];

  for (const filePath of paths) {
    const relativePath = filePath.replace(/^[./\\]/, '').replace(/\\/g, '/');

    if (ig.ignores(relativePath)) {
      ignored.push({ path: filePath, reason: 'toolignore' });
    } else if (isSecretSensitive(relativePath)) {
      ignored.push({ path: filePath, reason: 'secret-sensitive' });
    } else {
      included.push(filePath);
    }
  }

  return { included, ignored };
}

export function matchPattern(path: string, pattern: string): boolean {
  const IgnoreFactory = Ignore as unknown as () => IgnoreInstance;
  const ig = IgnoreFactory();
  ig.add(pattern);
  return ig.ignores(path);
}