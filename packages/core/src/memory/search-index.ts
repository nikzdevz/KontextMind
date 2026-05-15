// Search Index - Full-text search across all memory content
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
  SearchableEntry,
  SearchResult,
} from './memory-types.js';
import {
  loadSessionIndex,
} from './session-index.js';
import {
  loadTaskIndex,
  searchTasks,
} from './task-index.js';

/**
 * Search across all memory content (sessions, tasks, handoffs)
 */
export function searchMemory(
  projectRoot: string,
  query: string,
  options: {
    types?: ('task' | 'session' | 'handoff' | 'decision')[];
    days?: number;
    limit?: number;
  } = {}
): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const { types = ['task', 'session', 'handoff'], days = 30, limit = 20 } = options;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Search sessions
  if (types.includes('session')) {
    const sessionResults = searchInSessions(projectRoot, queryLower, cutoff, limit);
    results.push(...sessionResults);
  }

  // Search tasks
  if (types.includes('task')) {
    const taskResults = searchInTasks(projectRoot, queryLower, limit);
    results.push(...taskResults);
  }

  // Search handoffs
  if (types.includes('handoff')) {
    const handoffResults = searchInHandoffs(projectRoot, queryLower, cutoff, limit);
    results.push(...handoffResults);
  }

  // Sort by relevance and date
  results.sort((a, b) => {
    if (b.relevanceScore! - a.relevanceScore! !== 0) {
      return b.relevanceScore! - a.relevanceScore!;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return results.slice(0, limit);
}

/**
 * Search in session index
 */
function searchInSessions(
  projectRoot: string,
  query: string,
  cutoff: Date,
  limit: number
): SearchResult[] {
  const index = loadSessionIndex(projectRoot);
  const results: SearchResult[] = [];

  for (const session of index.sessions) {
    const sessionDate = new Date(session.startTime);
    if (sessionDate < cutoff) continue;

    const matchedOn: string[] = [];
    let relevanceScore = 0;

    // Check summary
    if (session.summary?.toLowerCase().includes(query)) {
      matchedOn.push('summary');
      relevanceScore += 0.3;
    }

    // Check topics
    for (const topic of session.topics) {
      if (topic.toLowerCase().includes(query)) {
        matchedOn.push('topic');
        relevanceScore += 0.4;
        break;
      }
    }

    // Check entities
    for (const entity of session.keyEntities) {
      if (entity.name.toLowerCase().includes(query)) {
        matchedOn.push('entity');
        relevanceScore += 0.5;
        break;
      }
    }

    // Check pending work
    if (session.pendingWork?.toLowerCase().includes(query)) {
      matchedOn.push('pending');
      relevanceScore += 0.2;
    }

    // Check files
    for (const file of session.filesModified || []) {
      if (file.toLowerCase().includes(query)) {
        matchedOn.push('file');
        relevanceScore += 0.3;
        break;
      }
    }

    if (relevanceScore > 0) {
      const snippet = generateSnippet(session.summary || session.topics.join(', '), query);
      results.push({
        id: session.sessionId,
        type: 'session',
        date: session.date,
        title: `Session: ${session.topics[0] || 'general'}`,
        content: buildSessionContent(session),
        entities: session.keyEntities.map(e => e.name),
        topics: session.topics,
        relevanceScore,
        matchedOn,
        snippet,
      });
    }
  }

  return results.sort((a, b) => b.relevanceScore! - a.relevanceScore!).slice(0, limit);
}

/**
 * Search in task index
 */
function searchInTasks(
  projectRoot: string,
  query: string,
  limit: number
): SearchResult[] {
  const tasks = searchTasks(projectRoot, query, limit);
  const results: SearchResult[] = [];

  for (const task of tasks) {
    const matchedOn: string[] = [];
    let relevanceScore = 0;

    if (task.title.toLowerCase().includes(query)) {
      matchedOn.push('title');
      relevanceScore += 0.5;
    }

    if (task.goal.toLowerCase().includes(query)) {
      matchedOn.push('goal');
      relevanceScore += 0.3;
    }

    if (task.pending?.toLowerCase().includes(query)) {
      matchedOn.push('pending');
      relevanceScore += 0.2;
    }

    for (const file of task.filesTouched) {
      if (file.toLowerCase().includes(query)) {
        matchedOn.push('file');
        relevanceScore += 0.3;
        break;
      }
    }

    if (relevanceScore > 0) {
      results.push({
        id: task.id,
        type: 'task',
        date: task.startDate.split('T')[0],
        title: task.title,
        content: buildTaskContent(task),
        entities: task.filesTouched,
        topics: [task.goal],
        relevanceScore,
        matchedOn,
        snippet: task.goal.slice(0, 100),
      });
    }
  }

  return results;
}

/**
 * Search in handoff documents
 */
function searchInHandoffs(
  projectRoot: string,
  query: string,
  cutoff: Date,
  limit: number
): SearchResult[] {
  const results: SearchResult[] = [];
  const handoffPath = join(projectRoot, '.context', 'handoff.md');

  if (!existsSync(handoffPath)) {
    return results;
  }

  try {
    const content = readFileSync(handoffPath, 'utf-8');
    const sections = content.split(/^---+$/m);

    for (const section of sections) {
      if (!section.toLowerCase().includes(query)) continue;

      const lines = section.trim().split('\n');
      let timestamp = '';
      const textLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('## Handoff')) {
          const match = line.match(/\((\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
          if (match) {
            timestamp = match[1].replace(' ', 'T');
          }
        } else if (line.trim()) {
          textLines.push(line.trim());
        }
      }

      if (timestamp && new Date(timestamp) >= cutoff) {
        const fullContent = textLines.join(' ');
        const snippet = generateSnippet(fullContent, query);

        results.push({
          id: `handoff_${timestamp}`,
          type: 'handoff',
          date: timestamp.split('T')[0],
          title: `Handoff: ${snippet.slice(0, 40)}...`,
          content: fullContent,
          entities: [],
          topics: [],
          relevanceScore: fullContent.toLowerCase().split(query).length * 0.2,
          matchedOn: ['content'],
          snippet,
        });
      }
    }
  } catch {
    // Ignore errors
  }

  return results.sort((a, b) => b.relevanceScore! - a.relevanceScore!).slice(0, limit);
}

/**
 * Search for entities across all sessions
 */
export function searchEntities(
  projectRoot: string,
  entityQuery: string,
  entityType?: 'file' | 'function' | 'component' | 'module'
): SearchResult[] {
  const index = loadSessionIndex(projectRoot);
  const results: SearchResult[] = [];

  for (const session of index.sessions) {
    for (const entity of session.keyEntities) {
      if (entity.name.toLowerCase().includes(entityQuery.toLowerCase())) {
        if (entityType && entity.type !== entityType) continue;

        results.push({
          id: `${session.sessionId}_${entity.name}`,
          type: 'session',
          date: session.date,
          title: `${entity.name} (${entity.type})`,
          content: `${entity.type}: ${entity.name}\nReferenced in session ${session.sessionId}`,
          entities: [entity.name],
          topics: session.topics,
          relevanceScore: entity.referenceCount * 0.1,
          matchedOn: ['entity'],
          snippet: `Referenced ${entity.referenceCount} times`,
        });
      }
    }
  }

  // Sort by relevance (reference count)
  return results
    .sort((a, b) => b.relevanceScore! - a.relevanceScore!)
    .slice(0, 20);
}

/**
 * Find related sessions based on shared entities or topics
 */
export function findRelatedSessions(
  projectRoot: string,
  sessionId: string,
  limit: number = 5
): SearchResult[] {
  const index = loadSessionIndex(projectRoot);
  const targetSession = index.sessions.find(s => s.sessionId === sessionId);

  if (!targetSession) return [];

  const relatedSessions: Array<{ session: typeof targetSession; score: number }> = [];

  for (const session of index.sessions) {
    if (session.sessionId === sessionId) continue;

    let score = 0;

    // Check shared topics
    for (const topic of session.topics) {
      if (targetSession.topics.includes(topic)) {
        score += 0.3;
      }
    }

    // Check shared entities
    for (const entity of session.keyEntities) {
      if (targetSession.keyEntities.some(e => e.name === entity.name)) {
        score += 0.4;
      }
    }

    // Check shared files
    for (const file of session.filesModified || []) {
      if (targetSession.filesModified?.includes(file)) {
        score += 0.2;
      }
    }

    if (score > 0) {
      relatedSessions.push({ session, score });
    }
  }

  return relatedSessions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ session, score }) => ({
      id: session.sessionId,
      type: 'session' as const,
      date: session.date,
      title: `Related: ${session.topics[0] || 'session'}`,
      content: buildSessionContent(session),
      entities: session.keyEntities.map(e => e.name),
      topics: session.topics,
      relevanceScore: score,
      matchedOn: ['topics', 'entities', 'files'],
      snippet: `${session.messageCount} messages, ${score.toFixed(1)} similarity score`,
    }));
}

/**
 * Generate a snippet around the matched query
 */
function generateSnippet(text: string, query: string, contextChars: number = 50): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());

  if (idx === -1) {
    return text.slice(0, 100);
  }

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Build searchable content from session
 */
function buildSessionContent(session: any): string {
  const parts: string[] = [];

  parts.push(`Topics: ${session.topics.join(', ')}`);

  if (session.summary) {
    parts.push(`Summary: ${session.summary}`);
  }

  if (session.pendingWork) {
    parts.push(`Pending: ${session.pendingWork}`);
  }

  if (session.keyEntities.length > 0) {
    parts.push(`Entities: ${session.keyEntities.map((e: any) => e.name).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Build searchable content from task
 */
function buildTaskContent(task: any): string {
  const parts: string[] = [];

  parts.push(`Title: ${task.title}`);
  parts.push(`Goal: ${task.goal}`);

  if (task.pending) {
    parts.push(`Pending: ${task.pending}`);
  }

  if (task.nextSteps.length > 0) {
    parts.push(`Next Steps: ${task.nextSteps.join(', ')}`);
  }

  if (task.decisions.length > 0) {
    parts.push(`Decisions: ${task.decisions.join(', ')}`);
  }

  parts.push(`Files: ${task.filesTouched.join(', ')}`);

  return parts.join('\n');
}