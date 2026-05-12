import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { computeFileHash } from '../scanner/hash-file.js';
import type { CacheEntry, CacheMetadata, InvalidationResult, CachedSource } from './types/invalidation-types.js';

const CACHE_META_FILE = '.kontextmind/chatbot/cache-meta.json';
const AGE_THRESHOLD_DAYS = 30;

function loadCacheMetadata(projectRoot: string): CacheMetadata {
  const path = join(projectRoot, CACHE_META_FILE);
  if (!existsSync(path)) {
    return { entries: {}, lastFullScan: null, version: '1.0.0' };
  }

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CacheMetadata;
  } catch {
    return { entries: {}, lastFullScan: null, version: '1.0.0' };
  }
}

function saveCacheMetadata(projectRoot: string, meta: CacheMetadata): void {
  const dir = join(projectRoot, '.kontextmind/chatbot');
  ensureDir(dir);
  writeFileSync(join(dir, CACHE_META_FILE), JSON.stringify(meta, null, 2), 'utf-8');
}

export function trackAnswerSources(
  projectRoot: string,
  answerId: string,
  question: string,
  sources: CachedSource[]
): void {
  const meta = loadCacheMetadata(projectRoot);
  const now = new Date().toISOString();

  meta.entries[answerId] = {
    answerId,
    question,
    sources,
    createdAt: meta.entries[answerId]?.createdAt || now,
    lastValidated: now,
    stale: false,
  };

  meta.lastFullScan = now;
  saveCacheMetadata(projectRoot, meta);
}

export function getCacheEntry(projectRoot: string, answerId: string): CacheEntry | null {
  const meta = loadCacheMetadata(projectRoot);
  return meta.entries[answerId] || null;
}

export function checkCacheStaleness(
  projectRoot: string,
  answerId: string
): { isStale: boolean; reason?: string } {
  const entry = getCacheEntry(projectRoot, answerId);
  if (!entry) {
    return { isStale: false };
  }

  // Check age threshold
  const ageMs = Date.now() - new Date(entry.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > AGE_THRESHOLD_DAYS) {
    return { isStale: true, reason: `Answer is ${Math.floor(ageDays)} days old (threshold: ${AGE_THRESHOLD_DAYS} days)` };
  }

  // Check source file changes
  for (const source of entry.sources) {
    if (source.type === 'file' && source.path && source.hash) {
      try {
        const currentHash = computeFileHash(join(projectRoot, source.path)).hash;
        if (currentHash !== source.hash) {
          return { isStale: true, reason: `Source file changed: ${source.path}` };
        }
      } catch {
        // File doesn't exist or can't be read
        return { isStale: true, reason: `Source file not found: ${source.path}` };
      }
    }
  }

  return { isStale: false };
}

export function invalidateCache(
  projectRoot: string,
  trigger: 'file_changed' | 'kb_rebuild' | 'manual_refresh' | 'age_threshold' | 'quality_threshold',
  options: { filePath?: string; answerIds?: string[] } = {}
): InvalidationResult {
  const meta = loadCacheMetadata(projectRoot);
  const now = new Date().toISOString();
  const invalidatedIds: string[] = [];

  let reason = '';
  switch (trigger) {
    case 'file_changed':
      reason = `File changed: ${options.filePath || 'unknown'}`;
      break;
    case 'kb_rebuild':
      reason = 'Knowledge base rebuilt';
      break;
    case 'manual_refresh':
      reason = 'Manual refresh requested';
      break;
    case 'age_threshold':
      reason = 'Age threshold exceeded';
      break;
    case 'quality_threshold':
      reason = 'Quality score below threshold';
      break;
  }

  const ageThreshold = Date.now() - AGE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  for (const [id, entry] of Object.entries(meta.entries)) {
    let shouldInvalidate = false;

    if (options.answerIds?.includes(id)) {
      shouldInvalidate = true;
    } else if (trigger === 'age_threshold' && new Date(entry.createdAt).getTime() < ageThreshold) {
      shouldInvalidate = true;
    } else if (trigger === 'kb_rebuild') {
      // Invalidate all entries on full rebuild
      shouldInvalidate = true;
    }

    if (shouldInvalidate) {
      entry.stale = true;
      entry.staleReason = reason;
      entry.lastValidated = now;
      invalidatedIds.push(id);
    }
  }

  meta.lastFullScan = now;
  saveCacheMetadata(projectRoot, meta);

  return {
    invalidatedIds,
    reason,
    timestamp: now,
    entriesChecked: Object.keys(meta.entries).length,
  };
}

export async function invalidateOnFileChange(
  projectRoot: string,
  changedFilePath: string
): Promise<InvalidationResult> {
  return invalidateCache(projectRoot, 'file_changed', { filePath: changedFilePath });
}

export async function invalidateOnKBRebuild(projectRoot: string): Promise<InvalidationResult> {
  return invalidateCache(projectRoot, 'kb_rebuild');
}

export function getCacheStatus(projectRoot: string): {
  totalEntries: number;
  staleEntries: number;
  freshEntries: number;
  lastFullScan: string | null;
} {
  const meta = loadCacheMetadata(projectRoot);
  const entries = Object.values(meta.entries);

  return {
    totalEntries: entries.length,
    staleEntries: entries.filter(e => e.stale).length,
    freshEntries: entries.filter(e => !e.stale).length,
    lastFullScan: meta.lastFullScan,
  };
}

export function clearCacheMetadata(projectRoot: string): void {
  const path = join(projectRoot, CACHE_META_FILE);
  if (existsSync(path)) {
    writeFileSync(path, JSON.stringify({ entries: {}, lastFullScan: null, version: '1.0.0' }, null, 2), 'utf-8');
  }
}