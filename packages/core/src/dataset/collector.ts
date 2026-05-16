// Dataset Collector - Gathers and merges data from multiple sources
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  TrainingRecord,
  DatasetFilters,
  DatasetSource,
  DatasetStatistics,
} from './types.js';
import type { QNAEvent } from '../chatbot/chatbot-types.js';

export interface CollectOptions {
  sources?: DatasetSource[];
  filters?: DatasetFilters;
}

export interface CollectedData {
  qnaEvents: QNAEvent[];
  feedbackRecords: FeedbackRecord[];
  qaHistory: QAHistoryRecord[];
  sessions: SessionRecord[];
}

export interface FeedbackRecord {
  qa_id: string;
  signal: 'helpful' | 'not_helpful' | 'neutral';
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface QAHistoryRecord {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  sources: Array<{ type: string; name?: string; relevanceScore?: number }>;
  timestamp: string;
  tier?: number;
}

export interface SessionRecord {
  id: string;
  projectName: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    responseId?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  topics: string[];
}

// Load Q&A events from JSONL - reads from NEW unified location
export function loadQNAEvents(projectRoot: string): QNAEvent[] {
  // Primary: new unified path
  const newPath = join(projectRoot, '.kontextmind', 'chatbot', 'qa-history.jsonl');
  const legacyPath = join(projectRoot, '.logs', 'qna-events.jsonl');

  const eventsPath = existsSync(newPath) ? newPath : (existsSync(legacyPath) ? legacyPath : null);
  if (!eventsPath) return [];

  try {
    const content = readFileSync(eventsPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const events: QNAEvent[] = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        events.push(event as QNAEvent);
      } catch {
        // Skip invalid lines
      }
    }

    return events;
  } catch {
    return [];
  }
}

// Load feedback records
export function loadFeedbackRecords(projectRoot: string): FeedbackRecord[] {
  const feedbackPath = join(projectRoot, '.kontextmind', 'chatbot', 'feedback.jsonl');
  if (!existsSync(feedbackPath)) return [];

  try {
    const content = readFileSync(feedbackPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const records: FeedbackRecord[] = [];

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        records.push(record as FeedbackRecord);
      } catch {
        // Skip invalid lines
      }
    }

    return records;
  } catch {
    return [];
  }
}

// Load Q&A history
export function loadQAHistory(projectRoot: string): QAHistoryRecord[] {
  const historyPath = join(projectRoot, '.kontextmind', 'chatbot', 'qa-history.jsonl');
  if (!existsSync(historyPath)) return [];

  try {
    const content = readFileSync(historyPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const records: QAHistoryRecord[] = [];

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        records.push(record as QAHistoryRecord);
      } catch {
        // Skip invalid lines
      }
    }

    return records;
  } catch {
    return [];
  }
}

// Load sessions - reads from both session files and session index
export function loadSessions(projectRoot: string): SessionRecord[] {
  const records: SessionRecord[] = [];
  const sessionsDir = join(projectRoot, '.kontextmind', 'sessions');
  const memoryDir = join(projectRoot, '.kontextmind', 'memory');

  // 1. Load from session JSON files
  if (existsSync(sessionsDir)) {
    try {
      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = readFileSync(join(sessionsDir, file), 'utf-8');
          const session = JSON.parse(content);
          records.push({
            id: session.id,
            projectName: session.projectName,
            messages: session.messages || [],
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            topics: session.context?.topics || [],
          });
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Directory access error
    }
  }

  // 2. Also load from session-index.json for richer session data
  const sessionIndexPath = join(memoryDir, 'session-index.json');
  if (existsSync(sessionIndexPath)) {
    try {
      const index = JSON.parse(readFileSync(sessionIndexPath, 'utf-8'));
      const sessions = index.sessions || [];

      for (const session of sessions) {
        // Add session index data if not already present
        if (!records.find(r => r.id === session.sessionId)) {
          records.push({
            id: session.sessionId,
            projectName: session.projectName,
            messages: [], // Session index doesn't store messages, just metadata
            createdAt: session.startTime,
            updatedAt: session.endTime || session.startTime,
            topics: session.topics || [],
          });
        }
      }
    } catch {
      // Skip invalid index
    }
  }

  return records;
}

// Collect all data from configured sources
export function collectData(projectRoot: string, options: CollectOptions = {}): CollectedData {
  const sources = options.sources || ['qna-events', 'feedback', 'qa-history', 'sessions'];

  const data: CollectedData = {
    qnaEvents: [],
    feedbackRecords: [],
    qaHistory: [],
    sessions: [],
  };

  if (sources.includes('qna-events')) {
    data.qnaEvents = loadQNAEvents(projectRoot);
  }

  if (sources.includes('feedback')) {
    data.feedbackRecords = loadFeedbackRecords(projectRoot);
  }

  if (sources.includes('qa-history')) {
    data.qaHistory = loadQAHistory(projectRoot);
  }

  if (sources.includes('sessions')) {
    data.sessions = loadSessions(projectRoot);
  }

  return data;
}

// Merge collected data into training records
export function mergeToTrainingRecords(
  data: CollectedData,
  filters: DatasetFilters
): TrainingRecord[] {
  const records: TrainingRecord[] = [];
  const seenQuestions = new Map<string, number>(); // question hash -> record index

  // Process Q&A events as primary source
  for (const event of data.qnaEvents) {
    // Apply filters
    if (event.confidence < filters.minConfidence) continue;

    // Filter by source
    if (filters.apiOnly && event.source !== 'api') continue;

    // Filter code requests
    if (!filters.includeCodeRequests && event.codeRequestDetected) continue;

    // Check date filter
    if (filters.since) {
      const eventDate = new Date(event.timestamp).getTime();
      const sinceDate = new Date(filters.since).getTime();
      if (eventDate < sinceDate) continue;
    }

    // Check age filter
    if (filters.maxAgeDays) {
      const eventDate = new Date(event.timestamp).getTime();
      const maxAge = filters.maxAgeDays * 24 * 60 * 60 * 1000;
      if (Date.now() - eventDate > maxAge) continue;
    }

    // Find matching feedback
    const feedback = data.feedbackRecords.find(f => f.qa_id === event.responseId);

    // Get conversation turns if session-based
    let conversationTurn: number | null = null;
    let sessionTopics: string[] = [];
    if (event.sessionId) {
      const session = data.sessions.find(s => s.id === event.sessionId);
      if (session) {
        sessionTopics = session.topics;
        // Count user messages up to this response
        const userMsgs = session.messages.filter(m => m.role === 'user');
        conversationTurn = userMsgs.length;
      }
    }
    conversationTurn = event.conversationTurn || conversationTurn;

    // Create training record
    const record: TrainingRecord = {
      id: event.responseId,
      question: event.question,
      answer: event.answer,
      category: categorizeQuestion(event.question),
      tags: extractTags(event),
      quality: {
        score: computeQualityScore(event, feedback),
        confidence: event.confidence,
        feedback: feedback?.signal === 'helpful' ? 'helpful' :
                 feedback?.signal === 'not_helpful' ? 'not_helpful' :
                 event.feedbackReceived === 'like' ? 'helpful' :
                 event.feedbackReceived === 'dislike' ? 'not_helpful' : null,
        isCodeFiltered: event.codeRequestDetected || false,
        conversationTurn,
      },
      metadata: {
        source: event.source,
        tier: 0, // Would come from KB tier system
        sessionId: event.sessionId || null,
        createdAt: event.timestamp,
        version: '1.0.0',
        topics: sessionTopics,
      },
    };

    // Check for duplicates
    const questionHash = simpleHash(event.question);
    const existingIndex = seenQuestions.get(questionHash);
    if (existingIndex !== undefined) {
      // Keep higher quality record
      if (record.quality.score > records[existingIndex].quality.score) {
        records[existingIndex] = record;
      }
    } else {
      seenQuestions.set(questionHash, records.length);
      records.push(record);
    }
  }

  return records;
}

// Simple hash function for deduplication
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}

// Categorize question for training
function categorizeQuestion(question: string): string {
  const q = question.toLowerCase();

  if (q.includes('setup') || q.includes('install') || q.includes('config')) return 'setup';
  if (q.includes('how') || q.includes('what') || q.includes('why')) return 'explanation';
  if (q.includes('error') || q.includes('bug') || q.includes('fix')) return 'troubleshooting';
  if (q.includes('api') || q.includes('endpoint') || q.includes('request')) return 'api';
  if (q.includes('deploy') || q.includes('production') || q.includes('release')) return 'deployment';
  if (q.includes('security') || q.includes('auth') || q.includes('permission')) return 'security';
  if (q.includes('database') || q.includes('query') || q.includes('data')) return 'database';

  return 'general';
}

// Extract tags from QNA event
function extractTags(event: QNAEvent): string[] {
  const tags: string[] = [];

  tags.push(event.source);
  tags.push(event.mode);

  if (event.codeRequestDetected) tags.push('code-request');
  if (event.feedbackReceived) tags.push(`feedback-${event.feedbackReceived}`);
  if (event.sessionId) tags.push('session-based');

  if (event.sources.length > 0) {
    tags.push(...event.sources.slice(0, 3));
  }

  return tags;
}

// Compute quality score for a record
function computeQualityScore(event: QNAEvent, feedback?: FeedbackRecord): number {
  let score = event.confidence * 0.4;

  // Feedback signal
  if (feedback?.signal === 'helpful' || event.feedbackReceived === 'like') {
    score += 0.3;
  } else if (feedback?.signal === 'not_helpful' || event.feedbackReceived === 'dislike') {
    score -= 0.2;
  }

  // Source priority
  const sourceWeights: Record<string, number> = { api: 0.15, mcp: 0.08, cli: 0.0 };
  score += sourceWeights[event.source] || 0;

  // Code request penalty
  if (event.codeRequestDetected && !event.feedbackReceived) {
    score -= 0.15;
  }

  // Session bonus
  if (event.sessionId) {
    score += 0.05;
    if (event.conversationTurn && event.conversationTurn > 1) {
      score += 0.05;
    }
  }

  return Math.max(0, Math.min(1, score));
}

// Compute dataset statistics
export function computeStatistics(records: TrainingRecord[]): DatasetStatistics {
  const stats: DatasetStatistics = {
    bySource: {},
    byTier: {},
    byFeedback: {},
    averageQuality: 0,
    sessionBased: 0,
    conversationTurns: [],
    codeRequests: 0,
    codeRequestDislikes: 0,
  };

  let totalQuality = 0;

  for (const record of records) {
    // By source
    const source = record.metadata.source;
    stats.bySource[source] = (stats.bySource[source] || 0) + 1;

    // By tier
    const tier = record.metadata.tier;
    stats.byTier[tier] = (stats.byTier[tier] || 0) + 1;

    // By feedback
    const feedback = record.quality.feedback || 'neutral';
    stats.byFeedback[feedback] = (stats.byFeedback[feedback] || 0) + 1;

    // Quality sum
    totalQuality += record.quality.score;

    // Session-based count
    if (record.metadata.sessionId) {
      stats.sessionBased++;
    }

    // Conversation turns
    if (record.quality.conversationTurn !== null) {
      stats.conversationTurns.push(record.quality.conversationTurn);
    }

    // Code requests
    if (record.quality.isCodeFiltered) {
      stats.codeRequests++;
      if (record.quality.feedback === 'not_helpful') {
        stats.codeRequestDislikes++;
      }
    }
  }

  stats.averageQuality = records.length > 0 ? totalQuality / records.length : 0;

  return stats;
}