/**
 * Self-Awareness Engine
 *
 * Agent understands its own capabilities and state.
 * Tracks strengths, weaknesses, attempts, and anti-patterns.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const AWARENESS_DIR = '.kontextmind/awareness';

export interface AgentState {
  currentTask: TaskContext | null;
  recentActions: ActionRecord[];
  activeGoals: Goal[];
  blockedBy: Blocker[];
  energyLevel: number;  // Confidence in current approach (0-1)
  mode: 'exploring' | 'implementing' | 'debugging' | 'reviewing' | 'idle';
  sessionStartTime: string;
  totalActionsThisSession: number;
}

export interface TaskContext {
  id: string;
  type: TaskType;
  description: string;
  startedAt: string;
  progress: number;  // 0-1
  complexity: 'low' | 'medium' | 'high' | 'critical';
  relatedSkills: string[];
  successProbability: number;  // Self-assessed
}

export type TaskType =
  | 'code_write'
  | 'code_edit'
  | 'code_refactor'
  | 'code_review'
  | 'debug'
  | 'test'
  | 'documentation'
  | 'architecture'
  | 'research'
  | 'planning';

export interface ActionRecord {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  success: boolean;
  confidenceBefore: number;
  confidenceAfter: number;
  duration: number;  // ms
  outcome: ActionOutcome;
  relatedFiles: string[];
  skillUsed?: string;
}

export interface ActionOutcome {
  completed: boolean;
  quality: number;  // 0-1
  errors: string[];
  warnings: string[];
  sideEffects: string[];
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  createdAt: string;
  deadline?: string;
  dependencies: string[];
}

export interface Blocker {
  id: string;
  description: string;
  type: 'waiting' | 'stuck' | 'unclear' | 'external';
  since: string;
  suggestedResolution?: string;
}

export interface CapabilityProfile {
  strengths: string[];
  weakAreas: string[];
  recentImprovements: string[];
  preferredApproaches: string[];
  successRates: Record<string, number>;
  averageConfidence: number;
  totalActions: number;
  totalSessions: number;
}

export interface Attempt {
  id: string;
  taskType: string;
  taskDescription: string;
  approach: string;
  success: boolean;
  timestamp: string;
  duration: number;
  notes: string;
}

export interface AntiPattern {
  pattern: string;
  description: string;
  frequency: number;
  lastOccurrence: string;
  avoidedCount: number;
  examples: string[];
}

export interface SelfAssessment {
  confidence: number;
  quality: number;
  potentialIssues: string[];
  suggestedApproaches: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * SelfAwareness - Agent self-understanding system
 */
export class SelfAwareness {
  private state: AgentState;
  private capabilities: CapabilityProfile;
  private attempts: Map<string, Attempt[]> = new Map();
  private antiPatterns: Map<string, AntiPattern> = new Map();
  private projectRoot: string;
  private statePath: string;
  private capabilitiesPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, AWARENESS_DIR, 'state.json');
    this.capabilitiesPath = join(projectRoot, AWARENESS_DIR, 'capabilities.json');

    this.state = this.createInitialState();
    this.capabilities = this.createInitialCapabilities();

    this.load();
  }

  // ============ State Management ============

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Update current task
   */
  setCurrentTask(task: TaskContext | null): void {
    this.state.currentTask = task;
    if (task) {
      this.state.mode = this.inferMode(task.type);
      this.state.energyLevel = task.successProbability;
    }
    this.saveState();
  }

  /**
   * Update mode
   */
  setMode(mode: AgentState['mode']): void {
    this.state.mode = mode;
    this.saveState();
  }

  /**
   * Add goal
   */
  addGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Goal {
    const fullGoal: Goal = {
      ...goal,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };
    this.state.activeGoals.push(fullGoal);
    this.saveState();
    return fullGoal;
  }

  /**
   * Remove goal
   */
  removeGoal(goalId: string): void {
    this.state.activeGoals = this.state.activeGoals.filter(g => g.id !== goalId);
    this.saveState();
  }

  /**
   * Add blocker
   */
  addBlocker(blocker: Omit<Blocker, 'id' | 'since'>): Blocker {
    const fullBlocker: Blocker = {
      ...blocker,
      id: this.generateId(),
      since: new Date().toISOString(),
    };
    this.state.blockedBy.push(fullBlocker);
    this.saveState();
    return fullBlocker;
  }

  /**
   * Resolve blocker
   */
  resolveBlocker(blockerId: string): void {
    this.state.blockedBy = this.state.blockedBy.filter(b => b.id !== blockerId);
    this.saveState();
  }

  /**
   * Update energy level
   */
  updateEnergyLevel(level: number): void {
    this.state.energyLevel = Math.max(0, Math.min(1, level));
    this.saveState();
  }

  // ============ Action Recording ============

  /**
   * Record an action
   */
  recordAction(
    actionType: string,
    description: string,
    relatedFiles: string[] = [],
    skillUsed?: string
  ): ActionRecord {
    const action: ActionRecord = {
      id: this.generateId(),
      type: actionType,
      description,
      timestamp: new Date().toISOString(),
      success: false,  // Will be updated
      confidenceBefore: this.state.energyLevel,
      confidenceAfter: this.state.energyLevel,
      duration: 0,
      outcome: {
        completed: false,
        quality: 0,
        errors: [],
        warnings: [],
        sideEffects: [],
      },
      relatedFiles,
      skillUsed,
    };

    this.state.recentActions.unshift(action);
    this.state.totalActionsThisSession++;

    // Keep only last 50 actions in memory
    if (this.state.recentActions.length > 50) {
      this.state.recentActions = this.state.recentActions.slice(0, 50);
    }

    this.saveState();
    return action;
  }

  /**
   * Complete action with outcome
   */
  completeAction(
    actionId: string,
    outcome: {
      success: boolean;
      quality?: number;
      errors?: string[];
      warnings?: string[];
      sideEffects?: string[];
      duration?: number;
    }
  ): void {
    const action = this.state.recentActions.find(a => a.id === actionId);
    if (!action) return;

    action.success = outcome.success;
    action.confidenceAfter = outcome.success ? Math.min(1, action.confidenceBefore + 0.1) : Math.max(0, action.confidenceBefore - 0.1);
    action.outcome = {
      completed: outcome.success,
      quality: outcome.quality ?? (outcome.success ? 0.8 : 0.3),
      errors: outcome.errors || [],
      warnings: outcome.warnings || [],
      sideEffects: outcome.sideEffects || [],
    };
    action.duration = outcome.duration || 0;

    // Update energy level based on success
    this.state.energyLevel = action.confidenceAfter;

    // Record attempt for learning
    if (action.success) {
      this.recordSuccess(action);
    } else {
      this.recordFailure(action);
    }

    this.saveState();
  }

  // ============ Self Assessment ============

  /**
   * Self-assess current state
   */
  assessSelf(context: {
    taskDescription?: string;
    recentErrors?: string[];
    timeSpent?: number;
  }): SelfAssessment {
    const { taskDescription, recentErrors, timeSpent } = context;

    // Calculate base confidence
    let confidence = this.capabilities.averageConfidence;

    // Adjust based on recent performance
    const recentSuccessRate = this.getRecentSuccessRate();
    confidence = confidence * 0.7 + recentSuccessRate * 0.3;

    // Adjust based on blockers
    if (this.state.blockedBy.length > 0) {
      confidence *= 0.7;
    }

    // Adjust based on energy
    confidence *= this.state.energyLevel;

    // Identify potential issues
    const potentialIssues: string[] = [];

    if (this.state.blockedBy.length > 0) {
      potentialIssues.push(`${this.state.blockedBy.length} active blocker(s)`);
    }

    if (recentErrors && recentErrors.length > 3) {
      potentialIssues.push(`Recent high error rate (${recentErrors.length} errors)`);
    }

    if (timeSpent && timeSpent > 300000) { // 5 minutes
      potentialIssues.push('Taking longer than expected');
    }

    const unresolvedAttempts = this.getUnresolvedAttempts();
    if (unresolvedAttempts.length > 3) {
      potentialIssues.push('Multiple failed attempts');
    }

    // Suggest approaches based on success patterns
    const suggestedApproaches = this.getSuggestedApproaches(taskDescription);

    // Calculate risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (potentialIssues.length >= 3 || recentErrors && recentErrors.length > 5) {
      riskLevel = 'high';
    } else if (potentialIssues.length >= 1) {
      riskLevel = 'medium';
    }

    return {
      confidence: Math.round(confidence * 100) / 100,
      quality: this.calculateQuality(),
      potentialIssues,
      suggestedApproaches,
      riskLevel,
    };
  }

  /**
   * Get capability profile
   */
  getCapabilities(): CapabilityProfile {
    return { ...this.capabilities };
  }

  /**
   * Update capability
   */
  updateCapability(type: 'strength' | 'weakness' | 'improvement' | 'approach', value: string): void {
    switch (type) {
      case 'strength':
        if (!this.capabilities.strengths.includes(value)) {
          this.capabilities.strengths.push(value);
        }
        break;
      case 'weakness':
        if (!this.capabilities.weakAreas.includes(value)) {
          this.capabilities.weakAreas.push(value);
        }
        break;
      case 'improvement':
        if (!this.capabilities.recentImprovements.includes(value)) {
          this.capabilities.recentImprovements.push(value);
          // Keep only last 10 improvements
          if (this.capabilities.recentImprovements.length > 10) {
            this.capabilities.recentImprovements = this.capabilities.recentImprovements.slice(-10);
          }
        }
        break;
      case 'approach':
        if (!this.capabilities.preferredApproaches.includes(value)) {
          this.capabilities.preferredApproaches.push(value);
        }
        break;
    }
    this.saveCapabilities();
  }

  // ============ Attempt History ============

  /**
   * Get attempt history for task type
   */
  getAttemptHistory(taskType: string): Attempt[] {
    return this.attempts.get(taskType) || [];
  }

  /**
   * Get anti-patterns to avoid
   */
  getAntiPatterns(): AntiPattern[] {
    return [...this.antiPatterns.values()];
  }

  /**
   * Check if approach matches anti-pattern
   */
  checkAntiPattern(approach: string): AntiPattern | null {
    const approachLower = approach.toLowerCase();

    for (const anti of this.antiPatterns.values()) {
      if (approachLower.includes(anti.pattern.toLowerCase())) {
        return anti;
      }
    }

    return null;
  }

  // ============ Session Management ============

  /**
   * Start new session
   */
  startSession(): void {
    this.state = this.createInitialState();
    this.state.sessionStartTime = new Date().toISOString();
    this.capabilities.totalSessions++;
    this.save();
  }

  /**
   * End session
   */
  endSession(): SessionSummary {
    const summary: SessionSummary = {
      startTime: this.state.sessionStartTime,
      endTime: new Date().toISOString(),
      totalActions: this.state.totalActionsThisSession,
      successRate: this.getRecentSuccessRate(),
      topStrengths: this.capabilities.strengths.slice(0, 3),
      areasForImprovement: this.capabilities.weakAreas.slice(0, 3),
      blockersEncountered: this.state.blockedBy.length,
    };

    this.save();
    return summary;
  }

  // ============ Persistence ============

  /**
   * Clear all data
   */
  clear(): void {
    this.state = this.createInitialState();
    this.capabilities = this.createInitialCapabilities();
    this.attempts.clear();
    this.antiPatterns.clear();
    this.save();
  }

  // ============ Private Methods ============

  private createInitialState(): AgentState {
    return {
      currentTask: null,
      recentActions: [],
      activeGoals: [],
      blockedBy: [],
      energyLevel: 0.8,
      mode: 'idle',
      sessionStartTime: new Date().toISOString(),
      totalActionsThisSession: 0,
    };
  }

  private createInitialCapabilities(): CapabilityProfile {
    return {
      strengths: [],
      weakAreas: [],
      recentImprovements: [],
      preferredApproaches: ['incremental', 'test-first', 'document-as-you-go'],
      successRates: {},
      averageConfidence: 0.7,
      totalActions: 0,
      totalSessions: 0,
    };
  }

  private generateId(): string {
    return `awr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private inferMode(taskType: TaskType): AgentState['mode'] {
    switch (taskType) {
      case 'debug': return 'debugging';
      case 'code_review': return 'reviewing';
      case 'research':
      case 'planning':
      case 'architecture':
        return 'exploring';
      default:
        return 'implementing';
    }
  }

  private recordSuccess(action: ActionRecord): void {
    // Update success rate for action type
    const type = action.type;
    const current = this.capabilities.successRates[type] || 0.5;
    this.capabilities.successRates[type] = current * 0.9 + 0.8 * 0.1;

    // Record attempt
    this.recordAttempt(action, true);

    // Update confidence
    this.capabilities.averageConfidence =
      this.capabilities.averageConfidence * 0.95 + action.confidenceAfter * 0.05;

    this.saveCapabilities();
  }

  private recordFailure(action: ActionRecord): void {
    // Update success rate
    const type = action.type;
    const current = this.capabilities.successRates[type] || 0.5;
    this.capabilities.successRates[type] = current * 0.9 + 0.2 * 0.1;

    // Record attempt
    this.recordAttempt(action, false);

    // Add to anti-patterns if relevant
    if (action.outcome.errors.length > 0) {
      this.addAntiPatternFromError(action);
    }

    // Update confidence
    this.capabilities.averageConfidence =
      this.capabilities.averageConfidence * 0.95 + action.confidenceAfter * 0.05;

    this.saveCapabilities();
  }

  private recordAttempt(action: ActionRecord, success: boolean): void {
    const type = action.type;
    if (!this.attempts.has(type)) {
      this.attempts.set(type, []);
    }

    const attempt: Attempt = {
      id: action.id,
      taskType: type,
      taskDescription: action.description,
      approach: action.skillUsed || 'default',
      success,
      timestamp: action.timestamp,
      duration: action.duration,
      notes: action.outcome.errors.join('; ') || '',
    };

    this.attempts.get(type)!.unshift(attempt);

    // Keep only last 20 attempts per type
    if (this.attempts.get(type)!.length > 20) {
      this.attempts.set(type, this.attempts.get(type)!.slice(0, 20));
    }

    this.capabilities.totalActions++;
  }

  private addAntiPatternFromError(action: ActionRecord): void {
    // Simple heuristic: first error becomes potential anti-pattern
    if (action.outcome.errors.length === 0) return;

    const error = action.outcome.errors[0].toLowerCase();

    // Don't add every error, only repeated patterns
    const existing = this.antiPatterns.get(error);
    if (existing) {
      existing.frequency++;
      existing.lastOccurrence = action.timestamp;
    } else {
      // Only add if it's a new pattern
      this.antiPatterns.set(error, {
        pattern: error.slice(0, 50),
        description: `Pattern associated with failure: ${error.slice(0, 100)}`,
        frequency: 1,
        lastOccurrence: action.timestamp,
        avoidedCount: 0,
        examples: [action.description],
      });
    }
  }

  private getRecentSuccessRate(): number {
    const recent = this.state.recentActions.slice(0, 10);
    if (recent.length === 0) return 0.8;

    const successful = recent.filter(a => a.success).length;
    return successful / recent.length;
  }

  private getUnresolvedAttempts(): Attempt[] {
    const unresolved: Attempt[] = [];
    for (const attempts of this.attempts.values()) {
      for (const attempt of attempts.slice(0, 5)) {
        if (!attempt.success) {
          unresolved.push(attempt);
        }
      }
    }
    return unresolved;
  }

  private getSuggestedApproaches(taskDescription?: string): string[] {
    const suggestions: string[] = [];

    // Based on task type
    if (this.state.currentTask) {
      const type = this.state.currentTask.type;
      const typeAttempts = this.attempts.get(type) || [];
      const successful = typeAttempts.filter(a => a.success);

      if (successful.length > 0) {
        suggestions.push(`For ${type}: ${successful[0].approach}`);
      }
    }

    // Based on strength
    if (this.capabilities.strengths.length > 0) {
      suggestions.push(`Leverage strength: ${this.capabilities.strengths[0]}`);
    }

    // Avoid weaknesses
    if (this.capabilities.weakAreas.length > 0) {
      suggestions.push(`Avoid: ${this.capabilities.weakAreas[0]}`);
    }

    return suggestions.slice(0, 3);
  }

  private calculateQuality(): number {
    const recent = this.state.recentActions.slice(0, 10);
    if (recent.length === 0) return 0.8;

    const totalQuality = recent.reduce((sum, a) => sum + a.outcome.quality, 0);
    return totalQuality / recent.length;
  }

  private load(): void {
    // Load state
    if (existsSync(this.statePath)) {
      try {
        const content = readFileSync(this.statePath, 'utf-8');
        const data = JSON.parse(content);
        this.state = { ...this.createInitialState(), ...data };
      } catch (error) {
        console.error('Failed to load self-awareness state:', error);
      }
    }

    // Load capabilities
    if (existsSync(this.capabilitiesPath)) {
      try {
        const content = readFileSync(this.capabilitiesPath, 'utf-8');
        const data = JSON.parse(content);
        this.capabilities = { ...this.createInitialCapabilities(), ...data };
      } catch (error) {
        console.error('Failed to load capabilities:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, AWARENESS_DIR));
    this.saveState();
    this.saveCapabilities();
  }

  private saveState(): void {
    ensureDir(join(this.projectRoot, AWARENESS_DIR));
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  private saveCapabilities(): void {
    ensureDir(join(this.projectRoot, AWARENESS_DIR));
    writeFileSync(this.capabilitiesPath, JSON.stringify(this.capabilities, null, 2), 'utf-8');
  }
}

export interface SessionSummary {
  startTime: string;
  endTime: string;
  totalActions: number;
  successRate: number;
  topStrengths: string[];
  areasForImprovement: string[];
  blockersEncountered: number;
}

// Singleton
const instances: Map<string, SelfAwareness> = new Map();

export function getSelfAwareness(projectRoot: string = process.cwd()): SelfAwareness {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new SelfAwareness(projectRoot));
  }
  return instances.get(projectRoot)!;
}