// ChatML Formatter - Export training records in ChatML format for chat-based models
import type { TrainingRecord } from '../types.js';

export interface ChatMLOptions {
  systemPrompt?: string;
  includeMetadata?: boolean;
}

// Default system prompt for training
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant for a software project. Answer questions about the project clearly and accurately. Do not output code snippets or file paths.`;

// Format records as ChatML (Chat Markup Language)
export function toChatML(records: TrainingRecord[], options: ChatMLOptions = {}): string {
  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  return records.map(record => {
    const formatted = formatAsChatMLMessage(record, systemPrompt, options.includeMetadata);
    return JSON.stringify(formatted);
  }).join('\n');
}

// Format a single record as ChatML message format
function formatAsChatMLMessage(
  record: TrainingRecord,
  systemPrompt: string,
  includeMetadata?: boolean
): Record<string, unknown> {
  const message: Record<string, unknown> = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: record.question },
      { role: 'assistant', content: record.answer },
    ],
  };

  if (includeMetadata) {
    message.metadata = {
      id: record.id,
      category: record.category,
      tags: record.tags,
      quality: record.quality,
      source: record.metadata.source,
    };
  }

  return message;
}

// Format as single-turn ChatML (no system prompt)
export function toChatMLSingle(records: TrainingRecord[]): string {
  return records.map(record => {
    return JSON.stringify({
      messages: [
        { role: 'user', content: record.question },
        { role: 'assistant', content: record.answer },
      ],
    });
  }).join('\n');
}

// Format as multi-turn conversation (from session data)
export function toChatMLMultiTurn(records: TrainingRecord[]): string {
  return records
    .filter(record => record.conversation?.turns)
    .map(record => {
      const messages: Array<{ role: string; content: string }> = [];

      for (const turn of record.conversation!.turns) {
        messages.push({ role: 'user', content: turn.question });
        messages.push({ role: 'assistant', content: turn.answer });
      }

      // Add current Q&A
      messages.push({ role: 'user', content: record.question });
      messages.push({ role: 'assistant', content: record.answer });

      return JSON.stringify({ messages });
    }).join('\n');
}

// Parse ChatML back to training records
export function fromChatML(content: string): Array<{ question: string; answer: string }> {
  const lines = content.split('\n').filter(l => l.trim());
  const results: Array<{ question: string; answer: string }> = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const messages = obj.messages || [];

      // Find user and assistant messages
      const userMsg = messages.find((m: { role: string }) => m.role === 'user');
      const assistantMsg = messages.find((m: { role: string }) => m.role === 'assistant');

      if (userMsg && assistantMsg) {
        results.push({
          question: userMsg.content,
          answer: assistantMsg.content,
        });
      }
    } catch {
      // Skip invalid lines
    }
  }

  return results;
}