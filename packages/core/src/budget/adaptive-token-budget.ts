/**
 * Adaptive Token Budget Manager
 *
 * Dynamically allocates context window based on task requirements.
 * Balances context quality vs token efficiency.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const BUDGET_DIR = '.kontextmind/budget';

export interface BudgetAllocation {
  category: 'system' | 'prompt' | 'context' | 'history' | 'reserve';
  tokens: number;
  priority: number;
  used: number;
}

export interface TaskProfile {
  type: 'analysis' | 'implementation' | 'debugging' | 'review' | 'refactoring' | 'general';
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  domain: string[];
}

export interface BudgetConfig {
  maxTokens: number;
  allocations: Record<string, BudgetAllocation>;
  overhead: number;
}

export interface BudgetStats {
  totalBudget: number;
  usedTokens: number;
  utilizationPercent: number;
  categoryBreakdown: Record<string, number>;
  efficiency: number;
}

export interface AdaptiveAllocation {
  recommended: number;
  minimum: number;
  maximum: number;
  reason: string;
}

/**
 * AdaptiveTokenBudget - Manages token allocation dynamically
 */
export class AdaptiveTokenBudget {
  private projectRoot: string;
  private budgetPath: string;
  private config: BudgetConfig;
  private usageHistory: Array<{ timestamp: string; task: string; tokens: number; success: boolean }> = [];
  private taskProfiles: Map<string, TaskProfile> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.budgetPath = join(projectRoot, BUDGET_DIR, 'config.json');
    this.config = this.loadConfig();
    this.load();
  }

  /**
   * Calculate optimal budget allocation for a task
   */
  calculateAllocation(taskProfile: TaskProfile): Record<string, AdaptiveAllocation> {
    const { maxTokens, overhead } = this.config;
    const available = maxTokens - overhead;

    // Base percentages by task type
    const baseAllocations: Record<string, Record<string, number>> = {
      analysis: { context: 0.45, history: 0.30, prompt: 0.20, reserve: 0.05 },
      implementation: { context: 0.35, history: 0.35, prompt: 0.25, reserve: 0.05 },
      debugging: { context: 0.50, history: 0.25, prompt: 0.20, reserve: 0.05 },
      review: { context: 0.40, history: 0.30, prompt: 0.25, reserve: 0.05 },
      refactoring: { context: 0.35, history: 0.40, prompt: 0.20, reserve: 0.05 },
      general: { context: 0.35, history: 0.35, prompt: 0.25, reserve: 0.05 },
    };

    // Complexity multipliers
    const complexityMultipliers: Record<string, number> = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.2,
      'very-high': 1.4,
    };

    // Urgency multipliers
    const urgencyMultipliers: Record<string, number> = {
      'low': 0.9,
      'normal': 1.0,
      'high': 1.1,
      'critical': 1.2,
    };

    const base = baseAllocations[taskProfile.type] || baseAllocations.general;
    const complexityMult = complexityMultipliers[taskProfile.complexity];
    const urgencyMult = urgencyMultipliers[taskProfile.urgency];

    const result: Record<string, AdaptiveAllocation> = {};
    const totalMultiplier = complexityMult * urgencyMult;

    for (const [category, percent] of Object.entries(base)) {
      const rawTokens = available * percent * totalMultiplier;
      const minTokens = Math.floor(rawTokens * 0.6);
      const maxTokens = Math.floor(rawTokens * 1.3);

      result[category] = {
        recommended: Math.min(Math.floor(rawTokens), maxTokens),
        minimum: minTokens,
        maximum: maxTokens,
        reason: this.getAllocationReason(category, taskProfile),
      };
    }

    return result;
  }

  /**
   * Check if current allocation is sufficient for task
   */
  validateAllocation(taskProfile: TaskProfile, proposedTokens: number): {
    sufficient: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const allocation = this.calculateAllocation(taskProfile);
    const totalRecommended = Object.values(allocation).reduce((sum, a) => sum + a.recommended, 0);
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (proposedTokens < totalRecommended * 0.8) {
      warnings.push(`Proposed budget (${proposedTokens}) is below recommended (${totalRecommended})`);
      suggestions.push('Consider increasing budget or simplifying scope');
    }

    const contextAlloc = allocation['context'];
    if (contextAlloc && proposedTokens * 0.4 < contextAlloc.minimum) {
      warnings.push('Context allocation may be insufficient for task complexity');
      suggestions.push('Prioritize essential context over history');
    }

    return {
      sufficient: proposedTokens >= totalRecommended * 0.7,
      warnings,
      suggestions,
    };
  }

  /**
   * Record actual token usage for learning
   */
  recordUsage(taskType: string, tokens: number, success: boolean): void {
    this.usageHistory.push({
      timestamp: new Date().toISOString(),
      task: taskType,
      tokens,
      success,
    });

    // Keep last 100 entries
    if (this.usageHistory.length > 100) {
      this.usageHistory = this.usageHistory.slice(-100);
    }

    this.save();
  }

  /**
   * Get budget statistics
   */
  getStats(): BudgetStats {
    const recentUsage = this.usageHistory.slice(-20);
    const totalTokens = recentUsage.reduce((sum, u) => sum + u.tokens, 0);
    const successCount = recentUsage.filter(u => u.success).length;
    const efficiency = recentUsage.length > 0 ? successCount / recentUsage.length : 0;

    const categoryBreakdown: Record<string, number> = {};
    for (const usage of recentUsage) {
      categoryBreakdown[usage.task] = (categoryBreakdown[usage.task] || 0) + usage.tokens;
    }

    return {
      totalBudget: this.config.maxTokens,
      usedTokens: totalTokens,
      utilizationPercent: recentUsage.length > 0 ? (totalTokens / recentUsage.length) / this.config.maxTokens * 100 : 0,
      categoryBreakdown,
      efficiency,
    };
  }

  /**
   * Adjust budget based on performance
   */
  adjustBudget(taskType: string): number {
    const relevantUsage = this.usageHistory.filter(u => u.task === taskType);
    if (relevantUsage.length < 3) return 0;

    const avgTokens = relevantUsage.reduce((sum, u) => sum + u.tokens, 0) / relevantUsage.length;
    const successRate = relevantUsage.filter(u => u.success).length / relevantUsage.length;

    // If success rate is low and tokens are high, reduce budget
    if (successRate < 0.5 && avgTokens > this.config.maxTokens * 0.9) {
      return -Math.floor(this.config.maxTokens * 0.05);
    }

    // If success rate is high and we're under budget, increase slightly
    if (successRate > 0.8 && avgTokens < this.config.maxTokens * 0.7) {
      return Math.floor(this.config.maxTokens * 0.05);
    }

    return 0;
  }

  /**
   * Get recommended context truncation
   */
  getTruncationRecommendation(taskType: string, availableTokens: number): {
    truncateAt: number;
    preservePatterns: string[];
    reason: string;
  } {
    const allocation = this.calculateAllocation({
      type: taskType as TaskProfile['type'],
      complexity: 'medium',
      urgency: 'normal',
      domain: [],
    });

    const contextBudget = allocation['context']?.recommended || availableTokens * 0.4;

    return {
      truncateAt: Math.floor(contextBudget),
      preservePatterns: this.getPreservePatterns(taskType),
      reason: `Optimized for ${taskType} tasks with ${Math.round(contextBudget / availableTokens * 100)}% context budget`,
    };
  }

  /**
   * Update max tokens setting
   */
  setMaxTokens(maxTokens: number): void {
    this.config.maxTokens = Math.max(1000, Math.min(maxTokens, 1000000));
    this.save();
  }

  /**
   * Get current configuration
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  /**
   * Get task profile by type
   */
  getTaskProfile(taskType: string): TaskProfile | null {
    return this.taskProfiles.get(taskType) || null;
  }

  /**
   * Save task profile for future reference
   */
  saveTaskProfile(taskType: string, profile: TaskProfile): void {
    this.taskProfiles.set(taskType, profile);
    this.save();
  }

  // ============ Private Methods ============

  private getAllocationReason(category: string, profile: TaskProfile): string {
    const reasons: Record<string, Record<string, string>> = {
      context: {
        analysis: 'Analysis needs detailed context for understanding patterns',
        implementation: 'Implementation requires reference to related code',
        debugging: 'Debugging needs comprehensive error context',
        review: 'Code review benefits from full context',
        refactoring: 'Refactoring needs understanding of dependencies',
        general: 'General tasks need balanced context',
      },
      history: {
        analysis: 'History helps track decision evolution',
        implementation: 'Implementation history shows approach changes',
        debugging: 'Debugging history shows attempted solutions',
        review: 'Review history shows previous findings',
        refactoring: 'Refactoring history shows architectural decisions',
        general: 'General tasks need conversation history',
      },
      prompt: {
        analysis: 'Analysis prompt needs room for detailed instructions',
        implementation: 'Implementation needs clear specifications',
        debugging: 'Debugging needs clear problem description',
        review: 'Review needs criteria and standards',
        refactoring: 'Refactoring needs clear goals',
        general: 'General tasks need clear instructions',
      },
    };

    return reasons[category]?.[profile.type] || 'Balanced allocation for task type';
  }

  private getPreservePatterns(taskType: string): string[] {
    const patterns: Record<string, string[]> = {
      analysis: ['function definitions', 'type declarations', 'imports'],
      implementation: ['function signatures', 'error handling', 'tests'],
      debugging: ['error messages', 'stack traces', 'variable states'],
      review: ['function signatures', 'comments', 'test coverage'],
      refactoring: ['public APIs', 'interfaces', 'dependencies'],
      general: ['key functions', 'important comments'],
    };

    return patterns[taskType] || patterns.general;
  }

  private getDefaultConfig(): BudgetConfig {
    return {
      maxTokens: 200000,
      overhead: 2000,
      allocations: {
        system: { category: 'system', tokens: 1000, priority: 1, used: 0 },
        prompt: { category: 'prompt', tokens: 5000, priority: 2, used: 0 },
        context: { category: 'context', tokens: 80000, priority: 3, used: 0 },
        history: { category: 'history', tokens: 70000, priority: 4, used: 0 },
        reserve: { category: 'reserve', tokens: 10000, priority: 5, used: 0 },
      },
    };
  }

  private loadConfig(): BudgetConfig {
    return this.getDefaultConfig();
  }

  private load(): void {
    ensureDir(join(this.projectRoot, BUDGET_DIR));

    if (existsSync(this.budgetPath)) {
      try {
        const content = readFileSync(this.budgetPath, 'utf-8');
        const data = JSON.parse(content);
        this.usageHistory = data.usageHistory || [];
        this.taskProfiles = new Map(Object.entries(data.taskProfiles || {}));
      } catch (error) {
        console.error('Failed to load budget data:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, BUDGET_DIR));

    writeFileSync(this.budgetPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      config: this.config,
      usageHistory: this.usageHistory,
      taskProfiles: Object.fromEntries(this.taskProfiles),
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, AdaptiveTokenBudget> = new Map();

export function getAdaptiveTokenBudget(projectRoot: string = process.cwd()): AdaptiveTokenBudget {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new AdaptiveTokenBudget(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { BUDGET_DIR };