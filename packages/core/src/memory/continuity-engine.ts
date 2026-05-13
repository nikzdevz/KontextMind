// Continuity Engine - Provides intelligent suggestions for continuing work
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
  ContinuitySuggestion,
  SessionIndexEntry,
  TaskIndexEntry,
} from './memory-types.js';
import {
  loadSessionIndex,
  getRecentSessions,
} from './session-index.js';
import {
  loadTaskIndex,
  getIncompleteTasks,
  getCurrentTask,
  getBlockedTasks,
} from './task-index.js';
import { calculateSummaryStats } from '../summaries/summary-storage.js';

/**
 * Get continuity suggestions for resuming work
 */
export function getContinuitySuggestions(projectRoot: string): ContinuitySuggestion[] {
  const suggestions: ContinuitySuggestion[] = [];

  // 1. Find incomplete tasks
  const incompleteTasks = getIncompleteTasks(projectRoot);
  for (const task of incompleteTasks) {
    if (task.pending) {
      suggestions.push({
        type: 'continue_task',
        priority: 'high',
        title: `Continue: ${task.title}`,
        description: task.pending,
        action: 'resume_task',
        relatedIds: { taskId: task.id },
        reason: 'Task has pending work from previous session',
      });
    }

    if (task.nextSteps.length > 0) {
      suggestions.push({
        type: 'continue_task',
        priority: 'medium',
        title: `Next steps for: ${task.title}`,
        description: task.nextSteps.join('\n- '),
        action: 'resume_task',
        relatedIds: { taskId: task.id },
        reason: 'Suggested next steps available',
      });
    }
  }

  // 2. Check for stale summaries
  try {
    const stats = calculateSummaryStats(projectRoot);
    if (stats.stale > 10) {
      suggestions.push({
        type: 'update_summaries',
        priority: 'medium',
        title: `${stats.stale} summaries need refresh`,
        description: `Run "kontextmind summarize --changed-only" to refresh stale summaries`,
        action: 'check_status',
        relatedIds: {},
        reason: `${stats.stale} file summaries are stale and may affect response quality`,
      });
    }
  } catch {
    // Ignore errors
  }

  // 3. Check for blocked tasks
  const blockedTasks = getBlockedTasks(projectRoot);
  if (blockedTasks.length > 0) {
    const blockedTitles = blockedTasks.slice(0, 3).map(t => t.title);
    suggestions.push({
      type: 'check_blockers',
      priority: 'medium',
      title: `${blockedTasks.length} tasks are blocked`,
      description: blockedTitles.join('\n- '),
      action: 'check_status',
      relatedIds: {},
      reason: 'Tasks are waiting for other tasks to complete',
    });
  }

  // 4. Check for recent sessions without task linking
  const recentSessions = getRecentSessions(projectRoot, 7, 5);
  const unlinkedSessions = recentSessions.filter(s => !s.taskId && s.messageCount > 5);
  if (unlinkedSessions.length > 0) {
    suggestions.push({
      type: 'continue_session',
      priority: 'low',
      title: `${unlinkedSessions.length} sessions need task linking`,
      description: unlinkedSessions.map(s => `Session ${s.sessionId}: ${s.topics.join(', ')}`).join('\n'),
      action: 'continue_session',
      relatedIds: { sessionId: unlinkedSessions[0].sessionId },
      reason: 'Recent sessions may need to be organized into tasks',
    });
  }

  // Sort by priority
  suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return suggestions;
}

/**
 * Analyze if there's pending work to continue
 */
export function analyzeContinuityNeed(projectRoot: string): {
  hasPendingWork: boolean;
  lastSessionDate: string | null;
  daysSinceLastSession: number | null;
  currentTask: TaskIndexEntry | null;
  suggestion: ContinuitySuggestion | null;
  summary: string;
} {
  const index = loadSessionIndex(projectRoot);
  const currentTask = getCurrentTask(projectRoot);
  const suggestions = getContinuitySuggestions(projectRoot);

  // Get most recent session
  const recentSessions = index.sessions.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const lastSession = recentSessions[0];
  let daysSinceLastSession: number | null = null;
  let lastSessionDate: string | null = null;

  if (lastSession) {
    lastSessionDate = lastSession.date;
    const lastTime = new Date(lastSession.startTime).getTime();
    daysSinceLastSession = Math.round((Date.now() - lastTime) / (1000 * 60 * 60 * 24));
  }

  const hasPendingWork = suggestions.length > 0;
  const suggestion = suggestions[0] || null;

  // Generate summary
  let summary = '';

  if (daysSinceLastSession === null) {
    summary = 'No previous sessions found. This appears to be a fresh start.';
  } else if (daysSinceLastSession === 0) {
    summary = 'You worked on this project today.';
  } else if (daysSinceLastSession === 1) {
    summary = 'You last worked on this project yesterday.';
  } else if (daysSinceLastSession && daysSinceLastSession <= 7) {
    summary = `You last worked on this project ${daysSinceLastSession} days ago.`;
  } else {
    summary = `It's been ${daysSinceLastSession} days since your last session.`;
  }

  if (currentTask) {
    summary += ` Current task: "${currentTask.title}".`;
    if (currentTask.pending) {
      summary += ` Pending: ${currentTask.pending}`;
    }
  }

  return {
    hasPendingWork,
    lastSessionDate,
    daysSinceLastSession,
    currentTask,
    suggestion,
    summary,
  };
}

/**
 * Get context for resuming a specific task
 */
export function getTaskResumptionContext(
  projectRoot: string,
  taskId: string
): {
  task: TaskIndexEntry;
  recentSessions: SessionIndexEntry[];
  relatedFiles: string[];
  summary: string;
} | null {
  const index = loadTaskIndex(projectRoot);
  const task = index.tasks.find(t => t.id === taskId);

  if (!task) return null;

  // Get sessions that worked on this task
  const sessionIndex = loadSessionIndex(projectRoot);
  const relatedSessions = sessionIndex.sessions
    .filter(s => task.sessionIds.includes(s.sessionId))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  // Get unique files
  const filesSet = new Set<string>();
  for (const session of relatedSessions) {
    for (const file of session.filesModified || []) {
      filesSet.add(file);
    }
  }
  for (const file of task.filesTouched) {
    filesSet.add(file);
  }

  // Generate summary
  let summary = `## Task: ${task.title}\n\n`;
  summary += `**Goal:** ${task.goal}\n`;
  summary += `**Status:** ${task.status}\n`;
  summary += `**Started:** ${task.startDate}\n\n`;

  if (task.pending) {
    summary += `### Pending Work\n${task.pending}\n\n`;
  }

  if (task.nextSteps.length > 0) {
    summary += `### Next Steps\n`;
    for (const step of task.nextSteps) {
      summary += `- ${step}\n`;
    }
    summary += '\n';
  }

  if (task.decisions.length > 0) {
    summary += `### Decisions\n`;
    for (const decision of task.decisions) {
      summary += `- ${decision}\n`;
    }
    summary += '\n';
  }

  summary += `### Related Files\n`;
  summary += `${Array.from(filesSet).slice(0, 20).join('\n')}\n`;

  return {
    task,
    recentSessions: relatedSessions,
    relatedFiles: Array.from(filesSet),
    summary,
  };
}

/**
 * Get context for resuming a session
 */
export function getSessionResumptionContext(
  projectRoot: string,
  sessionId: string
): {
  session: SessionIndexEntry;
  followingSessions: SessionIndexEntry[];
  summary: string;
} | null {
  const sessionIndex = loadSessionIndex(projectRoot);
  const session = sessionIndex.sessions.find(s => s.sessionId === sessionId);

  if (!session) return null;

  // Get sessions that came after this one (by time)
  const followingSessions = sessionIndex.sessions
    .filter(s => new Date(s.startTime) > new Date(session.startTime))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  // Generate summary
  let summary = `## Session Context\n\n`;
  summary += `**Date:** ${session.date}\n`;
  summary += `**Duration:** ${session.durationMs ? Math.round(session.durationMs / 60000) + 'min' : 'unknown'}\n`;
  summary += `**Messages:** ${session.messageCount}\n\n`;

  if (session.topics.length > 0) {
    summary += `### Topics Discussed\n${session.topics.join(', ')}\n\n`;
  }

  if (session.keyEntities.length > 0) {
    summary += `### Entities Referenced\n`;
    for (const entity of session.keyEntities.slice(0, 10)) {
      summary += `- ${entity.name} (${entity.type})\n`;
    }
    summary += '\n';
  }

  if (session.pendingWork) {
    summary += `### Pending Work\n${session.pendingWork}\n\n`;
  }

  if (session.summary) {
    summary += `### Summary\n${session.summary}\n`;
  }

  if (followingSessions.length > 0) {
    summary += `\n### ${followingSessions.length} sessions followed this one`;
  }

  return {
    session,
    followingSessions,
    summary,
  };
}

/**
 * Check if there's work to continue from previous sessions
 */
export function shouldContinueFromLastSession(projectRoot: string): {
  shouldContinue: boolean;
  reason: string;
  suggestion: string | null;
} {
  const analysis = analyzeContinuityNeed(projectRoot);

  if (analysis.daysSinceLastSession === null) {
    return {
      shouldContinue: false,
      reason: 'No previous sessions found',
      suggestion: null,
    };
  }

  if (analysis.daysSinceLastSession !== null && analysis.daysSinceLastSession > 3) {
    // More than 3 days - suggest continuing with context
    let suggestion = `You last worked on this project ${analysis.daysSinceLastSession} days ago.`;

    if (analysis.currentTask) {
      suggestion += ` Your current task is "${analysis.currentTask.title}".`;
      if (analysis.currentTask.pending) {
        suggestion += ` Pending: ${analysis.currentTask.pending}`;
      }
    }

    return {
      shouldContinue: true,
      reason: `Last session was ${analysis.daysSinceLastSession} days ago`,
      suggestion,
    };
  }

  if (analysis.hasPendingWork && analysis.suggestion) {
    return {
      shouldContinue: true,
      reason: 'Previous session has pending work',
      suggestion: analysis.suggestion.description,
    };
  }

  return {
    shouldContinue: false,
    reason: 'No urgent need to continue from previous session',
    suggestion: null,
  };
}