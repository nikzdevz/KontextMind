// Timeline Builder - Build activity timelines from sessions, tasks, and handoffs
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  TimelineEntry,
  SessionIndexEntry,
  TaskIndexEntry,
} from './memory-types.js';
import { loadSessionIndex, getSessionsInRange } from './session-index.js';

/**
 * Build a timeline of all activity over a period
 */
export function buildTimeline(
  projectRoot: string,
  hoursBack: number
): TimelineEntry[] {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const entries: TimelineEntry[] = [];

  // Get sessions in range
  const sessions = getSessionsInRange(projectRoot, cutoff);
  for (const session of sessions) {
    entries.push({
      type: 'session',
      timestamp: session.startTime,
      title: `Session: ${session.topics.slice(0, 2).join(', ') || 'general conversation'}`,
      summary: session.summary || `${session.messageCount} messages exchanged`,
      relatedSessionId: session.sessionId,
      entities: session.keyEntities.map(e => e.name),
    });

    // If session has an end time, add completion entry
    if (session.endTime && session.endTime >= cutoff.toISOString()) {
      entries.push({
        type: 'session',
        timestamp: session.endTime,
        title: `Session completed: ${session.topics.slice(0, 2).join(', ') || 'general'}`,
        summary: `${session.messageCount} messages, ${session.durationMs ? Math.round(session.durationMs / 60000) : '?'} minutes`,
        relatedSessionId: session.sessionId,
      });
    }
  }

  // Get tasks in range
  const tasks = loadTaskIndexEntries(projectRoot);
  for (const task of tasks) {
    const taskDate = new Date(task.startDate);
    if (taskDate >= cutoff) {
      entries.push({
        type: 'task_started',
        timestamp: task.startDate,
        title: `Task started: ${task.title}`,
        summary: task.goal,
        relatedTaskId: task.id,
        entities: task.filesTouched,
      });
    }

    if (task.endDate) {
      const endDate = new Date(task.endDate);
      if (endDate >= cutoff) {
        entries.push({
          type: 'task_completed',
          timestamp: task.endDate,
          title: `Task completed: ${task.title}`,
          summary: task.pending || 'No pending items',
          relatedTaskId: task.id,
        });
      }
    }
  }

  // Get handoffs in range
  const handoffs = loadHandoffsInRange(projectRoot, cutoff);
  for (const handoff of handoffs) {
    entries.push({
      type: 'handoff',
      timestamp: handoff.timestamp,
      title: `Handoff: ${handoff.summary.slice(0, 50)}`,
      summary: handoff.summary,
      entities: handoff.filesModified,
    });
  }

  // Sort by timestamp (newest first)
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return entries;
}

/**
 * Get recent activity summary
 */
export function getRecentActivity(
  projectRoot: string,
  days: number = 3
): {
  sessions: { count: number; totalMessages: number };
  tasks: { count: number; completed: number };
  filesModified: number;
  totalMessages: number;
  topTopics: string[];
  incompleteTasks: string[];
  recentSessions: { date: string; topics: string[]; sessionId: string }[];
} {
  const hoursBack = days * 24;
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const sessions = getSessionsInRange(projectRoot, cutoff);
  const tasks = loadTaskIndexEntries(projectRoot);

  // Calculate stats
  let totalMessages = 0;
  const topicCounts: Record<string, number> = {};
  const fileSet = new Set<string>();

  for (const session of sessions) {
    totalMessages += session.messageCount;
    for (const topic of session.topics) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
    for (const file of session.filesModified || []) {
      fileSet.add(file);
    }
  }

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic)
    .slice(0, 10);

  const incompleteTasks = tasks
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    .map(t => t.title);

  const recentSessions = sessions
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 5)
    .map(s => ({
      date: s.date,
      topics: s.topics,
      sessionId: s.sessionId,
    }));

  const completedTasks = tasks.filter(t => t.endDate && new Date(t.endDate) >= cutoff).length;

  return {
    sessions: {
      count: sessions.length,
      totalMessages,
    },
    tasks: {
      count: tasks.filter(t => new Date(t.startDate) >= cutoff).length,
      completed: completedTasks,
    },
    filesModified: fileSet.size,
    totalMessages,
    topTopics,
    incompleteTasks,
    recentSessions,
  };
}

/**
 * Load task index entries
 */
function loadTaskIndexEntries(projectRoot: string): TaskIndexEntry[] {
  const taskIndexPath = join(projectRoot, '.kontextmind', 'memory', 'task-index.json');

  if (!existsSync(taskIndexPath)) {
    return [];
  }

  try {
    const content = readFileSync(taskIndexPath, 'utf-8');
    const data = JSON.parse(content);
    return data.tasks || [];
  } catch {
    return [];
  }
}

/**
 * Load handoffs in a time range
 */
function loadHandoffsInRange(
  projectRoot: string,
  cutoff: Date
): Array<{ timestamp: string; summary: string; filesModified: string[] }> {
  const handoffPath = join(projectRoot, '.context', 'handoff.md');
  const handoffs: Array<{ timestamp: string; summary: string; filesModified: string[] }> = [];

  if (!existsSync(handoffPath)) {
    return handoffs;
  }

  try {
    const content = readFileSync(handoffPath, 'utf-8');
    const sections = content.split(/^---+$/m);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      let timestamp = '';
      const summaryLines: string[] = [];
      const filesModified: string[] = [];

      for (const line of lines) {
        if (line.startsWith('## Handoff') || line.startsWith('**Handoff')) {
          // Extract timestamp from header
          const match = line.match(/\((\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
          if (match) {
            timestamp = match[1].replace(' ', 'T');
          }
        } else if (line.startsWith('**Summary**') || line.startsWith('### Summary')) {
          // Found summary section
        } else if (line.startsWith('- ')) {
          filesModified.push(line.slice(2));
        } else if (line.includes(':') && !line.startsWith('**')) {
          // Key-value pair
          const colonIdx = line.indexOf(':');
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          if (key === 'summary') {
            summaryLines.push(line.slice(colonIdx + 1).trim());
          }
        } else if (summaryLines.length > 0 && !line.startsWith('**') && !line.startsWith('#') && line.trim()) {
          summaryLines.push(line.trim());
        }
      }

      if (timestamp) {
        const entryTime = new Date(timestamp);
        if (entryTime >= cutoff) {
          handoffs.push({
            timestamp,
            summary: summaryLines.join(' '),
            filesModified,
          });
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return handoffs;
}

/**
 * Group timeline entries by day
 */
export function groupTimelineByDay(entries: TimelineEntry[]): Record<string, TimelineEntry[]> {
  const byDay: Record<string, TimelineEntry[]> = {};

  for (const entry of entries) {
    const day = entry.timestamp.split('T')[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(entry);
  }

  return byDay;
}

/**
 * Get summary of what's changed since last session
 */
export function getChangesSinceLastSession(
  projectRoot: string
): {
  newSessions: number;
  newTasks: number;
  filesModified: string[];
  pendingWork: string[];
  suggestions: string[];
} {
  const index = loadSessionIndex(projectRoot);
  const tasks = loadTaskIndexEntries(projectRoot);

  if (index.sessions.length === 0) {
    return {
      newSessions: 0,
      newTasks: tasks.filter(t => t.status !== 'completed').length,
      filesModified: [],
      pendingWork: tasks.filter(t => t.pending).map(t => t.pending).filter(Boolean) as string[],
      suggestions: ['No previous sessions found. This appears to be a fresh start.'],
    };
  }

  // Get last session date
  const lastSession = index.sessions.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )[0];

  const lastSessionDate = new Date(lastSession.startTime);
  const now = new Date();
  const hoursSince = (now.getTime() - lastSessionDate.getTime()) / (1000 * 60 * 60);

  // Count new sessions since then
  const newSessions = index.sessions.filter(
    s => new Date(s.startTime) > lastSessionDate
  ).length;

  // Get tasks created since last session
  const tasksSince = tasks.filter(
    t => new Date(t.startDate) > lastSessionDate
  );

  // Get files modified since last session
  const filesSince = new Set<string>();
  for (const session of index.sessions) {
    if (new Date(session.startTime) > lastSessionDate) {
      for (const file of session.filesModified || []) {
        filesSince.add(file);
      }
    }
  }

  // Build suggestions
  const suggestions: string[] = [];

  if (hoursSince > 24) {
    suggestions.push(`It's been ${Math.round(hoursSince / 24)} days since your last session.`);
  }

  const incompleteTasks = tasks.filter(t => t.status !== 'completed');
  if (incompleteTasks.length > 0) {
    suggestions.push(`You have ${incompleteTasks.length} incomplete tasks.`);
  }

  if (lastSession.pendingWork) {
    suggestions.push(`You had pending work: ${lastSession.pendingWork}`);
  }

  return {
    newSessions,
    newTasks: tasksSince.length,
    filesModified: Array.from(filesSince).slice(0, 20),
    pendingWork: incompleteTasks.map(t => t.pending).filter(Boolean) as string[],
    suggestions,
  };
}