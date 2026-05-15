/**
 * Proactive Handoff System
 *
 * Automatically generates handoff documents when session ends.
 * Provides seamless context transfer between sessions.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const HANDOFF_DIR = '.kontextmind/handoff';

export interface HandoffDocument {
  id: string;
  summary: string;
  currentState: string;
  pendingWork: string[];
  decisionsMade: Decision[];
  contextForResume: ContextEntry[];
  warnings: string[];
  suggestedNextSteps: string[];
  createdAt: string;
  sessionId: string;
  relatedTaskId?: string;
  filesModified: string[];
  topics: string[];
}

export interface Decision {
  id: string;
  question: string;
  chosen: string;
  rationale: string;
  alternatives: string[];
  timestamp: string;
}

export interface ContextEntry {
  type: 'file' | 'function' | 'variable' | 'concept' | 'config';
  name: string;
  description: string;
  location?: string;
  importance: number;
}

export interface HandoffValidation {
  isValid: boolean;
  missingFields: string[];
  completeness: number;
  warnings: string[];
}

export interface AgentSuggestion {
  agentType: string;
  confidence: number;
  reason: string;
  suggestedContext: string[];
}

/**
 * ProactiveHandoff - Auto-generates handoffs for session continuity
 */
export class ProactiveHandoff {
  private handoffs: Map<string, HandoffDocument> = new Map();
  private projectRoot: string;
  private handoffsPath: string;
  private activeHandoffPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.handoffsPath = join(projectRoot, HANDOFF_DIR, 'documents.json');
    this.activeHandoffPath = join(projectRoot, HANDOFF_DIR, 'active.md');
    this.load();
  }

  /**
   * Detect if session is ending
   */
  detectEnd(session: {
    messageCount: number;
    lastActivity: string;
    idleMinutes: number;
    topics: string[];
    pendingWork?: string[];
  }): boolean {
    // Session is ending if:
    // 1. No activity for 5+ minutes
    // 2. Has meaningful work done (5+ messages)
    // 3. Has pending work or important context

    if (session.idleMinutes >= 5 && session.messageCount >= 5) {
      return true;
    }

    if (session.pendingWork && session.pendingWork.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Generate comprehensive handoff
   */
  generate(session: {
    sessionId: string;
    messages: Array<{ role: string; content: string; timestamp: string }>;
    topics: string[];
    filesModified?: string[];
    decisions?: Decision[];
    pendingWork?: string[];
    contextEntries?: ContextEntry[];
    relatedTaskId?: string;
  }): HandoffDocument {
    const handoff: HandoffDocument = {
      id: this.generateId(),
      summary: this.generateSummary(session.messages),
      currentState: this.generateCurrentState(session),
      pendingWork: session.pendingWork || [],
      decisionsMade: session.decisions || [],
      contextForResume: session.contextEntries || this.extractContextFromMessages(session.messages),
      warnings: this.generateWarnings(session),
      suggestedNextSteps: this.generateNextSteps(session),
      createdAt: new Date().toISOString(),
      sessionId: session.sessionId,
      relatedTaskId: session.relatedTaskId,
      filesModified: session.filesModified || [],
      topics: session.topics,
    };

    this.handoffs.set(handoff.id, handoff);
    this.saveActive(handoff);
    this.save();

    return handoff;
  }

  /**
   * Validate handoff completeness
   */
  validate(handoff: HandoffDocument): HandoffValidation {
    const missingFields: string[] = [];
    let completeness = 0;
    const warnings: string[] = [];

    // Check required fields
    if (!handoff.summary || handoff.summary.length < 10) {
      missingFields.push('summary');
    } else {
      completeness += 20;
    }

    if (!handoff.currentState || handoff.currentState.length < 10) {
      missingFields.push('currentState');
    } else {
      completeness += 20;
    }

    if (handoff.pendingWork.length === 0) {
      warnings.push('No pending work documented');
    } else {
      completeness += 15;
    }

    if (handoff.contextForResume.length === 0) {
      missingFields.push('contextForResume');
      warnings.push('No context entries for resume');
    } else {
      completeness += 20;
    }

    if (handoff.suggestedNextSteps.length === 0) {
      warnings.push('No suggested next steps');
    } else {
      completeness += 15;
    }

    if (handoff.decisionsMade.length > 0) {
      completeness += 10;
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      completeness,
      warnings,
    };
  }

  /**
   * Suggest next agent if switching
   */
  suggestNextAgent(handoff: HandoffDocument): AgentSuggestion[] {
    const suggestions: AgentSuggestion[] = [];

    // Analyze topics for agent suitability
    for (const topic of handoff.topics) {
      const topicLower = topic.toLowerCase();

      if (topicLower.includes('debug') || topicLower.includes('fix')) {
        suggestions.push({
          agentType: 'debugging',
          confidence: 0.8,
          reason: 'Session involved debugging activities',
          suggestedContext: ['error logs', 'stack traces', 'test cases'],
        });
      }

      if (topicLower.includes('implement') || topicLower.includes('feature')) {
        suggestions.push({
          agentType: 'coding',
          confidence: 0.8,
          reason: 'Session involved implementation work',
          suggestedContext: ['requirements', 'specifications', 'test cases'],
        });
      }

      if (topicLower.includes('refactor') || topicLower.includes('improve')) {
        suggestions.push({
          agentType: 'refactoring',
          confidence: 0.7,
          reason: 'Session involved code improvements',
          suggestedContext: ['architecture', 'dependencies', 'test coverage'],
        });
      }

      if (topicLower.includes('review') || topicLower.includes('test')) {
        suggestions.push({
          agentType: 'review',
          confidence: 0.7,
          reason: 'Session involved testing/review',
          suggestedContext: ['test results', 'code coverage', 'lint output'],
        });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions.slice(0, 3);
  }

  /**
   * Get active handoff for resume
   */
  getActiveHandoff(): HandoffDocument | null {
    // Try to find most recent unexpired handoff
    const now = Date.now();
    const expiryDays = 7;

    for (const handoff of this.handoffs.values()) {
      const age = now - new Date(handoff.createdAt).getTime();
      const ageDays = age / (1000 * 60 * 60 * 24);

      if (ageDays < expiryDays) {
        return handoff;
      }
    }

    return null;
  }

  /**
   * Get handoff by ID
   */
  getHandoff(id: string): HandoffDocument | null {
    return this.handoffs.get(id) || null;
  }

  /**
   * Get handoffs by session
   */
  getSessionHandoffs(sessionId: string): HandoffDocument[] {
    return [...this.handoffs.values()].filter(h => h.sessionId === sessionId);
  }

  /**
   * Get handoffs by task
   */
  getTaskHandoffs(taskId: string): HandoffDocument[] {
    return [...this.handoffs.values()].filter(h => h.relatedTaskId === taskId);
  }

  /**
   * Mark handoff as read/used
   */
  markUsed(handoffId: string): void {
    const handoff = this.handoffs.get(handoffId);
    if (handoff) {
      // Add timestamp for when it was used
      handoff.createdAt = handoff.createdAt; // Keep original
    }
  }

  /**
   * Delete old handoffs
   */
  prune(olderThanDays: number = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let pruned = 0;

    for (const [id, handoff] of this.handoffs.entries()) {
      const age = Date.now() - new Date(handoff.createdAt).getTime();
      if (age > cutoff) {
        this.handoffs.delete(id);
        pruned++;
      }
    }

    if (pruned > 0) {
      this.save();
    }

    return pruned;
  }

  /**
   * Export handoff for external use
   */
  exportMarkdown(handoff: HandoffDocument): string {
    let md = `# Session Handoff\n\n`;
    md += `**Created:** ${new Date(handoff.createdAt).toLocaleString()}\n`;
    md += `**Session ID:** ${handoff.sessionId}\n\n`;

    md += `## Summary\n${handoff.summary}\n\n`;

    md += `## Current State\n${handoff.currentState}\n\n`;

    if (handoff.pendingWork.length > 0) {
      md += `## Pending Work\n`;
      for (const work of handoff.pendingWork) {
        md += `- ${work}\n`;
      }
      md += '\n';
    }

    if (handoff.decisionsMade.length > 0) {
      md += `## Decisions Made\n`;
      for (const decision of handoff.decisionsMade) {
        md += `- **${decision.question}**: ${decision.chosen}\n`;
        md += `  - Rationale: ${decision.rationale}\n`;
      }
      md += '\n';
    }

    if (handoff.contextForResume.length > 0) {
      md += `## Context for Resume\n`;
      for (const entry of handoff.contextForResume) {
        md += `- **${entry.name}** (${entry.type}): ${entry.description}\n`;
        if (entry.location) {
          md += `  - Location: ${entry.location}\n`;
        }
      }
      md += '\n';
    }

    if (handoff.suggestedNextSteps.length > 0) {
      md += `## Suggested Next Steps\n`;
      for (const step of handoff.suggestedNextSteps) {
        md += `- ${step}\n`;
      }
      md += '\n';
    }

    if (handoff.warnings.length > 0) {
      md += `## Warnings\n`;
      for (const warning of handoff.warnings) {
        md += `- ⚠️ ${warning}\n`;
      }
      md += '\n';
    }

    if (handoff.filesModified.length > 0) {
      md += `## Files Modified\n`;
      for (const file of handoff.filesModified.slice(0, 20)) {
        md += `- \`${file}\`\n`;
      }
      md += '\n';
    }

    return md;
  }

  /**
   * Clear all handoffs
   */
  clear(): void {
    this.handoffs.clear();
    this.save();
  }

  // ============ Private Methods ============

  private generateSummary(messages: Array<{ role: string; content: string }>): string {
    if (messages.length === 0) return 'Empty session';

    // Extract key topics from messages
    const topics = new Set<string>();
    const actions = new Set<string>();

    for (const msg of messages) {
      const content = msg.content;
      // Simple topic extraction
      if (content.includes('implement')) topics.add('implementation');
      if (content.includes('fix')) topics.add('bug fix');
      if (content.includes('refactor')) topics.add('refactoring');
      if (content.includes('test')) topics.add('testing');
      if (content.includes('debug')) topics.add('debugging');
      if (content.includes('deploy')) topics.add('deployment');
      if (content.includes('review')) topics.add('review');
    }

    const topicList = [...topics].join(', ');
    return `Session covering ${topicList || 'general work'}. ${messages.length} messages exchanged.`;
  }

  private generateCurrentState(session: {
    topics: string[];
    filesModified?: string[];
    pendingWork?: string[];
  }): string {
    let state = `Current work involves: ${session.topics.join(', ') || 'unspecified topics'}.`;

    if (session.filesModified && session.filesModified.length > 0) {
      state += ` Files modified: ${session.filesModified.length}.`;
    }

    if (session.pendingWork && session.pendingWork.length > 0) {
      state += ` Pending: ${session.pendingWork.length} items.`;
    }

    return state;
  }

  private extractContextFromMessages(
    messages: Array<{ role: string; content: string }>
  ): ContextEntry[] {
    const entries: ContextEntry[] = [];

    // Extract file references
    const filePattern = /[\w-/]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp)/gi;
    const seenFiles = new Set<string>();

    for (const msg of messages) {
      const matches = msg.content.match(filePattern) || [];
      for (const file of matches) {
        if (!seenFiles.has(file)) {
          seenFiles.add(file);
          entries.push({
            type: 'file',
            name: file,
            description: `Referenced in session`,
            location: file,
            importance: 0.8,
          });
        }
      }
    }

    return entries;
  }

  private generateWarnings(session: {
    pendingWork?: string[];
    filesModified?: string[];
    topics: string[];
  }): string[] {
    const warnings: string[] = [];

    if (session.pendingWork && session.pendingWork.length > 0) {
      warnings.push(`${session.pendingWork.length} pending work item(s) not completed`);
    }

    if (session.filesModified && session.filesModified.length > 0) {
      warnings.push(`${session.filesModified.length} file(s) modified but not committed`);
    }

    return warnings;
  }

  private generateNextSteps(session: {
    topics: string[];
    pendingWork?: string[];
    filesModified?: string[];
  }): string[] {
    const steps: string[] = [];

    if (session.pendingWork && session.pendingWork.length > 0) {
      steps.push(...session.pendingWork.map(w => `Complete: ${w}`));
    }

    if (session.filesModified && session.filesModified.length > 0) {
      steps.push('Review and commit modified files');
    }

    if (session.topics.includes('testing')) {
      steps.push('Run test suite to verify changes');
    }

    if (session.topics.includes('deployment')) {
      steps.push('Verify deployment in staging environment');
    }

    return steps.slice(0, 5);
  }

  private generateId(): string {
    return `handoff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private saveActive(handoff: HandoffDocument): void {
    ensureDir(join(this.projectRoot, HANDOFF_DIR));
    const md = this.exportMarkdown(handoff);
    writeFileSync(this.activeHandoffPath, md, 'utf-8');
  }

  private load(): void {
    ensureDir(join(this.projectRoot, HANDOFF_DIR));

    if (existsSync(this.handoffsPath)) {
      try {
        const content = readFileSync(this.handoffsPath, 'utf-8');
        const data = JSON.parse(content);
        for (const h of data.handoffs || []) {
          this.handoffs.set(h.id, h);
        }
      } catch (error) {
        console.error('Failed to load handoffs:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, HANDOFF_DIR));

    writeFileSync(this.handoffsPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      handoffs: [...this.handoffs.values()],
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, ProactiveHandoff> = new Map();

export function getProactiveHandoff(projectRoot: string = process.cwd()): ProactiveHandoff {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new ProactiveHandoff(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { HANDOFF_DIR };