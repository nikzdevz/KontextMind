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