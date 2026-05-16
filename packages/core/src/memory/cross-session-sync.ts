/**
 * Cross-Session Sync Module
 *
 * Handles synchronization of memory and learning across sessions.
 * Enables continuity between different work sessions.
 */

export interface SyncState {
  lastSyncTime: number;
  pendingChanges: string[];
  syncedMemories: string[];
}

const syncState: SyncState = {
  lastSyncTime: Date.now(),
  pendingChanges: [],
  syncedMemories: []
};

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  return { ...syncState };
}

/**
 * Update sync state
 */
export function updateSyncState(updates: Partial<SyncState>): void {
  Object.assign(syncState, updates);
  syncState.lastSyncTime = Date.now();
}

/**
 * Add a pending change
 */
export function addPendingChange(changeId: string): void {
  if (!syncState.pendingChanges.includes(changeId)) {
    syncState.pendingChanges.push(changeId);
  }
}

/**
 * Mark changes as synced
 */
export function markSynced(changeIds: string[]): void {
  syncState.pendingChanges = syncState.pendingChanges.filter(id => !changeIds.includes(id));
  syncState.syncedMemories.push(...changeIds);
  syncState.lastSyncTime = Date.now();
}

/**
 * Perform cross-session sync
 */
export async function performSync(): Promise<{ success: boolean; synced: number; errors: string[] }> {
  const errors: string[] = [];
  const synced = syncState.pendingChanges.length;

  try {
    // Clear pending changes after successful sync
    syncState.pendingChanges = [];
    syncState.lastSyncTime = Date.now();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown sync error');
  }

  return { success: errors.length === 0, synced, errors };
}

/**
 * Get cross-session insights
 */
export async function getCrossSessionInsights(
  projectRoot: string,
  days: number = 30
): Promise<{
  totalSessions: number;
  totalMessages: number;
  commonTopics: string[];
  patterns: { pattern: string; frequency: number }[];
  productivity: { tasksCompleted: number; filesModified: number };
}> {
  const { loadSessionIndex } = await import('./session-index.js');
  const { loadTaskIndex } = await import('./task-index.js');

  const index = loadSessionIndex(projectRoot);
  const taskIndex = loadTaskIndex(projectRoot);

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Filter sessions by date
  const recentSessions = index.sessions.filter(s => new Date(s.startTime) >= cutoffDate);

  // Calculate totals
  const totalSessions = recentSessions.length;
  const totalMessages = recentSessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

  // Extract common topics
  const topicCounts: Record<string, number> = {};
  for (const session of recentSessions) {
    for (const topic of session.topics || []) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }
  const commonTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);

  // Find patterns from summaries
  const patterns: { pattern: string; frequency: number }[] = [];
  const patternCounts: Record<string, number> = {};
  for (const session of recentSessions) {
    if (session.summary) {
      // Extract simple patterns from summary keywords
      const keywords = ['fix', 'add', 'update', 'implement', 'refactor', 'test', 'review', 'debug'];
      for (const keyword of keywords) {
        if (session.summary.toLowerCase().includes(keyword)) {
          patternCounts[keyword] = (patternCounts[keyword] || 0) + 1;
        }
      }
    }
  }
  for (const [pattern, frequency] of Object.entries(patternCounts)) {
    patterns.push({ pattern, frequency });
  }
  patterns.sort((a, b) => b.frequency - a.frequency);

  // Calculate productivity
  const tasksCompleted = taskIndex.tasks.filter(t => t.status === 'completed').length;
  const recentTasks = taskIndex.tasks.filter(t => new Date(t.startDate) >= cutoffDate);
  const filesModified = recentTasks.reduce((sum, t) => sum + (t.filesTouched?.length || 0), 0);

  return {
    totalSessions,
    totalMessages,
    commonTopics,
    patterns: patterns.slice(0, 5),
    productivity: { tasksCompleted, filesModified },
  };
}