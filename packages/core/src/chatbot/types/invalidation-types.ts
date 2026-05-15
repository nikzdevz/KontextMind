import type { SourceReference } from '../chatbot-types.js';

export interface CachedSource {
  type: 'file' | 'summary' | 'graph' | 'llm-synthesis';
  path: string;
  hash?: string;
}

export interface CacheEntry {
  answerId: string;
  question: string;
  sources: CachedSource[];
  createdAt: string;
  lastValidated: string;
  stale: boolean;
  staleReason?: string;
}

export interface InvalidationResult {
  invalidatedIds: string[];
  reason: string;
  timestamp: string;
  entriesChecked: number;
}

export interface CacheMetadata {
  entries: Record<string, CacheEntry>;
  lastFullScan: string | null;
  version: string;
}

export const DEFAULT_CACHE_METADATA: CacheMetadata = {
  entries: {},
  lastFullScan: null,
  version: '1.0.0',
};

export type InvalidationTrigger =
  | 'file_changed'
  | 'kb_rebuild'
  | 'manual_refresh'
  | 'age_threshold'
  | 'quality_threshold';
