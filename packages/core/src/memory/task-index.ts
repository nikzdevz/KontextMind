// Task Index Manager - Centralized index of all tasks
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type {
  TaskIndex,
  TaskIndexEntry,
} from './memory-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { MEMORY_DIR, TASK_INDEX_FILE } from './memory-types.js';

const TASK_INDEX_VERSION_LOCAL = '1.0';

/**
 * Load the task index from disk
 */
export function loadTaskIndex(projectRoot: string): TaskIndex {
  const indexPath = getTaskIndexPath(projectRoot);

  if (!existsSync(indexPath)) {
    return createEmptyTaskIndex(projectRoot);
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content) as TaskIndex;
    return index;
  } catch {
    return createEmptyTaskIndex(projectRoot);
  }
}

/**
 * Save the task index to disk
 */
export function saveTaskIndex(projectRoot: string, index: TaskIndex): void {
  const indexPath = getTaskIndexPath(projectRoot);
  const dirPath = join(projectRoot, MEMORY_DIR);

  ensureDir(dirPath);
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Create an empty task index
 */
export function createEmptyTaskIndex(projectRoot: string): TaskIndex {
  return {
    _version: TASK_INDEX_VERSION_LOCAL,
    projectRoot,
    lastUpdated: new Date().toISOString(),
    tasks: [],
    sessionTaskMap: {},
  };
}

/**
 * Add or update a task in the index
 */
export function updateTaskInIndex(
  projectRoot: string,
  task: TaskIndexEntry
): void {
  const index = loadTaskIndex(projectRoot);
  const existingIndex = index.tasks.findIndex(t => t.id === task.id);

  if (existingIndex >= 0) {
    index.tasks[existingIndex] = task;
  } else {
    index.tasks.push(task);
  }

  index.lastUpdated = new Date().toISOString();
  saveTaskIndex(projectRoot, index);
}

/**
 * Get a task from the index
 */
export function getTaskFromIndex(
  projectRoot: string,
  taskId: string
): TaskIndexEntry | null {
  const index = loadTaskIndex(projectRoot);
  return index.tasks.find(t => t.id === taskId) || null;
}

/**
 * Get all tasks
 */
export function getAllTasks(projectRoot: string): TaskIndexEntry[] {
  const index = loadTaskIndex(projectRoot);
  return index.tasks;
}

/**
 * Get tasks by status
 */
export function getTasksByStatus(
  projectRoot: string,
  status: TaskIndexEntry['status']
): TaskIndexEntry[] {
  const index = loadTaskIndex(projectRoot);
  return index.tasks.filter(t => t.status === status);
}

/**
 * Get incomplete tasks
 */
export function getIncompleteTasks(projectRoot: string): TaskIndexEntry[] {
  return getTasksByStatus(projectRoot, 'in_progress').concat(
    getTasksByStatus(projectRoot, 'detected')
  );
}

/**
 * Get recent tasks
 */
export function getRecentTasks(
  projectRoot: string,
  days: number = 7,
  limit: number = 10
): TaskIndexEntry[] {
  const index = loadTaskIndex(projectRoot);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return index.tasks
    .filter(t => new Date(t.startDate) >= cutoff)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, limit);
}

/**
 * Get current active task (most recent incomplete task)
 */
export function getCurrentTask(projectRoot: string): TaskIndexEntry | null {
  const index = loadTaskIndex(projectRoot);
  const incomplete = index.tasks.filter(
    t => t.status === 'in_progress' || t.status === 'detected'
  );

  if (incomplete.length === 0) return null;

  // Return most recent incomplete task
  return incomplete.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )[0];
}

/**
 * Link a session to a task
 */
export function linkSessionToTask(
  projectRoot: string,
  sessionId: string,
  taskId: string
): void {
  const index = loadTaskIndex(projectRoot);

  // Update session to task mapping
  index.sessionTaskMap[sessionId] = taskId;

  // Add session to task's session list
  const task = index.tasks.find(t => t.id === taskId);
  if (task && !task.sessionIds.includes(sessionId)) {
    task.sessionIds.push(sessionId);
  }

  index.lastUpdated = new Date().toISOString();
  saveTaskIndex(projectRoot, index);
}

/**
 * Get the task for a session
 */
export function getSessionTask(
  projectRoot: string,
  sessionId: string
): TaskIndexEntry | null {
  const index = loadTaskIndex(projectRoot);
  const taskId = index.sessionTaskMap[sessionId];
  if (!taskId) return null;
  return getTaskFromIndex(projectRoot, taskId);
}

/**
 * Get all sessions for a task
 */
export function getTaskSessions(
  projectRoot: string,
  taskId: string
): string[] {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);
  return task?.sessionIds || [];
}

/**
 * Search tasks by keyword
 */
export function searchTasks(
  projectRoot: string,
  query: string,
  limit: number = 10
): TaskIndexEntry[] {
  const index = loadTaskIndex(projectRoot);
  const queryLower = query.toLowerCase();

  return index.tasks
    .filter(t => {
      if (t.title.toLowerCase().includes(queryLower)) return true;
      if (t.goal.toLowerCase().includes(queryLower)) return true;
      if (t.pending?.toLowerCase().includes(queryLower)) return true;
      if (t.nextSteps.some(s => s.toLowerCase().includes(queryLower))) return true;
      if (t.filesTouched.some(f => f.toLowerCase().includes(queryLower))) return true;
      return false;
    })
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, limit);
}

/**
 * Update task status
 */
export function updateTaskStatus(
  projectRoot: string,
  taskId: string,
  status: TaskIndexEntry['status']
): boolean {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);

  if (!task) return false;

  task.status = status;
  if (status === 'completed' || status === 'cancelled') {
    task.endDate = new Date().toISOString();
  }

  index.lastUpdated = new Date().toISOString();
  saveTaskIndex(projectRoot, index);
  return true;
}

/**
 * Add task dependency
 */
export function addTaskDependency(
  projectRoot: string,
  taskId: string,
  dependsOn: string
): boolean {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);

  if (!task) return false;

  if (!task.dependsOn.includes(dependsOn)) {
    task.dependsOn.push(dependsOn);
  }

  // Update the blocking task too
  const depTask = index.tasks.find(t => t.id === dependsOn);
  if (depTask && !depTask.linkedTaskIds.includes(taskId)) {
    depTask.linkedTaskIds.push(taskId);
  }

  index.lastUpdated = new Date().toISOString();
  saveTaskIndex(projectRoot, index);
  return true;
}

/**
 * Get task dependencies
 */
export function getTaskDependencies(
  projectRoot: string,
  taskId: string
): { dependsOn: TaskIndexEntry[]; blockedBy: TaskIndexEntry[] } {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);

  if (!task) {
    return { dependsOn: [], blockedBy: [] };
  }

  const dependsOn = task.dependsOn
    .map(id => index.tasks.find(t => t.id === id))
    .filter((t): t is TaskIndexEntry => t !== undefined);

  const blockedBy = task.dependsOn
    .map(id => index.tasks.find(t => t.id === id))
    .filter((t): t is TaskIndexEntry => t !== undefined && t.status !== 'completed');

  return { dependsOn, blockedBy };
}

/**
 * Get all blocked tasks
 */
export function getBlockedTasks(projectRoot: string): TaskIndexEntry[] {
  const index = loadTaskIndex(projectRoot);

  return index.tasks.filter(task => {
    // A task is blocked if any of its dependencies are incomplete
    return task.dependsOn.some(depId => {
      const dep = index.tasks.find(t => t.id === depId);
      return dep && dep.status !== 'completed';
    });
  });
}

/**
 * Delete a task from the index
 */
export function deleteTaskFromIndex(projectRoot: string, taskId: string): boolean {
  const index = loadTaskIndex(projectRoot);
  const initialLength = index.tasks.length;

  // Remove from tasks array
  index.tasks = index.tasks.filter(t => t.id !== taskId);

  // Remove from sessionTaskMap
  for (const sessionId of Object.keys(index.sessionTaskMap)) {
    if (index.sessionTaskMap[sessionId] === taskId) {
      delete index.sessionTaskMap[sessionId];
    }
  }

  // Remove from linkedTaskIds in other tasks
  for (const task of index.tasks) {
    task.linkedTaskIds = task.linkedTaskIds.filter(id => id !== taskId);
    task.dependsOn = task.dependsOn.filter(id => id !== taskId);
  }

  if (index.tasks.length < initialLength) {
    index.lastUpdated = new Date().toISOString();
    saveTaskIndex(projectRoot, index);
    return true;
  }

  return false;
}

/**
 * Get task index path
 */
function getTaskIndexPath(projectRoot: string): string {
  return join(projectRoot, MEMORY_DIR, TASK_INDEX_FILE);
}

// Re-export types
export type { TaskIndex, TaskIndexEntry } from './memory-types.js';