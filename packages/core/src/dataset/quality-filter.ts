// Dataset Quality Filter - Applies quality criteria to filter and score records
import type {
  TrainingRecord,
  DatasetFilters,
  DatasetQualityScore,
  DeduplicationResult,
} from './types.js';

export interface FilterResult {
  passed: TrainingRecord[];
  rejected: TrainingRecord[];
  statistics: {
    total: number;
    passed: number;
    rejected: number;
    reasons: Record<string, number>;
  };
}

// Main filtering function
export function filterRecords(
  records: TrainingRecord[],
  filters: DatasetFilters
): FilterResult {
  const passed: TrainingRecord[] = [];
  const rejected: TrainingRecord[] = [];
  const reasons: Record<string, number> = {};

  for (const record of records) {
    const qualityScore = computeQualityScore(record);
    const rejectionReasons = getRejectionReasons(record, filters, qualityScore);

    if (rejectionReasons.length === 0 && qualityScore.overall >= filters.minQualityScore) {
      passed.push(record);
    } else {
      // Update quality score with reasons
      rejected.push({
        ...record,
        quality: {
          ...record.quality,
          score: qualityScore.overall,
        },
      });

      // Track rejection reasons
      for (const reason of rejectionReasons) {
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
      if (qualityScore.overall < filters.minQualityScore) {
        reasons['quality-score'] = (reasons['quality-score'] || 0) + 1;
      }
    }
  }

  return {
    passed,
    rejected,
    statistics: {
      total: records.length,
      passed: passed.length,
      rejected: rejected.length,
      reasons,
    },
  };
}

// Compute quality score for a training record
export function computeQualityScore(record: TrainingRecord): DatasetQualityScore {
  const reasons: string[] = [];
  let score = 0;

  // Base score from confidence
  score += record.quality.confidence * 0.25;

  // Feedback signal contribution
  if (record.quality.feedback === 'helpful') {
    score += 0.30;
  } else if (record.quality.feedback === 'not_helpful') {
    score -= 0.20;
  } else if (record.quality.feedback === 'neutral') {
    score += 0.05;
  }

  // Source priority (API > MCP > CLI)
  const sourceWeights: Record<string, number> = { api: 0.15, mcp: 0.08, cli: 0.0 };
  score += sourceWeights[record.metadata.source] || 0;

  // Session-based bonus (multi-turn shows engagement)
  if (record.metadata.sessionId && record.quality.conversationTurn !== null) {
    const turnBonus = Math.min(0.15, record.quality.conversationTurn * 0.03);
    score += turnBonus;

    // Follow-up quality bonus
    if (record.quality.conversationTurn > 1) {
      score += 0.05;
    }
  }

  // Tier bonus (lower tier = higher quality source)
  const tierBonus = Math.max(0, (5 - record.metadata.tier) * 0.02);
  score += tierBonus;

  // Content validation
  if (!record.answer || record.answer.length < 20) {
    reasons.push('answer-too-short');
    score -= 0.2;
  }
  if (record.question.length < 5) {
    reasons.push('question-too-short');
    score -= 0.1;
  }

  // Code request handling
  if (record.quality.isCodeFiltered && !record.quality.feedback) {
    score -= 0.15;
    reasons.push('unreviewed-code-request');
  }

  const isTrainingReady = score >= 0.6 && !reasons.some(r => r.includes('too short'));

  return {
    overall: Math.max(0, Math.min(1, score)),
    confidence: record.quality.confidence,
    feedbackSignal: record.quality.feedback === 'helpful' ? 1 : record.quality.feedback === 'not_helpful' ? -1 : 0,
    sessionQuality: record.metadata.sessionId ? (record.quality.conversationTurn || 0) / 10 : 0,
    tierBonus,
    reasons,
    isTrainingReady,
  };
}

// Get reasons why a record would be rejected
function getRejectionReasons(
  record: TrainingRecord,
  filters: DatasetFilters,
  qualityScore: DatasetQualityScore
): string[] {
  const reasons: string[] = [];

  // Confidence threshold
  if (record.quality.confidence < filters.minConfidence) {
    reasons.push('low-confidence');
  }

  // Quality score threshold
  if (qualityScore.overall < filters.minQualityScore) {
    reasons.push('low-quality-score');
  }

  // Content validation
  if (!record.answer || record.answer.length < 20) {
    reasons.push('answer-too-short');
  }
  if (!record.question || record.question.length < 5) {
    reasons.push('question-too-short');
  }

  // Source filter
  if (filters.apiOnly && record.metadata.source !== 'api') {
    reasons.push('non-api-source');
  }

  // Code request filter
  if (!filters.includeCodeRequests && record.quality.isCodeFiltered) {
    reasons.push('code-request');
  }

  return reasons;
}

// Deduplicate records based on question similarity
export function deduplicateRecords(
  records: TrainingRecord[],
  threshold: number = 0.85
): { records: TrainingRecord[]; duplicates: DeduplicationResult[] } {
  const duplicates: DeduplicationResult[] = [];
  const kept: TrainingRecord[] = [];
  const seenQuestions = new Map<string, number>(); // hash -> index in kept

  for (const record of records) {
    const questionHash = simpleHash(record.question);
    const existingIndex = seenQuestions.get(questionHash);

    if (existingIndex !== undefined) {
      const existing = kept[existingIndex];

      // Compare quality scores
      if (record.quality.score > existing.quality.score) {
        // New record is better, mark old one as duplicate
        duplicates.push({
          originalId: existing.id,
          duplicateOf: record.id,
          similarity: 1.0,
          action: 'discard',
        });
        // Replace with new record
        kept[existingIndex] = record;
        seenQuestions.set(questionHash, existingIndex);
      } else {
        // Keep existing, mark new as duplicate
        duplicates.push({
          originalId: record.id,
          duplicateOf: existing.id,
          similarity: 1.0,
          action: 'discard',
        });
      }
    } else {
      seenQuestions.set(questionHash, kept.length);
      kept.push(record);
    }
  }

  return { records: kept, duplicates };
}

// Simple hash for deduplication
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}

// Filter by date range
export function filterByDateRange(
  records: TrainingRecord[],
  since?: string,
  until?: string
): TrainingRecord[] {
  return records.filter(record => {
    const createdAt = new Date(record.metadata.createdAt).getTime();

    if (since) {
      const sinceTime = new Date(since).getTime();
      if (createdAt < sinceTime) return false;
    }

    if (until) {
      const untilTime = new Date(until).getTime();
      if (createdAt > untilTime) return false;
    }

    return true;
  });
}

// Filter by source
export function filterBySource(
  records: TrainingRecord[],
  sources: ('cli' | 'api' | 'mcp')[]
): TrainingRecord[] {
  return records.filter(record => sources.includes(record.metadata.source));
}

// Filter to only include session-based records
export function filterSessionBased(records: TrainingRecord[]): TrainingRecord[] {
  return records.filter(record => record.metadata.sessionId !== null);
}

// Filter to only include non-session (single-turn) records
export function filterSingleTurn(records: TrainingRecord[]): TrainingRecord[] {
  return records.filter(record => record.metadata.sessionId === null);
}

// Get quality distribution
export function getQualityDistribution(records: TrainingRecord[]): {
  excellent: number;  // >= 0.8
  good: number;       // 0.6 - 0.8
  fair: number;       // 0.4 - 0.6
  poor: number;       // < 0.4
} {
  const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };

  for (const record of records) {
    const score = record.quality.score;
    if (score >= 0.8) distribution.excellent++;
    else if (score >= 0.6) distribution.good++;
    else if (score >= 0.4) distribution.fair++;
    else distribution.poor++;
  }

  return distribution;
}

// Apply all filters in sequence
export function applyAllFilters(
  records: TrainingRecord[],
  filters: DatasetFilters
): {
  records: TrainingRecord[];
  filterResult: FilterResult;
  deduplicationResult: { records: TrainingRecord[]; duplicates: DeduplicationResult[] };
} {
  // Step 1: Apply basic filters
  const filterResult = filterRecords(records, filters);

  // Step 2: Deduplicate
  const deduplicationResult = deduplicateRecords(filterResult.passed);

  // Step 3: Apply date range filter if specified
  let finalRecords = deduplicationResult.records;
  if (filters.since) {
    finalRecords = filterByDateRange(finalRecords, filters.since);
  }

  return {
    records: finalRecords,
    filterResult,
    deduplicationResult,
  };
}