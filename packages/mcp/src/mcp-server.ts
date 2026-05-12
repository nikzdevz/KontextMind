import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const LOG_FILE = '.logs/mcp-events.log';
const MCP_VERSION = '0.1.0';

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
        } catch {}
      }
    }
  } catch {}

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
        } catch {}
      }
    }
  } catch {}

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
        } catch {}
      }
    }
  } catch {}

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
        } catch {}
      }
    }
  } catch {}

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
        } catch {}
      }
    }
  } catch {}

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
        } catch {}
      }
    }
  } catch {}

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
      require('fs').mkdirSync(dirPath, { recursive: true });
    }

    const logPath = join(projectRoot, LOG_FILE);
    if (existsSync(logPath)) {
      const existing = readFileSync(logPath, 'utf-8');
      writeFileSync(logPath, existing + logLine, 'utf-8');
    } else {
      writeFileSync(logPath, logLine, 'utf-8');
    }
  } catch {
    // Silently ignore logging errors
  }
}

// Handle MCP tool call
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  mode: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();

  await logMCPEvent(projectRoot, {
    timestamp: new Date().toISOString(),
    tool: toolName,
    arguments_summary: JSON.stringify(args).slice(0, 100),
    mode,
  });

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
      require('fs').mkdirSync(tasksDir, { recursive: true });
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
      require('fs').mkdirSync(sessionsDir, { recursive: true });
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

// Handle MCP resource call
export async function handleResourceCall(uri: string): Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }> {
  const projectRoot = getProjectRoot();

  await logMCPEvent(projectRoot, {
    timestamp: new Date().toISOString(),
    resource: uri,
    mode: 'readonly',
  });

  let content = '';
  let mimeType = 'text/plain';

  switch (uri) {
    case 'kontextmind://project/overview': {
      const overviewPath = join(projectRoot, '.kontextmind', 'chatbot', 'project-overview.md');
      if (existsSync(overviewPath)) {
        content = readFileSync(overviewPath, 'utf-8');
        mimeType = 'text/markdown';
      } else {
        content = 'Project overview not available. Run "kontextmind kb build" first.';
      }
      break;
    }

    case 'kontextmind://project/architecture': {
      const archPath = join(projectRoot, '.kontextmind', 'chatbot', 'architecture.md');
      if (existsSync(archPath)) {
        content = readFileSync(archPath, 'utf-8');
        mimeType = 'text/markdown';
      } else {
        content = 'Architecture not available. Run "kontextmind kb build" first.';
      }
      break;
    }

    case 'kontextmind://project/current-state': {
      const statePath = join(projectRoot, '.context', 'current-state.md');
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
      const handoffPath = join(projectRoot, '.context', 'handoff.md');
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
  args: Record<string, unknown>
): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  const projectRoot = getProjectRoot();

  await logMCPEvent(projectRoot, {
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
      const handoffPath = join(projectRoot, '.context', 'handoff.md');
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

    case 'summarize_module':
      text = `Module: ${args.path || 'no path provided'}\n\n`;
      const mod = modules.find(m => m.directoryPath === args.path);
      if (mod) {
        text += `Summary: ${mod.summary}\n\nKey files: ${mod.keyFiles?.join(', ')}\n`;
        text += `Exports: ${mod.exports?.join(', ')}\n`;
      } else {
        text += `Module summary not found.`;
      }
      break;

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

    case 'analyze_dependencies':
      text = `## Dependency Analysis for ${args.path || 'unknown'}\n\n`;
      const file = files.find(f => f.filePath === args.path);
      if (file) {
        text += `Dependencies: ${file.dependencies?.join(', ') || 'none'}\n`;
        text += `Blocked by: ${file.blockedBy?.map((b: any) => b.name).join(', ') || 'none'}\n`;
      }
      break;

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
  mode: 'readonly' | 'chatbot-readonly' | 'suggest' | 'edit-with-approval';
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