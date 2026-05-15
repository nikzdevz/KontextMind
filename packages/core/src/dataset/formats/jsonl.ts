// JSONL Formatter - Export training records as JSON Lines
import type { TrainingRecord } from '../types.js';

export interface JSONLOptions {
  includeMetadata?: boolean;
  compact?: boolean;
}

// Format records as JSONL (one JSON object per line)
export function toJSONL(records: TrainingRecord[], options: JSONLOptions = {}): string {
  return records.map(record => {
    const formatted = formatRecordForJSONL(record, options);
    return JSON.stringify(formatted);
  }).join('\n');
}

// Format a single record for JSONL export
function formatRecordForJSONL(record: TrainingRecord, options: JSONLOptions): Record<string, unknown> {
  if (options.compact) {
    return {
      id: record.id,
      q: record.question,
      a: record.answer,
      c: record.category,
      t: record.tags,
      s: record.metadata.source,
      sc: Math.round(record.quality.score * 100) / 100,
      cf: Math.round(record.quality.confidence * 100) / 100,
    };
  }

  return {
    id: record.id,
    question: record.question,
    answer: record.answer,
    category: record.category,
    tags: record.tags,
    quality: {
      score: Math.round(record.quality.score * 1000) / 1000,
      confidence: Math.round(record.quality.confidence * 1000) / 1000,
      feedback: record.quality.feedback,
      isCodeFiltered: record.quality.isCodeFiltered,
      conversationTurn: record.quality.conversationTurn,
    },
    metadata: options.includeMetadata ? {
      source: record.metadata.source,
      tier: record.metadata.tier,
      sessionId: record.metadata.sessionId,
      createdAt: record.metadata.createdAt,
      version: record.metadata.version,
      topics: record.metadata.topics,
    } : undefined,
    conversation: record.conversation,
    context: record.context,
  };
}

// Parse JSONL back to training records
export function fromJSONL(content: string): TrainingRecord[] {
  const lines = content.split('\n').filter(l => l.trim());
  const records: TrainingRecord[] = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      records.push(parseRecord(obj));
    } catch {
      // Skip invalid lines
    }
  }

  return records;
}

// Parse a JSON object back to TrainingRecord
function parseRecord(obj: Record<string, unknown>): TrainingRecord {
  // Handle compact format
  if (obj.q !== undefined && obj.a !== undefined) {
    return {
      id: obj.id as string,
      question: obj.q as string,
      answer: obj.a as string,
      category: (obj.c as string) || 'general',
      tags: (obj.t as string[]) || [],
      quality: {
        score: (obj.sc as number) || 0,
        confidence: (obj.cf as number) || 0,
        feedback: null,
        isCodeFiltered: false,
        conversationTurn: null,
      },
      metadata: {
        source: (obj.s as 'cli' | 'api' | 'mcp') || 'cli',
        tier: 0,
        sessionId: null,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        topics: [],
      },
    };
  }

  // Standard format
  return obj as unknown as TrainingRecord;
}

// Export with line numbers for debugging
export function toJSONLWithLineNumbers(records: TrainingRecord[]): string {
  return records.map((record, index) => {
    return `${String(index + 1).padStart(6, ' ')} ${JSON.stringify(record)}`;
  }).join('\n');
}