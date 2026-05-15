// Cross-Session Memory System Types

export const MEMORY_INDEX_VERSION = '1.0';

// ====== Session Index ======

export interface SessionIndexEntry {
  sessionId: string;
  projectName: string;
  date: string;                    // YYYY-MM-DD for grouping
  startTime: string;               // ISO timestamp
  endTime?: string;
  durationMs?: number;
  messageCount: number;
  topics: string[];
  keyEntities: MemoryEntityReference[];
  taskId?: string;                // Linked task if any
  summary?: string;               // Auto-generated or user-provided
  filesModified?: string[];        // Files touched during session
  pendingWork?: string;           // Work left incomplete
}

export interface MemoryEntityReference {
  name: string;
  type: string;        // 'file', 'function', 'component', 'module'
  referenceCount: number;
}

export interface SessionIndex {
  _version: string;
  projectRoot: string;
  lastUpdated: string;
  sessions: SessionIndexEntry[];
}

// ====== Task Index ======

export interface TaskIndexEntry {
  id: string;
  title: string;
  goal: string;
  status: 'detected' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  sessionIds: string[];            // Sessions that worked on this task
  filesTouched: string[];
  decisions: string[];
  pending: string;                 // Work left incomplete
  nextSteps: string[];
  linkedTaskIds: string[];         // Tasks that depend on this one
  dependsOn: string[];            // Tasks this one depends on
  confidence: number;              // Detection confidence (0-1)
  gitCommitMessage?: string;
}

export interface TaskIndex {
  _version: string;
  projectRoot: string;
  lastUpdated: string;
  tasks: TaskIndexEntry[];
  sessionTaskMap: Record<string, string>;  // sessionId -> taskId
}

// ====== Task Detection ======

export interface DetectedTask {
  id: string;
  title: string;
  goal: string;
  sessionIds: string[];
  startDate: string;
  filesTouched: Set<string>;
  gitCommitMessage?: string;
  confidence: number;
  signals: TaskDetectionSignal[];
}

export type TaskDetectionSignal =
  | { type: 'git_commits'; count: number; messages: string[] }
  | { type: 'file_changes'; count: number; files: string[] }
  | { type: 'topic_cluster'; topics: string[] }
  | { type: 'time_gap'; hoursSinceLastSession: number };

// ====== Timeline ======

export interface TimelineEntry {
  type: 'task_started' | 'task_completed' | 'session' | 'handoff' | 'file_change' | 'decision_made';
  timestamp: string;
  title: string;
  summary: string;
  relatedTaskId?: string;
  relatedSessionId?: string;
  entities?: string[];
}

// ====== Search ======

export interface SearchableEntry {
  id: string;
  type: 'task' | 'session' | 'handoff' | 'decision';
  date: string;
  title: string;
  content: string;           // Combined searchable text
  entities: string[];       // Files, functions mentioned
  topics: string[];
  relevanceScore?: number;
}

export interface SearchResult extends SearchableEntry {
  matchedOn: string[];      // What matched the query
  snippet: string;          // Relevant snippet
}

// ====== Continuity Suggestions ======

export interface ContinuitySuggestion {
  type: 'continue_task' | 'review_decisions' | 'check_blockers' | 'update_summaries' | 'continue_session';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: 'resume_task' | 'read_summary' | 'check_status' | 'continue_session';
  relatedIds: {
    taskId?: string;
    sessionId?: string;
    decisionId?: string;
  };
  reason: string;            // Why this suggestion is relevant
}

// ====== Task Dependencies ======

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];      // taskIds this task depends on
  blocking: string[];       // taskIds blocked by this task
  status: 'blocked' | 'ready' | 'in_progress' | 'completed';
  reason?: string;          // Why the dependency exists
}

// ====== Storage Paths ======

export const MEMORY_DIR = '.kontextmind/memory';
export const SESSION_INDEX_FILE = 'session-index.json';
export const TASK_INDEX_FILE = 'task-index.json';

export function getMemoryDir(projectRoot: string): string {
  return `${projectRoot}/${MEMORY_DIR}`;
}

export function getSessionIndexPath(projectRoot: string): string {
  return `${getMemoryDir(projectRoot)}/${SESSION_INDEX_FILE}`;
}

export function getTaskIndexPath(projectRoot: string): string {
  return `${getMemoryDir(projectRoot)}/${TASK_INDEX_FILE}`;
}