// Dataset Versioning - Version control for datasets
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import type {
  DatasetVersion,
  DatasetManifest,
  TrainingRecord,
  DatasetFilters,
  DatasetStatistics,
} from './types.js';
import { DATASET_DIR, VERSIONS_DIR } from './types.js';

export interface VersionOptions {
  format: 'semver' | 'date-based';
  message?: string;
  parentVersion?: string;
}

// Ensure version directory exists
function ensureVersionDir(projectRoot: string): void {
  const versionPath = join(projectRoot, VERSIONS_DIR);
  if (!existsSync(versionPath)) {
    mkdirSync(versionPath, { recursive: true });
  }
}

// Generate version string
export function generateVersion(
  projectRoot: string,
  options: VersionOptions
): string {
  if (options.format === 'date-based') {
    return new Date().toISOString().split('T')[0];
  }

  // Semantic versioning
  const versions = getVersionHistory(projectRoot);
  if (versions.length === 0) {
    return '1.0.0';
  }

  // Get latest version
  const latest = versions[versions.length - 1];
  const [major, minor, patch] = latest.version.split('.').map(Number);

  // Increment patch version
  return `${major}.${minor}.${patch + 1}`;
}

// Compute checksum for records
export function computeChecksum(records: TrainingRecord[]): string {
  // Simple checksum based on content
  const content = JSON.stringify(records.map(r => ({ id: r.id, q: r.question, a: r.answer })));
  return simpleHash(content);
}

// Simple hash for checksum
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 16);
}

// Create a new version
export function createVersion(
  projectRoot: string,
  records: TrainingRecord[],
  options: VersionOptions
): DatasetVersion {
  ensureVersionDir(projectRoot);

  const version = generateVersion(projectRoot, options);
  const checksum = computeChecksum(records);

  // Get parent version
  const versions = getVersionHistory(projectRoot);
  const parentVersion = options.parentVersion || (versions.length > 0 ? versions[versions.length - 1].version : null);

  // Compute statistics
  const stats = computeVersionStats(records);

  // Calculate changes from parent
  let changes = { added: 0, removed: 0, modified: 0 };
  if (parentVersion) {
    const parentRecords = loadVersionRecords(projectRoot, parentVersion);
    if (parentRecords.length > 0) {
      changes = computeChanges(parentRecords, records);
    }
  }

  const versionData: DatasetVersion = {
    version,
    createdAt: new Date().toISOString(),
    recordCount: records.length,
    checksum,
    parentVersion,
    changes,
    filters: {} as DatasetFilters, // Would be passed in
    statistics: stats,
  };

  // Save version metadata
  saveVersionMetadata(projectRoot, version, versionData);

  // Save records
  saveVersionRecords(projectRoot, version, records);

  // Create manifest
  saveManifest(projectRoot, version, {
    version,
    createdAt: versionData.createdAt,
    projectName: projectRoot.split(/[\\/]/).pop() || 'project',
    recordCount: records.length,
    filters: versionData.filters,
    statistics: stats,
    checksum,
  });

  return versionData;
}

// Load version metadata
export function loadVersion(projectRoot: string, version: string): DatasetVersion | null {
  const versionPath = join(projectRoot, VERSIONS_DIR, `${version}.json`);

  if (!existsSync(versionPath)) {
    return null;
  }

  try {
    const content = readFileSync(versionPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Load version records
export function loadVersionRecords(projectRoot: string, version: string): TrainingRecord[] {
  const recordsPath = join(projectRoot, VERSIONS_DIR, version, 'records.jsonl');

  if (!existsSync(recordsPath)) {
    return [];
  }

  try {
    const content = readFileSync(recordsPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(line => JSON.parse(line) as TrainingRecord);
  } catch {
    return [];
  }
}

// Get all version history
export function getVersionHistory(projectRoot: string): DatasetVersion[] {
  ensureVersionDir(projectRoot);

  const versionPath = join(projectRoot, VERSIONS_DIR);
  const files = readdirSync(versionPath).filter(f => f.endsWith('.json'));

  const versions: DatasetVersion[] = [];
  for (const file of files) {
    try {
      const version = file.replace('.json', '');
      const data = loadVersion(projectRoot, version);
      if (data) {
        versions.push(data);
      }
    } catch {
      // Skip invalid files
    }
  }

  // Sort by creation date, newest first
  return versions.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Get latest version
export function getLatestVersion(projectRoot: string): string | null {
  const versions = getVersionHistory(projectRoot);
  if (versions.length === 0) return null;
  return versions[0].version;
}

// Compare two versions
export function compareVersions(
  projectRoot: string,
  version1: string,
  version2: string
): {
  added: number;
  removed: number;
  modified: number;
  summary: string;
} {
  const records1 = loadVersionRecords(projectRoot, version1);
  const records2 = loadVersionRecords(projectRoot, version2);

  const changes = computeChanges(records1, records2);

  return {
    ...changes,
    summary: `Version ${version1} -> ${version2}: +${changes.added} -${changes.removed} ~${changes.modified}`,
  };
}

// Save version metadata
function saveVersionMetadata(projectRoot: string, version: string, data: DatasetVersion): void {
  const versionPath = join(projectRoot, VERSIONS_DIR, `${version}.json`);
  writeFileSync(versionPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Save version records
function saveVersionRecords(projectRoot: string, version: string, records: TrainingRecord[]): void {
  const versionDir = join(projectRoot, VERSIONS_DIR, version);
  mkdirSync(versionDir, { recursive: true });

  const recordsPath = join(versionDir, 'records.jsonl');
  const content = records.map(r => JSON.stringify(r)).join('\n');
  writeFileSync(recordsPath, content, 'utf-8');
}

// Save manifest
function saveManifest(projectRoot: string, version: string, manifest: DatasetManifest): void {
  const versionDir = join(projectRoot, VERSIONS_DIR, version);
  mkdirSync(versionDir, { recursive: true });

  const manifestPath = join(versionDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

// Load manifest
export function loadManifest(projectRoot: string, version: string): DatasetManifest | null {
  const manifestPath = join(projectRoot, VERSIONS_DIR, version, 'manifest.json');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Compute version statistics
function computeVersionStats(records: TrainingRecord[]): DatasetStatistics {
  const stats: DatasetStatistics = {
    bySource: {},
    byTier: {},
    byFeedback: {},
    averageQuality: 0,
    sessionBased: 0,
    conversationTurns: [],
    codeRequests: 0,
    codeRequestDislikes: 0,
  };

  let totalQuality = 0;

  for (const record of records) {
    // By source
    const source = record.metadata.source;
    stats.bySource[source] = (stats.bySource[source] || 0) + 1;

    // By tier
    const tier = record.metadata.tier;
    stats.byTier[tier] = (stats.byTier[tier] || 0) + 1;

    // By feedback
    const feedback = record.quality.feedback || 'neutral';
    stats.byFeedback[feedback] = (stats.byFeedback[feedback] || 0) + 1;

    // Quality sum
    totalQuality += record.quality.score;

    // Session-based count
    if (record.metadata.sessionId) {
      stats.sessionBased++;
    }

    // Conversation turns
    if (record.quality.conversationTurn !== null) {
      stats.conversationTurns.push(record.quality.conversationTurn);
    }

    // Code requests
    if (record.quality.isCodeFiltered) {
      stats.codeRequests++;
      if (record.quality.feedback === 'not_helpful') {
        stats.codeRequestDislikes++;
      }
    }
  }

  stats.averageQuality = records.length > 0 ? totalQuality / records.length : 0;

  return stats;
}

// Compute changes between versions
function computeChanges(oldRecords: TrainingRecord[], newRecords: TrainingRecord[]): {
  added: number;
  removed: number;
  modified: number;
} {
  const oldIds = new Set(oldRecords.map(r => r.id));
  const newIds = new Set(newRecords.map(r => r.id));

  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const id of newIds) {
    if (!oldIds.has(id)) {
      added++;
    }
  }

  for (const id of oldIds) {
    if (!newIds.has(id)) {
      removed++;
    }
  }

  // Count modified (same ID but different content)
  for (const newRecord of newRecords) {
    const oldRecord = oldRecords.find(r => r.id === newRecord.id);
    if (oldRecord) {
      if (oldRecord.question !== newRecord.question || oldRecord.answer !== newRecord.answer) {
        modified++;
      }
    }
  }

  return { added, removed, modified };
}

// Delete a version
export function deleteVersion(projectRoot: string, version: string): boolean {
  const versionDir = join(projectRoot, VERSIONS_DIR, version);
  const versionFile = join(projectRoot, VERSIONS_DIR, `${version}.json`);

  try {
    if (existsSync(versionDir)) {
      rmSync(versionDir, { recursive: true });
    }

    // Delete metadata file
    if (existsSync(versionFile)) {
      rmSync(versionFile);
    }

    return true;
  } catch {
    return false;
  }
}

// Export version to file
export function exportVersion(
  projectRoot: string,
  version: string,
  format: 'jsonl' | 'json' | 'chatml' | 'sharegpt',
  outputPath: string
): boolean {
  const records = loadVersionRecords(projectRoot, version);
  if (records.length === 0) return false;

  let content: string;

  switch (format) {
    case 'jsonl':
      content = records.map(r => JSON.stringify(r)).join('\n');
      break;
    case 'json':
      content = JSON.stringify(records, null, 2);
      break;
    default:
      // For chatml/sharegpt, would use formatters
      content = records.map(r => JSON.stringify(r)).join('\n');
  }

  try {
    writeFileSync(outputPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}
