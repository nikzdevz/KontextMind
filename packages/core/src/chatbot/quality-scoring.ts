import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import type { QualitySignal, QualityScore, QualityConfig, QualityStats } from './types/quality-types.js';

const QUALITY_FILE = '.kontextmind/chatbot/quality-scores.json';

const DEFAULT_CONFIG: QualityConfig = {
  minScoreThreshold: 0.6,
  decayDays: 30,
  signalsEnabled: true,
};

function loadQualityScores(projectRoot: string): Record<string, QualityScore> {
  const path = join(projectRoot, QUALITY_FILE);
  if (!existsSync(path)) return {};

  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

function saveQualityScores(projectRoot: string, scores: Record<string, QualityScore>): void {
  const dir = join(projectRoot, '.kontextmind/chatbot');
  ensureDir(dir);
  writeFileSync(join(dir, QUALITY_FILE), JSON.stringify(scores, null, 2), 'utf-8');
}

export function loadQualityConfig(projectRoot: string): QualityConfig {
  // Could be extended to load from config file
  return DEFAULT_CONFIG;
}

export async function recordQualitySignal(
  projectRoot: string,
  answerId: string,
  signal: QualitySignal
): Promise<void> {
  const scores = loadQualityScores(projectRoot);
  const now = new Date().toISOString();

  if (!scores[answerId]) {
    scores[answerId] = {
      answerId,
      helpful: 0,
      notHelpful: 0,
      reasked: 0,
      averageScore: 0,
      lastUpdated: now,
    };
  }

  const score = scores[answerId];

  switch (signal) {
    case 'helpful':
      score.helpful++;
      break;
    case 'notHelpful':
      score.notHelpful++;
      break;
    case 'reasked':
      score.reasked++;
      break;
    case 'skipped':
      // No-op for now
      break;
  }

  // Calculate average score
  const totalSignals = score.helpful + score.notHelpful + score.reasked;
  if (totalSignals > 0) {
    score.averageScore = (score.helpful - score.notHelpful - score.reasked) / totalSignals;
    score.averageScore = Math.max(-1, Math.min(1, score.averageScore)); // Clamp to [-1, 1]
  }

  score.lastUpdated = now;
  saveQualityScores(projectRoot, scores);
}

export function getQualityScore(projectRoot: string, answerId: string): QualityScore | null {
  const scores = loadQualityScores(projectRoot);
  return scores[answerId] || null;
}

export function getEffectiveQualityScore(
  projectRoot: string,
  answerId: string,
  createdAt?: string
): number {
  const score = getQualityScore(projectRoot, answerId);
  const config = loadQualityConfig(projectRoot);

  if (!score) {
    return 0.5; // Default score for unrated answers
  }

  // Apply decay for old answers
  if (createdAt) {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > config.decayDays) {
      const decayFactor = Math.exp(-(ageDays - config.decayDays) / config.decayDays);
      return score.averageScore * decayFactor;
    }
  }

  // Convert [-1, 1] to [0, 1]
  return (score.averageScore + 1) / 2;
}

export function shouldUseCachedAnswer(
  projectRoot: string,
  answerId: string,
  createdAt?: string
): boolean {
  const config = loadQualityConfig(projectRoot);
  const effectiveScore = getEffectiveQualityScore(projectRoot, answerId, createdAt);
  return effectiveScore >= config.minScoreThreshold;
}

export async function detectReask(
  projectRoot: string,
  question: string,
  threshold: number = 0.8
): Promise<string | null> {
  const { findSimilarAnswers } = await import('./embedding-cache.js');

  const similar = findSimilarAnswers(projectRoot, question, { threshold, maxResults: 1 });
  if (similar.length > 0) {
    return similar[0].id;
  }
  return null;
}

export async function autoRecordReask(
  projectRoot: string,
  answerId: string
): Promise<void> {
  await recordQualitySignal(projectRoot, answerId, 'reasked');
}

export function getQualityStats(projectRoot: string): QualityStats {
  const scores = loadQualityScores(projectRoot);
  const entries = Object.values(scores);

  let totalHelpful = 0;
  let totalNotHelpful = 0;
  let totalScore = 0;
  const topRated: Array<{ answerId: string; score: number }> = [];

  for (const score of entries) {
    totalHelpful += score.helpful;
    totalNotHelpful += score.notHelpful;
    totalScore += score.averageScore;
    topRated.push({ answerId: score.answerId, score: score.averageScore });
  }

  topRated.sort((a, b) => b.score - a.score);

  return {
    totalRated: entries.length,
    helpful: totalHelpful,
    notHelpful: totalNotHelpful,
    averageScore: entries.length > 0 ? totalScore / entries.length : 0,
    topRated: topRated.slice(0, 10),
    lastUpdated: new Date().toISOString(),
  };
}

export async function rateLastAnswer(
  projectRoot: string,
  signal: QualitySignal
): Promise<void> {
  const { loadHistory } = await import('./qa-history.js');

  const history = await loadHistory(projectRoot, { limit: 1 });
  if (history.length > 0) {
    await recordQualitySignal(projectRoot, history[0].id, signal);
  }
}

export function clearQualityScores(projectRoot: string): void {
  const path = join(projectRoot, QUALITY_FILE);
  if (existsSync(path)) {
    writeFileSync(path, '{}', 'utf-8');
  }
}