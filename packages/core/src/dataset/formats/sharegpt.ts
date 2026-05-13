// ShareGPT Formatter - Export training records in ShareGPT format
import type { TrainingRecord } from '../types.js';

export interface ShareGPTOptions {
  category?: string;
  tags?: string[];
  includeMetadata?: boolean;
}

// Format records as ShareGPT (ShareGPT compatible format)
export function toShareGPT(records: TrainingRecord[], options: ShareGPTOptions = {}): string {
  return records.map(record => {
    const formatted = formatAsShareGPT(record, options);
    return JSON.stringify(formatted);
  }).join('\n');
}

// Format a single record as ShareGPT
function formatAsShareGPT(record: TrainingRecord, options?: ShareGPTOptions): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: record.id,
    conversations: [
      { from: 'human', value: record.question },
      { from: 'gpt', value: record.answer },
    ],
  };

  // Add category and tags
  if (options?.category) {
    item.category = options.category;
  } else {
    item.category = record.category;
  }

  if (options?.tags) {
    item.tags = options.tags;
  } else {
    item.tags = record.tags;
  }

  // Include metadata if requested
  if (options?.includeMetadata !== false) {
    item.metadata = {
      quality: record.quality,
      source: record.metadata.source,
      tier: record.metadata.tier,
      sessionId: record.metadata.sessionId,
      createdAt: record.metadata.createdAt,
      topics: record.metadata.topics,
      version: record.metadata.version,
    };
  }

  return item;
}

// Format as multi-turn ShareGPT (session-based)
export function toShareGPTMultiTurn(records: TrainingRecord[]): string {
  return records
    .filter(record => record.conversation?.turns)
    .map(record => {
      const conversations: Array<{ from: string; value: string }> = [];

      for (const turn of record.conversation!.turns) {
        conversations.push({ from: 'human', value: turn.question });
        conversations.push({ from: 'gpt', value: turn.answer });
      }

      // Add current Q&A
      conversations.push({ from: 'human', value: record.question });
      conversations.push({ from: 'gpt', value: record.answer });

      return JSON.stringify({
        id: record.id,
        conversations,
        category: record.category,
        tags: record.tags,
        metadata: {
          quality: record.quality,
          source: record.metadata.source,
          sessionId: record.metadata.sessionId,
        },
      });
    }).join('\n');
}

// Parse ShareGPT format back to training records
export function fromShareGPT(content: string): TrainingRecord[] {
  const lines = content.split('\n').filter(l => l.trim());
  const records: TrainingRecord[] = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const convs = obj.conversations || [];

      // Find human and gpt messages
      const humanMsg = convs.find((c: { from: string }) => c.from === 'human');
      const gptMsg = convs.find((c: { from: string }) => c.from === 'gpt');

      if (humanMsg && gptMsg) {
        const record: TrainingRecord = {
          id: obj.id || generateId(),
          question: humanMsg.value,
          answer: gptMsg.value,
          category: obj.category || 'general',
          tags: obj.tags || [],
          quality: obj.metadata?.quality || {
            score: 0.5,
            confidence: 0.5,
            feedback: null,
            isCodeFiltered: false,
            conversationTurn: null,
          },
          metadata: {
            source: obj.metadata?.source || 'cli',
            tier: obj.metadata?.tier || 0,
            sessionId: obj.metadata?.sessionId || null,
            createdAt: obj.metadata?.createdAt || new Date().toISOString(),
            version: obj.metadata?.version || '1.0.0',
            topics: obj.metadata?.topics || [],
          },
        };
        records.push(record);
      }
    } catch {
      // Skip invalid lines
    }
  }

  return records;
}

// Generate a simple ID
function generateId(): string {
  return `sgpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Convert ShareGPT to ChatML format
export function shareGPTToChatML(records: TrainingRecord[]): string {
  return records.map(record => {
    return JSON.stringify({
      messages: [
        { role: 'user', content: record.question },
        { role: 'assistant', content: record.answer },
      ],
      metadata: {
        id: record.id,
        category: record.category,
        tags: record.tags,
      },
    });
  }).join('\n');
}