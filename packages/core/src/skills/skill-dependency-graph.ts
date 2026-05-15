/**
 * Skill Dependency Graph
 *
 * Maps skills, tools, and their dependencies.
 * Enables intelligent skill composition and execution planning.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const SKILLS_DIR = '.kontextmind/skills';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'implementation' | 'testing' | 'refactoring' | 'documentation' | 'deployment' | 'general';
  dependencies: string[];
  prerequisites: string[];
  provides: string[];
  estimatedComplexity: number;
  executionTime?: number;
  successRate?: number;
  lastUsed?: string;
  usageCount: number;
  metadata: Record<string, any>;
}

export interface SkillExecution {
  skillId: string;
  startTime: string;
  endTime?: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

export interface DependencyNode {
  skillId: string;
  depth: number;
  dependencies: string[];
  dependents: string[];
  isReady: boolean;
}

export interface ExecutionPlan {
  steps: SkillExecution[];
  estimatedDuration: number;
  parallelizable: number[];
  criticalPath: string[];
  potentialFailures: string[];
}

export interface SkillGraphStats {
  totalSkills: number;
  byCategory: Record<string, number>;
  averageDependencies: number;
  maxDepth: number;
  isolatedSkills: string[];
}

/**
 * SkillDependencyGraph - Manages skill relationships and execution
 */
export class SkillDependencyGraph {
  private projectRoot: string;
  private skillsPath: string;
  private skills: Map<string, Skill> = new Map();
  private executions: Map<string, SkillExecution[]> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.skillsPath = join(projectRoot, SKILLS_DIR, 'skills.json');
    this.load();
  }

  /**
   * Register a new skill
   */
  register(skill: Omit<Skill, 'usageCount' | 'lastUsed'>): Skill {
    const fullSkill: Skill = {
      ...skill,
      usageCount: 0,
      lastUsed: undefined,
    };

    // Validate dependencies exist
    for (const depId of skill.dependencies) {
      if (!this.skills.has(depId)) {
        this.addPlaceholderSkill(depId);
      }
    }

    this.skills.set(skill.id, fullSkill);
    this.save();
    return fullSkill;
  }

  /**
   * Add placeholder for missing dependency
   */
  private addPlaceholderSkill(skillId: string): void {
    this.skills.set(skillId, {
      id: skillId,
      name: skillId,
      description: 'Auto-created placeholder for dependency',
      category: 'general',
      dependencies: [],
      prerequisites: [],
      provides: [],
      estimatedComplexity: 0.5,
      usageCount: 0,
      metadata: {},
    });
  }

  /**
   * Get skill by ID
   */
  getSkill(skillId: string): Skill | null {
    return this.skills.get(skillId) || null;
  }

  /**
   * Get all skills
   */
  getAllSkills(): Skill[] {
    return [...this.skills.values()];
  }

  /**
   * Get skills by category
   */
  getByCategory(category: Skill['category']): Skill[] {
    return [...this.skills.values()].filter(s => s.category === category);
  }

  /**
   * Get skill dependencies
   */
  getDependencies(skillId: string): Skill[] {
    const skill = this.skills.get(skillId);
    if (!skill) return [];

    return skill.dependencies
      .map(depId => this.skills.get(depId))
      .filter((s): s is Skill => s !== undefined);
  }

  /**
   * Get skills that depend on this skill
   */
  getDependents(skillId: string): Skill[] {
    return [...this.skills.values()].filter(s =>
      s.dependencies.includes(skillId)
    );
  }

  /**
   * Calculate execution plan for target skill
   */
  calculateExecutionPlan(targetSkillId: string): ExecutionPlan {
    const visited = new Set<string>();
    const steps: SkillExecution[] = [];
    const criticalPath: string[] = [];
    const potentialFailures: string[] = [];
    let estimatedDuration = 0;

    const executeSkill = (skillId: string, depth: number): void => {
      if (visited.has(skillId)) return;
      visited.add(skillId);

      const skill = this.skills.get(skillId);
      if (!skill) {
        potentialFailures.push(`Missing skill: ${skillId}`);
        return;
      }

      // Add dependencies first
      for (const depId of skill.dependencies) {
        if (!visited.has(depId)) {
          executeSkill(depId, depth + 1);
        }
      }

      const step: SkillExecution = {
        skillId,
        startTime: new Date().toISOString(),
        status: 'planned',
      };
      steps.push(step);

      estimatedDuration += skill.executionTime || skill.estimatedComplexity * 1000;
      criticalPath.push(skillId);
    };

    executeSkill(targetSkillId, 0);

    // Mark parallelizable steps (no dependencies between them)
    const parallelizable: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const skill = this.skills.get(step.skillId);
      if (!skill) continue;

      const hasDependenciesInPlan = steps
        .slice(0, i)
        .some(s => skill.dependencies.includes(s.skillId));

      if (!hasDependenciesInPlan && skill.dependencies.length > 0) {
        parallelizable.push(i);
      }
    }

    return {
      steps,
      estimatedDuration,
      parallelizable,
      criticalPath,
      potentialFailures,
    };
  }

  /**
   * Check if skill is ready to execute (all dependencies met)
   */
  isSkillReady(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    return skill.dependencies.every(depId => {
      const dep = this.skills.get(depId);
      return dep && dep.usageCount > 0;
    });
  }

  /**
   * Record skill usage
   */
  recordUsage(skillId: string, success: boolean, result?: any, error?: string): void {
    const skill = this.skills.get(skillId);
    if (!skill) return;

    skill.usageCount++;
    skill.lastUsed = new Date().toISOString();

    if (result !== undefined) {
      skill.metadata.lastResult = result;
    }

    // Update success rate
    const executions = this.executions.get(skillId) || [];
    executions.push({
      skillId,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      status: success ? 'completed' : 'failed',
      result,
      error,
    });

    // Keep last 50 executions
    if (executions.length > 50) {
      this.executions.set(skillId, executions.slice(-50));
    }

    // Update estimated execution time
    if (success && result && typeof result === 'number') {
      skill.executionTime = result;
    }

    this.save();
  }

  /**
   * Get skill execution history
   */
  getExecutionHistory(skillId: string): SkillExecution[] {
    return this.executions.get(skillId) || [];
  }

  /**
   * Find skills that provide a capability
   */
  findByCapability(capability: string): Skill[] {
    return [...this.skills.values()].filter(s =>
      s.provides.some(p => p.toLowerCase().includes(capability.toLowerCase()))
    );
  }

  /**
   * Get graph statistics
   */
  getStats(): SkillGraphStats {
    const byCategory: Record<string, number> = {};
    let totalDependencies = 0;
    let maxDepth = 0;
    const isolated: string[] = [];

    for (const skill of this.skills.values()) {
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
      totalDependencies += skill.dependencies.length;

      if (skill.dependencies.length === 0 && this.getDependents(skill.id).length === 0) {
        isolated.push(skill.id);
      }

      const depth = this.calculateDepth(skill.id);
      if (depth > maxDepth) maxDepth = depth;
    }

    return {
      totalSkills: this.skills.size,
      byCategory,
      averageDependencies: this.skills.size > 0 ? totalDependencies / this.skills.size : 0,
      maxDepth,
      isolatedSkills: isolated,
    };
  }

  /**
   * Calculate maximum depth of skill in graph
   */
  calculateDepth(skillId: string, visited?: Set<string>): number {
    if (!visited) visited = new Set();
    if (visited.has(skillId)) return 0;
    visited.add(skillId);

    const skill = this.skills.get(skillId);
    if (!skill || skill.dependencies.length === 0) return 1;

    let maxChildDepth = 0;
    for (const depId of skill.dependencies) {
      const childDepth = this.calculateDepth(depId, visited);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return 1 + maxChildDepth;
  }

  /**
   * Suggest skill combinations for a task
   */
  suggestCombination(taskType: string, targetCapabilities: string[]): Skill[][] {
    const suggestions: Skill[][] = [];
    const relevantSkills = [...this.skills.values()].filter(s =>
      targetCapabilities.some(cap =>
        s.provides.some(p => p.toLowerCase().includes(cap.toLowerCase())) ||
        s.name.toLowerCase().includes(cap.toLowerCase())
      )
    );

    // Simple combination logic
    if (relevantSkills.length === 0) {
      return suggestions;
    }

    // Single skill option
    for (const skill of relevantSkills.slice(0, 3)) {
      suggestions.push([skill]);
    }

    // Two skill combinations
    for (let i = 0; i < relevantSkills.length; i++) {
      for (let j = i + 1; j < relevantSkills.length; j++) {
        if (suggestions.length < 5) {
          const depCheck = !relevantSkills[i].dependencies.includes(relevantSkills[j].id) &&
            !relevantSkills[j].dependencies.includes(relevantSkills[i].id);
          if (depCheck) {
            suggestions.push([relevantSkills[i], relevantSkills[j]]);
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Remove skill
   */
  remove(skillId: string): boolean {
    // Check if any skills depend on this
    const dependents = this.getDependents(skillId);
    if (dependents.length > 0) {
      console.warn(`Cannot remove ${skillId}: ${dependents.length} skills depend on it`);
      return false;
    }

    return this.skills.delete(skillId);
  }

  /**
   * Clear all skills
   */
  clear(): void {
    this.skills.clear();
    this.executions.clear();
    this.save();
  }

  // ============ Private Methods ============

  private load(): void {
    ensureDir(join(this.projectRoot, SKILLS_DIR));

    if (existsSync(this.skillsPath)) {
      try {
        const content = readFileSync(this.skillsPath, 'utf-8');
        const data = JSON.parse(content);
        for (const s of data.skills || []) {
          this.skills.set(s.id, s);
        }
        this.executions = new Map(Object.entries(data.executions || {}));
      } catch (error) {
        console.error('Failed to load skills:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, SKILLS_DIR));

    writeFileSync(this.skillsPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      skills: [...this.skills.values()],
      executions: Object.fromEntries(this.executions),
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, SkillDependencyGraph> = new Map();

export function getSkillDependencyGraph(projectRoot: string = process.cwd()): SkillDependencyGraph {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new SkillDependencyGraph(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { SKILLS_DIR };