// Dataset Types - Core type definitions for dataset preparation
import { join } from 'path';

export interface DatasetConfig {
  collection: {
    enabled: boolean;
    sources: DatasetSource[];
    filters: DatasetFilters;
  };
  quality: {
    minScoreThreshold: number;
    decayDays: number;
    signalsEnabled: boolean;
  };
  versioning: {
    enabled: boolean;
    format: 'semver' | 'date-based';
    autoIncrement: boolean;
  };
  formats: {
    default: DatasetFormat;
    supported: DatasetFormat[];
  };
}

export type DatasetSource = 'qna-events' | 'feedback' | 'qa-history' | 'sessions' | 'knowledge-graph';

export type DatasetFormat = 'jsonl' | 'json' | 'chatml' | 'sharegpt';

export interface DatasetFilters {
  minConfidence: number;
  maxAgeDays: number;
  includeCodeRequests: boolean;
  apiOnly: boolean;
  minQualityScore: number;
  since?: string;
}

export interface TrainingRecord {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  quality: {
    score: number;
    confidence: number;
    feedback: 'helpful' | 'not_helpful' | 'neutral' | null;
    isCodeFiltered: boolean;
    conversationTurn: number | null;
  };
  metadata: {
    source: 'cli' | 'api' | 'mcp';
    tier: number;
    sessionId: string | null;
    createdAt: string;
    version: string;
    topics: string[];
  };
  conversation?: {
    turns: Array<{
      question: string;
      answer: string;
      responseId: string;
    }>;
  };
  context?: {
    relatedQuestions: string[];
    sources: DatasetSourceReference[];
    knowledgeGraph?: DatasetGraphNode[];
  };
}

export interface DatasetSourceReference {
  type: string;
  name: string;
  relevance: number;
}

export interface DatasetGraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface DatasetVersion {
  version: string;
  createdAt: string;
  recordCount: number;
  checksum: string;
  parentVersion: string | null;
  changes: {
    added: number;
    removed: number;
    modified: number;
  };
  filters: DatasetFilters;
  statistics: DatasetStatistics;
}

export interface DatasetStatistics {
  bySource: Record<string, number>;
  byTier: Record<number, number>;
  byFeedback: Record<string, number>;
  averageQuality: number;
  sessionBased: number;
  conversationTurns: number[];
  codeRequests: number;
  codeRequestDislikes: number;
}

export interface DatasetManifest {
  version: string;
  createdAt: string;
  projectName: string;
  recordCount: number;
  filters: DatasetFilters;
  statistics: DatasetStatistics;
  checksum: string;
}

export interface DatasetQualityScore {
  overall: number;
  confidence: number;
  feedbackSignal: number;
  sessionQuality: number;
  tierBonus: number;
  reasons: string[];
  isTrainingReady: boolean;
}

export interface DeduplicationResult {
  originalId: string;
  duplicateOf: string | null;
  similarity: number;
  action: 'keep' | 'merge' | 'discard';
}

// Default configuration
export const DEFAULT_DATASET_CONFIG: DatasetConfig = {
  collection: {
    enabled: true,
    sources: ['qna-events', 'feedback', 'qa-history'],
    filters: {
      minConfidence: 0.5,
      maxAgeDays: 90,
      includeCodeRequests: false,
      apiOnly: false,
      minQualityScore: 0.6,
    },
  },
  quality: {
    minScoreThreshold: 0.6,
    decayDays: 30,
    signalsEnabled: true,
  },
  versioning: {
    enabled: true,
    format: 'semver',
    autoIncrement: true,
  },
  formats: {
    default: 'jsonl',
    supported: ['jsonl', 'json', 'chatml', 'sharegpt'],
  },
};

export const DATASET_DIR = '.kontextmind/dataset';
export const VERSIONS_DIR = join(DATASET_DIR, 'versions');