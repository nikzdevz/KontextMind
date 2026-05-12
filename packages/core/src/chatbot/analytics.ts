import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { loadHistory } from './qa-history.js';
import type { DailyStats, WeeklyStats, AnalyticsReport, TopQuestion } from './types/analytics-types.js';

const ANALYTICS_DIR = '.kontextmind/chatbot/analytics';

export function loadDailyStats(projectRoot: string, date: string): DailyStats | null {
  const path = join(projectRoot, ANALYTICS_DIR, 'daily', `${date}.json`);
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as DailyStats;
  } catch {
    return null;
  }
}

export function saveDailyStats(projectRoot: string, stats: DailyStats): void {
  const dir = join(projectRoot, ANALYTICS_DIR, 'daily');
  ensureDir(dir);
  writeFileSync(join(dir, `${stats.date}.json`), JSON.stringify(stats, null, 2), 'utf-8');
}

export function getTodayStats(projectRoot: string): DailyStats {
  const today = new Date().toISOString().split('T')[0];
  const existing = loadDailyStats(projectRoot, today);

  if (existing) return existing;

  return {
    date: today,
    totalQuestions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    averageConfidence: 0,
    averageResponseTimeMs: 0,
    tierDistribution: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  };
}

export function updateTodayStats(projectRoot: string, tier: number, responseTimeMs: number, confidence: number, cached: boolean): void {
  const today = new Date().toISOString().split('T')[0];
  let stats = getTodayStats(projectRoot);

  // Update counters
  stats.totalQuestions++;
  if (cached) {
    stats.cacheHits++;
  } else {
    stats.cacheMisses++;
  }

  // Update tier distribution
  stats.tierDistribution[String(tier)] = (stats.tierDistribution[String(tier)] || 0) + 1;

  // Update running averages
  stats.averageConfidence = (stats.averageConfidence * (stats.totalQuestions - 1) + confidence) / stats.totalQuestions;
  stats.averageResponseTimeMs = (stats.averageResponseTimeMs * (stats.totalQuestions - 1) + responseTimeMs) / stats.totalQuestions;

  // Calculate hit rate
  stats.hitRate = stats.totalQuestions > 0 ? stats.cacheHits / stats.totalQuestions : 0;

  saveDailyStats(projectRoot, stats);
}

export async function getTopQuestions(projectRoot: string, limit: number = 10): Promise<TopQuestion[]> {
  const records = await loadHistory(projectRoot, { limit: 500 });

  const questionCounts = new Map<string, { count: number; totalConfidence: number }>();

  for (const record of records) {
    const questionLower = record.question.toLowerCase();
    const existing = questionCounts.get(questionLower);

    if (existing) {
      existing.count++;
      existing.totalConfidence += record.confidence;
    } else {
      questionCounts.set(questionLower, { count: 1, totalConfidence: record.confidence });
    }
  }

  const topQuestions: TopQuestion[] = [];

  for (const [question, data] of questionCounts) {
    topQuestions.push({
      question,
      count: data.count,
      averageConfidence: data.totalConfidence / data.count,
    });
  }

  topQuestions.sort((a, b) => b.count - a.count);

  return topQuestions.slice(0, limit);
}

export function getWeeklyStats(projectRoot: string): WeeklyStats | null {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 6);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = today.toISOString().split('T')[0];

  const dailyStats: DailyStats[] = [];

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayStats = loadDailyStats(projectRoot, dateStr);
    if (dayStats) {
      dailyStats.push(dayStats);
    }
  }

  if (dailyStats.length === 0) return null;

  const totalQuestions = dailyStats.reduce((sum, s) => sum + s.totalQuestions, 0);
  const totalHits = dailyStats.reduce((sum, s) => sum + s.cacheHits, 0);

  return {
    startDate: startStr,
    endDate: endStr,
    totalQuestions,
    totalCacheHits: totalHits,
    hitRateTrend: totalQuestions > 0 ? totalHits / totalQuestions : 0,
    topQuestions: [],
    dailyBreakdown: dailyStats,
  };
}

export async function getAnalyticsReport(projectRoot: string, period: 'daily' | 'weekly' = 'daily'): Promise<AnalyticsReport> {
  const today = new Date().toISOString().split('T')[0];
  const history = await loadHistory(projectRoot, { limit: 500 });

  const startDate = period === 'weekly'
    ? new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : today;

  // Calculate summary stats from history
  let totalQuestions = 0;
  let totalCacheHits = 0;
  let totalConfidence = 0;
  let totalResponseTime = 0;
  const tierBreakdown: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  for (const record of history) {
    const recordDate = record.timestamp.split('T')[0];
    if (recordDate >= startDate) {
      totalQuestions++;
      if (record.cached) totalCacheHits++;
      totalConfidence += record.confidence;
      totalResponseTime += record.responseTimeMs;
      tierBreakdown[String(record.tier)] = (tierBreakdown[String(record.tier)] || 0) + 1;
    }
  }

  const topQuestions = await getTopQuestions(projectRoot, 10);

  // Calculate trends (comparing first half vs second half)
  const halfIndex = Math.floor(history.length / 2);
  const firstHalf = history.slice(0, halfIndex);
  const secondHalf = history.slice(halfIndex);

  const firstHalfHits = firstHalf.filter(r => r.cached).length;
  const secondHalfHits = secondHalf.filter(r => r.cached).length;

  const hitRateTrend = firstHalf.length > 0 && secondHalf.length > 0
    ? (secondHalfHits / secondHalf.length) - (firstHalfHits / firstHalf.length)
    : 0;

  return {
    period,
    startDate,
    endDate: today,
    summary: {
      totalQuestions,
      totalCacheHits,
      overallHitRate: totalQuestions > 0 ? totalCacheHits / totalQuestions : 0,
      averageConfidence: totalQuestions > 0 ? totalConfidence / totalQuestions : 0,
      averageResponseTimeMs: totalQuestions > 0 ? totalResponseTime / totalQuestions : 0,
    },
    trends: {
      hitRateTrend,
      volumeTrend: 0, // Would need historical data to calculate
    },
    topQuestions,
    tierBreakdown,
  };
}

export function getCacheCoverage(projectRoot: string): {
  totalQuestions: number;
  cachedQuestions: number;
  coveragePercent: number;
  tierCoverage: Record<string, number>;
} {
  // This would need more implementation - for now return basic stats
  const today = getTodayStats(projectRoot);

  const totalQuestions = today.totalQuestions;
  const cachedQuestions = today.cacheHits;
  const coveragePercent = totalQuestions > 0 ? (cachedQuestions / totalQuestions) * 100 : 0;

  return {
    totalQuestions,
    cachedQuestions,
    coveragePercent,
    tierCoverage: today.tierDistribution,
  };
}

export async function clearAnalytics(projectRoot: string): Promise<void> {
  const dailyDir = join(projectRoot, ANALYTICS_DIR, 'daily');

  if (existsSync(dailyDir)) {
    try {
      const files = readdirSync(dailyDir);
      for (const file of files) {
        const path = join(dailyDir, file);
        writeFileSync(path, JSON.stringify({
          date: file.replace('.json', ''),
          totalQuestions: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
          averageConfidence: 0,
          averageResponseTimeMs: 0,
          tierDistribution: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        }, null, 2), 'utf-8');
      }
    } catch {
      // Silently fail
    }
  }
}