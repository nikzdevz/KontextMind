// Task Detector - Automatically detect task boundaries and create task entries
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
  DetectedTask,
  TaskDetectionSignal,
  TaskIndexEntry,
} from './memory-types.js';
import { updateTaskInIndex, loadTaskIndex, getCurrentTask } from './task-index.js';

/**
 * Detect task boundaries based on various signals
 */
export function detectTask(
  projectRoot: string,
  options: {
    sessionId?: string;
    messageCount?: number;
    topics?: string[];
    filesModified?: string[];
  } = {}
): DetectedTask | null {
  const signals: TaskDetectionSignal[] = [];

  // Check for recent git commits (async)
  detectFromGit(projectRoot).then(gitSignals => {
    if (gitSignals) signals.push(gitSignals);
  }).catch(() => {});

  // Check for file changes
  if (options.filesModified && options.filesModified.length >= 3) {
    signals.push({
      type: 'file_changes',
      count: options.filesModified.length,
      files: options.filesModified.slice(0, 20),
    });
  }

  // Check for topic clustering
  if (options.topics && options.topics.length >= 2) {
    signals.push({
      type: 'topic_cluster',
      topics: options.topics.slice(0, 5),
    });
  }

  // Check time gap from last session
  const timeGap = detectTimeGap(projectRoot);
  if (timeGap !== null) {
    signals.push({
      type: 'time_gap',
      hoursSinceLastSession: timeGap,
    });
  }

  // Calculate confidence based on signals
  const confidence = calculateConfidence(signals);

  // If confidence is too low, don't create a task
  if (confidence < 0.3) {
    return null;
  }

  // Generate task title from signals
  const title = generateTaskTitle(signals, options.topics);

  // Generate task goal
  const goal = generateTaskGoal(signals);

  const task: DetectedTask = {
    id: generateTaskId(),
    title,
    goal,
    sessionIds: options.sessionId ? [options.sessionId] : [],
    startDate: new Date().toISOString(),
    filesTouched: new Set(options.filesModified || []),
    confidence,
    signals,
  };

  return task;
}

/**
 * Create or update a task from detected signals
 */
export function createOrUpdateTask(
  projectRoot: string,
  detected: DetectedTask
): TaskIndexEntry {
  const index = loadTaskIndex(projectRoot);

  // Check if there's an existing incomplete task that could be related
  const currentTask = getCurrentTask(projectRoot);

  if (currentTask && currentTask.confidence > 0.5) {
    // Check if detected task is related to current task
    const overlap = [...detected.filesTouched].filter(
      f => currentTask.filesTouched.includes(f)
    );

    if (overlap.length >= 2) {
      // Merge with existing task
      for (const file of detected.filesTouched) {
        if (!currentTask.filesTouched.includes(file)) {
          currentTask.filesTouched.push(file);
        }
      }

      if (detected.sessionIds[0] && !currentTask.sessionIds.includes(detected.sessionIds[0])) {
        currentTask.sessionIds.push(detected.sessionIds[0]);
      }

      currentTask.confidence = Math.min(currentTask.confidence + 0.1, 1.0);

      updateTaskInIndex(projectRoot, currentTask);
      return currentTask;
    }
  }

  // Create new task
  const task: TaskIndexEntry = {
    id: detected.id,
    title: detected.title,
    goal: detected.goal,
    status: 'detected',
    startDate: detected.startDate,
    sessionIds: detected.sessionIds,
    filesTouched: Array.from(detected.filesTouched),
    decisions: [],
    pending: '',
    nextSteps: [],
    linkedTaskIds: [],
    dependsOn: [],
    confidence: detected.confidence,
    gitCommitMessage: detected.gitCommitMessage,
  };

  updateTaskInIndex(projectRoot, task);
  return task;
}

/**
 * Detect task from git commits
 */
async function detectFromGit(projectRoot: string): Promise<TaskDetectionSignal | null> {
  try {
    const { execSync } = await import('child_process');
    // Get recent commits from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const output = execSync(
      `git log --since="${since}" --oneline --format="%s"`,
      { cwd: projectRoot, encoding: 'utf-8', timeout: 5000 }
    );

    if (!output.trim()) return null;

    const messages = output.trim().split('\n').filter(Boolean);
    if (messages.length < 2) return null;

    // Cluster commits by message similarity
    const clusters = clusterCommits(messages);

    // If we have a cluster of related commits, it's likely a task
    const largestCluster = clusters.sort((a, b) => b.length - a.length)[0];
    if (largestCluster && largestCluster.length >= 2) {
      return {
        type: 'git_commits',
        count: messages.length,
        messages: largestCluster,
      };
    }

    return null;
  } catch {
    // Git not available or no commits
    return null;
  }
}

/**
 * Cluster commits by similarity
 */
function clusterCommits(messages: string[]): string[][] {
  const clusters: string[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < messages.length; i++) {
    if (used.has(i)) continue;

    const cluster = [messages[i]];
    used.add(i);

    const keywords1 = extractKeywords(messages[i]);

    for (let j = i + 1; j < messages.length; j++) {
      if (used.has(j)) continue;

      const keywords2 = extractKeywords(messages[j]);
      const overlap = keywords1.filter(k => keywords2.includes(k));

      if (overlap.length >= 2) {
        cluster.push(messages[j]);
        used.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Extract keywords from commit message
 */
function extractKeywords(message: string): string[] {
  const words = message.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'to', 'for', 'of', 'with', 'fix', 'update', 'add', 'change']);
  return words.filter(w => w.length > 3 && !stopWords.has(w));
}

/**
 * Detect time gap from last session
 */
function detectTimeGap(projectRoot: string): number | null {
  const index = loadTaskIndex(projectRoot);
  const sessions = index.sessionTaskMap ? Object.keys(index.sessionTaskMap) : [];

  if (sessions.length === 0) return null;

  // This is a simplified check - in real implementation,
  // we'd check the session index for the most recent session
  // For now, return null to skip time gap detection
  return null;
}

/**
 * Calculate confidence that this is a distinct task
 */
function calculateConfidence(signals: TaskDetectionSignal[]): number {
  let confidence = 0;

  for (const signal of signals) {
    switch (signal.type) {
      case 'git_commits':
        confidence += Math.min(signal.count * 0.1, 0.4);
        break;
      case 'file_changes':
        confidence += Math.min(signal.count * 0.05, 0.3);
        break;
      case 'topic_cluster':
        confidence += Math.min(signal.topics.length * 0.1, 0.2);
        break;
      case 'time_gap':
        // Long gaps suggest new tasks
        confidence += signal.hoursSinceLastSession > 24 ? 0.2 : 0;
        break;
    }
  }

  return Math.min(confidence, 1.0);
}

/**
 * Generate task title from signals
 */
function generateTaskTitle(
  signals: TaskDetectionSignal[],
  topics?: string[]
): string {
  // Try to derive from topic cluster first
  const topicSignal = signals.find(s => s.type === 'topic_cluster');
  if (topicSignal && 'topics' in topicSignal && topicSignal.topics.length > 0) {
    return topicSignal.topics[0].split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
  }

  // Try from git commits
  const gitSignal = signals.find(s => s.type === 'git_commits');
  if (gitSignal && 'messages' in gitSignal && gitSignal.messages.length > 0) {
    return gitSignal.messages[0].split(' ').slice(0, 4).join(' ');
  }

  // Try from topics parameter
  if (topics && topics.length > 0) {
    return topics[0];
  }

  return `Work session ${new Date().toISOString().split('T')[0]}`;
}

/**
 * Generate task goal from signals
 */
function generateTaskGoal(signals: TaskDetectionSignal[]): string {
  const parts: string[] = [];

  for (const signal of signals) {
    switch (signal.type) {
      case 'git_commits':
        parts.push(`${signal.count} commits made`);
        break;
      case 'file_changes':
        parts.push(`${signal.count} files modified`);
        break;
      case 'topic_cluster':
        parts.push(`Topics: ${signal.topics.join(', ')}`);
        break;
    }
  }

  return parts.join('. ') || 'General development work';
}

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `task_${timestamp}_${random}`;
}

/**
 * Auto-complete a task (mark as done)
 */
export function autoCompleteTask(
  projectRoot: string,
  taskId: string,
  pending?: string,
  nextSteps?: string[]
): boolean {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);

  if (!task) return false;

  task.status = 'completed';
  task.endDate = new Date().toISOString();

  if (pending) {
    task.pending = pending;
  }
  if (nextSteps) {
    task.nextSteps = nextSteps;
  }

  updateTaskInIndex(projectRoot, task);
  return true;
}

/**
 * Update pending work for a task
 */
export function updateTaskPending(
  projectRoot: string,
  taskId: string,
  pending: string
): boolean {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);

  if (!task) return false;

  task.pending = pending;
  updateTaskInIndex(projectRoot, task);
  return true;
}

/**
 * Check if task should be marked as stale (no activity for N days)
 */
export function isTaskStale(
  projectRoot: string,
  taskId: string,
  staleDays: number = 7
): boolean {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);

  if (!task) return false;
  if (task.status === 'completed') return false;

  const lastActivity = new Date(task.endDate || task.startDate);
  const daysSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

  return daysSince > staleDays;
}