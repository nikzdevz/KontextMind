import type { SourceReference } from '../chatbot-types.js';

export interface QARecord {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  confidence: number;
  sources: SourceReference[];
  responseTimeMs: number;
  mode: 'readonly' | 'chatbot-readonly';
  cached: boolean;
  tier: number;
  qualityScore?: number;
}

export interface QASearchOptions {
  limit?: number;
  since?: Date;
  mode?: 'readonly' | 'chatbot-readonly';
  minQualityScore?: number;
  cachedOnly?: boolean;
}

export interface QAHistoryStats {
  totalRecords: number;
  cachedHits: number;
  cacheMisses: number;
  averageConfidence: number;
  averageResponseTimeMs: number;
  recordsByDay: Record<string, number>;
  modeDistribution: Record<string, number>;
  tierDistribution: Record<string, number>;
  lastUpdated: string;
}
