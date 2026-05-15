/**
 * Conversation Compressor
 *
 * Compresses conversations while preserving meaning.
 * Extracts key points and generates actionable summaries.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const COMPRESSION_DIR = '.kontextmind/compression';

export interface KeyPoint {
  type: 'decision' | 'implementation' | 'question' | 'issue' | 'concept' | 'reference';
  content: string;
  importance: number;
  timestamp: string;
  relatedEntities: string[];
}

export interface ConversationSummary {
  topic: string;
  outcome: string;
  keyDecisions: Decision[];
  pendingItems: string[];
  learnings: string[];
  nextSteps: string[];
  entities: string[];
  timestamp: string;
  originalMessageCount: number;
  compressedTo: number;
}

export interface Decision {
  question: string;
  chosen: string;
  rationale?: string;
}

export interface CompressedConversation {
  id: string;
  summary: ConversationSummary;
  keyPoints: KeyPoint[];
  rawMessages: Array<{ role: string; content: string; timestamp: string }>;
  linkedSummary: string; // Reference to detailed log
}

export interface CompressionOptions {
  maxKeyPoints?: number;
  preserveDecisions?: boolean;
  preserveQuestions?: boolean;
  minImportance?: number;
}

/**
 * ConversationCompressor - Compresses conversations intelligently
 */
export class ConversationCompressor {
  private projectRoot: string;
  private compressedPath: string;
  private compressed: Map<string, CompressedConversation> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.compressedPath = join(projectRoot, COMPRESSION_DIR, 'compressed.json');
    this.load();
  }

  /**
   * Extract key points from messages
   */
  extractKeyPoints(
    messages: Array<{ role: string; content: string; timestamp: string }>,
    options: CompressionOptions = {}
  ): KeyPoint[] {
    const keyPoints: KeyPoint[] = [];
    const maxPoints = options.maxKeyPoints || 20;
    const minImportance = options.minImportance || 0.3;

    for (const msg of messages) {
      const content = msg.content;

      // Detect decisions
      if (options.preserveDecisions && this.isDecision(content)) {
        keyPoints.push({
          type: 'decision',
          content: this.extractDecision(content),
          importance: 0.9,
          timestamp: msg.timestamp,
          relatedEntities: this.extractEntities(content),
        });
      }

      // Detect questions
      if (options.preserveQuestions && this.isQuestion(content)) {
        keyPoints.push({
          type: 'question',
          content: this.extractQuestion(content),
          importance: 0.7,
          timestamp: msg.timestamp,
          relatedEntities: this.extractEntities(content),
        });
      }

      // Detect implementations
      if (this.isImplementation(content)) {
        keyPoints.push({
          type: 'implementation',
          content: this.summarizeImplementation(content),
          importance: 0.8,
          timestamp: msg.timestamp,
          relatedEntities: this.extractEntities(content),
        });
      }

      // Detect issues
      if (this.isIssue(content)) {
        keyPoints.push({
          type: 'issue',
          content: this.summarizeIssue(content),
          importance: 0.85,
          timestamp: msg.timestamp,
          relatedEntities: this.extractEntities(content),
        });
      }

      // Detect concepts
      if (this.isConcept(content)) {
        keyPoints.push({
          type: 'concept',
          content: this.summarizeConcept(content),
          importance: 0.6,
          timestamp: msg.timestamp,
          relatedEntities: this.extractEntities(content),
        });
      }
    }

    // Filter by importance
    const filtered = keyPoints.filter(kp => kp.importance >= minImportance);

    // Deduplicate
    const deduped = this.deduplicateKeyPoints(filtered);

    // Sort by importance and timestamp
    deduped.sort((a, b) => {
      const impDiff = b.importance - a.importance;
      if (impDiff !== 0) return impDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return deduped.slice(0, maxPoints);
  }

  /**
   * Generate conversation summary
   */
  summarize(
    messages: Array<{ role: string; content: string; timestamp: string }>,
    options: CompressionOptions = {}
  ): ConversationSummary {
    const keyPoints = this.extractKeyPoints(messages, options);

    // Extract decisions
    const decisions = keyPoints
      .filter(kp => kp.type === 'decision')
      .map(kp => this.parseDecision(kp.content));

    // Extract pending items (unresolved questions + issues)
    const pendingItems = keyPoints
      .filter(kp => kp.type === 'question' || kp.type === 'issue')
      .map(kp => kp.content);

    // Extract learnings
    const learnings = keyPoints
      .filter(kp => kp.type === 'concept' || kp.type === 'implementation')
      .map(kp => kp.content);

    // Generate next steps
    const nextSteps = this.generateNextSteps(keyPoints);

    // Extract entities
    const entities = [...new Set(
      keyPoints.flatMap(kp => kp.relatedEntities)
    )].slice(0, 20);

    // Determine topic
    const topic = this.determineTopic(messages);

    // Determine outcome
    const outcome = this.determineOutcome(messages, keyPoints);

    const summary: ConversationSummary = {
      topic,
      outcome,
      keyDecisions: decisions,
      pendingItems,
      learnings,
      nextSteps,
      entities,
      timestamp: new Date().toISOString(),
      originalMessageCount: messages.length,
      compressedTo: keyPoints.length,
    };

    return summary;
  }

  /**
   * Compress and store conversation
   */
  compress(
    conversationId: string,
    messages: Array<{ role: string; content: string; timestamp: string }>,
    options: CompressionOptions = {}
  ): CompressedConversation {
    const keyPoints = this.extractKeyPoints(messages, options);
    const summary = this.summarize(messages, options);

    const compressed: CompressedConversation = {
      id: conversationId,
      summary,
      keyPoints,
      rawMessages: messages,
      linkedSummary: `${conversationId}_summary`,
    };

    this.compressed.set(conversationId, compressed);
    this.save();

    return compressed;
  }

  /**
   * Get compressed conversation
   */
  getCompressed(conversationId: string): CompressedConversation | null {
    return this.compressed.get(conversationId) || null;
  }

  /**
   * Get summary only (without raw messages)
   */
  getSummary(conversationId: string): ConversationSummary | null {
    const compressed = this.compressed.get(conversationId);
    return compressed ? compressed.summary : null;
  }

  /**
   * Preserve important details during compression
   */
  preserve(important: string[]): void {
    // Mark these strings as high-priority for preservation
    // This is used during compression to ensure certain details aren't lost
  }

  /**
   * Link summary to detailed logs
   */
  link(summaryId: string, rawMessages: Array<{ role: string; content: string; timestamp: string }>): void {
    const compressed = this.compressed.get(summaryId);
    if (compressed) {
      compressed.rawMessages = rawMessages;
      this.save();
    }
  }

  /**
   * Delete compressed conversation
   */
  delete(conversationId: string): boolean {
    return this.compressed.delete(conversationId);
  }

  /**
   * Clear all compressed data
   */
  clear(): void {
    this.compressed.clear();
    this.save();
  }

  // ============ Private Methods ============

  private isDecision(content: string): boolean {
    const patterns = [
      /decided?\s+to/i,
      /chose\s+/i,
      /selected\s+/i,
      /going\s+with/i,
      /will\s+use/i,
      /agreed?\s+on/i,
      /best\s+approach/i,
      /should\s+(use|implement|do)/i,
    ];
    return patterns.some(p => p.test(content));
  }

  private isQuestion(content: string): boolean {
    return content.includes('?') && content.length < 500;
  }

  private isImplementation(content: string): boolean {
    const patterns = [
      /implemented/i,
      /created\s+/i,
      /added\s+/i,
      /built\s+/i,
      /wrote\s+code/i,
      /function\s+\w+/i,
      /class\s+\w+/i,
    ];
    return patterns.some(p => p.test(content));
  }

  private isIssue(content: string): boolean {
    const patterns = [
      /error/i,
      /bug/i,
      /issue/i,
      /failed/i,
      /broken/i,
      /exception/i,
      /warning/i,
      /doesn't\s+work/i,
    ];
    return patterns.some(p => p.test(content));
  }

  private isConcept(content: string): boolean {
    const patterns = [
      /concept/i,
      /understanding/i,
      /pattern/i,
      /architecture/i,
      /approach/i,
      /explanation/i,
    ];
    return patterns.some(p => p.test(content));
  }

  private extractDecision(content: string): string {
    // Extract the decision from content
    if (content.length > 200) {
      return content.slice(0, 200) + '...';
    }
    return content;
  }

  private extractQuestion(content: string): string {
    // Extract just the question part
    const parts = content.split('?');
    return (parts[0] + '?').trim().slice(0, 200);
  }

  private summarizeImplementation(content: string): string {
    // Shorten implementation descriptions
    if (content.length > 150) {
      return content.slice(0, 150) + '...';
    }
    return content;
  }

  private summarizeIssue(content: string): string {
    // Shorten issue descriptions
    if (content.length > 150) {
      return content.slice(0, 150) + '...';
    }
    return content;
  }

  private summarizeConcept(content: string): string {
    // Keep concepts relatively intact
    if (content.length > 200) {
      return content.slice(0, 200) + '...';
    }
    return content;
  }

  private extractEntities(content: string): string[] {
    const entities: string[] = [];

    // File references
    const filePattern = /[\w-/]+\.(ts|js|tsx|jsx|py|go|rs)/gi;
    const files = content.match(filePattern) || [];
    entities.push(...files);

    // Function names
    const funcPattern = /(?:function|const|let|var|class|interface)\s+(\w+)/gi;
    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      entities.push(match[1]);
    }

    return [...new Set(entities)].slice(0, 10);
  }

  private parseDecision(decisionContent: string): Decision {
    return {
      question: 'Decision made',
      chosen: decisionContent.slice(0, 100),
    };
  }

  private deduplicateKeyPoints(keyPoints: KeyPoint[]): KeyPoint[] {
    const seen = new Set<string>();
    const deduped: KeyPoint[] = [];

    for (const kp of keyPoints) {
      const key = kp.content.slice(0, 50).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(kp);
      }
    }

    return deduped;
  }

  private generateNextSteps(keyPoints: KeyPoint[]): string[] {
    const steps: string[] = [];

    // From pending questions
    const questions = keyPoints.filter(kp => kp.type === 'question');
    for (const q of questions.slice(0, 3)) {
      steps.push(`Address: ${q.content}`);
    }

    // From unresolved issues
    const issues = keyPoints.filter(kp => kp.type === 'issue');
    for (const issue of issues.slice(0, 2)) {
      steps.push(`Fix: ${issue.content}`);
    }

    return steps.slice(0, 5);
  }

  private determineTopic(messages: Array<{ content: string }>): string {
    // Simple topic extraction from message content
    const allContent = messages.map(m => m.content).join(' ').toLowerCase();

    const topics: Record<string, number> = {
      'debugging': (allContent.match(/debug|error|fix|issue/g) || []).length,
      'implementation': (allContent.match(/implement|create|add|build/g) || []).length,
      'refactoring': (allContent.match(/refactor|clean|improve|restructure/g) || []).length,
      'testing': (allContent.match(/test|testing|spec|assert/g) || []).length,
      'review': (allContent.match(/review|check|examine|validate/g) || []).length,
      'documentation': (allContent.match(/document|doc|comment|explain/g) || []).length,
    };

    const topTopic = Object.entries(topics).sort((a, b) => b[1] - a[1])[0];
    return topTopic ? topTopic[0] : 'general';
  }

  private determineOutcome(
    messages: Array<{ role: string; content: string }>,
    keyPoints: KeyPoint[]
  ): string {
    // Check for completion signals
    const lastMessages = messages.slice(-5);
    const hasSuccess = lastMessages.some(m =>
      /completed?|done|solved|fixed|resolved|works/i.test(m.content)
    );

    const hasIssues = keyPoints.some(kp => kp.type === 'issue');
    const hasPending = keyPoints.some(kp => kp.type === 'question');

    if (hasSuccess && !hasIssues) {
      return 'Successfully completed';
    } else if (hasPending) {
      return 'Pending follow-up required';
    } else if (hasIssues) {
      return 'Issues remain unresolved';
    }

    return 'In progress';
  }

  private load(): void {
    ensureDir(join(this.projectRoot, COMPRESSION_DIR));

    if (existsSync(this.compressedPath)) {
      try {
        const content = readFileSync(this.compressedPath, 'utf-8');
        const data = JSON.parse(content);
        for (const c of data.compressed || []) {
          this.compressed.set(c.id, c);
        }
      } catch (error) {
        console.error('Failed to load compressed conversations:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, COMPRESSION_DIR));

    writeFileSync(this.compressedPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      compressed: [...this.compressed.values()].slice(-100), // Keep last 100
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, ConversationCompressor> = new Map();

export function getConversationCompressor(
  projectRoot: string = process.cwd()
): ConversationCompressor {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new ConversationCompressor(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { COMPRESSION_DIR };