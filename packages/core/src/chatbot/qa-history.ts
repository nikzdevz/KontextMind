import { existsSync, readFileSync, appendFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import type { QARecord, QASearchOptions, QAHistoryStats } from './types/qa-types.js';
import type { SourceReference } from './chatbot-types.js';

const QA_HISTORY_FILE = '.kontextmind/chatbot/qa-history.jsonl';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function createQARecord(params: {
  question: string;
  answer: string;
  confidence: number;
  sources: SourceReference[];
  responseTimeMs: number;
  mode: 'readonly' | 'chatbot-readonly';
  cached: boolean;
  tier: number;
  qualityScore?: number;
}): QARecord {
  return {
    id: generateId(),
    question: params.question,
    answer: params.answer,
    timestamp: new Date().toISOString(),
    confidence: params.confidence,
    sources: params.sources,
    responseTimeMs: params.responseTimeMs,
    mode: params.mode,
    cached: params.cached,
    tier: params.tier,
    qualityScore: params.qualityScore,
  };
}

export async function appendToHistory(
  projectRoot: string,
  record: QARecord
): Promise<void> {
  const filePath = join(projectRoot, QA_HISTORY_FILE);
  const line = JSON.stringify(record) + '\n';

  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      ensureDir(dir);
    }

    appendFileSync(filePath, line, 'utf-8');
  } catch (error) {
    console.warn('Failed to append to Q&A history:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function loadHistory(
  projectRoot: string,
  options: QASearchOptions = {}
): Promise<QARecord[]> {
  const filePath = join(projectRoot, QA_HISTORY_FILE);

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const records: QARecord[] = [];
    const limit = options.limit || 100;
    const since = options.since?.getTime();

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as QARecord;

        if (since && new Date(record.timestamp).getTime() < since) {
          continue;
        }

        if (options.mode && record.mode !== options.mode) {
          continue;
        }

        if (options.minQualityScore !== undefined && (record.qualityScore || 0) < options.minQualityScore) {
          continue;
        }

        if (options.cachedOnly && !record.cached) {
          continue;
        }

        records.push(record);

        if (records.length >= limit) {
          break;
        }
      } catch {
        continue;
      }
    }

    return records;
  } catch {
    return [];
  }
}

export async function searchHistory(
  projectRoot: string,
  query: string,
  options: QASearchOptions = {}
): Promise<QARecord[]> {
  const records = await loadHistory(projectRoot, { ...options, limit: options.limit || 50 });
  const lowerQuery = query.toLowerCase();

  return records.filter(r =>
    r.question.toLowerCase().includes(lowerQuery) ||
    r.answer.toLowerCase().includes(lowerQuery)
  );
}

export async function findByQuestion(
  projectRoot: string,
  question: string,
  normalized: boolean = false
): Promise<QARecord | null> {
  const records = await loadHistory(projectRoot, { limit: 100 });

  if (normalized) {
    const normalizedQuestion = question.toLowerCase().trim();
    return records.find(r =>
      r.question.toLowerCase().trim() === normalizedQuestion
    ) || null;
  }

  return records.find(r => r.question === question) || null;
}

export async function getHistoryStats(projectRoot: string): Promise<QAHistoryStats> {
  const records = await loadHistory(projectRoot, { limit: 1000 });

  const stats: QAHistoryStats = {
    totalRecords: records.length,
    cachedHits: records.filter(r => r.cached).length,
    cacheMisses: records.filter(r => !r.cached).length,
    averageConfidence: 0,
    averageResponseTimeMs: 0,
    recordsByDay: {},
    modeDistribution: { readonly: 0, 'chatbot-readonly': 0 },
    tierDistribution: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    lastUpdated: new Date().toISOString(),
  };

  if (records.length === 0) {
    return stats;
  }

  let totalConfidence = 0;
  let totalResponseTime = 0;

  for (const record of records) {
    totalConfidence += record.confidence;
    totalResponseTime += record.responseTimeMs;

    const day = record.timestamp.split('T')[0];
    stats.recordsByDay[day] = (stats.recordsByDay[day] || 0) + 1;

    stats.modeDistribution[record.mode] = (stats.modeDistribution[record.mode] || 0) + 1;
    stats.tierDistribution[String(record.tier)] = (stats.tierDistribution[String(record.tier)] || 0) + 1;
  }

  stats.averageConfidence = totalConfidence / records.length;
  stats.averageResponseTimeMs = totalResponseTime / records.length;

  return stats;
}

export async function getTotalQuestions(projectRoot: string): Promise<number> {
  const filePath = join(projectRoot, QA_HISTORY_FILE);

  if (!existsSync(filePath)) {
    return 0;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(l => l.trim()).length;
  } catch {
    return 0;
  }
}

export async function recordCacheHit(
  projectRoot: string,
  tier: number,
  responseTimeMs: number
): Promise<void> {
  const dir = join(projectRoot, '.kontextmind/chatbot/analytics/daily');
  ensureDir(dir);

  const today = new Date().toISOString().split('T')[0];
  const filePath = join(dir, `${today}.json`);

  try {
    let stats = { hits: 0, misses: 0, tierHits: {} as Record<string, number> };

    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      stats = JSON.parse(content);
    }

    stats.hits = (stats.hits || 0) + 1;
    stats.tierHits[String(tier)] = (stats.tierHits[String(tier)] || 0) + 1;

    writeFileSync(filePath, JSON.stringify(stats, null, 2), 'utf-8');
  } catch {
    // Silently fail
  }
}

export async function recordCacheMiss(projectRoot: string, responseTimeMs: number): Promise<void> {
  const dir = join(projectRoot, '.kontextmind/chatbot/analytics/daily');
  ensureDir(dir);

  const today = new Date().toISOString().split('T')[0];
  const filePath = join(dir, `${today}.json`);

  try {
    let stats = { hits: 0, misses: 0, tierHits: {} as Record<string, number> };

    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      stats = JSON.parse(content);
    }

    stats.misses = (stats.misses || 0) + 1;

    writeFileSync(filePath, JSON.stringify(stats, null, 2), 'utf-8');
  } catch {
    // Silently fail
  }
}