/**
 * Dynamic Context Windows
 *
 * Sliding/priority context windows that adapt based on task requirements.
 * Prioritizes what matters right now, similar to Hermes compression but smarter.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const CONTEXT_DIR = '.kontextmind/context';

export interface ContextElement {
  id: string;
  content: any;
  type: 'code' | 'summary' | 'decision' | 'skill' | 'memory' | 'conversation' | 'file' | 'entity';
  importance: number;       // 0-1, user/task declared
  freshness: number;       // 0-1, how recent
  relevance: number;       // 0-1, to current task
  size: number;           // Token cost
  dependencies: string[];  // Other elements it depends on
  source: string;          // Where it came from
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
  compressed?: boolean;    // Has been compressed
  compressedTo?: number;   // Original size if compressed
}

export interface ContextWindow {
  id: string;
  elements: ContextElement[];
  totalSize: number;
  maxSize: number;
  createdAt: string;
  lastUpdated: string;
  score: number;  // Overall quality score
}

export interface TokenAllocation {
  context: number;     // Project context
  memory: number;      // Cross-session memory
  tools: number;       // Tool schemas
  response: number;   // Expected output
  buffer: number;      // Safety margin
}

export interface ScoredElement {
  element: ContextElement;
  score: number;
  reason: string;
}

export interface ContextStats {
  totalElements: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
  averageImportance: number;
  averageFreshness: number;
  compressionRatio: number;
}

export interface WindowConfig {
  maxSize: number;
  minElements: number;
  maxElements: number;
  compressionThreshold: number;
  priorityThreshold: number;
  autoExpand: boolean;
  preserveHead: number;
  preserveTail: number;
}

const DEFAULT_CONFIG: WindowConfig = {
  maxSize: 15000,      // ~15k tokens default
  minElements: 5,
  maxElements: 50,
  compressionThreshold: 0.8,  // Compress when 80% full
  priorityThreshold: 0.3,      // Drop below 0.3 priority
  autoExpand: false,
  preserveHead: 3,    // Always keep first 3 elements
  preserveTail: 5,    // Always keep last 5 elements
};

/**
 * Priority Queue implementation for context elements
 */
class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    this.items.push({ item, priority });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  toArray(): T[] {
    return this.items.map(i => i.item);
  }
}

/**
 * DynamicContextEngine - Smart context management
 */
export class DynamicContextEngine {
  private window: ContextWindow;
  private config: WindowConfig;
  private projectRoot: string;
  private windowPath: string;
  private history: ContextWindow[] = [];

  constructor(projectRoot: string, config: Partial<WindowConfig> = {}) {
    this.projectRoot = projectRoot;
    this.windowPath = join(projectRoot, CONTEXT_DIR, 'window.json');
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.window = this.createEmptyWindow();
    this.load();
  }

  // ============ Core Methods ============

  /**
   * Add element to context
   */
  add(element: Omit<ContextElement, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): ContextElement {
    const fullElement: ContextElement = {
      ...element,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 0,
    };

    this.window.elements.push(fullElement);
    this.window.lastUpdated = new Date().toISOString();

    // Check if we need to maintain window size
    if (this.window.totalSize > this.config.maxSize) {
      this.maintainWindow();
    }

    this.save();
    return fullElement;
  }

  /**
   * Add multiple elements
   */
  addBatch(elements: Array<Omit<ContextElement, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>>): ContextElement[] {
    const added: ContextElement[] = [];
    for (const element of elements) {
      added.push(this.add(element));
    }
    return added;
  }

  /**
   * Get current window elements
   */
  getElements(options?: {
    type?: ContextElement['type'];
    minScore?: number;
    limit?: number;
  }): ContextElement[] {
    let elements = [...this.window.elements];

    if (options?.type) {
      elements = elements.filter(e => e.type === options.type);
    }

    if (options?.minScore !== undefined) {
      elements = elements.filter(e => this.scoreElement(e) >= options.minScore!);
    }

    // Sort by score
    elements = elements.sort((a, b) => this.scoreElement(b) - this.scoreElement(a));

    if (options?.limit) {
      elements = elements.slice(0, options.limit);
    }

    return elements;
  }

  /**
   * Update element relevance based on task
   */
  updateRelevance(taskContext: string): void {
    // This would normally use embeddings to calculate relevance
    // For now, simple keyword matching

    for (const element of this.window.elements) {
      const content = typeof element.content === 'string'
        ? element.content.toLowerCase()
        : JSON.stringify(element.content).toLowerCase();

      const taskWords = taskContext.toLowerCase().split(/\s+/);
      let matches = 0;

      for (const word of taskWords) {
        if (word.length > 3 && content.includes(word)) {
          matches++;
        }
      }

      // Relevance based on word matches
      element.relevance = Math.min(1, matches / Math.max(taskWords.length, 1));
    }

    this.window.lastUpdated = new Date().toISOString();
    this.save();
  }

  /**
   * Access element (updates access stats)
   */
  access(id: string): ContextElement | null {
    const element = this.window.elements.find(e => e.id === id);
    if (element) {
      element.lastAccessed = new Date().toISOString();
      element.accessCount++;
      this.window.lastUpdated = new Date().toISOString();
      this.save();
    }
    return element || null;
  }

  /**
   * Remove element
   */
  remove(id: string): boolean {
    const index = this.window.elements.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.window.elements.splice(index, 1);
    this.recalculateSize();
    this.window.lastUpdated = new Date().toISOString();
    this.save();
    return true;
  }

  // ============ Window Management ============

  /**
   * Maintain window within size limits
   */
  maintainWindow(): void {
    if (this.window.totalSize <= this.config.maxSize) return;

    // Score all elements
    const scored = this.window.elements.map(e => ({
      element: e,
      score: this.scoreElement(e),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Identify elements to keep
    const toKeep: Set<string> = new Set();

    // Always preserve head
    for (let i = 0; i < Math.min(this.config.preserveHead, scored.length); i++) {
      toKeep.add(scored[i].element.id);
    }

    // Always preserve tail
    for (let i = Math.max(0, scored.length - this.config.preserveTail); i < scored.length; i++) {
      toKeep.add(scored[i].element.id);
    }

    // Add high-scoring elements until we hit size limit
    let currentSize = this.calculatePreservedSize(toKeep);

    for (const item of scored) {
      if (toKeep.has(item.element.id)) continue;
      if (currentSize + item.element.size <= this.config.maxSize * 0.9) {
        toKeep.add(item.element.id);
        currentSize += item.element.size;
      }
    }

    // Remove elements not in toKeep
    this.window.elements = this.window.elements.filter(e => toKeep.has(e.id));
    this.recalculateSize();
  }

  /**
   * Compress element (reduce size while preserving meaning)
   */
  compress(elementId: string, targetSize?: number): boolean {
    const element = this.window.elements.find(e => e.id === elementId);
    if (!element) return false;

    // Mark as compressed
    element.compressed = true;
    element.compressedTo = element.size;

    // In a real implementation, this would call an LLM to summarize
    // For now, we just mark it
    if (typeof element.content === 'string' && element.content.length > 500) {
      // Simple compression: keep first and last 25%
      const length = element.content.length;
      const keepLength = Math.floor(length * 0.3);
      element.content = element.content.slice(0, keepLength) + '\n...\n' + element.content.slice(-keepLength);
    }

    this.window.lastUpdated = new Date().toISOString();
    this.save();
    return true;
  }

  /**
   * Expand element (restore full content)
   */
  expand(elementId: string): boolean {
    const element = this.window.elements.find(e => e.id === elementId);
    if (!element || !element.compressed) return false;

    // In a real implementation, this would restore from compressed version
    element.compressed = false;
    if (element.compressedTo) {
      element.size = element.compressedTo;
      element.compressedTo = undefined;
    }

    this.window.lastUpdated = new Date().toISOString();
    this.save();
    return true;
  }

  /**
   * Clear entire window
   */
  clear(): void {
    // Save current window to history
    this.history.push({ ...this.window });
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }

    this.window = this.createEmptyWindow();
    this.save();
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.window = this.createEmptyWindow();
    this.history = [];
    this.save();
  }

  // ============ Token Budget ============

  /**
   * Calculate token allocation for a task
   */
  calculateBudget(taskType: string): TokenAllocation {
    const total = this.config.maxSize;

    // Different allocations based on task type
    switch (taskType) {
      case 'code_write':
        return {
          context: Math.floor(total * 0.5),   // Heavy on project context
          memory: Math.floor(total * 0.2),
          tools: Math.floor(total * 0.15),
          response: Math.floor(total * 0.1),
          buffer: Math.floor(total * 0.05),
        };

      case 'debug':
        return {
          context: Math.floor(total * 0.3),   // More memory (error history)
          memory: Math.floor(total * 0.4),
          tools: Math.floor(total * 0.1),
          response: Math.floor(total * 0.1),
          buffer: Math.floor(total * 0.1),
        };

      case 'refactor':
        return {
          context: Math.floor(total * 0.4),   // Balanced, more on context
          memory: Math.floor(total * 0.25),
          tools: Math.floor(total * 0.15),
          response: Math.floor(total * 0.15),
          buffer: Math.floor(total * 0.05),
        };

      case 'documentation':
        return {
          context: Math.floor(total * 0.35),
          memory: Math.floor(total * 0.3),
          tools: Math.floor(total * 0.1),
          response: Math.floor(total * 0.2),
          buffer: Math.floor(total * 0.05),
        };

      default:
        return {
          context: Math.floor(total * 0.4),
          memory: Math.floor(total * 0.25),
          tools: Math.floor(total * 0.15),
          response: Math.floor(total * 0.15),
          buffer: Math.floor(total * 0.05),
        };
    }
  }

  /**
   * Check if approaching limits
   */
  checkLimits(): { warning: string; percentage: number }[] {
    const warnings: { warning: string; percentage: number }[] = [];
    const percentage = (this.window.totalSize / this.config.maxSize) * 100;

    if (percentage >= 90) {
      warnings.push({ warning: 'Context window is nearly full', percentage: 90 });
    } else if (percentage >= 80) {
      warnings.push({ warning: 'Context window is getting full', percentage: 80 });
    }

    return warnings;
  }

  // ============ Analytics ============

  /**
   * Get context statistics
   */
  getStats(): ContextStats {
    const stats: ContextStats = {
      totalElements: this.window.elements.length,
      totalSize: this.window.totalSize,
      byType: {},
      averageImportance: 0,
      averageFreshness: 0,
      compressionRatio: 0,
    };

    let totalImportance = 0;
    let totalFreshness = 0;
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    for (const element of this.window.elements) {
      // Type breakdown
      if (!stats.byType[element.type]) {
        stats.byType[element.type] = { count: 0, size: 0 };
      }
      stats.byType[element.type].count++;
      stats.byType[element.type].size += element.size;

      // Averages
      totalImportance += element.importance;
      totalFreshness += element.freshness;

      // Compression ratio
      if (element.compressed && element.compressedTo) {
        totalOriginalSize += element.compressedTo;
        totalCompressedSize += element.size;
      }
    }

    const count = this.window.elements.length || 1;
    stats.averageImportance = totalImportance / count;
    stats.averageFreshness = totalFreshness / count;
    stats.compressionRatio = totalOriginalSize > 0
      ? (totalOriginalSize - totalCompressedSize) / totalOriginalSize
      : 0;

    return stats;
  }

  /**
   * Get historical windows
   */
  getHistory(): ContextWindow[] {
    return [...this.history];
  }

  // ============ Serialization ============

  /**
   * Export current window
   */
  export(): ContextWindow {
    return { ...this.window };
  }

  /**
   * Import window
   */
  import(window: ContextWindow): void {
    this.history.push({ ...this.window });
    this.window = { ...window };
    this.save();
  }

  // ============ Private Methods ============

  private scoreElement(element: ContextElement): number {
    // Weighted scoring: importance * freshness * relevance

    // Recency factor (decays over time)
    const age = Date.now() - new Date(element.lastAccessed).getTime();
    const hoursSinceAccess = age / (1000 * 60 * 60);
    const recencyFactor = Math.max(0.1, 1 - (hoursSinceAccess / 168)); // Decays over a week

    // Base score
    const baseScore = element.importance * 0.4 + element.freshness * 0.2 + element.relevance * 0.4;

    // Adjust by recency
    const adjustedScore = baseScore * (0.5 + 0.5 * recencyFactor);

    // Access frequency bonus
    const accessBonus = Math.min(0.1, element.accessCount * 0.01);

    return Math.min(1, adjustedScore + accessBonus);
  }

  private calculatePreservedSize(ids: Set<string>): number {
    return this.window.elements
      .filter(e => ids.has(e.id))
      .reduce((sum, e) => sum + e.size, 0);
  }

  private recalculateSize(): void {
    this.window.totalSize = this.window.elements.reduce((sum, e) => sum + e.size, 0);
  }

  private createEmptyWindow(): ContextWindow {
    return {
      id: this.generateId(),
      elements: [],
      totalSize: 0,
      maxSize: this.config.maxSize,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      score: 0,
    };
  }

  private generateId(): string {
    return `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private load(): void {
    if (existsSync(this.windowPath)) {
      try {
        const content = readFileSync(this.windowPath, 'utf-8');
        const data = JSON.parse(content);
        this.window = { ...this.createEmptyWindow(), ...data };
      } catch (error) {
        console.error('Failed to load context window:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, CONTEXT_DIR));
    writeFileSync(this.windowPath, JSON.stringify(this.window, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, DynamicContextEngine> = new Map();

export function getDynamicContextEngine(
  projectRoot: string = process.cwd(),
  config?: Partial<WindowConfig>
): DynamicContextEngine {
  const key = `${projectRoot}:${JSON.stringify(config || {})}`;
  if (!instances.has(key)) {
    instances.set(key, new DynamicContextEngine(projectRoot, config));
  }
  return instances.get(key)!;
}

export { CONTEXT_DIR };