export interface ScanOptions {
  changedOnly: boolean;
  include?: string;
  exclude?: string;
}

export interface FileRecord {
  path: string;
  language: string;
  size_bytes: number;
  hash: string;
  modified_at: string;
  indexed_at: string;
  summary_status: 'missing' | 'generated' | 'stale';
  ignored: boolean;
  ignore_reason: string | null;
}

export interface IgnoredFile {
  path: string;
  reason: string;
}

export interface FileIndex {
  version: string;
  generated_at: string;
  project: string;
  root: string;
  total_files_seen: number;
  indexed_files: number;
  ignored_files: number;
  large_files_skipped: number;
  secret_sensitive_files_skipped: number;
  files: FileRecord[];
  ignored: IgnoredFile[];
}

export interface ScanResult {
  indexed: number;
  ignored: number;
  largeSkipped: number;
  secretSkipped: number;
  duration_ms: number;
}

export interface GitInfo {
  available: boolean;
  branch: string | null;
  commit: string | null;
}

export interface ScanStats {
  totalFiles: number;
  indexed: number;
  ignored: number;
  largeSkipped: number;
  secretSkipped: number;
  durationMs: number;
}