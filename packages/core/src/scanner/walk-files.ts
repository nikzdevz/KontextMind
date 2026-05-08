import { readdirSync, statSync, Stats } from 'fs';
import { join, relative, isAbsolute } from 'path';
import { createIgnoreInstance, isSecretSensitive, DEFAULT_IGNORES } from './ignore-rules.js';

export interface WalkOptions {
  root: string;
  toolignoreContent?: string;
  maxFileSizeBytes?: number;
  includeHidden?: boolean;
}

export interface WalkResult {
  files: string[];
  ignored: { path: string; reason: string }[];
  largeSkipped: string[];
  secretSkipped: string[];
}

export function walkDirectory(root: string, options?: Partial<WalkOptions>): WalkResult {
  const toolignore = options?.toolignoreContent;
  const maxSize = options?.maxFileSizeBytes ?? 2 * 1024 * 1024;
  const includeHidden = options?.includeHidden ?? false;

  const ig = createIgnoreInstance(toolignore);

  const result: WalkResult = {
    files: [],
    ignored: [],
    largeSkipped: [],
    secretSkipped: [],
  };

  walkRecursive(root, root, ig, result, { maxSize, includeHidden });

  return result;
}

interface WalkContext {
  maxSize: number;
  includeHidden: boolean;
}

function walkRecursive(
  currentPath: string,
  rootPath: string,
  ignore: ReturnType<typeof createIgnoreInstance>,
  result: WalkResult,
  context: WalkContext
): void {
  let entries: string[];

  try {
    entries = readdirSync(currentPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(currentPath, entry);
    const relativePath = relative(rootPath, fullPath).replace(/\\/g, '/');

    // Skip hidden files if not included
    if (!context.includeHidden && entry.startsWith('.')) {
      result.ignored.push({ path: relativePath, reason: 'hidden' });
      continue;
    }

    let stats: Stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      // Check if directory should be ignored
      if (shouldIgnoreDirectory(entry, relativePath, ignore)) {
        result.ignored.push({ path: relativePath + '/', reason: 'toolignore' });
        continue;
      }

      // Recurse into directory
      walkRecursive(fullPath, rootPath, ignore, result, context);
    } else if (stats.isFile()) {
      // Check file size
      if (stats.size > context.maxSize) {
        result.largeSkipped.push(relativePath);
        continue;
      }

      // Check secret sensitivity
      if (isSecretSensitive(relativePath)) {
        result.secretSkipped.push(relativePath);
        continue;
      }

      // Check ignore rules
      if (ignore.ignores(relativePath)) {
        result.ignored.push({ path: relativePath, reason: 'toolignore' });
        continue;
      }

      // Add file
      result.files.push(relativePath);
    }
  }
}

function shouldIgnoreDirectory(
  dirName: string,
  relativePath: string,
  ignore: ReturnType<typeof createIgnoreInstance>
): boolean {
  // Always skip these directories
  const alwaysSkip = ['node_modules', '.git', 'dist', 'build', 'coverage', 'vendor', 'venv', '.venv', '.cache', 'tmp', 'temp'];

  if (alwaysSkip.includes(dirName)) {
    return true;
  }

  // Check ignore patterns
  return ignore.ignores(relativePath + '/') || ignore.ignores(dirName);
}

export function getRelativePath(filePath: string, rootPath: string): string {
  if (isAbsolute(filePath)) {
    return relative(rootPath, filePath).replace(/\\/g, '/');
  }
  return filePath;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}