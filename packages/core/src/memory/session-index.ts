// Session Index Manager - Centralized index of all sessions
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  SessionIndex,
  SessionIndexEntry,
} from './memory-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';
import {
  MEMORY_INDEX_VERSION,
  MEMORY_DIR,
  SESSION_INDEX_FILE,
} from './memory-types.js';

const SESSION_INDEX_VERSION_LOCAL = '1.0';

/**
 * Load the session index from disk
 */
export function loadSessionIndex(projectRoot: string): SessionIndex {
  const indexPath = getSessionIndexPath(projectRoot);

  if (!existsSync(indexPath)) {
    return createEmptySessionIndex(projectRoot);
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content) as SessionIndex;
    return index;
  } catch {
    return createEmptySessionIndex(projectRoot);
  }
}

/**
 * Save the session index to disk
 */
export function saveSessionIndex(projectRoot: string, index: SessionIndex): void {
  const indexPath = getSessionIndexPath(projectRoot);
  const dirPath = join(projectRoot, MEMORY_DIR);

  ensureDir(dirPath);
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Create an empty session index
 */
export function createEmptySessionIndex(projectRoot: string): SessionIndex {
  return {
    _version: SESSION_INDEX_VERSION_LOCAL,
    projectRoot,
    lastUpdated: new Date().toISOString(),
    sessions: [],
  };
}

/**
 * Add or update a session in the index
 */
export function updateSessionInIndex(
  projectRoot: string,
  entry: SessionIndexEntry
): void {
  const index = loadSessionIndex(projectRoot);
  const existingIndex = index.sessions.findIndex(s => s.sessionId === entry.sessionId);

  if (existingIndex >= 0) {
    index.sessions[existingIndex] = entry;
  } else {
    index.sessions.push(entry);
  }

  index.lastUpdated = new Date().toISOString();
  saveSessionIndex(projectRoot, index);
}

/**
 * Get a session from the index
 */
export function getSessionFromIndex(
  projectRoot: string,
  sessionId: string
): SessionIndexEntry | null {
  const index = loadSessionIndex(projectRoot);
  return index.sessions.find(s => s.sessionId === sessionId) || null;
}

/**
 * Get all sessions within a date range
 */
export function getSessionsInRange(
  projectRoot: string,
  startDate: Date,
  endDate: Date = new Date()
): SessionIndexEntry[] {
  const index = loadSessionIndex(projectRoot);
  const start = startDate.toISOString();
  const end = endDate.toISOString();

  return index.sessions.filter(s => {
    const sessionDate = s.startTime;
    return sessionDate >= start && sessionDate <= end;
  });
}

/**
 * Get sessions by topic
 */
export function getSessionsByTopic(
  projectRoot: string,
  topic: string,
  limit: number = 10
): SessionIndexEntry[] {
  const index = loadSessionIndex(projectRoot);
  const topicLower = topic.toLowerCase();

  return index.sessions
    .filter(s => s.topics.some(t => t.toLowerCase().includes(topicLower)))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit);
}

/**
 * Get sessions that touched a specific file
 */
export function getSessionsByFile(
  projectRoot: string,
  filePath: string,
  limit: number = 10
): SessionIndexEntry[] {
  const index = loadSessionIndex(projectRoot);
  const fileLower = filePath.toLowerCase();

  return index.sessions
    .filter(s => s.filesModified?.some(f => f.toLowerCase().includes(fileLower)))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit);
}

/**
 * Get recent sessions
 */
export function getRecentSessions(
  projectRoot: string,
  days: number = 7,
  limit: number = 20
): SessionIndexEntry[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return getSessionsInRange(projectRoot, cutoff)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit);
}

/**
 * Get all unique topics across sessions
 */
export function getAllTopics(projectRoot: string): string[] {
  const index = loadSessionIndex(projectRoot);
  const topics = new Set<string>();

  for (const session of index.sessions) {
    for (const topic of session.topics) {
      topics.add(topic);
    }
  }

  return Array.from(topics).sort();
}

/**
 * Get session statistics
 */
export function getSessionStats(projectRoot: string): {
  totalSessions: number;
  totalMessages: number;
  totalDurationMs: number;
  averageSessionDuration: number;
  sessionsLastWeek: number;
  sessionsLastMonth: number;
  mostActiveTopics: { topic: string; count: number }[];
} {
  const index = loadSessionIndex(projectRoot);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const topicCounts: Record<string, number> = {};
  let totalMessages = 0;
  let totalDurationMs = 0;
  let sessionsLastWeek = 0;
  let sessionsLastMonth = 0;

  for (const session of index.sessions) {
    totalMessages += session.messageCount;

    if (session.durationMs) {
      totalDurationMs += session.durationMs;
    }

    const startTime = new Date(session.startTime);
    if (startTime >= weekAgo) sessionsLastWeek++;
    if (startTime >= monthAgo) sessionsLastMonth++;

    for (const topic of session.topics) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }

  const mostActiveTopics = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSessions: index.sessions.length,
    totalMessages,
    totalDurationMs,
    averageSessionDuration: index.sessions.length > 0 ? totalDurationMs / index.sessions.length : 0,
    sessionsLastWeek,
    sessionsLastMonth,
    mostActiveTopics,
  };
}

/**
 * Delete a session from the index
 */
export function deleteSessionFromIndex(projectRoot: string, sessionId: string): boolean {
  const index = loadSessionIndex(projectRoot);
  const initialLength = index.sessions.length;

  index.sessions = index.sessions.filter(s => s.sessionId !== sessionId);

  if (index.sessions.length < initialLength) {
    index.lastUpdated = new Date().toISOString();
    saveSessionIndex(projectRoot, index);
    return true;
  }

  return false;
}

/**
 * Search sessions by keyword
 */
export function searchSessions(
  projectRoot: string,
  query: string,
  limit: number = 10
): SessionIndexEntry[] {
  const index = loadSessionIndex(projectRoot);
  const queryLower = query.toLowerCase();

  return index.sessions
    .filter(s => {
      // Search in summary
      if (s.summary?.toLowerCase().includes(queryLower)) return true;
      // Search in topics
      if (s.topics.some(t => t.toLowerCase().includes(queryLower))) return true;
      // Search in entities
      if (s.keyEntities.some(e => e.name.toLowerCase().includes(queryLower))) return true;
      // Search in pending work
      if (s.pendingWork?.toLowerCase().includes(queryLower)) return true;
      return false;
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit);
}

/**
 * Get session index path
 */
function getSessionIndexPath(projectRoot: string): string {
  return join(projectRoot, MEMORY_DIR, SESSION_INDEX_FILE);
}

// Re-export types for convenience
export type { SessionIndex, SessionIndexEntry } from './memory-types.js';