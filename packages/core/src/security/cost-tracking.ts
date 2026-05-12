/**
 * Cost Tracking
 *
 * Track LLM usage costs and token consumption.
 */

import * as fs from 'fs';
import * as path from 'path';

const COST_LOGS_DIR = '.logs';
const COST_LOG_FILE = path.join(COST_LOGS_DIR, 'cost-events.log');

export interface CostEntry {
  timestamp: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  currency: string;
}

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  operationCounts: Record<string, number>;
  providerUsage: Record<string, number>;
  modelUsage: Record<string, number>;
}

function ensureLogDir(): void {
  if (!fs.existsSync(COST_LOGS_DIR)) {
    fs.mkdirSync(COST_LOGS_DIR, { recursive: true });
  }
}

export function logCostEvent(entry: Omit<CostEntry, 'timestamp' | 'currency'>): void {
  ensureLogDir();
  const fullEntry: CostEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    currency: 'USD',
  };
  fs.appendFileSync(COST_LOG_FILE, JSON.stringify(fullEntry) + '\n');
}

export function getCostSummary(since?: Date): CostSummary {
  const summary: CostSummary = {
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    operationCounts: {},
    providerUsage: {},
    modelUsage: {},
  };

  if (!fs.existsSync(COST_LOG_FILE)) {
    return summary;
  }

  const lines = fs.readFileSync(COST_LOG_FILE, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const entry: CostEntry = JSON.parse(line);

      if (since && new Date(entry.timestamp) < since) {
        continue;
      }

      summary.totalCost += entry.estimatedCost;
      summary.totalInputTokens += entry.inputTokens;
      summary.totalOutputTokens += entry.outputTokens;

      summary.operationCounts[entry.operation] = (summary.operationCounts[entry.operation] || 0) + 1;
      summary.providerUsage[entry.provider] = (summary.providerUsage[entry.provider] || 0) + entry.estimatedCost;
      summary.modelUsage[entry.model] = (summary.modelUsage[entry.model] || 0) + entry.estimatedCost;
    } catch {
      // Skip invalid entries
    }
  }

  return summary;
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  provider: string,
  model: string
): number {
  const PRICING: Record<string, Record<string, { inputPer1M: number; outputPer1M: number }>> = {
    anthropic: {
      'claude-opus-4-7': { inputPer1M: 15, outputPer1M: 75 },
      'claude-sonnet-4-6': { inputPer1M: 3, outputPer1M: 15 },
      'claude-haiku-4-5': { inputPer1M: 0.8, outputPer1M: 4 },
    },
    openai: {
      'gpt-4o': { inputPer1M: 5, outputPer1M: 15 },
      'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
      'gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30 },
    },
    'openai-compatible': {
      default: { inputPer1M: 2, outputPer1M: 8 },
    },
    ollama: {
      default: { inputPer1M: 0, outputPer1M: 0 },
    },
    bedrock: {
      default: { inputPer1M: 2.5, outputPer1M: 10 },
    },
  };

  const providerPricing = PRICING[provider] || PRICING['openai-compatible'];
  const modelPricing = providerPricing[model] || providerPricing['default'] || { inputPer1M: 2, outputPer1M: 8 };

  const inputCost = (inputTokens / 1_000_000) * modelPricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.outputPer1M;

  return inputCost + outputCost;
}

export function estimateTokens(text: string): number {
  const CHARS_PER_TOKEN = 4;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function parseCostLog(logPath: string): CostEntry[] {
  const entries: CostEntry[] = [];

  if (!fs.existsSync(logPath)) {
    return entries;
  }

  const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip invalid entries
    }
  }

  return entries;
}