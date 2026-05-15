/**
 * Semantic Memory Module
 *
 * Stores learned knowledge from interactions, summaries, and Q&A events.
 * Used by BrainAsk and LearningBridge to provide learned context.
 */

export interface SemanticMemoryEntry {
  id: string;
  key: string;
  content: string;
  source?: string;
  tags?: string[];
  importance?: number;
  accessCount?: number;
  metadata: Record<string, any>;
}

export interface RecallOptions {
  limit?: number;
  tags?: string[];
}

export interface SemanticMemoryStore {
  store(key: string, content: string, metadata?: Record<string, any>): Promise<void>;
  recall(query: string, options?: RecallOptions): Promise<SemanticMemoryEntry[]>;
  get(key: string): Promise<SemanticMemoryEntry | null>;
  getAll(): SemanticMemoryEntry[];
  clear(): void;
}

const memoryStore: Map<string, SemanticMemoryEntry> = new Map();

export function getSemanticMemory(projectRoot: string): SemanticMemoryStore {
  return {
    async store(key: string, content: string, metadata: Record<string, any> = {}): Promise<void> {
      const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      memoryStore.set(key, {
        id,
        key,
        content,
        source: metadata.source,
        tags: metadata.tags || [],
        importance: metadata.importance || 0.5,
        accessCount: 0,
        metadata: { ...metadata, projectRoot, timestamp: Date.now() },
      });
    },

    async recall(query: string, options: RecallOptions = {}): Promise<SemanticMemoryEntry[]> {
      const queryLower = query.toLowerCase();
      const limit = options.limit || 10;
      const results: SemanticMemoryEntry[] = [];

      for (const entry of memoryStore.values()) {
        const contentMatch = entry.content.toLowerCase().includes(queryLower);
        const keyMatch = entry.key.toLowerCase().includes(queryLower);
        const tagMatch = entry.tags?.some(tag => tag.toLowerCase().includes(queryLower));

        if (contentMatch || keyMatch || tagMatch) {
          // Update access count
          entry.accessCount = (entry.accessCount || 0) + 1;
          results.push(entry);
        }
      }

      // Sort by relevance (importance * accessCount)
      results.sort((a, b) => {
        const scoreA = (a.importance || 0.5) * Math.log((a.accessCount || 0) + 1);
        const scoreB = (b.importance || 0.5) * Math.log((b.accessCount || 0) + 1);
        return scoreB - scoreA;
      });

      return results.slice(0, limit);
    },

    async get(key: string): Promise<SemanticMemoryEntry | null> {
      return memoryStore.get(key) || null;
    },

    getAll(): SemanticMemoryEntry[] {
      return Array.from(memoryStore.values());
    },

    clear(): void {
      memoryStore.clear();
    },
  };
}

export { memoryStore };