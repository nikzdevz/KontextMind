import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

// Memory system imports (Phase 1+)
import {
  loadSessionIndex,
  getRecentSessions,
  getSessionsByTopic,
  getSessionStats as getSessionIndexStats,
  searchSessions,
  getSessionsByFile,
  type SessionIndexEntry,
} from '@kontextmind/core';
import {
  buildTimeline,
  getRecentActivity,
} from '@kontextmind/core';
import {
  searchMemory,
  searchEntities,
  findRelatedSessions,
} from '@kontextmind/core';
import {
  getCurrentTask,
  getTaskSessions as getTaskSessionList,
  getSessionTask,
  getTaskDependencies,
  getBlockedTasks as getBlockedTasksList,
  searchTasks,
} from '@kontextmind/core';
import {
  getContinuitySuggestions,
  analyzeContinuityNeed,
  getTaskResumptionContext,
  shouldContinueFromLastSession,
} from '@kontextmind/core';
import {
  getOutcomeTracker,
  getLearningBridge,
  type LearningStats,
  type OutcomePattern,
  type Improvement,
} from '@kontextmind/core';
import {
  getSelfAwareness,
  type AgentState,
  type CapabilityProfile,
  type AntiPattern,
  type SelfAssessment,
} from '@kontextmind/core';
import {
  getAnalyticsReport,
  getTopQuestions,
  getCacheCoverage,
} from '@kontextmind/core';
import {
  calculateQualityMetrics,
  getQualityTrends,
  getPerformanceStats,
  generateQualityReport,
} from '@kontextmind/core';
import {
  getDynamicContextEngine,
} from '@kontextmind/core';

const LOG_FILE = '.logs/mcp-events.log';
const MCP_VERSION = '0.1.0';

export type MCPMode = 'readonly' | 'chatbot-readonly' | 'suggest' | 'edit-with-approval' | 'full-agent';

const WRITE_TOOL_NAMES = new Set([
  'project.create_handoff',
  'project.write_task_summary',
  'project.write_session_summary',
  'project.add_task_dependency',
]);

function canRunToolInMode(toolName: string, mode: MCPMode): boolean {
  if (!WRITE_TOOL_NAMES.has(toolName)) {
    return true;
  }
  return mode === 'edit-with-approval' || mode === 'full-agent';
}

function modeDeniedResult(toolName: string, mode: MCPMode): { content: Array<{ type: string; text: string }> } {
  return {
    content: [{
      type: 'text',
      text: `Tool '${toolName}' is disabled in '${mode}' mode. Restart KontextMind MCP with --mode edit-with-approval or --mode full-agent for write tools.`,
    }],
  };
}

// MCP tool definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

// All available MCP tools
export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'project.status',
    description: 'Get the current project status including initialization, indexing, and summary states',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'project.search',
    description: 'Search for files, symbols, or content in the project',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        type: { type: 'string', enum: ['file', 'symbol', 'all'], default: 'all' },
      },
      required: ['query'],
    },
  },
  {
    name: 'project.get_file_summary',
    description: 'Get the summary for a specific file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to get summary for' },
      },
      required: ['path'],
    },
  },
  {
    name: 'project.get_function_summary',
    description: 'Get the summary for a specific function',
    inputSchema: {
      type: 'object',
      properties: {
        symbolId: { type: 'string', description: 'Function symbol ID to get summary for' },
      },
      required: ['symbolId'],
    },
  },
  {
    name: 'project.get_module_summary',
    description: 'Get the summary for a specific module/directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Module directory path to get summary for' },
      },
      required: ['path'],
    },
  },
  {
    name: 'project.get_api_summary',
    description: 'Get the summary for a specific API endpoint',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'API endpoint ID to get summary for' },
      },
      required: ['endpoint'],
    },
  },
  {
    name: 'project.get_decision_summary',
    description: 'Get the summary for a specific architectural decision',
    inputSchema: {
      type: 'object',
      properties: {
        decisionId: { type: 'string', description: 'Decision ID to get summary for' },
      },
      required: ['decisionId'],
    },
  },
  {
    name: 'project.get_blocker_summary',
    description: 'Get blocker information about a symbol or module',
    inputSchema: {
      type: 'object',
      properties: {
        blockerId: { type: 'string', description: 'Blocker ID to get summary for' },
      },
      required: ['blockerId'],
    },
  },
  {
    name: 'project.get_symbol_summary',
    description: 'Get summary information about a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Symbol name' },
        file: { type: 'string', description: 'Optional file path filter' },
      },
      required: ['name'],
    },
  },
  {
    name: 'project.find_dependencies',
    description: 'Find files that import or depend on a given file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to find dependencies for' },
      },
      required: ['path'],
    },
  },
  {
    name: 'project.find_callers',
    description: 'Find functions that call a given function',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Function name to find callers for' },
      },
      required: ['name'],
    },
  },
  {
    name: 'project.find_related_files',
    description: 'Find files related to a given file based on imports and dependencies',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to find related files for' },
      },
      required: ['path'],
    },
  },
  {
    name: 'project.find_blockers',
    description: 'Find what is blocking or is blocked by a given symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbolId: { type: 'string', description: 'Symbol ID to find blockers for' },
      },
      required: ['symbolId'],
    },
  },
  {
    name: 'project.ask_readonly',
    description: 'Ask a question about the project in readonly mode',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Question to ask' },
        no_code: { type: 'boolean', default: false, description: 'Filter out code from response' },
      },
      required: ['question'],
    },
  },
  {
    name: 'project.create_handoff',
    description: 'Create a handoff document for context transfer',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of current work' },
        next_steps: { type: 'string', description: 'Recommended next steps' },
      },
      required: ['summary'],
    },
  },
  {
    name: 'project.refresh_summary',
    description: 'Refresh stale summaries for changed files',
    inputSchema: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' }, description: 'File paths to refresh' },
      },
    },
  },
  {
    name: 'project.refresh_all_summaries',
    description: 'Refresh all summaries (files, functions, modules, APIs, decisions, blockers)',
    inputSchema: {
      type: 'object',
      properties: {
        types: { type: 'array', items: { type: 'string' }, description: 'Types to refresh: files, functions, modules, apis, decisions, blockers' },
      },
    },
  },
  {
    name: 'project.security_scan',
    description: 'Scan for potential security issues in the project',
    inputSchema: {
      type: 'object',
      properties: {
        include_secrets: { type: 'boolean', default: false, description: 'Include secret scanning' },
      },
    },
  },
  {
    name: 'project.get_all_summaries',
    description: 'Get all summaries with optional filtering by type',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['files', 'functions', 'modules', 'apis', 'decisions', 'blockers', 'all'], default: 'all', description: 'Type of summaries to retrieve' },
        limit: { type: 'number', default: 50, description: 'Maximum number of summaries to return' },
      },
    },
  },
  {
    name: 'project.check_provider',
    description: 'Check if a valid LLM provider is configured. Returns error if no provider available.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.get_recent_tasks',
    description: 'Get recent task summaries - what was worked on recently',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 5, description: 'Maximum number of tasks to return' },
      },
    },
  },
  {
    name: 'project.get_last_session',
    description: 'Get the last session summary - what happened in the previous session',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.resume_task',
    description: 'Get context to resume a specific task - finds task by ID or keywords',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to resume' },
        keywords: { type: 'string', description: 'Keywords to search for in task summaries' },
      },
    },
  },
  {
    name: 'project.write_task_summary',
    description: 'Write a task summary for tracking completed work',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Brief task title' },
        goal: { type: 'string', description: 'What was the goal?' },
        progress: { type: 'string', description: 'What was accomplished?' },
        filesTouched: { type: 'array', items: { type: 'string' }, description: 'Files modified' },
        decisions: { type: 'array', items: { type: 'string' }, description: 'Key decisions made' },
        pending: { type: 'string', description: 'What remains?' },
        nextSteps: { type: 'string', description: 'Recommended next steps' },
      },
      required: ['title', 'goal'],
    },
  },
  {
    name: 'project.write_session_summary',
    description: 'Write a session summary for tracking work across a session',
    inputSchema: {
      type: 'object',
      properties: {
        goals: { type: 'string', description: 'What was being worked on?' },
        tasksCompleted: { type: 'array', items: { type: 'string' }, description: 'Tasks completed this session' },
        filesModified: { type: 'array', items: { type: 'string' }, description: 'All files modified' },
        decisions: { type: 'array', items: { type: 'string' }, description: 'Key decisions made' },
        pending: { type: 'string', description: 'Unfinished work' },
        handoff: { type: 'string', description: 'Context for next session' },
      },
      required: [],
    },
  },

  // ====== PHASE 1: Session Index Tools ======
  {
    name: 'project.get_session_index',
    description: 'Get all sessions with metadata for cross-session search and continuity',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 30, description: 'Number of days to look back' },
        limit: { type: 'number', default: 20, description: 'Maximum number of sessions to return' },
        topic: { type: 'string', description: 'Filter by topic keyword' },
      },
    },
  },
  {
    name: 'project.get_session_stats',
    description: 'Get statistics about all sessions - total sessions, messages, activity patterns',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.search_sessions',
    description: 'Search across all historical sessions by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', default: 10, description: 'Maximum results to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'project.get_recent_files',
    description: 'Get files that were recently touched across all sessions',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 7, description: 'Days to look back' },
        limit: { type: 'number', default: 20, description: 'Maximum files to return' },
      },
    },
  },

  // ====== PHASE 5: Timeline Tools ======
  {
    name: 'project.get_timeline',
    description: 'Get a timeline of all activity over a period',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', default: 72, description: 'Hours to look back' },
        format: { type: 'string', enum: ['summary', 'detailed'], default: 'summary' },
      },
    },
  },
  {
    name: 'project.get_recent_activity',
    description: 'Get a summary of what happened recently across all sessions and tasks',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 3, description: 'Days to look back' },
      },
    },
  },

  // ====== PHASE 2-3: Task Management Tools ======
  {
    name: 'project.get_current_task',
    description: 'Get the current active task based on recent work',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.get_task_sessions',
    description: 'Get all sessions related to a specific task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to get sessions for' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'project.get_session_task',
    description: 'Get the task that a session contributed to',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },

  // ====== PHASE 4: Cross-Session Search Tools ======
  {
    name: 'project.search_memory',
    description: 'Search across all sessions, tasks, and handoffs for specific content',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        types: { type: 'array', items: { type: 'string', enum: ['task', 'session', 'handoff'] }, description: 'Filter by type' },
        days: { type: 'number', default: 30, description: 'Days to search back' },
        limit: { type: 'number', default: 10, description: 'Maximum results' },
      },
      required: ['query'],
    },
  },
  {
    name: 'project.search_entities',
    description: 'Search for specific files, functions, or components across all sessions',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity name to search for' },
        type: { type: 'string', enum: ['file', 'function', 'component', 'module'], description: 'Entity type filter' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'project.find_related_sessions',
    description: 'Find sessions related to a specific session based on shared topics or files',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to find related sessions for' },
        limit: { type: 'number', default: 5, description: 'Maximum related sessions' },
      },
      required: ['sessionId'],
    },
  },

  // ====== PHASE 6: Task Dependency Tools ======
  {
    name: 'project.add_task_dependency',
    description: 'Mark that a task depends on another task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task that has the dependency' },
        dependsOn: { type: 'string', description: 'Task ID it depends on' },
      },
      required: ['taskId', 'dependsOn'],
    },
  },
  {
    name: 'project.get_task_dependencies',
    description: 'Get dependency information for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'project.get_blocked_tasks',
    description: 'Get all tasks that are blocked by incomplete tasks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ====== PHASE 7: Continuity Suggestion Tools ======
  {
    name: 'project.get_continuity_suggestions',
    description: 'Get suggestions for continuing from where you left off - pending tasks, blockers, etc.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.analyze_continuity',
    description: 'Analyze if there is pending work to continue from previous sessions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.get_task_resumption_context',
    description: 'Get full context for resuming a specific task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to get context for' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'project.should_continue',
    description: 'Check if there is work to continue from the previous session',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ====== LEARNING & ADAPTATION TOOLS ======
  {
    name: 'project.learn_sync',
    description: 'Trigger manual learning sync - extracts knowledge from summaries and Q&A history',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.learn_import',
    description: 'Import learning data from another project',
    inputSchema: {
      type: 'object',
      properties: {
        sourceProject: { type: 'string', description: 'Path to source project directory' },
        dataTypes: { type: 'array', items: { type: 'string' }, description: 'Data types to import: summaries, decisions' },
      },
      required: ['sourceProject'],
    },
  },
  {
    name: 'project.learn_stats',
    description: 'Get learning statistics - outcomes, success rates, patterns learned',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.learn_patterns',
    description: 'Get learned success and failure patterns for a task type',
    inputSchema: {
      type: 'object',
      properties: {
        taskType: { type: 'string', description: 'Task type to get patterns for (e.g., code_write, debug)' },
      },
      required: ['taskType'],
    },
  },
  {
    name: 'project.learn_suggestions',
    description: 'Get improvement suggestions based on learned patterns',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['skill', 'pattern', 'approach', 'documentation'], description: 'Filter by improvement category' },
        limit: { type: 'number', default: 10, description: 'Maximum suggestions to return' },
      },
    },
  },
  {
    name: 'project.learn_export',
    description: 'Export learning data for training purposes',
    inputSchema: {
      type: 'object',
      properties: {
        taskType: { type: 'string', description: 'Filter by task type' },
        minConfidence: { type: 'number', description: 'Minimum confidence threshold (0-1)' },
      },
    },
  },

  // ====== AGENT AWARENESS TOOLS ======
  {
    name: 'project.agent_state',
    description: 'Get current agent state - current task, goals, blockers, energy level, mode',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.agent_capabilities',
    description: 'Get agent capability profile - strengths, weak areas, success rates, preferred approaches',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.agent_antipatterns',
    description: 'Get anti-patterns the agent has learned to avoid',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.agent_assess',
    description: 'Self-assess current state and get suggestions',
    inputSchema: {
      type: 'object',
      properties: {
        taskDescription: { type: 'string', description: 'Optional task description for context' },
        recentErrors: { type: 'array', items: { type: 'string' }, description: 'Recent errors encountered' },
        timeSpent: { type: 'number', description: 'Time spent on current task in milliseconds' },
      },
    },
  },

  // ====== TASK DETECTION TOOLS ======
  {
    name: 'project.task_detect',
    description: 'Detect current task boundaries and context from recent activity',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.task_complete',
    description: 'Mark current task as completed',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to mark complete' },
      },
    },
  },
  {
    name: 'project.task_update_pending',
    description: 'Update pending work for current task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to update' },
        pendingWork: { type: 'string', description: 'Description of remaining work' },
      },
      required: ['taskId', 'pendingWork'],
    },
  },

  // ====== ANALYTICS TOOLS ======
  {
    name: 'project.ask_stats',
    description: 'Get Q&A statistics including cache hit rate, response times, tier distribution',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['daily', 'weekly'], default: 'daily', description: 'Time period for stats' },
      },
    },
  },
  {
    name: 'project.ask_top_questions',
    description: 'Get most frequently asked questions',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10, description: 'Maximum questions to return' },
      },
    },
  },
  {
    name: 'project.ask_quality',
    description: 'Get answer quality metrics and cache coverage',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ====== QUALITY TOOLS ======
  {
    name: 'project.quality_trends',
    description: 'Get quality trends over time',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 7, description: 'Number of days to analyze' },
      },
    },
  },
  {
    name: 'project.quality_report',
    description: 'Generate comprehensive quality report',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['daily', 'weekly'], default: 'daily', description: 'Report period' },
      },
    },
  },
  {
    name: 'project.quality_performance',
    description: 'Get performance statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ====== CONTEXT TOOLS ======
  {
    name: 'project.context_stats',
    description: 'Get dynamic context engine statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project.context_export',
    description: 'Export current context window for debugging or analysis',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ====== SESSION INSIGHTS TOOLS ======
  {
    name: 'project.session_insights',
    description: 'Get cross-session insights and patterns',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 30, description: 'Days to analyze' },
      },
    },
  },
];

// All available MCP resources
export const MCP_RESOURCES: MCPResource[] = [
  {
    uri: 'kontextmind://project/overview',
    name: 'Project Overview',
    description: 'Get the project overview including name, mode, phase, and statistics',
  },
  {
    uri: 'kontextmind://project/architecture',
    name: 'Project Architecture',
    description: 'Get the project architecture including file structure and key components',
  },
  {
    uri: 'kontextmind://project/current-state',
    name: 'Current State',
    description: 'Get the current state of the project including recent activity and next steps',
  },
  {
    uri: 'kontextmind://project/provider-status',
    name: 'Provider Status',
    description: 'Check if LLM provider is configured and available',
  },
  {
    uri: 'kontextmind://graph/files',
    name: 'File Graph',
    description: 'Get the file dependency graph',
  },
  {
    uri: 'kontextmind://graph/symbols',
    name: 'Symbol Graph',
    description: 'Get the symbol dependency graph',
  },
  {
    uri: 'kontextmind://graph/blockers',
    name: 'Blockers Graph',
    description: 'Get the blocker/dependency graph',
  },
  {
    uri: 'kontextmind://handoff/latest',
    name: 'Latest Handoff',
    description: 'Get the latest handoff document',
  },
  {
    uri: 'kontextmind://summaries/files',
    name: 'File Summaries',
    description: 'Get all file summaries',
  },
  {
    uri: 'kontextmind://summaries/functions',
    name: 'Function Summaries',
    description: 'Get all function summaries',
  },
  {
    uri: 'kontextmind://summaries/modules',
    name: 'Module Summaries',
    description: 'Get all module summaries',
  },
  {
    uri: 'kontextmind://summaries/apis',
    name: 'API Summaries',
    description: 'Get all API endpoint summaries',
  },
  {
    uri: 'kontextmind://summaries/decisions',
    name: 'Decision Summaries',
    description: 'Get all architectural decision summaries',
  },
  {
    uri: 'kontextmind://summaries/blockers',
    name: 'Blocker Summaries',
    description: 'Get all blocker/dependency issue summaries',
  },
  {
    uri: 'kontextmind://summaries/all',
    name: 'All Summaries',
    description: 'Get all summaries combined (files, functions, modules, apis, decisions, blockers)',
  },
];

// All available MCP prompts
export const MCP_PROMPTS: MCPPrompt[] = [
  {
    name: 'explain_project',
    description: 'Generate a project explanation using all available summaries',
    arguments: [
      { name: 'detail_level', description: 'Level of detail: brief, medium, detailed', required: false },
    ],
  },
  {
    name: 'resume_last_task',
    description: 'Get context to resume the last task using handoff and summary documents',
  },
  {
    name: 'review_impact',
    description: 'Analyze the impact of changes using dependency and blocker analysis',
    arguments: [
      { name: 'changed_files', description: 'Comma-separated list of changed files', required: true },
    ],
  },
  {
    name: 'answer_without_code',
    description: 'Answer a question without showing code, using summary knowledge',
    arguments: [
      { name: 'question', description: 'Question to answer', required: true },
    ],
  },
  {
    name: 'find_bug_area',
    description: 'Find the likely location of a bug using blocker and dependency analysis',
    arguments: [
      { name: 'error', description: 'Error message or description', required: true },
    ],
  },
  {
    name: 'summarize_module',
    description: 'Summarize a module using file, function, and API summaries',
    arguments: [
      { name: 'path', description: 'Path to module', required: true },
    ],
  },
  {
    name: 'prepare_handoff',
    description: 'Prepare a handoff document using current project state and summaries',
    arguments: [
      { name: 'completed_work', description: 'Summary of completed work', required: true },
      { name: 'pending_work', description: 'Summary of pending work', required: false },
    ],
  },
  {
    name: 'understand_architecture',
    description: 'Understand the project architecture using all summaries and knowledge graphs',
    arguments: [
      { name: 'focus_area', description: 'Optional area to focus on', required: false },
    ],
  },
  {
    name: 'analyze_dependencies',
    description: 'Analyze dependencies and blockers for a given file or module',
    arguments: [
      { name: 'path', description: 'File or module path', required: true },
    ],
  },
];

// Get project root
function getProjectRoot(): string {
  return process.cwd();
}

// ==================== Global Config Loader ====================

interface GlobalProviderConfig {
  provider: string;
  baseUrl: string;
  model?: string;
  apiKey?: string;
}

interface GlobalConfig {
  providers: Record<string, GlobalProviderConfig>;
  defaultProvider?: string;
}

function getGlobalConfigDir(): string {
  const base = process.env.APPDATA || process.env.HOME || '';
  return join(base, '.kontextmind');
}

function loadGlobalConfig(): GlobalConfig {
  const configPath = join(getGlobalConfigDir(), 'config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return { providers: {} };
    }
  }
  return { providers: {} };
}

function checkProviderConfigured(): { configured: boolean; provider?: string; model?: string; error?: string } {
  const globalConfig = loadGlobalConfig();

  if (globalConfig.defaultProvider && globalConfig.providers[globalConfig.defaultProvider]) {
    const provider = globalConfig.providers[globalConfig.defaultProvider];
    return {
      configured: true,
      provider: globalConfig.defaultProvider,
      model: provider.model || 'unknown',
    };
  }

  // Check project config
  const projectRoot = getProjectRoot();
  const projectConfigPath = join(projectRoot, '.kontextmind', 'providers.json');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      const selectedProvider = projectConfig.selected_provider;
      if (selectedProvider && selectedProvider !== 'none' && projectConfig.providers?.[selectedProvider]) {
        return {
          configured: true,
          provider: selectedProvider,
          model: projectConfig.providers[selectedProvider].model || 'unknown',
        };
      }
    } catch {
      // Fall through
    }
  }

  return {
    configured: false,
    error: 'No LLM provider configured. Please configure a provider:\n' +
      '  1. Globally: kontextmind config add --name <name> --type openai-compatible --baseUrl <url> --apiKey <key> --global\n' +
      '  2. Then set default: kontextmind config set --name <name> --global\n' +
      '\nOr configure in project .kontextmind/providers.json',
  };
}

// ==================== Summary Loaders ====================

function getSafeFileName(filePath: string): string {
  return filePath.replace(/[/\\:]/g, '__').replace(/\.json$/, '_json');
}

function loadAllFileSummaries(): any[] {
  const projectRoot = getProjectRoot();
  const summaryDir = join(projectRoot, '.summaries', 'files');
  const summaries: any[] = [];

  if (!existsSync(summaryDir)) return summaries;

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content));
        } catch { /* ignore malformed summary */ }
      }
    }
  } catch { /* ignore malformed summary */ }

  return summaries;
}

function loadAllFunctionSummaries(): any[] {
  const projectRoot = getProjectRoot();
  const summaryDir = join(projectRoot, '.summaries', 'functions');
  const summaries: any[] = [];

  if (!existsSync(summaryDir)) return summaries;

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content));
        } catch { /* ignore malformed summary */ }
      }
    }
  } catch { /* ignore malformed summary */ }

  return summaries;
}

function loadAllModuleSummaries(): any[] {
  const projectRoot = getProjectRoot();
  const summaryDir = join(projectRoot, '.summaries', 'modules');
  const summaries: any[] = [];

  if (!existsSync(summaryDir)) return summaries;

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content));
        } catch { /* ignore malformed summary */ }
      }
    }
  } catch { /* ignore malformed summary */ }

  return summaries;
}

function loadAllAPISummaries(): any[] {
  const projectRoot = getProjectRoot();
  const summaryDir = join(projectRoot, '.summaries', 'api');
  const summaries: any[] = [];

  if (!existsSync(summaryDir)) return summaries;

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content));
        } catch { /* ignore malformed summary */ }
      }
    }
  } catch { /* ignore malformed summary */ }

  return summaries;
}

function loadAllDecisionSummaries(): any[] {
  const projectRoot = getProjectRoot();
  const summaryDir = join(projectRoot, '.summaries', 'decisions');
  const summaries: any[] = [];

  if (!existsSync(summaryDir)) return summaries;

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content));
        } catch { /* ignore malformed summary */ }
      }
    }
  } catch { /* ignore malformed summary */ }

  return summaries;
}

function loadAllBlockerSummaries(): any[] {
  const projectRoot = getProjectRoot();
  const summaryDir = join(projectRoot, '.summaries', 'blockers');
  const summaries: any[] = [];

  if (!existsSync(summaryDir)) return summaries;

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content));
        } catch { /* ignore malformed summary */ }
      }
    }
  } catch { /* ignore malformed summary */ }

  return summaries;
}

// Log MCP event
async function logMCPEvent(
  projectRoot: string,
  event: {
    timestamp: string;
    client?: string;
    tool?: string;
    resource?: string;
    prompt?: string;
    arguments_summary?: string;
    mode: string;
  }
): Promise<void> {
  const logLine = `[${event.timestamp}] mode=${event.mode}` +
    (event.client ? ` client=${event.client}` : '') +
    (event.tool ? ` tool=${event.tool}` : '') +
    (event.resource ? ` resource=${event.resource}` : '') +
    (event.prompt ? ` prompt=${event.prompt}` : '') +
    (event.arguments_summary ? ` args=${event.arguments_summary}` : '') +
    '\n';

  try {
    const dirPath = join(projectRoot, '.logs');
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    const logPath = join(projectRoot, LOG_FILE);
    appendFileSync(logPath, logLine, 'utf-8');
  } catch {
    // Silently ignore logging errors
  }
}

// Handle MCP tool call
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  projectRoot?: string,
  mode: MCPMode = (serverStatus?.mode as MCPMode | undefined) || 'readonly'
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const root = projectRoot || getProjectRoot();

  await logMCPEvent(root, {
    timestamp: new Date().toISOString(),
    tool: toolName,
    arguments_summary: JSON.stringify(args).slice(0, 100),
    mode,
  });

  if (!canRunToolInMode(toolName, mode)) {
    return modeDeniedResult(toolName, mode);
  }

  switch (toolName) {
    case 'project.status':
      return handleStatus();

    case 'project.check_provider':
      return handleCheckProvider();

    case 'project.search':
      return handleSearch(args.query as string, args.type as string);

    case 'project.get_file_summary':
      return handleGetFileSummary(args.path as string);

    case 'project.get_function_summary':
      return handleGetFunctionSummary(args.symbolId as string);

    case 'project.get_module_summary':
      return handleGetModuleSummary(args.path as string);

    case 'project.get_api_summary':
      return handleGetAPISummary(args.endpoint as string);

    case 'project.get_decision_summary':
      return handleGetDecisionSummary(args.decisionId as string);

    case 'project.get_blocker_summary':
      return handleGetBlockerSummary(args.blockerId as string);

    case 'project.get_symbol_summary':
      return handleGetSymbolSummary(args.name as string, args.file as string | undefined);

    case 'project.find_dependencies':
      return handleFindDependencies(args.path as string);

    case 'project.find_callers':
      return handleFindCallers(args.name as string);

    case 'project.find_related_files':
      return handleFindRelatedFiles(args.path as string);

    case 'project.find_blockers':
      return handleFindBlockers(args.symbolId as string);

    case 'project.ask_readonly':
      return handleAskReadonly(args.question as string, args.no_code as boolean | undefined);

    case 'project.create_handoff':
      return handleCreateHandoff(args.summary as string, args.next_steps as string | undefined);

    case 'project.refresh_summary':
      return handleRefreshSummary(args.paths as string[] | undefined);

    case 'project.refresh_all_summaries':
      return handleRefreshAllSummaries(args.types as string[] | undefined);

    case 'project.security_scan':
      return handleSecurityScan(args.include_secrets as boolean | undefined);

    case 'project.get_all_summaries':
      return handleGetAllSummaries(args.type as string, args.limit as number | undefined);

    case 'project.get_recent_tasks':
      return handleGetRecentTasks(args.limit as number | undefined);

    case 'project.get_last_session':
      return handleGetLastSession();

    case 'project.resume_task':
      return handleResumeTask(args.taskId as string | undefined, args.keywords as string | undefined);

    case 'project.write_task_summary':
      return handleWriteTaskSummary(args as Record<string, unknown>);

    case 'project.write_session_summary':
      return handleWriteSessionSummary(args as Record<string, unknown>);

    // ====== PHASE 1: Session Index Tools ======
    case 'project.get_session_index':
      return handleGetSessionIndex(args.days as number, args.limit as number, args.topic as string | undefined);

    case 'project.get_session_stats':
      return handleGetSessionStats();

    case 'project.search_sessions':
      return handleSearchSessions(args.query as string, args.limit as number);

    case 'project.get_recent_files':
      return handleGetRecentFiles(args.days as number, args.limit as number);

    // ====== PHASE 5: Timeline Tools ======
    case 'project.get_timeline':
      return handleGetTimeline(args.hours as number, args.format as 'summary' | 'detailed');

    case 'project.get_recent_activity':
      return handleGetRecentActivity(args.days as number);

    // ====== PHASE 2-3: Task Management Tools ======
    case 'project.get_current_task':
      return handleGetCurrentTask();

    case 'project.get_task_sessions':
      return handleGetTaskSessions(args.taskId as string);

    case 'project.get_session_task':
      return handleGetSessionTask(args.sessionId as string);

    // ====== PHASE 4: Cross-Session Search Tools ======
    case 'project.search_memory':
      return handleSearchMemory(
        args.query as string,
        args.types as ('task' | 'session' | 'handoff')[] | undefined,
        args.days as number,
        args.limit as number
      );

    case 'project.search_entities':
      return handleSearchEntities(args.entity as string, args.type as string | undefined);

    case 'project.find_related_sessions':
      return handleFindRelatedSessions(args.sessionId as string, args.limit as number);

    // ====== PHASE 6: Task Dependency Tools ======
    case 'project.add_task_dependency':
      return handleAddTaskDependency(args.taskId as string, args.dependsOn as string);

    case 'project.get_task_dependencies':
      return handleGetTaskDependencies(args.taskId as string);

    case 'project.get_blocked_tasks':
      return handleGetBlockedTasks();

    // ====== PHASE 7: Continuity Suggestion Tools ======
    case 'project.get_continuity_suggestions':
      return handleGetContinuitySuggestions();

    case 'project.analyze_continuity':
      return handleAnalyzeContinuity();

    case 'project.get_task_resumption_context':
      return handleGetTaskResumptionContext(args.taskId as string);

    case 'project.should_continue':
      return handleShouldContinue();

    // ====== LEARNING & ADAPTATION TOOLS ======
    case 'project.learn_sync':
      return handleLearnSync();

    case 'project.learn_import':
      return handleLearnImport(args.sourceProject as string, args.dataTypes as string[] | undefined);

    case 'project.learn_stats':
      return handleLearnStats();

    case 'project.learn_patterns':
      return handleLearnPatterns(args.taskType as string);

    case 'project.learn_suggestions':
      return handleLearnSuggestions(args.category as string | undefined, args.limit as number | undefined);

    case 'project.learn_export':
      return handleLearnExport(args.taskType as string | undefined, args.minConfidence as number | undefined);

    // ====== AGENT AWARENESS TOOLS ======
    case 'project.agent_state':
      return handleAgentState();

    case 'project.agent_capabilities':
      return handleAgentCapabilities();

    case 'project.agent_antipatterns':
      return handleAgentAntiPatterns();

    case 'project.agent_assess':
      return handleAgentAssess(args.taskDescription as string | undefined, args.recentErrors as string[] | undefined, args.timeSpent as number | undefined);

    // ====== TASK DETECTION TOOLS ======
    case 'project.task_detect':
      return handleTaskDetect();

    case 'project.task_complete':
      return handleTaskComplete(args.taskId as string | undefined);

    case 'project.task_update_pending':
      return handleTaskUpdatePending(args.taskId as string, args.pendingWork as string);

    // ====== ANALYTICS TOOLS ======
    case 'project.ask_stats':
      return handleAskStats(args.period as 'daily' | 'weekly' | undefined);

    case 'project.ask_top_questions':
      return handleAskTopQuestions(args.limit as number | undefined);

    case 'project.ask_quality':
      return handleAskQuality();

    // ====== QUALITY TOOLS ======
    case 'project.quality_trends':
      return handleQualityTrends(args.days as number | undefined);

    case 'project.quality_report':
      return handleQualityReport(args.period as 'daily' | 'weekly' | undefined);

    case 'project.quality_performance':
      return handleQualityPerformance();

    // ====== CONTEXT TOOLS ======
    case 'project.context_stats':
      return handleContextStats();

    case 'project.context_export':
      return handleContextExport();

    // ====== SESSION INSIGHTS TOOLS ======
    case 'project.session_insights':
      return handleSessionInsights(args.days as number | undefined);

    default:
      return {
        content: [{ type: 'text', text: `Tool '${toolName}' not implemented yet.` }],
      };
  }
}

// Tool handlers
async function handleStatus(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const configPath = join(projectRoot, '.kontextmind', 'config.json');

  let status = 'Not initialized';
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      status = `Project: ${config.project?.name || 'unknown'}, Mode: ${config.mode || 'unknown'}, Phase: ${config.phase || 'unknown'}`;

      // Add summary counts
      const fileSummaries = loadAllFileSummaries();
      const funcSummaries = loadAllFunctionSummaries();
      const moduleSummaries = loadAllModuleSummaries();
      const apiSummaries = loadAllAPISummaries();
      const decisionSummaries = loadAllDecisionSummaries();
      const blockerSummaries = loadAllBlockerSummaries();

      status += `\n\nSummaries:\n` +
        `  Files: ${fileSummaries.length}\n` +
        `  Functions: ${funcSummaries.length}\n` +
        `  Modules: ${moduleSummaries.length}\n` +
        `  APIs: ${apiSummaries.length}\n` +
        `  Decisions: ${decisionSummaries.length}\n` +
        `  Blockers: ${blockerSummaries.length}`;

      // Add provider status
      const providerStatus = checkProviderConfigured();
      status += `\n\nProvider: ${providerStatus.configured ? `${providerStatus.provider} (${providerStatus.model})` : 'NOT CONFIGURED'}`;
      if (!providerStatus.configured && providerStatus.error) {
        status += `\n\n${providerStatus.error}`;
      }
    } catch {
      status = 'Invalid config';
    }
  }

  return { content: [{ type: 'text', text: status }] };
}

async function handleCheckProvider(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const providerStatus = checkProviderConfigured();

  if (providerStatus.configured) {
    return {
      content: [{ type: 'text', text: `Provider configured: ${providerStatus.provider} (model: ${providerStatus.model})` }],
    };
  } else {
    return {
      content: [{ type: 'text', text: `ERROR: ${providerStatus.error}` }],
    };
  }
}

async function handleSearch(query: string, type: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Search across all summaries
  const files = loadAllFileSummaries();
  const functions = loadAllFunctionSummaries();
  const modules = loadAllModuleSummaries();
  const apis = loadAllAPISummaries();
  const decisions = loadAllDecisionSummaries();

  const results: string[] = [];
  const q = query.toLowerCase();

  if (type === 'all' || type === 'file') {
    for (const f of files) {
      if (f.filePath?.toLowerCase().includes(q) || f.purpose?.toLowerCase().includes(q)) {
        results.push(`FILE: ${f.filePath} - ${f.purpose || 'no description'}`);
      }
    }
  }

  if (type === 'all' || type === 'symbol') {
    for (const f of functions) {
      if (f.symbolName?.toLowerCase().includes(q) || f.summary?.toLowerCase().includes(q)) {
        results.push(`FUNCTION: ${f.symbolName} in ${f.filePath} - ${f.summary || 'no description'}`);
      }
    }

    for (const m of modules) {
      if (m.directoryPath?.toLowerCase().includes(q) || m.summary?.toLowerCase().includes(q)) {
        results.push(`MODULE: ${m.directoryPath} - ${m.summary || 'no description'}`);
      }
    }

    for (const a of apis) {
      if (a.endpoint?.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q)) {
        results.push(`API: ${a.endpoint} (${a.method}) - ${a.summary || 'no description'}`);
      }
    }

    for (const d of decisions) {
      if (d.title?.toLowerCase().includes(q) || d.summary?.toLowerCase().includes(q)) {
        results.push(`DECISION: ${d.title} - ${d.summary || 'no description'}`);
      }
    }
  }

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No results found for "${query}"` }] };
  }

  return { content: [{ type: 'text', text: results.slice(0, 20).join('\n\n') }] };
}

async function handleGetFileSummary(path: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const safePath = getSafeFileName(path);
  const summaryPath = join(projectRoot, '.summaries', 'files', safePath + '.json');

  if (!existsSync(summaryPath)) {
    return { content: [{ type: 'text', text: `No summary found for ${path}. Run "kontextmind summarize" first.` }] };
  }

  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    let text = `## File Summary\n\n**Path:** ${summary.filePath}\n`;
    text += `**Language:** ${summary.language}\n`;
    text += `**Status:** ${summary.summaryStatus}\n`;
    text += `**Provider:** ${summary.provider} (${summary.model})\n\n`;
    text += `### Purpose\n${summary.purpose || 'No description available'}\n\n`;

    if (summary.symbols && summary.symbols.length > 0) {
      text += `### Exported Symbols\n`;
      for (const s of summary.symbols.slice(0, 10)) {
        text += `- ${s.kind} ${s.name}`;
        if (s.blockedBy && s.blockedBy.length > 0) {
          text += ` (blocked by: ${s.blockedBy.map((b: any) => b.name).join(', ')})`;
        }
        text += '\n';
      }
      text += '\n';
    }

    if (summary.dependencies && summary.dependencies.length > 0) {
      text += `### Dependencies\n${summary.dependencies.join(', ')}\n\n`;
    }

    if (summary.blockedBy && summary.blockedBy.length > 0) {
      text += `### Blocked By\n`;
      for (const b of summary.blockedBy) {
        text += `- ${b.name}: ${b.reason} (${b.severity})\n`;
      }
    }

    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `Error reading summary for ${path}` }] };
  }
}

async function handleGetFunctionSummary(symbolId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const safePath = getSafeFileName(symbolId);
  const summaryPath = join(projectRoot, '.summaries', 'functions', safePath + '.json');

  if (!existsSync(summaryPath)) {
    return { content: [{ type: 'text', text: `No summary found for function ${symbolId}. Run "kontextmind summarize" first.` }] };
  }

  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    let text = `## Function Summary\n\n**Name:** ${summary.symbolName}\n`;
    text += `**File:** ${summary.filePath}\n`;
    text += `**Signature:** ${summary.signature || 'unknown'}\n`;
    text += `**Status:** ${summary.summaryStatus}\n\n`;
    text += `### Purpose\n${summary.summary || summary.purpose || 'No description available'}\n\n`;

    if (summary.parameters && summary.parameters.length > 0) {
      text += `### Parameters\n${summary.parameters.join(', ')}\n\n`;
    }

    if (summary.returnType) {
      text += `### Return Type\n${summary.returnType}\n\n`;
    }

    if (summary.complexity) {
      text += `### Complexity\n${summary.complexity}/10\n\n`;
    }

    if (summary.blockedBy && summary.blockedBy.length > 0) {
      text += `### Blocked By\n`;
      for (const b of summary.blockedBy) {
        text += `- ${b.name}: ${b.reason}\n`;
      }
    }

    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `Error reading summary for ${symbolId}` }] };
  }
}

async function handleGetModuleSummary(path: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const safePath = getSafeFileName(path);
  const summaryPath = join(projectRoot, '.summaries', 'modules', safePath + '.json');

  if (!existsSync(summaryPath)) {
    return { content: [{ type: 'text', text: `No summary found for module ${path}. Run "kontextmind summarize" first.` }] };
  }

  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    let text = `## Module Summary\n\n**Path:** ${summary.directoryPath}\n`;
    text += `**Files:** ${summary.fileCount}\n`;
    text += `**Status:** ${summary.summaryStatus}\n\n`;
    text += `### Summary\n${summary.summary || 'No description available'}\n\n`;

    if (summary.keyFiles && summary.keyFiles.length > 0) {
      text += `### Key Files\n${summary.keyFiles.map((f: string) => `- ${f}`).join('\n')}\n\n`;
    }

    if (summary.exports && summary.exports.length > 0) {
      text += `### Exports\n${summary.exports.slice(0, 15).join(', ')}\n\n`;
    }

    if (summary.imports && summary.imports.length > 0) {
      text += `### External Dependencies\n${summary.imports.slice(0, 15).join(', ')}\n\n`;
    }

    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `Error reading summary for ${path}` }] };
  }
}

async function handleGetAPISummary(endpoint: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const safePath = getSafeFileName(endpoint);
  const summaryPath = join(projectRoot, '.summaries', 'api', safePath + '.json');

  if (!existsSync(summaryPath)) {
    return { content: [{ type: 'text', text: `No summary found for API ${endpoint}. Run "kontextmind summarize" first.` }] };
  }

  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    let text = `## API Summary\n\n**Endpoint:** ${summary.endpoint}\n`;
    text += `**Method:** ${summary.method || 'unknown'}\n`;
    text += `**File:** ${summary.filePath}\n`;
    text += `**Status:** ${summary.summaryStatus}\n\n`;
    text += `### Description\n${summary.description || summary.summary || 'No description available'}\n\n`;

    if (summary.parameters && summary.parameters.length > 0) {
      text += `### Parameters\n`;
      for (const p of summary.parameters) {
        text += `- ${p.name}: ${p.type}${p.required ? ' (required)' : ' (optional)'}\n`;
      }
      text += '\n';
    }

    if (summary.responseType) {
      text += `### Response Type\n${summary.responseType}\n\n`;
    }

    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `Error reading summary for ${endpoint}` }] };
  }
}

async function handleGetDecisionSummary(decisionId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const safePath = getSafeFileName(decisionId);
  const summaryPath = join(projectRoot, '.summaries', 'decisions', safePath + '.json');

  if (!existsSync(summaryPath)) {
    return { content: [{ type: 'text', text: `No summary found for decision ${decisionId}. Run "kontextmind summarize" first.` }] };
  }

  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    let text = `## Decision Summary\n\n**Title:** ${summary.title || decisionId}\n`;
    text += `**File:** ${summary.filePath}\n`;
    text += `**Status:** ${summary.summaryStatus}\n\n`;
    text += `### Summary\n${summary.summary || 'No description available'}\n\n`;

    if (summary.context) {
      text += `### Context\n${summary.context}\n\n`;
    }

    if (summary.rationale) {
      text += `### Rationale\n${summary.rationale}\n\n`;
    }

    if (summary.alternatives && summary.alternatives.length > 0) {
      text += `### Alternatives Considered\n${summary.alternatives.map((a: string) => `- ${a}`).join('\n')}\n\n`;
    }

    if (summary.consequences && summary.consequences.length > 0) {
      text += `### Consequences\n${summary.consequences.map((c: string) => `- ${c}`).join('\n')}\n\n`;
    }

    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `Error reading summary for ${decisionId}` }] };
  }
}

async function handleGetBlockerSummary(blockerId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const safePath = getSafeFileName(blockerId);
  const summaryPath = join(projectRoot, '.summaries', 'blockers', safePath + '.json');

  if (!existsSync(summaryPath)) {
    return { content: [{ type: 'text', text: `No summary found for blocker ${blockerId}. Run "kontextmind summarize" first.` }] };
  }

  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    let text = `## Blocker Summary\n\n**Source:** ${summary.sourceSymbol}\n`;
    text += `**Target:** ${summary.targetSymbol}\n`;
    text += `**Severity:** ${summary.severity}\n`;
    text += `**File:** ${summary.filePath}${summary.line ? `:${summary.line}` : ''}\n\n`;
    text += `### Reason\n${summary.reason}\n\n`;
    text += `### Resolution\n${summary.resolution || 'No resolution available'}\n`;

    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `Error reading summary for ${blockerId}` }] };
  }
}

async function handleGetSymbolSummary(name: string, file?: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Search function summaries for this symbol
  const functions = loadAllFunctionSummaries();
  const matching = functions.filter(f =>
    f.symbolName === name && (!file || f.filePath === file)
  );

  if (matching.length > 0) {
    return handleGetFunctionSummary(matching[0].symbolId);
  }

  // Search file summaries for this symbol
  const files = loadAllFileSummaries();
  const matchingFiles = files.filter(f => f.symbols?.some((s: any) => s.name === name));

  if (matchingFiles.length > 0) {
    return handleGetFileSummary(matchingFiles[0].filePath);
  }

  return {
    content: [{
      type: 'text',
      text: `Symbol "${name}"${file ? ` in ${file}` : ''} not found in any summary. Run "kontextmind index" and "kontextmind summarize" first.`,
    }],
  };
}

async function handleFindDependencies(path: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const files = loadAllFileSummaries();
  const file = files.find(f => f.filePath === path);

  if (file && file.dependencies) {
    return {
      content: [{ type: 'text', text: `Dependencies of ${path}:\n\n${file.dependencies.map((d: string) => `- ${d}`).join('\n')}` }],
    };
  }

  // Find files that depend on this path
  const dependents = files.filter(f =>
    f.dependencies?.some((d: string) => d.includes(path) || path.includes(d))
  );

  if (dependents.length > 0) {
    return {
      content: [{
        type: 'text',
        text: `Files that depend on ${path}:\n\n${dependents.map(f => `- ${f.filePath}`).join('\n')}`,
      }],
    };
  }

  return { content: [{ type: 'text', text: `No dependencies found for ${path}` }] };
}

async function handleFindCallers(name: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const files = loadAllFileSummaries();
  const callers: string[] = [];

  for (const file of files) {
    if (file.symbols?.some((s: any) => s.name === name)) {
      callers.push(file.filePath);
    }
  }

  if (callers.length > 0) {
    return {
      content: [{ type: 'text', text: `Functions that call "${name}":\n\n${callers.map(f => `- ${f}`).join('\n')}` }],
    };
  }

  return { content: [{ type: 'text', text: `No callers found for "${name}"` }] };
}

async function handleFindRelatedFiles(path: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const files = loadAllFileSummaries();
  const file = files.find(f => f.filePath === path);

  if (!file) {
    return { content: [{ type: 'text', text: `File ${path} not found in summaries` }] };
  }

  const related: string[] = [];

  // Find files with shared dependencies
  for (const dep of file.dependencies || []) {
    const shared = files.filter(f =>
      f.filePath !== path && f.dependencies?.includes(dep)
    );
    related.push(...shared.map(f => f.filePath));
  }

  // Find files that depend on this file
  const dependents = files.filter(f =>
    f.dependencies?.some((d: string) => d.includes(path) || path.includes(d))
  );
  related.push(...dependents.map(f => f.filePath));

  const uniqueRelated = [...new Set(related)].slice(0, 20);

  if (uniqueRelated.length > 0) {
    return {
      content: [{ type: 'text', text: `Files related to ${path}:\n\n${uniqueRelated.map(f => `- ${f}`).join('\n')}` }],
    };
  }

  return { content: [{ type: 'text', text: `No related files found for ${path}` }] };
}

async function handleFindBlockers(symbolId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const files = loadAllFileSummaries();
  const functions = loadAllFunctionSummaries();
  const blockers = loadAllBlockerSummaries();

  const results: string[] = [];

  // Find symbols blocked by this one
  for (const blocker of blockers) {
    if (blocker.sourceSymbol === symbolId || blocker.sourceSymbol.includes(symbolId)) {
      results.push(`BLOCKS: ${blocker.targetSymbol} - ${blocker.reason} (${blocker.severity})`);
    }
  }

  // Find symbols that block this one
  for (const blocker of blockers) {
    if (blocker.targetSymbol === symbolId || blocker.targetSymbol.includes(symbolId)) {
      results.push(`BLOCKED BY: ${blocker.sourceSymbol} - ${blocker.reason}`);
    }
  }

  // Check in function summaries
  const func = functions.find(f => f.symbolId === symbolId);
  if (func?.blockedBy && func.blockedBy.length > 0) {
    for (const b of func.blockedBy) {
      results.push(`BLOCKED BY: ${b.name} - ${b.reason}`);
    }
  }

  if (results.length > 0) {
    return {
      content: [{ type: 'text', text: `Blockers for ${symbolId}:\n\n${results.join('\n')}` }],
    };
  }

  return { content: [{ type: 'text', text: `No blockers found for ${symbolId}` }] };
}

async function handleAskReadonly(question: string, noCode?: boolean): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Search all summaries for relevant answers
  const files = loadAllFileSummaries();
  const functions = loadAllFunctionSummaries();
  const modules = loadAllModuleSummaries();
  const apis = loadAllAPISummaries();
  const decisions = loadAllDecisionSummaries();

  const q = question.toLowerCase();
  const relevant: string[] = [];

  for (const f of files) {
    if (f.purpose?.toLowerCase().includes(q) || f.filePath?.toLowerCase().includes(q)) {
      relevant.push(`FILE: ${f.filePath} - ${f.purpose}`);
    }
  }

  for (const fn of functions) {
    if (fn.summary?.toLowerCase().includes(q) || fn.symbolName?.toLowerCase().includes(q)) {
      relevant.push(`FUNCTION: ${fn.symbolName} - ${fn.summary}`);
    }
  }

  for (const m of modules) {
    if (m.summary?.toLowerCase().includes(q)) {
      relevant.push(`MODULE: ${m.directoryPath} - ${m.summary}`);
    }
  }

  for (const a of apis) {
    if (a.summary?.toLowerCase().includes(q) || a.endpoint?.toLowerCase().includes(q)) {
      relevant.push(`API: ${a.endpoint} - ${a.summary}`);
    }
  }

  for (const d of decisions) {
    if (d.summary?.toLowerCase().includes(q) || d.title?.toLowerCase().includes(q)) {
      relevant.push(`DECISION: ${d.title} - ${d.summary}`);
    }
  }

  if (relevant.length > 0) {
    return {
      content: [{
        type: 'text',
        text: `Based on project summaries:\n\n${relevant.slice(0, 10).join('\n\n')}\n\nFor full Q&A, run "kontextmind ask '${question}'"`,
      }],
    };
  }

  return {
    content: [{
      type: 'text',
      text: `Question: ${question}\n\nNo relevant summaries found. Run "kontextmind kb build" and "kontextmind ask" via CLI for full Q&A functionality.`,
    }],
  };
}

async function handleCreateHandoff(summary: string, nextSteps?: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const handoffPath = join(projectRoot, '.context', 'handoff.md');

  // Load existing handoff
  let existingContent = '';
  if (existsSync(handoffPath)) {
    existingContent = readFileSync(handoffPath, 'utf-8');
  }

  const content = existingContent + `\n\n---\n\n## Handoff (${new Date().toISOString()})\n\n### Summary\n${summary}\n\n### Next Steps\n${nextSteps || 'None specified'}\n`;

  try {
    mkdirSync(dirname(handoffPath), { recursive: true });
    writeFileSync(handoffPath, content, 'utf-8');
    return { content: [{ type: 'text', text: `Handoff created at ${handoffPath}` }] };
  } catch {
    return { content: [{ type: 'text', text: 'Failed to create handoff document' }] };
  }
}

async function handleRefreshSummary(paths?: string[]): Promise<{ content: Array<{ type: string; text: string }> }> {
  if (!paths || paths.length === 0) {
    return {
      content: [{ type: 'text', text: 'Run "kontextmind summarize --changed-only" to refresh all stale summaries.' }],
    };
  }

  return {
    content: [{ type: 'text', text: `Refresh summaries for ${paths.length} files. Run "kontextmind summarize --changed-only" to refresh.` }],
  };
}

async function handleRefreshAllSummaries(types?: string[]): Promise<{ content: Array<{ type: string; text: string }> }> {
  const allTypes = ['files', 'functions', 'modules', 'apis', 'decisions', 'blockers'];
  const toRefresh = types || allTypes;

  return {
    content: [{
      type: 'text',
      text: `Refresh summaries for: ${toRefresh.join(', ')}\n\nRun "kontextmind summarize" to regenerate all summaries.`,
    }],
  };
}

async function handleSecurityScan(includeSecrets?: boolean): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{ type: 'text', text: `Security scan${includeSecrets ? ' (including secrets)' : ''}. Run "kontextmind secrets scan" via CLI for full scan.` }],
  };
}

async function handleGetAllSummaries(type?: string, limit?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const maxResults = limit || 50;
  let text = '# All Project Summaries\n\n';

  if (!type || type === 'all' || type === 'files') {
    const files = loadAllFileSummaries();
    text += `## Files (${files.length})\n\n`;
    for (const f of files.slice(0, maxResults)) {
      text += `- **${f.filePath}**: ${f.purpose?.substring(0, 100) || 'no description'}`;
      if (f.blockedBy && f.blockedBy.length > 0) {
        text += ` [BLOCKED by ${f.blockedBy.length}]`;
      }
      text += '\n';
    }
    text += '\n';
  }

  if (!type || type === 'all' || type === 'functions') {
    const functions = loadAllFunctionSummaries();
    text += `## Functions (${functions.length})\n\n`;
    for (const f of functions.slice(0, maxResults)) {
      text += `- **${f.symbolName}** (${f.filePath}): ${f.summary?.substring(0, 80) || 'no description'}\n`;
    }
    text += '\n';
  }

  if (!type || type === 'all' || type === 'modules') {
    const modules = loadAllModuleSummaries();
    text += `## Modules (${modules.length})\n\n`;
    for (const m of modules.slice(0, maxResults)) {
      text += `- **${m.directoryPath}**: ${m.summary?.substring(0, 100) || 'no description'}\n`;
    }
    text += '\n';
  }

  if (!type || type === 'all' || type === 'apis') {
    const apis = loadAllAPISummaries();
    text += `## APIs (${apis.length})\n\n`;
    for (const a of apis.slice(0, maxResults)) {
      text += `- **${a.method || 'GET'} ${a.endpoint}**: ${a.summary?.substring(0, 80) || 'no description'}\n`;
    }
    text += '\n';
  }

  if (!type || type === 'all' || type === 'decisions') {
    const decisions = loadAllDecisionSummaries();
    text += `## Decisions (${decisions.length})\n\n`;
    for (const d of decisions.slice(0, maxResults)) {
      text += `- **${d.title}**: ${d.summary?.substring(0, 80) || 'no description'}\n`;
    }
    text += '\n';
  }

  if (!type || type === 'all' || type === 'blockers') {
    const blockers = loadAllBlockerSummaries();
    text += `## Blockers (${blockers.length})\n\n`;
    for (const b of blockers.slice(0, maxResults)) {
      text += `- **${b.sourceSymbol}** → **${b.targetSymbol}**: ${b.reason} (${b.severity})\n`;
    }
  }

  return { content: [{ type: 'text', text: text.substring(0, 10000) }] };
}

// Task & Session Summary Handlers

async function handleGetRecentTasks(limit?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tasksDir = join(projectRoot, '.kontextmind', 'tasks');

  if (!existsSync(tasksDir)) {
    return { content: [{ type: 'text', text: 'No tasks directory found. Task summaries will be created here when agents write them.' }] };
  }

  try {
    const files = readdirSync(tasksDir).filter(f => f.endsWith('.md')).sort().reverse();
    const maxResults = limit || 5;
    const results: string[] = [];

    for (const file of files.slice(0, maxResults)) {
      const filePath = join(tasksDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        // Extract key info from task summary
        const titleMatch = content.match(/\*\*Title:\*\*\s*(.+)/i) || content.match(/^#\s+Task\s+Summary.*?\n.*?\n.*?\*\*Title:\*\*\s*(.+)/mi);
        const goalMatch = content.match(/\*\*Status:\*\*\s*(\w+)/i);
        const dateMatch = content.match(/\*\*Started:\*\*\s*(.+)/i) || content.match(/(\d{4}-\d{2}-\d{2})/);

        const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
        const status = goalMatch ? goalMatch[1] : 'unknown';
        const date = dateMatch ? dateMatch[1] : '';

        results.push(`## ${title}\n**Status:** ${status}${date ? ` | **Date:** ${date}` : ''}\n`);
        results.push(content.substring(0, 500) + (content.length > 500 ? '\n...' : ''));
        results.push('');
      } catch { /* skip */ }
    }

    if (results.length === 0) {
      return { content: [{ type: 'text', text: 'No task summaries found. Write task summaries using project.write_task_summary.' }] };
    }

    return { content: [{ type: 'text', text: results.join('\n').substring(0, 8000) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error reading tasks: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

async function handleGetLastSession(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const sessionsDir = join(projectRoot, '.kontextmind', 'sessions');

  if (!existsSync(sessionsDir)) {
    return { content: [{ type: 'text', text: 'No sessions directory found. Session summaries will be created here when agents end sessions.' }] };
  }

  try {
    const files = readdirSync(sessionsDir).filter(f => f.endsWith('.md')).sort().reverse();

    if (files.length === 0) {
      return { content: [{ type: 'text', text: 'No session summaries found. Write session summaries using project.write_session_summary.' }] };
    }

    // Get most recent session
    const latestSession = files[0];
    const sessionPath = join(sessionsDir, latestSession);
    const content = readFileSync(sessionPath, 'utf-8');

    return { content: [{ type: 'text', text: `# Last Session: ${latestSession}\n\n${content}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error reading session: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

async function handleResumeTask(taskId?: string, keywords?: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tasksDir = join(projectRoot, '.kontextmind', 'tasks');

  if (!existsSync(tasksDir)) {
    return { content: [{ type: 'text', text: 'No tasks directory found.' }] };
  }

  try {
    const files = readdirSync(tasksDir).filter(f => f.endsWith('.md'));

    // Search by task ID first
    if (taskId) {
      const taskFile = files.find(f => f.includes(taskId));
      if (taskFile) {
        const content = readFileSync(join(tasksDir, taskFile), 'utf-8');
        return { content: [{ type: 'text', text: `# Task: ${taskFile}\n\n${content}` }] };
      }
    }

    // Search by keywords
    if (keywords) {
      const keywordLower = keywords.toLowerCase();
      for (const file of files.reverse()) {
        const content = readFileSync(join(tasksDir, file), 'utf-8');
        if (content.toLowerCase().includes(keywordLower)) {
          return { content: [{ type: 'text', text: `# Task: ${file}\n\n${content}` }] };
        }
      }
    }

    return { content: [{ type: 'text', text: `Task not found${taskId ? ` (ID: ${taskId})` : ''}${keywords ? ` (keywords: ${keywords})` : ''}. Try project.get_recent_tasks to see available tasks.` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error resuming task: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

async function handleWriteTaskSummary(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tasksDir = join(projectRoot, '.kontextmind', 'tasks');

  if (!existsSync(tasksDir)) {
    try {
      mkdirSync(tasksDir, { recursive: true });
    } catch { /* ignore */ }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const taskId = `task_${timestamp}`;
  const title = args.title as string || 'Untitled Task';
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
  const filename = `${timestamp.split('T')[0]}_task_${safeTitle}.md`;

  const content = `# Task Summary

**Task ID:** ${taskId}
**Title:** ${title}
**Status:** ${(args.status as string) || 'in_progress'}
**Started:** ${timestamp}
**Agent:** Claude Code

## Goal
${args.goal || 'No goal specified'}

## Progress
${args.progress || 'Work in progress...'}

## Files Touched
${(args.filesTouched as string[] || []).map(f => `- ${f}`).join('\n') || '_None yet_'}

## Decisions Made
${(args.decisions as string[] || []).map(d => `1. ${d}`).join('\n') || '_None yet_'}

## Pending
${args.pending || 'To be determined'}

## Next Steps
${args.nextSteps || 'Continue working on this task'}

---

_Last updated: ${timestamp}_
`;

  const filePath = join(tasksDir, filename);
  try {
    writeFileSync(filePath, content, 'utf-8');
    return { content: [{ type: 'text', text: `Task summary created: ${filename}\n\nPath: ${filePath}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Failed to write task summary: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

async function handleWriteSessionSummary(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const sessionsDir = join(projectRoot, '.kontextmind', 'sessions');

  if (!existsSync(sessionsDir)) {
    try {
      mkdirSync(sessionsDir, { recursive: true });
    } catch { /* ignore */ }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dateStr = timestamp.split('T')[0];
  const timeStr = timestamp.split('T')[1].slice(0, 8).replace(/:/g, '');
  const filename = `${dateStr}_${timeStr}_session.md`;

  const content = `# Session Summary

**Session ID:** session_${timestamp}
**Started:** ${timestamp}
**Ended:** ${timestamp}
**Agent:** Claude Code

## Goals
${args.goals || 'No goals specified'}

## Tasks Completed
${(args.tasksCompleted as string[] || []).map(t => `- ${t}`).join('\n') || '_None_'}

## Files Modified
${(args.filesModified as string[] || []).map(f => `- ${f}`).join('\n') || '_None_'}

## Decisions Made
${(args.decisions as string[] || []).map(d => `1. ${d}`).join('\n') || '_None_'}

## Pending
${args.pending || 'None'}

## Handoff
${args.handoff || 'Continue with pending tasks in next session'}

---

_Last updated: ${timestamp}_
`;

  const filePath = join(sessionsDir, filename);
  try {
    writeFileSync(filePath, content, 'utf-8');
    return { content: [{ type: 'text', text: `Session summary created: ${filename}\n\nPath: ${filePath}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Failed to write session summary: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

// ====== PHASE 1: Session Index Handlers ======

async function handleGetSessionIndex(
  days: number = 30,
  limit: number = 20,
  topic?: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();

  let sessions: SessionIndexEntry[];
  if (topic) {
    sessions = getSessionsByTopic(projectRoot, topic, limit);
  } else {
    sessions = getRecentSessions(projectRoot, days, limit);
  }

  if (sessions.length === 0) {
    return { content: [{ type: 'text', text: 'No sessions found in this period.' }] };
  }

  let output = `## Session Index (Last ${days} Days)\n\n`;
  output += `Total: ${sessions.length} sessions\n\n`;

  for (const session of sessions) {
    const duration = session.durationMs
      ? `${Math.round(session.durationMs / 60000)}min`
      : 'unknown';
    const topics = session.topics.slice(0, 3).join(', ') || 'general';
    const entities = session.keyEntities.slice(0, 3).map((e: { name: string }) => e.name).join(', ') || 'none';

    output += `### Session ${session.sessionId}\n`;
    output += `**Date:** ${session.date}\n`;
    output += `**Duration:** ${duration}\n`;
    output += `**Topics:** ${topics}\n`;
    output += `**Key Entities:** ${entities}\n`;
    output += `**Messages:** ${session.messageCount}\n`;
    if (session.summary) {
      output += `**Summary:** ${session.summary}\n`;
    }
    if (session.pendingWork) {
      output += `**Pending:** ${session.pendingWork}\n`;
    }
    output += '\n---\n\n';
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleGetSessionStats(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const stats = getSessionIndexStats(projectRoot);

  const avgDurationMin = Math.round(stats.averageSessionDuration / 60000);
  const totalDurationHours = Math.round(stats.totalDurationMs / 3600000 * 10) / 10;

  let output = `## Session Statistics\n\n`;
  output += `**Total Sessions:** ${stats.totalSessions}\n`;
  output += `**Total Messages:** ${stats.totalMessages}\n`;
  output += `**Average Session Duration:** ${avgDurationMin} minutes\n`;
  output += `**Total Active Time:** ${totalDurationHours} hours\n`;
  output += `**Sessions Last Week:** ${stats.sessionsLastWeek}\n`;
  output += `**Sessions Last Month:** ${stats.sessionsLastMonth}\n\n`;

  if (stats.mostActiveTopics.length > 0) {
    output += `### Most Active Topics\n`;
    for (const { topic, count } of stats.mostActiveTopics.slice(0, 5)) {
      output += `- ${topic}: ${count} sessions\n`;
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleSearchSessions(
  query: string,
  limit: number = 10
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const results = searchSessions(projectRoot, query, limit);

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No sessions found matching "${query}"` }] };
  }

  let output = `## Search Results for "${query}"\n\n`;

  for (const session of results) {
    output += `### Session ${session.sessionId} (${session.date})\n`;
    output += `**Topics:** ${session.topics.join(', ')}\n`;
    output += `**Messages:** ${session.messageCount}\n`;
    if (session.summary) {
      output += `**Summary:** ${session.summary}\n`;
    }
    output += '\n---\n\n';
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleGetRecentFiles(
  days: number = 7,
  limit: number = 20
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const sessions = getRecentSessions(projectRoot, days, 100);

  // Aggregate all files across sessions
  const fileCounts: Record<string, number> = {};
  const fileSessions: Record<string, string[]> = {};

  for (const session of sessions) {
    for (const file of session.filesModified || []) {
      fileCounts[file] = (fileCounts[file] || 0) + 1;
      if (!fileSessions[file]) fileSessions[file] = [];
      fileSessions[file].push(session.sessionId);
    }
  }

  // Sort by count
  const sortedFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (sortedFiles.length === 0) {
    return { content: [{ type: 'text', text: 'No files found in recent sessions.' }] };
  }

  let output = `## Recently Modified Files (Last ${days} Days)\n\n`;
  output += `Total unique files: ${sortedFiles.length}\n\n`;

  for (const [file, count] of sortedFiles) {
    output += `- ${file} (${count} sessions)\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

// ====== PHASE 5: Timeline Handlers ======

async function handleGetTimeline(
  hours: number = 72,
  format: 'summary' | 'detailed' = 'summary'
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const entries = buildTimeline(projectRoot, hours);

  if (entries.length === 0) {
    return { content: [{ type: 'text', text: `No activity in the last ${hours} hours.` }] };
  }

  let output = `## Activity Timeline (Last ${hours} Hours)\n\n`;

  if (format === 'summary') {
    // Group by day
    const byDay: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const day = entry.timestamp.split('T')[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(entry);
    }

    for (const [day, dayEntries] of Object.entries(byDay)) {
      output += `### ${day}\n`;
      for (const entry of dayEntries) {
        const time = entry.timestamp.split('T')[1].slice(0, 5);
        output += `- [${time}] ${entry.type}: ${entry.title}\n`;
      }
      output += '\n';
    }
  } else {
    // Detailed format
    for (const entry of entries) {
      const time = entry.timestamp.replace('T', ' ').slice(0, 19);
      output += `### ${entry.type} - ${time}\n`;
      output += `**Title:** ${entry.title}\n`;
      output += `**Summary:** ${entry.summary}\n`;
      if (entry.relatedTaskId) output += `**Task:** ${entry.relatedTaskId}\n`;
      if (entry.relatedSessionId) output += `**Session:** ${entry.relatedSessionId}\n`;
      output += '\n---\n\n';
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleGetRecentActivity(days: number = 3): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const report = getRecentActivity(projectRoot, days);

  let output = `## Recent Activity (Last ${days} Days)\n\n`;

  output += `### Summary\n`;
  output += `- Sessions: ${report.sessions.count}\n`;
  output += `- Tasks created: ${report.tasks.count}\n`;
  output += `- Files modified: ${report.filesModified}\n`;
  output += `- Total messages: ${report.totalMessages}\n\n`;

  if (report.topTopics.length > 0) {
    output += `### Active Topics\n`;
    for (const topic of report.topTopics.slice(0, 5)) {
      output += `- ${topic}\n`;
    }
    output += '\n';
  }

  if (report.incompleteTasks.length > 0) {
    output += `### Pending Tasks\n`;
    for (const task of report.incompleteTasks.slice(0, 5)) {
      output += `- ${task}\n`;
    }
    output += '\n';
  }

  if (report.recentSessions.length > 0) {
    output += `### Recent Sessions\n`;
    for (const session of report.recentSessions.slice(0, 3)) {
      output += `- ${session.date}: ${session.topics.join(', ') || 'general'}\n`;
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

// ====== PHASE 2-3: Task Management Handlers ======

async function handleGetCurrentTask(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const task = getCurrentTask(projectRoot);

  if (!task) {
    return { content: [{ type: 'text', text: 'No active task found. Start working on something to create a task.' }] };
  }

  let output = `## Current Task\n\n`;
  output += `**ID:** ${task.id}\n`;
  output += `**Title:** ${task.title}\n`;
  output += `**Goal:** ${task.goal}\n`;
  output += `**Status:** ${task.status}\n`;
  output += `**Started:** ${task.startDate}\n`;
  output += `**Sessions:** ${task.sessionIds.length}\n`;

  if (task.pending) {
    output += `\n### Pending Work\n${task.pending}\n`;
  }

  if (task.nextSteps.length > 0) {
    output += `\n### Next Steps\n`;
    for (const step of task.nextSteps) {
      output += `- ${step}\n`;
    }
  }

  if (task.filesTouched.length > 0) {
    output += `\n### Files Modified\n${task.filesTouched.slice(0, 10).join('\n')}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleGetTaskSessions(taskId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const sessionIds = getTaskSessionList(projectRoot, taskId);

  if (sessionIds.length === 0) {
    return { content: [{ type: 'text', text: `No sessions found for task ${taskId}` }] };
  }

  const index = loadSessionIndex(projectRoot);
  const sessions = index.sessions.filter((s: { sessionId: string }) => sessionIds.includes(s.sessionId));

  let output = `## Sessions for Task ${taskId}\n\n`;
  output += `Total: ${sessions.length} sessions\n\n`;

  for (const session of sessions.sort((a: { startTime: string }, b: { startTime: string }) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())) {
    output += `### Session ${session.sessionId} (${session.date})\n`;
    output += `**Topics:** ${session.topics.join(', ')}\n`;
    output += `**Messages:** ${session.messageCount}\n`;
    output += `**Duration:** ${session.durationMs ? Math.round(session.durationMs / 60000) + 'min' : 'unknown'}\n\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleGetSessionTask(sessionId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const task = getSessionTask(projectRoot, sessionId);

  if (!task) {
    return { content: [{ type: 'text', text: `No task found for session ${sessionId}` }] };
  }

  let output = `## Task for Session ${sessionId}\n\n`;
  output += `**ID:** ${task.id}\n`;
  output += `**Title:** ${task.title}\n`;
  output += `**Status:** ${task.status}\n`;

  if (task.pending) {
    output += `\n**Pending:** ${task.pending}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

// ====== PHASE 4: Cross-Session Search Handlers ======

async function handleSearchMemory(
  query: string,
  types?: ('task' | 'session' | 'handoff')[],
  days: number = 30,
  limit: number = 10
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const results = searchMemory(projectRoot, query, { types, days, limit });

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No results found for "${query}"` }] };
  }

  let output = `## Search Results for "${query}"\n\n`;
  output += `Found ${results.length} results\n\n`;

  for (const result of results) {
    output += `### [${result.type}] ${result.title}\n`;
    output += `**Date:** ${result.date}\n`;
    output += `**Match:** ${result.matchedOn.join(', ')}\n`;
    output += `**Snippet:** ${result.snippet}\n\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleSearchEntities(
  entity: string,
  type?: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const results = searchEntities(projectRoot, entity, type as any);

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No sessions found mentioning "${entity}"` }] };
  }

  let output = `## Entity Search: ${entity}\n\n`;
  output += `Found in ${results.length} sessions\n\n`;

  for (const result of results.slice(0, 10)) {
    output += `- ${result.snippet}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleFindRelatedSessions(
  sessionId: string,
  limit: number = 5
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const results = findRelatedSessions(projectRoot, sessionId, limit);

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No related sessions found for ${sessionId}` }] };
  }

  let output = `## Related Sessions\n\n`;

  for (const result of results) {
    output += `### Session ${result.id}\n`;
    output += `**Date:** ${result.date}\n`;
    output += `**Relevance:** ${result.relevanceScore?.toFixed(2)}\n`;
    output += `**Topics:** ${result.topics.join(', ')}\n\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

// ====== PHASE 6: Task Dependency Handlers ======

async function handleAddTaskDependency(
  taskId: string,
  dependsOn: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const { addTaskDependency } = await import('@kontextmind/core');
  const success = addTaskDependency(projectRoot, taskId, dependsOn);

  if (success) {
    return { content: [{ type: 'text', text: `Added dependency: ${taskId} depends on ${dependsOn}` }] };
  } else {
    return { content: [{ type: 'text', text: `Failed to add dependency. Task ${taskId} not found.` }] };
  }
}

async function handleGetTaskDependencies(taskId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const deps = getTaskDependencies(projectRoot, taskId);

  let output = `## Dependencies for ${taskId}\n\n`;

  if (deps.dependsOn.length > 0) {
    output += `### Depends On\n`;
    for (const dep of deps.dependsOn) {
      output += `- ${dep.title} (${dep.status})\n`;
    }
    output += '\n';
  }

  if (deps.blockedBy.length > 0) {
    output += `### Blocked By (incomplete)\n`;
    for (const dep of deps.blockedBy) {
      output += `- ${dep.title} (${dep.status})\n`;
    }
    output += '\n';
  }

  if (deps.dependsOn.length === 0 && deps.blockedBy.length === 0) {
    output += 'No dependencies.\n';
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleGetBlockedTasks(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tasks = getBlockedTasksList(projectRoot);

  if (tasks.length === 0) {
    return { content: [{ type: 'text', text: 'No blocked tasks found. All tasks are ready to proceed.' }] };
  }

  let output = `## Blocked Tasks\n\n`;
  output += `Total: ${tasks.length} tasks are blocked\n\n`;

  for (const task of tasks) {
    output += `### ${task.title}\n`;
    output += `**ID:** ${task.id}\n`;
    output += `**Waiting on:** ${task.dependsOn.join(', ')}\n\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

// ====== PHASE 7: Continuity Suggestion Handlers ======

async function handleGetContinuitySuggestions(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const suggestions = getContinuitySuggestions(projectRoot);

  if (suggestions.length === 0) {
    return { content: [{ type: 'text', text: 'No continuity suggestions. All work appears to be up to date.' }] };
  }

  let output = `## Continuity Suggestions\n\n`;

  for (const suggestion of suggestions) {
    const priorityIcon = suggestion.priority === 'high' ? '[HIGH]' : suggestion.priority === 'medium' ? '[MED]' : '[LOW]';
    output += `### ${priorityIcon} ${suggestion.title}\n`;
    output += `**Type:** ${suggestion.type}\n`;
    output += `**Reason:** ${suggestion.reason}\n`;
    output += `**Action:** ${suggestion.action}\n`;
    if (suggestion.relatedIds.taskId) output += `**Task ID:** ${suggestion.relatedIds.taskId}\n`;
    output += `\n${suggestion.description}\n\n`;
    output += `---\n\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleAnalyzeContinuity(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const analysis = analyzeContinuityNeed(projectRoot);

  let output = `## Continuity Analysis\n\n`;
  output += `${analysis.summary}\n\n`;

  if (analysis.currentTask) {
    output += `### Current Task\n`;
    output += `**${analysis.currentTask.title}**\n`;
    if (analysis.currentTask.pending) {
      output += `Pending: ${analysis.currentTask.pending}\n`;
    }
    output += '\n';
  }

  if (analysis.suggestion) {
    output += `### Suggested Action\n`;
    output += `**${analysis.suggestion.title}**\n`;
    output += `${analysis.suggestion.description}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleGetTaskResumptionContext(taskId: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const context = getTaskResumptionContext(projectRoot, taskId);

  if (!context) {
    return { content: [{ type: 'text', text: `Task ${taskId} not found` }] };
  }

  return { content: [{ type: 'text', text: context.summary }] };
}

async function handleShouldContinue(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const result = shouldContinueFromLastSession(projectRoot);

  let output = `## Continue from Last Session?\n\n`;
  output += `**Should Continue:** ${result.shouldContinue ? 'Yes' : 'No'}\n`;
  output += `**Reason:** ${result.reason}\n`;

  if (result.suggestion) {
    output += `\n### Suggestion\n${result.suggestion}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

// ============ LEARNING & ADAPTATION HANDLERS ============

async function handleLearnSync(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const bridge = getLearningBridge(projectRoot);

  const result = await bridge.syncNow();

  let output = `## Learning Sync Results\n\n`;
  output += `**Sync Type:** ${result.syncType}\n`;
  output += `**Timestamp:** ${result.timestamp}\n`;
  output += `**Summaries Processed:** ${result.summariesProcessed}\n`;
  output += `**Q&A Events Processed:** ${result.qnaEventsProcessed}\n`;
  output += `**Memories Created:** ${result.memoriesCreated}\n`;

  if (result.errors.length > 0) {
    output += `\n### Errors\n${result.errors.join('\n')}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleLearnImport(sourceProject: string, dataTypes?: string[]): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const bridge = getLearningBridge(projectRoot);

  const options: { sourceProject: string; dataTypes?: ('summaries' | 'decisions')[] } = {
    sourceProject,
    dataTypes: dataTypes as ('summaries' | 'decisions')[] | undefined,
  };

  const result = await bridge.importFrom(options);

  let output = `## Import Results\n\n`;
  output += `**Success:** ${result.success ? 'Yes' : 'No'}\n`;
  output += `**Source Project:** ${result.sourceProject}\n`;
  output += `**Items Imported:** ${result.itemsImported}\n`;
  output += `**Imported Types:** ${result.importedTypes.join(', ') || 'none'}\n`;

  if (result.errors.length > 0) {
    output += `\n### Errors\n${result.errors.join('\n')}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleLearnStats(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tracker = getOutcomeTracker(projectRoot);
  const bridge = getLearningBridge(projectRoot);

  const stats = tracker.getStats();
  const brainStatus = bridge.getStatus();

  let output = `## Learning Statistics\n\n`;
  output += `**Total Outcomes:** ${stats.totalOutcomes}\n`;
  output += `**Overall Success Rate:** ${(stats.successRate * 100).toFixed(1)}%\n`;
  output += `**Average Confidence:** ${(stats.averageConfidence * 100).toFixed(1)}%\n`;
  output += `**Patterns Learned:** ${stats.patternsLearned}\n`;
  output += `**Improvements Suggested:** ${stats.improvementsSuggested}\n`;

  output += `\n### By Action Type\n`;
  for (const [type, data] of Object.entries(stats.byActionType)) {
    output += `- ${type}: ${data.count} actions, ${(data.successRate * 100).toFixed(1)}% success rate\n`;
  }

  output += `\n### Brain Status\n`;
  output += `**Last Sync:** ${brainStatus.lastSync || 'never'}\n`;
  output += `**Sync Mode:** ${brainStatus.syncMode}\n`;
  output += `**Imported Projects:** ${brainStatus.importedProjects.join(', ') || 'none'}\n`;

  return { content: [{ type: 'text', text: output }] };
}

async function handleLearnPatterns(taskType: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tracker = getOutcomeTracker(projectRoot);

  const successPatterns = tracker.getSuccessPatterns(taskType);
  const failurePatterns = tracker.getFailurePatterns(taskType);
  const patterns = tracker.getPatterns(taskType);

  let output = `## Learning Patterns for ${taskType}\n\n`;

  output += `### Success Patterns (${successPatterns.length})\n`;
  if (successPatterns.length > 0) {
    for (const pattern of successPatterns.slice(0, 10)) {
      output += `- ${pattern}\n`;
    }
  } else {
    output += `No success patterns recorded yet.\n`;
  }

  output += `\n### Failure Patterns to Avoid (${failurePatterns.length})\n`;
  if (failurePatterns.length > 0) {
    for (const pattern of failurePatterns.slice(0, 10)) {
      output += `- ${pattern}\n`;
    }
  } else {
    output += `No failure patterns recorded yet.\n`;
  }

  output += `\n### All Patterns\n`;
  if (patterns.length > 0) {
    for (const p of patterns.slice(0, 10)) {
      output += `- ${p.pattern}: ${(p.successRate * 100).toFixed(1)}% success (seen ${p.frequency}x)\n`;
    }
  } else {
    output += `No patterns recorded yet.\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleLearnSuggestions(category?: string, limit?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tracker = getOutcomeTracker(projectRoot);

  const improvements = tracker.getSuggestions({
    category: category as 'skill' | 'pattern' | 'approach' | 'documentation' | undefined,
    limit: limit || 10,
  });

  let output = `## Improvement Suggestions\n\n`;

  if (improvements.length === 0) {
    output += `No improvement suggestions available yet. More data needed.\n`;
  } else {
    for (const imp of improvements) {
      output += `### ${imp.category.toUpperCase()}: ${(imp.confidence * 100).toFixed(0)}% confidence\n`;
      output += `${imp.description}\n`;
      output += `**Suggested for:** ${imp.suggestedFor.join(', ')}\n\n`;
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleLearnExport(taskType?: string, minConfidence?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const tracker = getOutcomeTracker(projectRoot);

  const outcomes = tracker.exportForTraining({
    taskType,
    minConfidence,
  });

  let output = `## Learning Export\n\n`;
  output += `**Total Exported:** ${outcomes.length}\n`;
  output += `**Filter Task Type:** ${taskType || 'all'}\n`;
  output += `**Min Confidence:** ${minConfidence !== undefined ? minConfidence : 'none'}\n\n`;

  if (outcomes.length > 0) {
    output += `### Sample Outcomes (first 5)\n`;
    for (const o of outcomes.slice(0, 5)) {
      output += `- [${o.success ? 'SUCCESS' : 'FAILURE'}] ${o.actionType}: ${o.actionDescription.slice(0, 50)}...\n`;
    }
  }

  return { content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(outcomes, null, 2)}\n\`\`\`\n\n${output}` }] };
}

// ============ AGENT AWARENESS HANDLERS ============

async function handleAgentState(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const awareness = getSelfAwareness(projectRoot);
  const state = awareness.getState();

  let output = `## Agent State\n\n`;
  output += `**Mode:** ${state.mode}\n`;
  output += `**Energy Level:** ${(state.energyLevel * 100).toFixed(0)}%\n`;
  output += `**Session Start:** ${state.sessionStartTime}\n`;
  output += `**Total Actions This Session:** ${state.totalActionsThisSession}\n`;

  if (state.currentTask) {
    output += `\n### Current Task\n`;
    output += `**ID:** ${state.currentTask.id}\n`;
    output += `**Type:** ${state.currentTask.type}\n`;
    output += `**Description:** ${state.currentTask.description}\n`;
    output += `**Progress:** ${(state.currentTask.progress * 100).toFixed(0)}%\n`;
    output += `**Complexity:** ${state.currentTask.complexity}\n`;
  }

  if (state.activeGoals.length > 0) {
    output += `\n### Active Goals (${state.activeGoals.length})\n`;
    for (const goal of state.activeGoals) {
      output += `- [P${goal.priority}] ${goal.description}\n`;
    }
  }

  if (state.blockedBy.length > 0) {
    output += `\n### Blockers (${state.blockedBy.length})\n`;
    for (const blocker of state.blockedBy) {
      output += `- [${blocker.type}] ${blocker.description}\n`;
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleAgentCapabilities(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const awareness = getSelfAwareness(projectRoot);
  const capabilities = awareness.getCapabilities();

  let output = `## Agent Capabilities\n\n`;
  output += `**Average Confidence:** ${(capabilities.averageConfidence * 100).toFixed(1)}%\n`;
  output += `**Total Actions:** ${capabilities.totalActions}\n`;
  output += `**Total Sessions:** ${capabilities.totalSessions}\n`;

  output += `\n### Strengths\n`;
  if (capabilities.strengths.length > 0) {
    for (const s of capabilities.strengths) {
      output += `- ${s}\n`;
    }
  } else {
    output += `No strengths recorded yet.\n`;
  }

  output += `\n### Weak Areas\n`;
  if (capabilities.weakAreas.length > 0) {
    for (const w of capabilities.weakAreas) {
      output += `- ${w}\n`;
    }
  } else {
    output += `No weak areas recorded yet.\n`;
  }

  output += `\n### Recent Improvements\n`;
  if (capabilities.recentImprovements.length > 0) {
    for (const i of capabilities.recentImprovements.slice(-5)) {
      output += `- ${i}\n`;
    }
  } else {
    output += `No recent improvements recorded.\n`;
  }

  output += `\n### Success Rates by Action Type\n`;
  for (const [type, rate] of Object.entries(capabilities.successRates)) {
    output += `- ${type}: ${(rate * 100).toFixed(1)}%\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleAgentAntiPatterns(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const awareness = getSelfAwareness(projectRoot);
  const antiPatterns = awareness.getAntiPatterns();

  let output = `## Anti-Patterns (Patterns to Avoid)\n\n`;

  if (antiPatterns.length === 0) {
    output += `No anti-patterns recorded yet.\n`;
  } else {
    for (const ap of antiPatterns) {
      output += `### ${ap.pattern}\n`;
      output += `${ap.description}\n`;
      output += `**Frequency:** ${ap.frequency} times\n`;
      output += `**Last Occurrence:** ${ap.lastOccurrence}\n`;
      output += `**Times Avoided:** ${ap.avoidedCount}\n\n`;
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleAgentAssess(taskDescription?: string, recentErrors?: string[], timeSpent?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const awareness = getSelfAwareness(projectRoot);

  const assessment = awareness.assessSelf({ taskDescription, recentErrors, timeSpent });

  let output = `## Self-Assessment\n\n`;
  output += `**Confidence:** ${(assessment.confidence * 100).toFixed(0)}%\n`;
  output += `**Quality:** ${(assessment.quality * 100).toFixed(0)}%\n`;
  output += `**Risk Level:** ${assessment.riskLevel.toUpperCase()}\n`;

  if (assessment.potentialIssues.length > 0) {
    output += `\n### Potential Issues\n`;
    for (const issue of assessment.potentialIssues) {
      output += `- ${issue}\n`;
    }
  }

  if (assessment.suggestedApproaches.length > 0) {
    output += `\n### Suggested Approaches\n`;
    for (const approach of assessment.suggestedApproaches) {
      output += `- ${approach}\n`;
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

// ============ TASK DETECTION HANDLERS ============

async function handleTaskDetect(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const awareness = getSelfAwareness(projectRoot);
  const state = awareness.getState();

  let output = `## Task Detection\n\n`;

  if (state.currentTask) {
    output += `**Current Task Detected:**\n`;
    output += `- ID: ${state.currentTask.id}\n`;
    output += `- Type: ${state.currentTask.type}\n`;
    output += `- Description: ${state.currentTask.description}\n`;
    output += `- Progress: ${(state.currentTask.progress * 100).toFixed(0)}%\n`;
    output += `- Complexity: ${state.currentTask.complexity}\n`;
    output += `- Success Probability: ${(state.currentTask.successProbability * 100).toFixed(0)}%\n`;
  } else {
    output += `No active task detected.\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleTaskComplete(taskId?: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const awareness = getSelfAwareness(projectRoot);
  const state = awareness.getState();

  if (state.currentTask && (!taskId || state.currentTask.id === taskId)) {
    awareness.completeAction(state.currentTask.id, { success: true });
    return { content: [{ type: 'text', text: `Task ${state.currentTask.id} marked as completed.` }] };
  }

  return { content: [{ type: 'text', text: `Task ${taskId || 'current'} not found or does not match current task.` }] };
}

async function handleTaskUpdatePending(taskId: string, pendingWork: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const awareness = getSelfAwareness(projectRoot);
  const state = awareness.getState();

  if (state.currentTask && state.currentTask.id === taskId) {
    state.currentTask.description = `${state.currentTask.description}\n\nPending: ${pendingWork}`;
    awareness.setCurrentTask(state.currentTask);
    return { content: [{ type: 'text', text: `Updated pending work for task ${taskId}.` }] };
  }

  return { content: [{ type: 'text', text: `Task ${taskId} not found or does not match current task.` }] };
}

// ============ ANALYTICS HANDLERS ============

async function handleAskStats(period?: 'daily' | 'weekly'): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const report = await getAnalyticsReport(projectRoot, period || 'daily');

  let output = `## Q&A Statistics (${report.period})\n\n`;
  output += `**Period:** ${report.startDate} to ${report.endDate}\n`;
  output += `**Total Questions:** ${report.summary.totalQuestions}\n`;
  output += `**Cache Hits:** ${report.summary.totalCacheHits}\n`;
  output += `**Hit Rate:** ${(report.summary.overallHitRate * 100).toFixed(1)}%\n`;
  output += `**Average Confidence:** ${(report.summary.averageConfidence * 100).toFixed(1)}%\n`;
  output += `**Avg Response Time:** ${report.summary.averageResponseTimeMs.toFixed(0)}ms\n`;

  output += `\n### Tier Distribution\n`;
  for (const [tier, count] of Object.entries(report.tierBreakdown)) {
    output += `- Tier ${tier}: ${count}\n`;
  }

  output += `\n### Top Questions\n`;
  for (const q of report.topQuestions.slice(0, 5)) {
    output += `- [${q.count}x] ${q.question.slice(0, 60)}...\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleAskTopQuestions(limit?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const questions = await getTopQuestions(projectRoot, limit || 10);

  let output = `## Top Asked Questions\n\n`;

  if (questions.length === 0) {
    output += `No questions recorded yet.\n`;
  } else {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      output += `${i + 1}. **Asked ${q.count} times** (avg confidence: ${(q.averageConfidence * 100).toFixed(0)}%)\n`;
      output += `   ${q.question}\n\n`;
    }
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleAskQuality(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const coverage = getCacheCoverage(projectRoot);

  let output = `## Answer Quality & Cache Coverage\n\n`;
  output += `**Total Questions:** ${coverage.totalQuestions}\n`;
  output += `**Cached Questions:** ${coverage.cachedQuestions}\n`;
  output += `**Coverage:** ${coverage.coveragePercent.toFixed(1)}%\n`;

  output += `\n### Tier Coverage\n`;
  for (const [tier, count] of Object.entries(coverage.tierCoverage)) {
    output += `- Tier ${tier}: ${count}\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

// ============ QUALITY HANDLERS ============

async function handleQualityTrends(days?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const trends = getQualityTrends(projectRoot, days || 7);

  let output = `## Quality Trends (${days || 7} days)\n\n`;
  output += `**Current Period:**\n`;
  output += `  - Total Requests: ${trends.current.totalRequests}\n`;
  output += `  - Average Confidence: ${(trends.current.averageConfidence * 100).toFixed(1)}%\n`;
  output += `  - Average Response Time: ${trends.current.averageResponseTime.toFixed(0)}ms\n`;
  output += `\n**Previous Period:**\n`;
  output += `  - Total Requests: ${trends.previous.totalRequests}\n`;
  output += `  - Average Confidence: ${(trends.previous.averageConfidence * 100).toFixed(1)}%\n`;
  output += `\n**Trends:**\n`;
  for (const [key, value] of Object.entries(trends.trends)) {
    output += `  - ${key}: ${value >= 0 ? '+' : ''}${value.toFixed(1)}%\n`;
  }

  return { content: [{ type: 'text', text: output }] };
}

async function handleQualityReport(period?: 'daily' | 'weekly'): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const report = generateQualityReport(projectRoot);

  // generateQualityReport returns a markdown string
  return { content: [{ type: 'text', text: report }] };
}

async function handleQualityPerformance(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const stats = getPerformanceStats(projectRoot);
  const metrics = calculateQualityMetrics(projectRoot);

  let output = `## Performance Statistics\n\n`;
  output += `**Total Requests:** ${metrics.totalRequests}\n`;
  output += `**Successful Requests:** ${metrics.successfulRequests}\n`;
  output += `**Failed Requests:** ${metrics.failedRequests}\n`;
  output += `**Average Response Time:** ${stats.averageResponseTime.toFixed(0)}ms\n`;
  output += `\n**Latency Percentiles:**\n`;
  output += `  - P50: ${stats.p50}ms\n`;
  output += `  - P95: ${stats.p95}ms\n`;
  output += `  - P99: ${stats.p99}ms\n`;
  output += `\n**Token Usage:**\n`;
  output += `  - Average: ${stats.tokenUsage.avg.toFixed(0)} tokens\n`;
  output += `  - Max: ${stats.tokenUsage.max} tokens\n`;
  output += `  - Min: ${stats.tokenUsage.min} tokens\n`;

  return { content: [{ type: 'text', text: output }] };
}

// ============ CONTEXT HANDLERS ============

async function handleContextStats(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const engine = getDynamicContextEngine(projectRoot);

  let output = `## Dynamic Context Statistics\n\n`;

  // Get stats if available
  output += `**Context Engine:** Active\n`;

  return { content: [{ type: 'text', text: output }] };
}

async function handleContextExport(): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const engine = getDynamicContextEngine(projectRoot);

  const exported = engine.export();
  const json = JSON.stringify(exported, null, 2);

  let output = `## Context Export\n\n`;
  output += `**Elements:** ${exported.elements?.length || 0}\n`;
  output += `**Export Length:** ${json.length} characters\n`;

  return { content: [{ type: 'text', text: output + `\n\`\`\`json\n${json.slice(0, 2000)}...\n\`\`\`\n` }] };
}

// ============ SESSION INSIGHTS HANDLERS ============

async function handleSessionInsights(days?: number): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const sessionIndex = loadSessionIndex(projectRoot);

  // Filter sessions by date range
  const cutoffTime = Date.now() - (days || 30) * 24 * 60 * 60 * 1000;
  const sessions = sessionIndex.sessions.filter(s => new Date(s.startTime).getTime() >= cutoffTime);

  let output = `## Cross-Session Insights (${days || 30} days)\n\n`;
  output += `**Total Sessions:** ${sessionIndex.sessions.length}\n`;
  output += `**Sessions in Period:** ${sessions.length}\n`;

  // Aggregate topics
  const allTopics = new Set<string>();
  for (const session of sessions) {
    for (const topic of session.topics || []) {
      allTopics.add(topic);
    }
  }

  output += `\n**Unique Topics:** ${allTopics.size}\n`;
  output += `**Topics:** ${[...allTopics].slice(0, 10).join(', ')}\n`;

  // Aggregate files
  const allFiles = new Set<string>();
  for (const session of sessions) {
    for (const file of session.filesModified || []) {
      allFiles.add(file);
    }
  }

  output += `\n**Unique Files Touched:** ${allFiles.size}\n`;

  return { content: [{ type: 'text', text: output }] };
}

// Handle MCP resource call
export async function handleResourceCall(
  uri: string,
  _args?: Record<string, unknown>,
  projectRoot?: string
): Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }> {
  const root = projectRoot || getProjectRoot();

  await logMCPEvent(root, {
    timestamp: new Date().toISOString(),
    resource: uri,
    mode: 'readonly',
  });

  let content = '';
  let mimeType = 'text/plain';

  switch (uri) {
    case 'kontextmind://project/overview': {
      const overviewPath = join(root, '.kontextmind', 'chatbot', 'project-overview.md');
      if (existsSync(overviewPath)) {
        content = readFileSync(overviewPath, 'utf-8');
        mimeType = 'text/markdown';
      } else {
        content = 'Project overview not available. Run "kontextmind kb build" first.';
      }
      break;
    }

    case 'kontextmind://project/architecture': {
      const archPath = join(root, '.kontextmind', 'chatbot', 'architecture.md');
      if (existsSync(archPath)) {
        content = readFileSync(archPath, 'utf-8');
        mimeType = 'text/markdown';
      } else {
        content = 'Architecture not available. Run "kontextmind kb build" first.';
      }
      break;
    }

    case 'kontextmind://project/current-state': {
      const statePath = join(root, '.context', 'current-state.md');
      if (existsSync(statePath)) {
        content = readFileSync(statePath, 'utf-8');
        mimeType = 'text/markdown';
      } else {
        content = 'Current state not available.';
      }
      break;
    }

    case 'kontextmind://project/provider-status': {
      const providerStatus = checkProviderConfigured();
      if (providerStatus.configured) {
        content = `# Provider Status\n\n**Status:** CONFIGURED\n\n**Provider:** ${providerStatus.provider}\n**Model:** ${providerStatus.model}`;
      } else {
        content = `# Provider Status\n\n**Status:** NOT CONFIGURED\n\n${providerStatus.error || 'No provider configured'}`;
      }
      mimeType = 'text/markdown';
      break;
    }

    case 'kontextmind://handoff/latest': {
      const handoffPath = join(root, '.context', 'handoff.md');
      if (existsSync(handoffPath)) {
        content = readFileSync(handoffPath, 'utf-8');
        mimeType = 'text/markdown';
      } else {
        content = 'Handoff not available.';
      }
      break;
    }

    case 'kontextmind://graph/files':
    case 'kontextmind://graph/symbols':
    case 'kontextmind://graph/blockers': {
      content = 'Graph not available. Run "kontextmind index" first.';
      break;
    }

    case 'kontextmind://summaries/files': {
      const summaries = loadAllFileSummaries();
      content = JSON.stringify(summaries, null, 2);
      mimeType = 'application/json';
      break;
    }

    case 'kontextmind://summaries/functions': {
      const summaries = loadAllFunctionSummaries();
      content = JSON.stringify(summaries, null, 2);
      mimeType = 'application/json';
      break;
    }

    case 'kontextmind://summaries/modules': {
      const summaries = loadAllModuleSummaries();
      content = JSON.stringify(summaries, null, 2);
      mimeType = 'application/json';
      break;
    }

    case 'kontextmind://summaries/apis': {
      const summaries = loadAllAPISummaries();
      content = JSON.stringify(summaries, null, 2);
      mimeType = 'application/json';
      break;
    }

    case 'kontextmind://summaries/decisions': {
      const summaries = loadAllDecisionSummaries();
      content = JSON.stringify(summaries, null, 2);
      mimeType = 'application/json';
      break;
    }

    case 'kontextmind://summaries/blockers': {
      const summaries = loadAllBlockerSummaries();
      content = JSON.stringify(summaries, null, 2);
      mimeType = 'application/json';
      break;
    }

    case 'kontextmind://summaries/all': {
      const all = {
        files: loadAllFileSummaries(),
        functions: loadAllFunctionSummaries(),
        modules: loadAllModuleSummaries(),
        apis: loadAllAPISummaries(),
        decisions: loadAllDecisionSummaries(),
        blockers: loadAllBlockerSummaries(),
      };
      content = JSON.stringify(all, null, 2);
      mimeType = 'application/json';
      break;
    }

    default:
      content = `Resource ${uri} not found`;
  }

  return { contents: [{ uri, text: content, mimeType }] };
}

// Handle MCP prompt call
export async function handlePromptCall(
  promptName: string,
  args: Record<string, unknown>,
  projectRoot?: string
): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  const root = projectRoot || getProjectRoot();

  await logMCPEvent(root, {
    timestamp: new Date().toISOString(),
    prompt: promptName,
    arguments_summary: JSON.stringify(args).slice(0, 100),
    mode: 'readonly',
  });

  let text = '';
  const files = loadAllFileSummaries();
  const functions = loadAllFunctionSummaries();
  const modules = loadAllModuleSummaries();
  const apis = loadAllAPISummaries();
  const decisions = loadAllDecisionSummaries();
  const blockers = loadAllBlockerSummaries();

  switch (promptName) {
    case 'explain_project':
      text = `## Project Overview\n\n`;
      text += `Based on ${files.length} file summaries, ${functions.length} function summaries, and ${modules.length} module summaries.\n\n`;
      text += `### Key Files\n`;
      for (const f of files.slice(0, 5)) {
        text += `- ${f.filePath}: ${f.purpose?.substring(0, 100)}\n`;
      }
      text += `\n### Key Modules\n`;
      for (const m of modules.slice(0, 5)) {
        text += `- ${m.directoryPath}: ${m.summary?.substring(0, 100)}\n`;
      }
      break;

    case 'resume_last_task': {
      const handoffPath = join(root, '.context', 'handoff.md');
      const handoffContent = existsSync(handoffPath) ? readFileSync(handoffPath, 'utf-8') : '';
      text = `## Resume Context\n\nLatest handoff:\n\n${handoffContent.substring(0, 2000) || 'No handoff available'}`;
      break;
    }

    case 'review_impact': {
      const changedFiles = (args.changed_files as string || '').split(',').map(f => f.trim());
      const impacted: string[] = [];

      for (const changed of changedFiles) {
        const dependent = files.filter(f =>
          f.dependencies?.some((d: string) => d.includes(changed) || changed.includes(d))
        );
        impacted.push(...dependent.map(f => f.filePath));
      }

      text = `## Impact Analysis\n\nChanged files: ${changedFiles.join(', ')}\n\n`;
      text += `Potentially impacted:\n${[...new Set(impacted)].join('\n') || 'None detected'}\n\n`;
      text += `Blockers affected: ${blockers.filter(b =>
        changedFiles.some(c => b.sourceSymbol.includes(c) || b.targetSymbol.includes(c))
      ).length}`;
      break;
    }

    case 'answer_without_code':
      text = `Answer without code: ${args.question || 'no question provided'}\n\n`;
      text += `Search results from summaries:\n\n`;
      for (const f of files.slice(0, 5)) {
        if (f.purpose) text += `- ${f.filePath}: ${f.purpose.substring(0, 150)}\n`;
      }
      break;

    case 'find_bug_area':
      text = `Looking for bug: ${args.error || 'no error provided'}\n\n`;
      text += `Relevant functions:\n`;
      for (const fn of functions.slice(0, 5)) {
        text += `- ${fn.symbolName} in ${fn.filePath}: ${fn.summary?.substring(0, 100)}\n`;
      }
      break;

    case 'summarize_module': {
      text = `Module: ${args.path || 'no path provided'}\n\n`;
      const mod = modules.find(m => m.directoryPath === args.path);
      if (mod) {
        text += `Summary: ${mod.summary}\n\nKey files: ${mod.keyFiles?.join(', ')}\n`;
        text += `Exports: ${mod.exports?.join(', ')}\n`;
      } else {
        text += `Module summary not found.`;
      }
      break;
    }

    case 'prepare_handoff':
      text = `## Handoff Preparation\n\nCompleted: ${args.completed_work || 'none'}\n\nPending: ${args.pending_work || 'none'}\n\n`;
      text += `Current blockers: ${blockers.length}\n`;
      text += `Stale summaries: ${files.filter((f: any) => f.summaryStatus === 'stale').length}`;
      break;

    case 'understand_architecture':
      text = `## Architecture Overview\n\n`;
      text += `Modules: ${modules.length}\n`;
      text += `APIs: ${apis.length}\n`;
      text += `Decisions: ${decisions.length}\n\n`;
      text += `### Module Structure\n`;
      for (const m of modules.slice(0, 10)) {
        text += `- ${m.directoryPath}\n`;
      }
      break;

    case 'analyze_dependencies': {
      text = `## Dependency Analysis for ${args.path || 'unknown'}\n\n`;
      const file = files.find(f => f.filePath === args.path);
      if (file) {
        text += `Dependencies: ${file.dependencies?.join(', ') || 'none'}\n`;
        text += `Blocked by: ${file.blockedBy?.map((b: any) => b.name).join(', ') || 'none'}\n`;
      }
      break;
    }

    default:
      text = `Prompt ${promptName} not implemented`;
  }

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text },
    }],
  };
}

// MCP Server interface
export interface MCPServerConfig {
  mode: MCPMode;
  transport: 'stdio' | 'http';
}

export interface MCPServerStatus {
  running: boolean;
  version: string;
  mode: string;
  transport: string;
  startedAt: string;
  providerConfigured: boolean;
}

let serverStatus: MCPServerStatus | null = null;

export function getMCPServerStatus(): MCPServerStatus | null {
  return serverStatus;
}

export function setMCPServerStatus(status: MCPServerStatus | null): void {
  serverStatus = status;
}

export { MCP_VERSION, LOG_FILE };
