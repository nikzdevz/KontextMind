/**
 * Real-Time Context Injection
 *
 * Dynamically injects relevant context during execution.
 * Monitors task progress and surfaces relevant information.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const REALTIME_DIR = '.kontextmind/realtime';

export interface ContextEvent {
  id: string;
  type: 'file_change' | 'error' | 'warning' | 'insight' | 'dependency' | 'pattern';
  source: string;
  content: string;
  relevance: number;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface InjectionRule {
  id: string;
  name: string;
  trigger: 'on_error' | 'on_file_change' | 'on_import' | 'on_timeout' | 'on_repeat' | 'manual';
  conditions: RuleCondition[];
  contextType: 'error_context' | 'related_code' | 'documentation' | 'test_hint' | 'performance_tip' | 'security_note';
  content: string;
  priority: number;
  enabled: boolean;
}

export interface RuleCondition {
  field: 'file_type' | 'error_pattern' | 'function_name' | 'import_path' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  value: string;
}

export interface InjectionTarget {
  type: 'system' | 'user' | 'hidden';
  position: 'before' | 'after' | 'replace';
  content: string;
}

export interface InjectionResult {
  injected: ContextEvent[];
  skipped: number;
  rulesFired: number;
}

export interface MonitorState {
  activeEvents: ContextEvent[];
  recentInjections: ContextEvent[];
  errorCount: number;
  lastInjection: string;
}

/**
 * RealtimeContextInjector - Injects context in real-time
 */
export class RealtimeContextInjector {
  private projectRoot: string;
  private statePath: string;
  private rulesPath: string;
  private rules: Map<string, InjectionRule> = new Map();
  private eventHistory: ContextEvent[] = [];
  private activeEvents: ContextEvent[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, REALTIME_DIR, 'state.json');
    this.rulesPath = join(projectRoot, REALTIME_DIR, 'rules.json');
    this.initializeDefaultRules();
    this.load();
  }

  /**
   * Initialize default injection rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: InjectionRule[] = [
      {
        id: 'error_context',
        name: 'Provide error context',
        trigger: 'on_error',
        conditions: [],
        contextType: 'error_context',
        content: 'Previous similar errors occurred. Consider checking the error pattern in recent logs.',
        priority: 10,
        enabled: true,
      },
      {
        id: 'file_dependencies',
        name: 'Show related files',
        trigger: 'on_file_change',
        conditions: [{ field: 'file_type', operator: 'equals', value: 'ts' }],
        contextType: 'related_code',
        content: 'This file may have dependencies that need updating.',
        priority: 5,
        enabled: true,
      },
      {
        id: 'test_hints',
        name: 'Suggest test coverage',
        trigger: 'on_import',
        conditions: [{ field: 'import_path', operator: 'contains', value: 'src/' }],
        contextType: 'test_hint',
        content: 'Consider adding or updating tests for this module.',
        priority: 4,
        enabled: true,
      },
      {
        id: 'performance_watch',
        name: 'Performance tip for loops',
        trigger: 'on_repeat',
        conditions: [{ field: 'custom', operator: 'contains', value: 'loop' }],
        contextType: 'performance_tip',
        content: 'This operation appears to be in a loop. Consider caching or batching for better performance.',
        priority: 6,
        enabled: true,
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Register custom injection rule
   */
  registerRule(rule: InjectionRule): void {
    this.rules.set(rule.id, rule);
    this.save();
  }

  /**
   * Trigger context injection based on event
   */
  trigger(event: Omit<ContextEvent, 'id' | 'timestamp'>): InjectionResult {
    const now = new Date().toISOString();
    const fullEvent: ContextEvent = {
      ...event,
      id: this.generateId(),
      timestamp: now,
    };

    this.activeEvents.push(fullEvent);
    if (this.activeEvents.length > 50) {
      this.activeEvents = this.activeEvents.slice(-50);
    }

    const applicableRules = this.getApplicableRules(fullEvent);
    const injected: ContextEvent[] = [];
    let rulesFired = 0;

    for (const rule of applicableRules) {
      if (this.shouldFire(rule, fullEvent)) {
        rulesFired++;
        // Don't actually inject here, just record the rule firing
      }
    }

    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > 500) {
      this.eventHistory = this.eventHistory.slice(-500);
    }

    this.save();

    return {
      injected,
      skipped: applicableRules.length - rulesFired,
      rulesFired,
    };
  }

  /**
   * Get applicable rules for event
   */
  private getApplicableRules(event: ContextEvent): InjectionRule[] {
    // Map event types to their corresponding trigger types
    const triggerMap: Record<string, string> = {
      'error': 'on_error',
      'file_change': 'on_file_change',
      'warning': 'on_error', // Treat warnings like errors
      'insight': 'manual',
      'dependency': 'on_import',
      'pattern': 'on_repeat',
    };

    const correspondingTrigger = triggerMap[event.type] || 'manual';

    return [...this.rules.values()]
      .filter(r => r.enabled && (r.trigger === correspondingTrigger || r.trigger === 'manual'))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if rule should fire
   */
  private shouldFire(rule: InjectionRule, event: ContextEvent): boolean {
    if (rule.conditions.length === 0) return true;

    return rule.conditions.every(condition => {
      const eventValue = this.getEventField(event, condition.field);
      return this.evaluateCondition(eventValue, condition);
    });
  }

  /**
   * Get field value from event
   */
  private getEventField(event: ContextEvent, field: string): string {
    if (field === 'file_type') {
      const match = event.source.match(/\.([^.]+)$/);
      return match ? match[1] : '';
    }
    if (field === 'function_name') {
      const match = event.content.match(/(?:function|const|class)\s+(\w+)/);
      return match ? match[1] : '';
    }
    if (field === 'custom') {
      return event.content;
    }
    return '';
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: string, condition: RuleCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return value.includes(condition.value);
      case 'matches':
        return new RegExp(condition.value).test(value);
      case 'greater_than':
        return parseFloat(value) > parseFloat(condition.value);
      case 'less_than':
        return parseFloat(value) < parseFloat(condition.value);
      default:
        return false;
    }
  }

  /**
   * Inject context for specific situation
   */
  inject(targetType: ContextEvent['type'], content: string, metadata: Record<string, any> = {}): ContextEvent {
    const event: ContextEvent = {
      id: this.generateId(),
      type: targetType,
      source: 'manual',
      content,
      relevance: 0.8,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.activeEvents.push(event);
    this.eventHistory.push(event);
    this.save();

    return event;
  }

  /**
   * Get current monitoring state
   */
  getState(): MonitorState {
    return {
      activeEvents: [...this.activeEvents],
      recentInjections: this.eventHistory.slice(-10),
      errorCount: this.eventHistory.filter(e => e.type === 'error').length,
      lastInjection: this.eventHistory.length > 0 ? this.eventHistory[this.eventHistory.length - 1].timestamp : '',
    };
  }

  /**
   * Get events by type
   */
  getEventsByType(type: ContextEvent['type']): ContextEvent[] {
    return this.eventHistory.filter(e => e.type === type);
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 20): ContextEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get context suggestions based on current state
   */
  getSuggestions(): string[] {
    const suggestions: string[] = [];
    const recentErrors = this.eventHistory.filter(e => e.type === 'error').slice(-5);

    if (recentErrors.length > 2) {
      suggestions.push('Multiple errors detected. Consider running tests to identify root cause.');
    }

    const fileChanges = this.eventHistory.filter(e => e.type === 'file_change').slice(-10);
    if (fileChanges.length > 5) {
      suggestions.push('Many file changes detected. Consider reviewing dependencies.');
    }

    const warnings = this.eventHistory.filter(e => e.type === 'warning').slice(-3);
    if (warnings.length > 0) {
      suggestions.push('Recent warnings may indicate code quality issues.');
    }

    return suggestions;
  }

  /**
   * Enable or disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): InjectionRule[] {
    return [...this.rules.values()];
  }

  /**
   * Remove rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.activeEvents = [];
    this.save();
  }

  // ============ Private Methods ============

  private generateId(): string {
    return `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private load(): void {
    ensureDir(join(this.projectRoot, REALTIME_DIR));

    if (existsSync(this.statePath)) {
      try {
        const content = readFileSync(this.statePath, 'utf-8');
        const data = JSON.parse(content);
        this.eventHistory = data.eventHistory || [];
        this.activeEvents = data.activeEvents || [];
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }

    if (existsSync(this.rulesPath)) {
      try {
        const content = readFileSync(this.rulesPath, 'utf-8');
        const data = JSON.parse(content);
        for (const r of data.rules || []) {
          this.rules.set(r.id, r);
        }
      } catch (error) {
        console.error('Failed to load rules:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, REALTIME_DIR));

    writeFileSync(this.statePath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      eventHistory: this.eventHistory.slice(-500),
      activeEvents: this.activeEvents.slice(-50),
    }, null, 2), 'utf-8');

    writeFileSync(this.rulesPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      rules: [...this.rules.values()],
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, RealtimeContextInjector> = new Map();

export function getRealtimeContextInjector(projectRoot: string = process.cwd()): RealtimeContextInjector {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new RealtimeContextInjector(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { REALTIME_DIR };