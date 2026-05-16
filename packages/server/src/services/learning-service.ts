// Learning Service - Auto Learn Configuration
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { LearningConfig, LearningStats, LearningSuggestion } from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

export class LearningService {
  private getProjectDir(projectName: string): string {
    return join(PROJECTS_DIR, projectName);
  }

  private getLearningConfigPath(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'learning-config.json');
  }

  private getLearningStatsPath(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'learning-stats.json');
  }

  private getPatternsPath(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'patterns.json');
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Get learning config
  getConfig(projectName: string): LearningConfig {
    const projectDir = this.getProjectDir(projectName);
    const configPath = this.getLearningConfigPath(projectDir);

    if (existsSync(configPath)) {
      try {
        return JSON.parse(readFileSync(configPath, 'utf-8')) as LearningConfig;
      } catch {}
    }

    // Default config
    return {
      enabled: true,
      triggers: {
        autoSync: true,
        syncIntervalMinutes: 30,
        syncOnConversationEnd: true,
        syncOnFeedbackReceived: true
      },
      sources: {
        conversations: true,
        feedback: true,
        codeChanges: false,
        taskCompletions: true,
        searchQueries: false
      },
      thresholds: {
        minConfidenceToLearn: 0.7,
        minOccurrencesBeforePattern: 3,
        failureThresholdToAlert: 5
      },
      retention: {
        learnedPatternsDays: 90,
        conversationHistoryDays: 30,
        feedbackHistoryDays: 60
      },
      feedbackLoop: {
        enabled: true,
        collectFrom: {
          explicitRatings: true,
          implicitSignals: true,
          conversationOutcome: true
        },
        learnFrom: {
          cacheHits: true,
          cacheMisses: true,
          fallbacks: true
        }
      }
    };
  }

  // Update learning config
  async updateConfig(projectName: string, config: Partial<LearningConfig>): Promise<LearningConfig> {
    const projectDir = this.getProjectDir(projectName);
    this.ensureDirectory(join(projectDir, '.kontextmind'));

    const current = this.getConfig(projectName);
    const updatedFeedbackLoop = current.feedbackLoop ? {
      ...current.feedbackLoop,
      ...(config.feedbackLoop || {}),
      collectFrom: { ...current.feedbackLoop.collectFrom, ...((config.feedbackLoop?.collectFrom) || {}) },
      learnFrom: { ...current.feedbackLoop.learnFrom, ...((config.feedbackLoop?.learnFrom) || {}) }
    } : {
      enabled: true,
      collectFrom: {
        explicitRatings: true,
        implicitSignals: true,
        conversationOutcome: true
      },
      learnFrom: {
        cacheHits: true,
        cacheMisses: true,
        fallbacks: true
      }
    };

    const updated: LearningConfig = {
      ...current,
      ...config,
      // Deep merge triggers and sources
      triggers: { ...current.triggers, ...(config.triggers || {}) },
      sources: { ...current.sources, ...(config.sources || {}) },
      thresholds: { ...current.thresholds, ...(config.thresholds || {}) },
      retention: { ...current.retention, ...(config.retention || {}) },
      feedbackLoop: updatedFeedbackLoop
    };

    writeFileSync(this.getLearningConfigPath(projectDir), JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  // Trigger manual sync
  async triggerSync(projectName: string): Promise<{ triggered: boolean; timestamp: string }> {
    const timestamp = new Date().toISOString();
    const projectDir = this.getProjectDir(projectName);

    // In a real implementation, this would trigger the learning sync process
    // For now, we just update the last sync time
    const stats = await this.getStats(projectName);
    stats.lastSync = timestamp;

    await this.saveStats(projectDir, stats);

    return { triggered: true, timestamp };
  }

  // Get learning stats
  async getStats(projectName: string): Promise<LearningStats> {
    const projectDir = this.getProjectDir(projectName);
    const statsPath = this.getLearningStatsPath(projectDir);

    if (existsSync(statsPath)) {
      try {
        return JSON.parse(readFileSync(statsPath, 'utf-8')) as LearningStats;
      } catch {}
    }

    // Default stats
    return {
      enabled: true,
      lastSync: new Date().toISOString(),
      patternsLearned: 0,
      outcomes: {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0
      },
      patterns: [],
      antiPatterns: [],
      suggestions: []
    };
  }

  // Get learned patterns
  getPatterns(projectName: string): Array<{
    pattern: string;
    frequency: number;
    successRate: number;
  }> {
    const projectDir = this.getProjectDir(projectName);
    const patternsPath = this.getPatternsPath(projectDir);

    if (!existsSync(patternsPath)) {
      return [];
    }

    try {
      const data = JSON.parse(readFileSync(patternsPath, 'utf-8'));
      return data.patterns || [];
    } catch {
      return [];
    }
  }

  // Record learning outcome
  async recordOutcome(
    projectName: string,
    outcome: 'success' | 'failure',
    context: {
      type: string;
      pattern?: string;
      confidence?: number;
    }
  ): Promise<void> {
    const projectDir = this.getProjectDir(projectName);
    const stats = await this.getStats(projectName);

    stats.outcomes.total++;
    if (outcome === 'success') {
      stats.outcomes.successful++;
    } else {
      stats.outcomes.failed++;
    }

    // Calculate success rate
    stats.outcomes.successRate = stats.outcomes.total > 0
      ? Math.round((stats.outcomes.successful / stats.outcomes.total) * 100)
      : 0;

    await this.saveStats(projectDir, stats);

    // Trigger auto-sync if enabled and threshold reached
    const config = this.getConfig(projectName);
    if (config.triggers.autoSync && outcome === 'failure') {
      const recentFailures = stats.outcomes.failed - (stats.outcomes.total - context.confidence!);
      if (recentFailures >= config.thresholds.failureThresholdToAlert) {
        // Would trigger sync here
        stats.lastSync = new Date().toISOString();
        await this.saveStats(projectDir, stats);
      }
    }
  }

  // Get suggestions
  async getSuggestions(
    projectName: string,
    category?: string,
    limit: number = 10
  ): Promise<LearningSuggestion[]> {
    const stats = await this.getStats(projectName);

    let suggestions = stats.suggestions;

    if (category) {
      suggestions = suggestions.filter(s => s.category === category);
    }

    // Sort by priority and confidence
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    return suggestions.slice(0, limit);
  }

  // Add suggestion (internal use)
  async addSuggestion(
    projectName: string,
    suggestion: LearningSuggestion
  ): Promise<void> {
    const projectDir = this.getProjectDir(projectName);
    const stats = await this.getStats(projectName);

    // Avoid duplicates
    const existing = stats.suggestions.findIndex(s =>
      s.title === suggestion.title && s.category === suggestion.category
    );

    if (existing >= 0) {
      stats.suggestions[existing] = suggestion;
    } else {
      stats.suggestions.push(suggestion);
    }

    await this.saveStats(projectDir, stats);
  }

  private async saveStats(projectDir: string, stats: LearningStats): Promise<void> {
    this.ensureDirectory(projectDir);
    writeFileSync(this.getLearningStatsPath(projectDir), JSON.stringify(stats, null, 2), 'utf-8');
  }
}

export const learningService = new LearningService();