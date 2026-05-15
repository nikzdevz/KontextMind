/**
 * Intent Prediction System
 *
 * Predicts user/agent intent before it's explicit.
 * Pre-loads resources for predicted intents.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const PREDICTION_DIR = '.kontextmind/prediction';

export interface Prediction {
  id: string;
  intent: string;
  confidence: number;
  requiredContext: string[];
  preloadedResources: Resource[];
  alternativeIntents: string[];
  timestamp: string;
  outcome?: 'correct' | 'incorrect' | 'partial';
}

export interface Resource {
  type: 'file' | 'summary' | 'skill' | 'memory' | 'code';
  id: string;
  content: string;
  relevance: number;
}

export interface IntentHistory {
  intent: string;
  frequency: number;
  successRate: number;
  averageConfidence: number;
  lastOccurrence: string;
  contextPatterns: string[];
}

export interface PredictionStats {
  totalPredictions: number;
  accuracy: number;
  topIntents: string[];
  averageConfidence: number;
}

/**
 * IntentPredictor - Predicts next actions/intents
 */
export class IntentPredictor {
  private predictions: Map<string, Prediction> = new Map();
  private history: Map<string, IntentHistory> = new Map();
  private preloadedResources: Map<string, Resource[]> = new Map();
  private projectRoot: string;
  private predictionsPath: string;
  private historyPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.predictionsPath = join(projectRoot, PREDICTION_DIR, 'predictions.json');
    this.historyPath = join(projectRoot, PREDICTION_DIR, 'history.json');
    this.load();
  }

  /**
   * Predict next intents based on context
   */
  predict(context: {
    recentMessages?: string[];
    currentTask?: string;
    filesInvolved?: string[];
    activeSkills?: string[];
  }): Prediction[] {
    const predictions: Prediction[] = [];

    // Analyze context for patterns
    const patterns = this.analyzeContext(context);

    // Generate predictions based on patterns
    for (const pattern of patterns) {
      const prediction = this.createPrediction(pattern);
      predictions.push(prediction);
    }

    // Sort by confidence
    predictions.sort((a, b) => b.confidence - a.confidence);

    return predictions.slice(0, 5);
  }

  /**
   * Preload resources for predicted intents
   */
  async preload(prediction: Prediction): Promise<void> {
    // Store prediction
    this.predictions.set(prediction.id, prediction);

    // Preload all required resources
    for (const resource of prediction.preloadedResources) {
      if (!this.preloadedResources.has(prediction.intent)) {
        this.preloadedResources.set(prediction.intent, []);
      }
      this.preloadedResources.get(prediction.intent)!.push(resource);
    }

    this.save();
  }

  /**
   * Get preloaded resources for intent
   */
  getPreloaded(intent: string): Resource[] {
    return this.preloadedResources.get(intent) || [];
  }

  /**
   * Record prediction outcome (for learning)
   */
  recordOutcome(predictionId: string, actual: string): void {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) return;

    // Determine outcome
    prediction.outcome = prediction.intent === actual
      ? 'correct'
      : (prediction.alternativeIntents.includes(actual) ? 'partial' : 'incorrect');

    // Update history
    this.updateHistory(prediction.intent, prediction.outcome);

    // Update confidence based on outcome
    if (prediction.outcome === 'correct') {
      prediction.confidence = Math.min(1, prediction.confidence + 0.1);
    } else if (prediction.outcome === 'incorrect') {
      prediction.confidence = Math.max(0.1, prediction.confidence - 0.2);
    }

    this.save();
  }

  /**
   * Get prediction history for intent
   */
  getHistory(intent: string): IntentHistory | null {
    return this.history.get(intent) || null;
  }

  /**
   * Get statistics
   */
  getStats(): PredictionStats {
    const predictions = [...this.predictions.values()];

    if (predictions.length === 0) {
      return {
        totalPredictions: 0,
        accuracy: 0.5,
        topIntents: [],
        averageConfidence: 0.5,
      };
    }

    const correct = predictions.filter(p => p.outcome === 'correct').length;
    const partial = predictions.filter(p => p.outcome === 'partial').length;

    // Top intents by frequency
    const intentCounts: Record<string, number> = {};
    for (const pred of predictions) {
      intentCounts[pred.intent] = (intentCounts[pred.intent] || 0) + 1;
    }
    const topIntents = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([intent]) => intent);

    return {
      totalPredictions: predictions.length,
      accuracy: (correct + partial * 0.5) / predictions.length,
      topIntents,
      averageConfidence: predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length,
    };
  }

  /**
   * Clear predictions
   */
  clear(): void {
    this.predictions.clear();
    this.preloadedResources.clear();
    this.save();
  }

  // ============ Private Methods ============

  private analyzeContext(context: {
    recentMessages?: string[];
    currentTask?: string;
    filesInvolved?: string[];
    activeSkills?: string[];
  }): Array<{ intent: string; confidence: number; alternatives: string[] }> {
    const patterns: Array<{ intent: string; confidence: number; alternatives: string[] }> = [];

    // Task-based predictions
    if (context.currentTask) {
      const taskPatterns = this.getTaskPatterns(context.currentTask);
      patterns.push(...taskPatterns);
    }

    // File-based predictions
    if (context.filesInvolved) {
      for (const file of context.filesInvolved) {
        const filePatterns = this.getFilePatterns(file);
        patterns.push(...filePatterns);
      }
    }

    // Message-based predictions
    if (context.recentMessages && context.recentMessages.length > 0) {
      const lastMsg = context.recentMessages[context.recentMessages.length - 1].toLowerCase();
      const msgPatterns = this.getMessagePatterns(lastMsg);
      patterns.push(...msgPatterns);
    }

    // Merge duplicate intents
    const merged: Record<string, { confidence: number; alternatives: string[] }> = {};
    for (const pattern of patterns) {
      if (!merged[pattern.intent]) {
        merged[pattern.intent] = { confidence: 0, alternatives: [] };
      }
      merged[pattern.intent].confidence = Math.max(merged[pattern.intent].confidence, pattern.confidence);
      merged[pattern.intent].alternatives.push(...pattern.alternatives);
    }

    return Object.entries(merged).map(([intent, data]) => ({
      intent,
      confidence: data.confidence,
      alternatives: [...new Set(data.alternatives)],
    }));
  }

  private getTaskPatterns(task: string): Array<{ intent: string; confidence: number; alternatives: string[] }> {
    const patterns: Array<{ intent: string; confidence: number; alternatives: string[] }> = [];

    // Map task types to likely next intents
    const taskMap: Record<string, { intent: string; confidence: number; alternatives: string[] }[]> = {
      'debug': [
        { intent: 'find_root_cause', confidence: 0.8, alternatives: ['add_logging', 'check_stack'] },
        { intent: 'write_fix', confidence: 0.6, alternatives: ['revert_change', 'ask_help'] },
      ],
      'code_write': [
        { intent: 'add_tests', confidence: 0.7, alternatives: ['refine_code', 'document'] },
        { intent: 'review_code', confidence: 0.5, alternatives: ['commit', 'next_feature'] },
      ],
      'refactor': [
        { intent: 'run_tests', confidence: 0.9, alternatives: ['commit', 'review'] },
        { intent: 'update_docs', confidence: 0.4, alternatives: ['optimize', 'next_task'] },
      ],
    };

    for (const [key, preds] of Object.entries(taskMap)) {
      if (task.toLowerCase().includes(key)) {
        patterns.push(...preds);
      }
    }

    return patterns;
  }

  private getFilePatterns(file: string): Array<{ intent: string; confidence: number; alternatives: string[] }> {
    const patterns: Array<{ intent: string; confidence: number; alternatives: string[] }> = [];

    // File extension based predictions
    if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
      patterns.push({ intent: 'run_tests', confidence: 0.9, alternatives: ['debug', 'coverage'] });
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      patterns.push({ intent: 'implement', confidence: 0.6, alternatives: ['refactor', 'test'] });
    }

    return patterns;
  }

  private getMessagePatterns(message: string): Array<{ intent: string; confidence: number; alternatives: string[] }> {
    const patterns: Array<{ intent: string; confidence: number; alternatives: string[] }> = [];

    // Keyword-based predictions
    const keywords: Record<string, { intent: string; confidence: number; alternatives: string[] }[]> = {
      'fix': [{ intent: 'debug', confidence: 0.7, alternatives: ['implement', 'test'] }],
      'add': [{ intent: 'implement', confidence: 0.8, alternatives: ['test', 'document'] }],
      'test': [{ intent: 'run_tests', confidence: 0.9, alternatives: ['debug', 'coverage'] }],
      'refactor': [{ intent: 'refactor', confidence: 0.8, alternatives: ['test', 'review'] }],
      'document': [{ intent: 'document', confidence: 0.9, alternatives: ['review', 'publish'] }],
      'deploy': [{ intent: 'deploy', confidence: 0.9, alternatives: ['test', 'rollback_plan'] }],
    };

    for (const [keyword, preds] of Object.entries(keywords)) {
      if (message.includes(keyword)) {
        patterns.push(...preds);
      }
    }

    return patterns;
  }

  private createPrediction(pattern: { intent: string; confidence: number; alternatives: string[] }): Prediction {
    return {
      id: this.generateId(),
      intent: pattern.intent,
      confidence: pattern.confidence,
      requiredContext: [],
      preloadedResources: [],
      alternativeIntents: pattern.alternatives,
      timestamp: new Date().toISOString(),
    };
  }

  private updateHistory(intent: string, outcome: 'correct' | 'incorrect' | 'partial'): void {
    if (!this.history.has(intent)) {
      this.history.set(intent, {
        intent,
        frequency: 0,
        successRate: 0,
        averageConfidence: 0,
        lastOccurrence: '',
        contextPatterns: [],
      });
    }

    const history = this.history.get(intent)!;
    const prevFreq = history.frequency;

    history.frequency++;
    history.lastOccurrence = new Date().toISOString();

    // Update success rate
    const successValue = outcome === 'correct' ? 1 : (outcome === 'partial' ? 0.5 : 0);
    history.successRate = (history.successRate * prevFreq + successValue) / history.frequency;
  }

  private generateId(): string {
    return `pred_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private load(): void {
    ensureDir(join(this.projectRoot, PREDICTION_DIR));

    if (existsSync(this.predictionsPath)) {
      try {
        const content = readFileSync(this.predictionsPath, 'utf-8');
        const data = JSON.parse(content);
        for (const pred of data.predictions || []) {
          this.predictions.set(pred.id, pred);
        }
      } catch (error) {
        console.error('Failed to load predictions:', error);
      }
    }

    if (existsSync(this.historyPath)) {
      try {
        const content = readFileSync(this.historyPath, 'utf-8');
        const data = JSON.parse(content);
        for (const hist of data.history || []) {
          this.history.set(hist.intent, hist);
        }
      } catch (error) {
        console.error('Failed to load prediction history:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, PREDICTION_DIR));

    writeFileSync(this.predictionsPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      predictions: [...this.predictions.values()].slice(-100),
    }, null, 2), 'utf-8');

    writeFileSync(this.historyPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      history: [...this.history.values()],
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, IntentPredictor> = new Map();

export function getIntentPredictor(projectRoot: string = process.cwd()): IntentPredictor {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new IntentPredictor(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { PREDICTION_DIR };