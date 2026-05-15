/**
 * Outcome Tracker - Core learning mechanism
 *
 * Collects feedback from multiple automatic sources:
 * - Agent self-assessment
 * - MCP client signals
 * - Execution results (lint, test, compile)
 * - Implicit user behavior (continue vs rephrase)
 * - Pattern analysis
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const LEARNING_DIR = '.kontextmind/learning';

export interface FeedbackSources {
  selfAssessment?: SelfAssessmentResult;
  mcpSignals?: MCPSignals;
  executionResult?: ExecutionResult;
  implicitBehavior?: ImplicitBehaviorResult;
  patternMatch?: PatternMatchResult;
}

export interface SelfAssessmentResult {
  confidence: number;
  quality: number;
  issuesFound: string[];
  suggestions: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MCPSignals {
  toolName: string;
  success: boolean;
  attempts: number;
  duration: number;
  errorCode?: string;
  userAccepted?: boolean;
  userRejected?: boolean;
  rollbackRequested?: boolean;
}

export interface ExecutionResult {
  compileSuccess?: boolean;
  compileErrors?: string[];
  testPassed?: boolean;
  testResults?: { passed: number; failed: number; skipped: number };
  lintScore?: number;
  lintIssues?: LintIssue[];
  runtimeErrors?: string[];
  coverage?: number;
}

export interface LintIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule?: string;
}

export interface ImplicitBehaviorResult {
  userContinued: boolean;
  userRephrased: boolean;
  userAskedFollowup: boolean;
  userSwitchedTopic: boolean;
  responseTime?: number;
  sessionContinued: boolean;
}

export interface PatternMatchResult {
  hasSuccessPattern: boolean;
  hasFailurePattern: boolean;
  matchedPatterns: string[];
  confidence: number;
}

export interface RecordedOutcome {
  id: string;
  actionType: string;
  actionDescription: string;
  timestamp: string;
  success: boolean;
  compositeScore: number;

  // Source breakdowns
  selfAssessment?: SelfAssessmentResult;
  mcpSignals?: MCPSignals;
  executionResult?: ExecutionResult;
  implicitBehavior?: ImplicitBehaviorResult;
  patternMatch?: PatternMatchResult;

  // Context
  taskType?: string;
  filesInvolved?: string[];
  skillUsed?: string;
  sessionId?: string;

  // Learnings
  pattern?: string;
  suggestedImprovement?: string;
}

export interface OutcomePattern {
  type: string;
  pattern: string;
  successRate: number;
  frequency: number;
  lastOccurrence: string;
  relatedActions: string[];
  suggestion?: string;
}

export interface LearningStats {
  totalOutcomes: number;
  successRate: number;
  byActionType: Record<string, { count: number; successRate: number; avgQuality: number }>;
  byTaskType: Record<string, { count: number; successRate: number }>;
  patternsLearned: number;
  improvementsSuggested: number;
  averageConfidence: number;
}

export interface Improvement {
  id: string;
  category: 'skill' | 'pattern' | 'approach' | 'documentation';
  description: string;
  evidence: string[];
  suggestedFor: string[];
  confidence: number;
  createdAt: string;
}

/**
 * OutcomeTracker - Records and learns from action outcomes
 */
export class OutcomeTracker {
  private outcomes: Map<string, RecordedOutcome> = new Map();
  private patterns: Map<string, OutcomePattern> = new Map();
  private improvements: Map<string, Improvement> = new Map();
  private projectRoot: string;
  private outcomesPath: string;
  private patternsPath: string;
  private improvementsPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.outcomesPath = join(projectRoot, LEARNING_DIR, 'outcomes.json');
    this.patternsPath = join(projectRoot, LEARNING_DIR, 'patterns.json');
    this.improvementsPath = join(projectRoot, LEARNING_DIR, 'improvements.json');
    this.load();
  }

  // ============ Core Recording ============

  /**
   * Record outcome from multiple sources
   */
  record(
    actionType: string,
    actionDescription: string,
    sources: FeedbackSources,
    context?: {
      taskType?: string;
      filesInvolved?: string[];
      skillUsed?: string;
      sessionId?: string;
    }
  ): RecordedOutcome {
    // Calculate composite score
    const compositeScore = this.calculateCompositeScore(sources);

    // Determine success
    const success = this.determineSuccess(sources);

    const outcome: RecordedOutcome = {
      id: this.generateId(),
      actionType,
      actionDescription,
      timestamp: new Date().toISOString(),
      success,
      compositeScore,
      selfAssessment: sources.selfAssessment,
      mcpSignals: sources.mcpSignals,
      executionResult: sources.executionResult,
      implicitBehavior: sources.implicitBehavior,
      patternMatch: sources.patternMatch,
      taskType: context?.taskType,
      filesInvolved: context?.filesInvolved,
      skillUsed: context?.skillUsed,
      sessionId: context?.sessionId,
    };

    this.outcomes.set(outcome.id, outcome);
    this.learnFromOutcome(outcome);
    this.save();

    return outcome;
  }

  /**
   * Record from MCP signal only
   */
  recordFromMCPSignal(signal: MCPSignals): RecordedOutcome {
    return this.record(
      signal.toolName,
      `Tool: ${signal.toolName}`,
      { mcpSignals: signal },
      { taskType: 'tool_execution' }
    );
  }

  /**
   * Record from execution result
   */
  recordFromExecution(
    actionType: string,
    description: string,
    result: ExecutionResult,
    context?: { filesInvolved?: string[]; taskType?: string }
  ): RecordedOutcome {
    return this.record(
      actionType,
      description,
      { executionResult: result },
      context
    );
  }

  /**
   * Record from implicit behavior
   */
  recordFromBehavior(
    actionType: string,
    description: string,
    behavior: ImplicitBehaviorResult,
    context?: { sessionId?: string }
  ): RecordedOutcome {
    return this.record(
      actionType,
      description,
      { implicitBehavior: behavior },
      context
    );
  }

  /**
   * Update existing outcome with additional feedback
   */
  updateOutcome(outcomeId: string, additionalFeedback: Partial<FeedbackSources>): void {
    const outcome = this.outcomes.get(outcomeId);
    if (!outcome) return;

    if (additionalFeedback.selfAssessment) {
      outcome.selfAssessment = additionalFeedback.selfAssessment;
    }
    if (additionalFeedback.mcpSignals) {
      outcome.mcpSignals = additionalFeedback.mcpSignals;
    }
    if (additionalFeedback.executionResult) {
      outcome.executionResult = additionalFeedback.executionResult;
    }
    if (additionalFeedback.implicitBehavior) {
      outcome.implicitBehavior = additionalFeedback.implicitBehavior;
    }

    // Recalculate composite score
    outcome.compositeScore = this.calculateCompositeScore({
      selfAssessment: outcome.selfAssessment,
      mcpSignals: outcome.mcpSignals,
      executionResult: outcome.executionResult,
      implicitBehavior: outcome.implicitBehavior,
    });
    outcome.success = this.determineSuccess({
      selfAssessment: outcome.selfAssessment,
      mcpSignals: outcome.mcpSignals,
      executionResult: outcome.executionResult,
      implicitBehavior: outcome.implicitBehavior,
    });

    this.save();
  }

  // ============ Pattern Learning ============

  /**
   * Get patterns for action type
   */
  getPatterns(actionType: string): OutcomePattern[] {
    const patterns: OutcomePattern[] = [];

    for (const pattern of this.patterns.values()) {
      if (pattern.type === actionType || pattern.relatedActions.includes(actionType)) {
        patterns.push(pattern);
      }
    }

    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Get successful patterns for task
   */
  getSuccessPatterns(taskType: string): string[] {
    const patterns: string[] = [];

    for (const outcome of this.outcomes.values()) {
      if (outcome.success && outcome.taskType === taskType) {
        const successPatterns = this.identifyPatterns(outcome);
        patterns.push(...successPatterns);
      }
    }

    return [...new Set(patterns)];
  }

  /**
   * Get failure patterns to avoid
   */
  getFailurePatterns(taskType: string): string[] {
    const patterns: string[] = [];

    for (const outcome of this.outcomes.values()) {
      if (!outcome.success && outcome.taskType === taskType) {
        patterns.push(...this.identifyPatterns(outcome));
      }
    }

    return [...new Set(patterns)];
  }

  // ============ Improvements ============

  /**
   * Get suggested improvements
   */
  getSuggestions(options?: { category?: Improvement['category']; limit?: number }): Improvement[] {
    let improvements = [...this.improvements.values()];

    if (options?.category) {
      improvements = improvements.filter(i => i.category === options.category);
    }

    improvements.sort((a, b) => b.confidence - a.confidence);

    if (options?.limit) {
      improvements = improvements.slice(0, options.limit);
    }

    return improvements;
  }

  /**
   * Generate improvement suggestions based on patterns
   */
  generateSuggestions(): Improvement[] {
    const suggestions: Improvement[] = [];

    // Analyze failure patterns
    const failuresByType: Record<string, RecordedOutcome[]> = {};
    for (const outcome of this.outcomes.values()) {
      if (!outcome.success) {
        if (!failuresByType[outcome.actionType]) {
          failuresByType[outcome.actionType] = [];
        }
        failuresByType[outcome.actionType].push(outcome);
      }
    }

    // Generate suggestions from frequent failures
    for (const [type, failures] of Object.entries(failuresByType)) {
      if (failures.length >= 3) {
        const commonIssues = this.aggregateIssues(failures);

        if (commonIssues.length > 0) {
          const improvement: Improvement = {
            id: this.generateId(),
            category: 'pattern',
            description: `Improve ${type} handling for: ${commonIssues.join(', ')}`,
            evidence: failures.slice(0, 5).map(f => f.actionDescription),
            suggestedFor: [type],
            confidence: Math.min(0.9, failures.length * 0.1),
            createdAt: new Date().toISOString(),
          };

          this.improvements.set(improvement.id, improvement);
          suggestions.push(improvement);
        }
      }
    }

    this.save();
    return suggestions;
  }

  /**
   * Mark improvement as applied
   */
  applyImprovement(improvementId: string): void {
    const improvement = this.improvements.get(improvementId);
    if (improvement) {
      improvement.confidence = Math.min(1, improvement.confidence + 0.1);
    }
    this.save();
  }

  // ============ Statistics ============

  /**
   * Get learning statistics
   */
  getStats(): LearningStats {
    const outcomes = [...this.outcomes.values()];
    const total = outcomes.length;

    if (total === 0) {
      return {
        totalOutcomes: 0,
        successRate: 0.8,
        byActionType: {},
        byTaskType: {},
        patternsLearned: this.patterns.size,
        improvementsSuggested: this.improvements.size,
        averageConfidence: 0.7,
      };
    }

    const successful = outcomes.filter(o => o.success).length;

    // By action type
    const byActionType: Record<string, { count: number; successRate: number; avgQuality: number }> = {};
    for (const outcome of outcomes) {
      if (!byActionType[outcome.actionType]) {
        byActionType[outcome.actionType] = { count: 0, successRate: 0, avgQuality: 0 };
      }
      byActionType[outcome.actionType].count++;
    }
    for (const [type, stats] of Object.entries(byActionType)) {
      const typeOutcomes = outcomes.filter(o => o.actionType === type);
      const typeSuccess = typeOutcomes.filter(o => o.success).length;
      const totalQuality = typeOutcomes.reduce((sum, o) => sum + (o.compositeScore || 0), 0);
      stats.successRate = typeSuccess / typeOutcomes.length;
      stats.avgQuality = totalQuality / typeOutcomes.length;
    }

    // By task type
    const byTaskType: Record<string, { count: number; successRate: number }> = {};
    for (const outcome of outcomes) {
      if (outcome.taskType) {
        if (!byTaskType[outcome.taskType]) {
          byTaskType[outcome.taskType] = { count: 0, successRate: 0 };
        }
        byTaskType[outcome.taskType].count++;
      }
    }
    for (const [type, stats] of Object.entries(byTaskType)) {
      const typeOutcomes = outcomes.filter(o => o.taskType === type);
      const typeSuccess = typeOutcomes.filter(o => o.success).length;
      stats.successRate = typeSuccess / typeOutcomes.length;
    }

    return {
      totalOutcomes: total,
      successRate: successful / total,
      byActionType,
      byTaskType,
      patternsLearned: this.patterns.size,
      improvementsSuggested: this.improvements.size,
      averageConfidence: outcomes.reduce((sum, o) => sum + (o.selfAssessment?.confidence || 0.5), 0) / total,
    };
  }

  /**
   * Get recent outcomes
   */
  getRecentOutcomes(limit: number = 20): RecordedOutcome[] {
    return [...this.outcomes.values()]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get outcomes by session
   */
  getSessionOutcomes(sessionId: string): RecordedOutcome[] {
    return [...this.outcomes.values()]
      .filter(o => o.sessionId === sessionId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // ============ Analysis ============

  /**
   * Analyze success factors
   */
  analyzeSuccessFactors(taskType: string): {
    factors: string[];
    confidence: number;
  } {
    const outcomes = [...this.outcomes.values()].filter(
      o => o.taskType === taskType && o.success
    );

    if (outcomes.length < 3) {
      return { factors: [], confidence: 0.3 };
    }

    // Analyze common patterns in successful outcomes
    const factors: string[] = [];

    for (const outcome of outcomes) {
      if (outcome.selfAssessment?.confidence && outcome.selfAssessment.confidence > 0.7) {
        factors.push('high self-confidence');
      }
      if (outcome.executionResult?.testPassed) {
        factors.push('tests passing');
      }
      if (outcome.implicitBehavior?.userContinued) {
        factors.push('user continued');
      }
    }

    // Count frequency
    const factorCounts: Record<string, number> = {};
    for (const factor of factors) {
      factorCounts[factor] = (factorCounts[factor] || 0) + 1;
    }

    const significantFactors = Object.entries(factorCounts)
      .filter(([_, count]) => count >= outcomes.length * 0.5)
      .map(([factor]) => factor);

    return {
      factors: significantFactors,
      confidence: Math.min(0.9, outcomes.length * 0.1),
    };
  }

  /**
   * Predict outcome based on patterns
   */
  predictOutcome(
    actionType: string,
    context?: { taskType?: string; filesInvolved?: string[] }
  ): { predicted: boolean; confidence: number; reason: string } {
    const patterns = this.getPatterns(actionType);

    if (patterns.length === 0) {
      return { predicted: true, confidence: 0.5, reason: 'No patterns found, default to success' };
    }

    const avgSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;

    if (avgSuccessRate > 0.8) {
      return {
        predicted: true,
        confidence: avgSuccessRate,
        reason: `High success pattern (${Math.round(avgSuccessRate * 100)}%) for ${actionType}`,
      };
    } else if (avgSuccessRate < 0.5) {
      return {
        predicted: false,
        confidence: 1 - avgSuccessRate,
        reason: `Low success pattern (${Math.round(avgSuccessRate * 100)}%) for ${actionType}`,
      };
    }

    return {
      predicted: avgSuccessRate > 0.5,
      confidence: avgSuccessRate,
      reason: `Average pattern (${Math.round(avgSuccessRate * 100)}%) for ${actionType}`,
    };
  }

  // ============ Persistence ============

  /**
   * Clear all data
   */
  clear(): void {
    this.outcomes.clear();
    this.patterns.clear();
    this.improvements.clear();
    this.save();
  }

  /**
   * Export outcomes for training
   */
  exportForTraining(filter?: { taskType?: string; minConfidence?: number }): RecordedOutcome[] {
    let outcomes = [...this.outcomes.values()];

    if (filter) {
      if (filter.taskType) {
        outcomes = outcomes.filter(o => o.taskType === filter.taskType);
      }
      if (filter.minConfidence !== undefined) {
        outcomes = outcomes.filter(o => o.compositeScore >= filter.minConfidence!);
      }
    }

    return outcomes;
  }

  // ============ Private Methods ============

  private calculateCompositeScore(sources: FeedbackSources): number {
    let score = 0;
    let weightSum = 0;

    // Self-assessment (weight: 0.3)
    if (sources.selfAssessment) {
      score += sources.selfAssessment.confidence * 0.3;
      weightSum += 0.3;
    }

    // MCP signals (weight: 0.3)
    if (sources.mcpSignals) {
      const mcpScore = sources.mcpSignals.success
        ? (1 - Math.min(sources.mcpSignals.attempts / 5, 1) * 0.3)
        : 0.3;
      score += mcpScore * 0.3;
      weightSum += 0.3;
    }

    // Execution result (weight: 0.25)
    if (sources.executionResult) {
      let execScore = 0.5;
      if (sources.executionResult.compileSuccess !== undefined) {
        execScore = sources.executionResult.compileSuccess ? 0.9 : 0.3;
      }
      if (sources.executionResult.testPassed !== undefined) {
        execScore = sources.executionResult.testPassed ? execScore + 0.1 : execScore - 0.1;
      }
      score += execScore * 0.25;
      weightSum += 0.25;
    }

    // Implicit behavior (weight: 0.15)
    if (sources.implicitBehavior) {
      let behaviorScore = 0.5;
      if (sources.implicitBehavior.userContinued && !sources.implicitBehavior.userRephrased) {
        behaviorScore = 0.9;
      } else if (sources.implicitBehavior.userRephrased) {
        behaviorScore = 0.3;
      }
      score += behaviorScore * 0.15;
      weightSum += 0.15;
    }

    return weightSum > 0 ? score / weightSum : 0.5;
  }

  private determineSuccess(sources: FeedbackSources): boolean {
    // Success if majority of sources indicate success
    let successIndicators = 0;
    let totalIndicators = 0;

    if (sources.selfAssessment) {
      totalIndicators++;
      if (sources.selfAssessment.confidence >= 0.6) successIndicators++;
    }

    if (sources.mcpSignals) {
      totalIndicators++;
      if (sources.mcpSignals.success) successIndicators++;
    }

    if (sources.executionResult) {
      totalIndicators++;
      if (sources.executionResult.compileSuccess !== false &&
          sources.executionResult.testPassed !== false) {
        successIndicators++;
      }
    }

    if (sources.implicitBehavior) {
      totalIndicators++;
      if (sources.implicitBehavior.userContinued && !sources.implicitBehavior.userRephrased) {
        successIndicators++;
      }
    }

    return totalIndicators > 0 && successIndicators >= totalIndicators / 2;
  }

  private learnFromOutcome(outcome: RecordedOutcome): void {
    // Extract and store patterns
    const patterns = this.identifyPatterns(outcome);

    for (const pattern of patterns) {
      if (!this.patterns.has(pattern)) {
        this.patterns.set(pattern, {
          type: outcome.actionType,
          pattern,
          successRate: outcome.success ? 1 : 0,
          frequency: 1,
          lastOccurrence: outcome.timestamp,
          relatedActions: [outcome.actionType],
        });
      } else {
        const existing = this.patterns.get(pattern)!;
        const newRate = (existing.successRate * existing.frequency + (outcome.success ? 1 : 0)) /
                        (existing.frequency + 1);
        existing.successRate = newRate;
        existing.frequency++;
        existing.lastOccurrence = outcome.timestamp;
      }
    }
  }

  private identifyPatterns(outcome: RecordedOutcome): string[] {
    const patterns: string[] = [];

    // Pattern from files
    if (outcome.filesInvolved) {
      patterns.push(...outcome.filesInvolved.map(f => `file:${f}`));
    }

    // Pattern from task type
    if (outcome.taskType) {
      patterns.push(`task:${outcome.taskType}`);
    }

    // Pattern from skill
    if (outcome.skillUsed) {
      patterns.push(`skill:${outcome.skillUsed}`);
    }

    // Pattern from execution errors
    if (outcome.executionResult?.lintIssues) {
      for (const issue of outcome.executionResult.lintIssues.slice(0, 3)) {
        if (issue.rule) patterns.push(`lint:${issue.rule}`);
      }
    }

    return patterns;
  }

  private aggregateIssues(failures: RecordedOutcome[]): string[] {
    const issueCounts: Record<string, number> = {};

    for (const failure of failures) {
      if (failure.executionResult?.lintIssues) {
        for (const issue of failure.executionResult.lintIssues) {
          const key = issue.message.slice(0, 50);
          issueCounts[key] = (issueCounts[key] || 0) + 1;
        }
      }
      if (failure.selfAssessment?.issuesFound) {
        for (const issue of failure.selfAssessment.issuesFound) {
          const key = issue.slice(0, 50);
          issueCounts[key] = (issueCounts[key] || 0) + 1;
        }
      }
    }

    return Object.entries(issueCounts)
      .filter(([_, count]) => count >= 2)
      .sort(([a], [b]) => issueCounts[b] - issueCounts[a])
      .slice(0, 5)
      .map(([issue]) => issue);
  }

  private generateId(): string {
    return `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private load(): void {
    ensureDir(join(this.projectRoot, LEARNING_DIR));

    // Load outcomes
    if (existsSync(this.outcomesPath)) {
      try {
        const content = readFileSync(this.outcomesPath, 'utf-8');
        const data = JSON.parse(content);
        for (const outcome of data.outcomes || []) {
          this.outcomes.set(outcome.id, outcome);
        }
      } catch (error) {
        console.error('Failed to load outcomes:', error);
      }
    }

    // Load patterns
    if (existsSync(this.patternsPath)) {
      try {
        const content = readFileSync(this.patternsPath, 'utf-8');
        const data = JSON.parse(content);
        for (const pattern of data.patterns || []) {
          this.patterns.set(pattern.pattern, pattern);
        }
      } catch (error) {
        console.error('Failed to load patterns:', error);
      }
    }

    // Load improvements
    if (existsSync(this.improvementsPath)) {
      try {
        const content = readFileSync(this.improvementsPath, 'utf-8');
        const data = JSON.parse(content);
        for (const improvement of data.improvements || []) {
          this.improvements.set(improvement.id, improvement);
        }
      } catch (error) {
        console.error('Failed to load improvements:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, LEARNING_DIR));

    writeFileSync(this.outcomesPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      outcomes: [...this.outcomes.values()].slice(-500), // Keep last 500
    }, null, 2), 'utf-8');

    writeFileSync(this.patternsPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      patterns: [...this.patterns.values()],
    }, null, 2), 'utf-8');

    writeFileSync(this.improvementsPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      improvements: [...this.improvements.values()],
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, OutcomeTracker> = new Map();

export function getOutcomeTracker(projectRoot: string = process.cwd()): OutcomeTracker {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new OutcomeTracker(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { LEARNING_DIR };