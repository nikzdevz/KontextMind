import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { walkDirectory } from './walk-files.js';
import { loadToolignore, isSecretSensitive } from './ignore-rules.js';
import { detectGitInfo } from './git-info.js';
import { computeFileHash, getFileStats, DEFAULT_HASH_ALGORITHM, MAX_FILE_SIZE_DEFAULT } from './hash-file.js';
import { detectLanguage } from './language-detect.js';
import { saveFileIndex, loadFileIndex, updateRegistryWithScan, validateFileIndex } from './file-index.js';
import type { FileIndex, FileRecord, ScanResult, GitInfo, ScanOptions } from './scan-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

export interface ScanProjectOptions extends ScanOptions {
  projectRoot: string;
  projectName: string;
  maxFileSizeBytes?: number;
  hashAlgorithm?: string;
}

export async function scanProject(options: ScanProjectOptions): Promise<ScanResult> {
  const startTime = Date.now();
  const {
    projectRoot,
    projectName,
    maxFileSizeBytes = MAX_FILE_SIZE_DEFAULT,
    hashAlgorithm = DEFAULT_HASH_ALGORITHM,
    changedOnly = false,
  } = options;

  // Ensure .kg directory exists
  ensureDir(join(projectRoot, '.kg'));

  // Load toolignore
  const toolignoreContent = loadToolignore(projectRoot);

  // Walk directory to discover files
  const walkResult = walkDirectory(projectRoot, {
    root: projectRoot,
    toolignoreContent: toolignoreContent ?? undefined,
    maxFileSizeBytes,
    includeHidden: false,
  });

  // Load existing index for changed-only mode
  const existingIndex = changedOnly ? loadFileIndex(projectRoot) : null;
  const existingFilesMap = new Map<string, FileRecord>();
  if (existingIndex) {
    for (const file of existingIndex.files) {
      existingFilesMap.set(file.path, file);
    }
  }

  // Create new index
  const index: FileIndex = {
    version: '1',
    generated_at: new Date().toISOString(),
    project: projectName,
    root: '.',
    total_files_seen: 0,
    indexed_files: 0,
    ignored_files: walkResult.ignored.length,
    large_files_skipped: walkResult.largeSkipped.length,
    secret_sensitive_files_skipped: walkResult.secretSkipped.length,
    files: [],
    ignored: [],
  };

  // Process files
  for (const filePath of walkResult.files) {
    const fullPath = join(projectRoot, filePath);

    // Check if we can reuse from existing index
    const existing = existingFilesMap.get(filePath);
    if (existing && changedOnly) {
      try {
        const stats = getFileStats(fullPath);
        if (stats.modified_at === existing.modified_at && stats.size_bytes === existing.size_bytes) {
          // File unchanged, reuse record
          index.files.push(existing);
          index.indexed_files++;
          index.total_files_seen++;
          continue;
        }
      } catch {
        // Fall through to reindex
      }
    }

    // Index the file
    try {
      const stats = getFileStats(fullPath);
      const { hash, size_bytes } = computeFileHash(fullPath, hashAlgorithm);
      const language = detectLanguage(filePath);

      const record: FileRecord = {
        path: filePath,
        language,
        size_bytes,
        hash,
        modified_at: stats.modified_at,
        indexed_at: new Date().toISOString(),
        summary_status: 'missing',
        ignored: false,
        ignore_reason: null,
      };

      index.files.push(record);
      index.indexed_files++;
      index.total_files_seen++;
    } catch {
      // Skip files that can't be read
      index.total_files_seen++;
    }
  }

  // Add ignored files to index
  for (const { path, reason } of walkResult.ignored) {
    index.ignored.push({ path, reason });
  }

  // Add large files to ignored count
  index.ignored_files += walkResult.largeSkipped.length + walkResult.secretSkipped.length;

  // Get git info
  const gitInfo = detectGitInfo(projectRoot);

  // Save index
  saveFileIndex(index, projectRoot);

  // Update registry
  const durationMs = Date.now() - startTime;
  const result: ScanResult = {
    indexed: index.indexed_files,
    ignored: index.ignored_files + index.large_files_skipped + index.secret_sensitive_files_skipped,
    largeSkipped: index.large_files_skipped,
    secretSkipped: index.secret_sensitive_files_skipped,
    duration_ms: durationMs,
  };

  updateRegistryWithScan(projectRoot, result, gitInfo);

  return result;
}

export function getLastScanTime(projectRoot: string): string | null {
  const registryPath = join(projectRoot, '.kontextmind', 'registry.json');

  if (!existsSync(registryPath)) {
    return null;
  }

  try {
    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
    return registry.last_scan || null;
  } catch {
    return null;
  }
}

export function getFileIndexStatus(projectRoot: string): { exists: boolean; fileCount: number; valid: boolean } {
  const indexPath = join(projectRoot, '.kg', 'file-index.json');

  if (!existsSync(indexPath)) {
    return { exists: false, fileCount: 0, valid: false };
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content);

    return {
      exists: true,
      fileCount: Array.isArray(index.files) ? index.files.length : 0,
      valid: validateFileIndex(index),
    };
  } catch {
    return { exists: true, fileCount: 0, valid: false };
  }
}

export { loadFileIndex, saveFileIndex, validateFileIndex } from './file-index.js';
export { detectGitInfo } from './git-info.js';
export { detectLanguage } from './language-detect.js';
export { computeFileHash, getFileStats } from './hash-file.js';
export { walkDirectory } from './walk-files.js';
export { loadToolignore, isSecretSensitive } from './ignore-rules.js';