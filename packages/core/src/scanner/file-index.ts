import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import type { FileIndex, FileRecord, ScanResult, GitInfo } from './scan-types.js';
import { computeFileHash, getFileStats, DEFAULT_HASH_ALGORITHM } from './hash-file.js';
import { detectLanguage } from './language-detect.js';
import { detectGitInfo } from './git-info.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

export interface IndexOptions {
  projectName: string;
  projectRoot: string;
  hashAlgorithm?: string;
  maxFileSizeBytes?: number;
}

export function createFileIndex(options: IndexOptions): FileIndex {
  return {
    version: '1',
    generated_at: new Date().toISOString(),
    project: options.projectName,
    root: options.projectRoot,
    total_files_seen: 0,
    indexed_files: 0,
    ignored_files: 0,
    large_files_skipped: 0,
    secret_sensitive_files_skipped: 0,
    files: [],
    ignored: [],
  };
}

export function addFileToIndex(
  index: FileIndex,
  filePath: string,
  options: Pick<IndexOptions, 'hashAlgorithm' | 'maxFileSizeBytes'>
): boolean {
  const fullPath = join(options.maxFileSizeBytes ? process.cwd() : '.', filePath);

  // Check if file exists
  if (!existsSync(fullPath)) {
    return false;
  }

  try {
    const stats = getFileStats(fullPath);
    const { hash } = computeFileHash(fullPath, options.hashAlgorithm || DEFAULT_HASH_ALGORITHM);
    const language = detectLanguage(filePath);
    const indexedAt = new Date().toISOString();

    const record: FileRecord = {
      path: filePath,
      language,
      size_bytes: stats.size_bytes,
      hash,
      modified_at: stats.modified_at,
      indexed_at: indexedAt,
      summary_status: 'missing',
      ignored: false,
      ignore_reason: null,
    };

    index.files.push(record);
    index.indexed_files++;
    index.total_files_seen++;

    return true;
  } catch {
    return false;
  }
}

export function addIgnoredToIndex(index: FileIndex, path: string, reason: string): void {
  index.ignored.push({ path, reason });
  index.ignored_files++;
  index.total_files_seen++;
}

export function addLargeSkippedToIndex(index: FileIndex, path: string): void {
  index.large_files_skipped++;
  index.total_files_seen++;
}

export function addSecretSkippedToIndex(index: FileIndex, path: string): void {
  index.secret_sensitive_files_skipped++;
  index.total_files_seen++;
}

export function saveFileIndex(index: FileIndex, projectRoot: string): string {
  const indexPath = join(projectRoot, '.kg', 'file-index.json');
  const dirPath = join(projectRoot, '.kg');

  ensureDir(dirPath);

  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  return indexPath;
}

export function loadFileIndex(projectRoot: string): FileIndex | null {
  const indexPath = join(projectRoot, '.kg', 'file-index.json');

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    return JSON.parse(content) as FileIndex;
  } catch {
    return null;
  }
}

export function updateRegistryWithScan(projectRoot: string, result: ScanResult, gitInfo?: GitInfo): void {
  const registryPath = join(projectRoot, '.kontextmind', 'registry.json');

  if (!existsSync(registryPath)) {
    return;
  }

  try {
    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

    registry.last_scan = new Date().toISOString();
    registry.files_indexed = result.indexed;
    registry.files_ignored = result.ignored;
    registry.scan_duration_ms = result.duration_ms;

    if (gitInfo) {
      registry.git = {
        available: gitInfo.available,
        branch: gitInfo.branch,
        commit: gitInfo.commit,
      };
    }

    writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  } catch {
    // Ignore registry update errors
  }
}

export function mergeWithExistingIndex(
  newFiles: string[],
  existingIndex: FileIndex | null,
  options: IndexOptions
): { toIndex: string[]; toReuse: Map<string, FileRecord> } {
  const toIndex: string[] = [];
  const toReuse = new Map<string, FileRecord>();

  if (!existingIndex || !options.maxFileSizeBytes) {
    return { toIndex: newFiles, toReuse };
  }

  const existingMap = new Map(existingIndex.files.map(f => [f.path, f]));

  for (const filePath of newFiles) {
    const existing = existingMap.get(filePath);

    if (!existing) {
      // New file, needs indexing
      toIndex.push(filePath);
    } else {
      // Check if file has changed
      const fullPath = join(options.projectRoot, filePath);

      if (!existsSync(fullPath)) {
        // File was deleted
        continue;
      }

      try {
        const stats = getFileStats(fullPath);
        if (stats.modified_at === existing.modified_at) {
          // File unchanged, reuse record
          toReuse.set(filePath, existing);
        } else {
          // File changed, reindex
          toIndex.push(filePath);
        }
      } catch {
        toIndex.push(filePath);
      }
    }
  }

  return { toIndex, toReuse };
}

export function validateFileIndex(index: unknown): index is FileIndex {
  if (typeof index !== 'object' || index === null) {
    return false;
  }

  const idx = index as Record<string, unknown>;

  return (
    typeof idx.version === 'string' &&
    typeof idx.generated_at === 'string' &&
    typeof idx.project === 'string' &&
    typeof idx.files === 'object' &&
    Array.isArray(idx.files) &&
    typeof idx.ignored === 'object' &&
    Array.isArray(idx.ignored)
  );
}