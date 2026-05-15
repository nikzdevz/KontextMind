// Quality Metrics - Observability and performance tracking for Ask tool
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { QuestionIntent, QualityMetrics, QualityMetricsEvent } from './chatbot-types.js';

/**
 * Calculate quality metrics from stored events
 */
export function calculateQualityMetrics(
  projectRoot: string,
  timeWindow?: { start: Date; end: Date }
): QualityMetrics {
  const metricsPath = join(projectRoot, '.logs', 'quality-metrics.jsonl');
  const qnaPath = join(projectRoot, '.logs', 'qna-events.jsonl');

  const metrics: QualityMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageConfidence: 0,
    averageQualityScore: 0,
    intentDistribution: {},
    averageResponseTime: 0,
    tokenUsage: { total: 0, average: 0 },
    contextHitRate: 0,
    followUpRate: 0,
    llmFallbackRate: 0,
  };

  // Load quality metrics events
  if (existsSync(metricsPath)) {
    try {
      const content = readFileSync(metricsPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      let totalConfidence = 0;
      let totalQualityScore = 0;
      let totalResponseTime = 0;
      let totalTokens = 0;

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as QualityMetricsEvent;

          // Filter by time window if specified
          if (timeWindow) {
            const ts = new Date(event.timestamp);
            if (ts < timeWindow.start || ts > timeWindow.end) {
              continue;
            }
          }

          metrics.totalRequests++;
          metrics.successfulRequests++;
          totalConfidence += event.qualityScore;
          totalQualityScore += event.qualityScore;
          totalResponseTime += event.responseTimeMs;
          totalTokens += event.totalTokens;

          // Track intent distribution
          const intent = event.intent;
          if (!metrics.intentDistribution[intent]) {
            metrics.intentDistribution[intent] = 0;
          }
          metrics.intentDistribution[intent]!++;
        } catch {
          // Skip invalid lines
        }
      }

      if (metrics.totalRequests > 0) {
        metrics.averageConfidence = totalConfidence / metrics.totalRequests;
        metrics.averageQualityScore = totalQualityScore / metrics.totalRequests;
        metrics.averageResponseTime = totalResponseTime / metrics.totalRequests;
        metrics.tokenUsage.total = totalTokens;
        metrics.tokenUsage.average = totalTokens / metrics.totalRequests;
      }
    } catch {
      // Skip on error
    }
  }

  // Load Q&A events for additional metrics
  if (existsSync(qnaPath)) {
    try {
      const content = readFileSync(qnaPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      let requestsWithContext = 0;
      let followUpCount = 0;
      let llmFallbackCount = 0;

      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          // Check for context (sources exist)
          if (event.sources && event.sources.length > 0) {
            requestsWithContext++;
          }

          // Check for follow-up
          if (event.conversationTurn && event.conversationTurn > 0) {
            followUpCount++;
          }

          // Check for code request (potential fallback)
          if (event.codeRequestDetected) {
            llmFallbackCount++;
          }
        } catch {
          // Skip invalid lines
        }
      }

      const totalQNA = lines.length;
      if (totalQNA > 0) {
        metrics.contextHitRate = requestsWithContext / totalQNA;
        metrics.followUpRate = followUpCount / totalQNA;
        metrics.llmFallbackRate = llmFallbackCount / totalQNA;
      }
    } catch {
      // Skip on error
    }
  }

  return metrics;
}

/**
 * Get recent quality trends
 */
export function getQualityTrends(
  projectRoot: string,
  windowHours: number = 24
): {
  current: QualityMetrics;
  previous: QualityMetrics;
  trends: Record<string, number>;
} {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - windowHours * 2 * 60 * 60 * 1000);

  const current = calculateQualityMetrics(projectRoot, { start: windowStart, end: now });
  const previous = calculateQualityMetrics(projectRoot, { start: previousStart, end: windowStart });

  // Calculate trends
  const trends: Record<string, number> = {};

  if (previous.totalRequests > 0 && current.totalRequests > 0) {
    trends.requestGrowth = ((current.totalRequests - previous.totalRequests) / previous.totalRequests) * 100;
  }
  if (previous.averageConfidence > 0) {
    trends.confidenceDelta = (current.averageConfidence - previous.averageConfidence) * 100;
  }
  if (previous.averageResponseTime > 0) {
    trends.responseTimeDelta = ((current.averageResponseTime - previous.averageResponseTime) / previous.averageResponseTime) * 100;
  }

  return { current, previous, trends };
}

/**
 * Get intent distribution for analysis
 */
export function getIntentDistribution(projectRoot: string): Array<{ intent: QuestionIntent; count: number; percentage: number }> {
  const metrics = calculateQualityMetrics(projectRoot);

  const total = Object.values(metrics.intentDistribution).reduce((sum, count) => sum + count, 0);

  return Object.entries(metrics.intentDistribution)
    .map(([intent, count]) => ({
      intent: intent as QuestionIntent,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(projectRoot: string): {
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  tokenUsage: { avg: number; max: number; min: number };
} {
  const metricsPath = join(projectRoot, '.logs', 'quality-metrics.jsonl');

  const responseTimes: number[] = [];
  const tokenCounts: number[] = [];

  if (existsSync(metricsPath)) {
    try {
      const content = readFileSync(metricsPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as QualityMetricsEvent;
          responseTimes.push(event.responseTimeMs);
          tokenCounts.push(event.totalTokens);
        } catch {
          // Skip invalid lines
        }
      }
    } catch {
      // Skip on error
    }
  }

  responseTimes.sort((a, b) => a - b);
  tokenCounts.sort((a, b) => a - b);

  const average = responseTimes.length > 0
    ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    : 0;

  const pIndex = (p: number) => Math.floor((p / 100) * responseTimes.length);
  const p50 = responseTimes.length > 0 ? responseTimes[pIndex(50)] || 0 : 0;
  const p95 = responseTimes.length > 0 ? responseTimes[pIndex(95)] || 0 : 0;
  const p99 = responseTimes.length > 0 ? responseTimes[pIndex(99)] || 0 : 0;

  return {
    averageResponseTime: average,
    p50,
    p95,
    p99,
    tokenUsage: {
      avg: tokenCounts.length > 0 ? tokenCounts.reduce((sum, t) => sum + t, 0) / tokenCounts.length : 0,
      max: tokenCounts.length > 0 ? Math.max(...tokenCounts) : 0,
      min: tokenCounts.length > 0 ? Math.min(...tokenCounts) : 0,
    },
  };
}

/**
 * Generate quality report
 */
export function generateQualityReport(projectRoot: string): string {
  const metrics = calculateQualityMetrics(projectRoot);
  const trends = getQualityTrends(projectRoot, 24);
  const intents = getIntentDistribution(projectRoot);
  const performance = getPerformanceStats(projectRoot);

  const lines: string[] = [
    '# Ask Tool Quality Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Overview',
    `- Total Requests: ${metrics.totalRequests}`,
    `- Successful: ${metrics.successfulRequests}`,
    `- Failed: ${metrics.failedRequests}`,
    `- Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`,
    '',
    '## Intent Distribution',
  ];

  for (const { intent, count, percentage } of intents) {
    lines.push(`- ${intent}: ${count} (${percentage.toFixed(1)}%)`);
  }

  lines.push(
    '',
    '## Performance',
    `- Average Response Time: ${performance.averageResponseTime.toFixed(0)}ms`,
    `- P50 Latency: ${performance.p50}ms`,
    `- P95 Latency: ${performance.p95}ms`,
    `- P99 Latency: ${performance.p99}ms`,
    '',
    '## Token Usage',
    `- Average: ${performance.tokenUsage.avg.toFixed(0)} tokens`,
    `- Max: ${performance.tokenUsage.max} tokens`,
    `- Min: ${performance.tokenUsage.min} tokens`,
    '',
    '## Context Quality',
    `- Context Hit Rate: ${(metrics.contextHitRate * 100).toFixed(1)}%`,
    `- Follow-up Rate: ${(metrics.followUpRate * 100).toFixed(1)}%`,
    `- LLM Fallback Rate: ${(metrics.llmFallbackRate * 100).toFixed(1)}%`,
  );

  if (Object.keys(trends.trends).length > 0) {
    lines.push('', '## Trends (24h)');
    for (const [key, value] of Object.entries(trends.trends)) {
      const arrow = value >= 0 ? '↑' : '↓';
      lines.push(`- ${key}: ${arrow} ${Math.abs(value).toFixed(1)}%`);
    }
  }

  return lines.join('\n');
}

/**
 * Record a quality event (called by ask pipeline)
 */
export function recordQualityEvent(
  projectRoot: string,
  event: QualityMetricsEvent
): void {
  try {
    const logsDir = join(projectRoot, '.logs');
    mkdirSync(logsDir, { recursive: true });

    const metricsPath = join(logsDir, 'quality-metrics.jsonl');
    const entry = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });

    appendFileSync(metricsPath, entry + '\n', 'utf-8');
  } catch {
    // Silently ignore logging errors
  }
}

/**
 * Check if quality meets threshold
 */
export function checkQualityThreshold(
  projectRoot: string,
  threshold: {
    minConfidence?: number;
    maxResponseTime?: number;
    minContextHitRate?: number;
  }
): {
  passed: boolean;
  failures: string[];
} {
  const metrics = calculateQualityMetrics(projectRoot);
  const failures: string[] = [];

  if (threshold.minConfidence && metrics.averageConfidence < threshold.minConfidence) {
    failures.push(`Average confidence (${metrics.averageConfidence.toFixed(2)}) below threshold (${threshold.minConfidence})`);
  }

  if (threshold.maxResponseTime && metrics.averageResponseTime > threshold.maxResponseTime) {
    failures.push(`Average response time (${metrics.averageResponseTime.toFixed(0)}ms) exceeds threshold (${threshold.maxResponseTime}ms)`);
  }

  if (threshold.minContextHitRate && metrics.contextHitRate < threshold.minContextHitRate) {
    failures.push(`Context hit rate (${(metrics.contextHitRate * 100).toFixed(1)}%) below threshold (${(threshold.minContextHitRate * 100).toFixed(0)}%)`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
