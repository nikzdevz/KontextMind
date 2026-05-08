import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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
    name: 'project.security_scan',
    description: 'Scan for potential security issues in the project',
    inputSchema: {
      type: 'object',
      properties: {
        include_secrets: { type: 'boolean', default: false, description: 'Include secret scanning' },
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
    uri: 'kontextmind://handoff/latest',
    name: 'Latest Handoff',
    description: 'Get the latest handoff document',
  },
  {
    uri: 'kontextmind://summaries/files',
    name: 'File Summaries',
    description: 'Get all file summaries',
  },
];

// All available MCP prompts
export const MCP_PROMPTS: MCPPrompt[] = [
  {
    name: 'explain_project',
    description: 'Generate a project explanation',
    arguments: [
      { name: 'detail_level', description: 'Level of detail: brief, medium, detailed', required: false },
    ],
  },
  {
    name: 'resume_last_task',
    description: 'Get context to resume the last task',
  },
  {
    name: 'review_impact',
    description: 'Analyze the impact of changes',
    arguments: [
      { name: 'changed_files', description: 'Comma-separated list of changed files', required: true },
    ],
  },
  {
    name: 'answer_without_code',
    description: 'Answer a question without showing code',
    arguments: [
      { name: 'question', description: 'Question to answer', required: true },
    ],
  },
  {
    name: 'find_bug_area',
    description: 'Find the likely location of a bug',
    arguments: [
      { name: 'error', description: 'Error message or description', required: true },
    ],
  },
  {
    name: 'summarize_module',
    description: 'Summarize a module',
    arguments: [
      { name: 'path', description: 'Path to module', required: true },
    ],
  },
  {
    name: 'prepare_handoff',
    description: 'Prepare a handoff document',
    arguments: [
      { name: 'completed_work', description: 'Summary of completed work', required: true },
      { name: 'pending_work', description: 'Summary of pending work', required: false },
    ],
  },
];

// Get project root
function getProjectRoot(): string {
  return process.cwd();
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

    case 'project.search':
      return handleSearch(args.query as string, args.type as string);

    case 'project.get_file_summary':
      return handleGetFileSummary(args.path as string);

    case 'project.get_symbol_summary':
      return handleGetSymbolSummary(args.name as string, args.file as string | undefined);

    case 'project.find_dependencies':
      return handleFindDependencies(args.path as string);

    case 'project.find_callers':
      return handleFindCallers(args.name as string);

    case 'project.find_related_files':
      return handleFindRelatedFiles(args.path as string);

    case 'project.ask_readonly':
      return handleAskReadonly(args.question as string, args.no_code as boolean | undefined);

    case 'project.create_handoff':
      return handleCreateHandoff(args.summary as string, args.next_steps as string | undefined);

    case 'project.refresh_summary':
      return handleRefreshSummary(args.paths as string[] | undefined);

    case 'project.security_scan':
      return handleSecurityScan(args.include_secrets as boolean | undefined);

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
    } catch {
      status = 'Invalid config';
    }
  }

  return { content: [{ type: 'text', text: status }] };
}

async function handleSearch(query: string, type: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{
      type: 'text',
      text: `Search for "${query}" (type: ${type || 'all'}). Run "kontextmind index" first to enable search.`,
    }],
  };
}

async function handleGetFileSummary(path: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const summaryPath = join(projectRoot, '.summaries', 'files', path.replace(/[/\\:]/g, '__') + '.json');

  if (!existsSync(summaryPath)) {
    return { content: [{ type: 'text', text: `No summary found for ${path}. Run "kontextmind summarize" first.` }] };
  }

  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    return {
      content: [{
        type: 'text',
        text: `File: ${path}\nPurpose: ${summary.purpose || 'No description'}\nLanguage: ${summary.language}\nStatus: ${summary.summaryStatus}`,
      }],
    };
  } catch {
    return { content: [{ type: 'text', text: `Error reading summary for ${path}` }] };
  }
}

async function handleGetSymbolSummary(name: string, file?: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{
      type: 'text',
      text: `Symbol: ${name}${file ? ` in ${file}` : ''}. Run "kontextmind index" first to enable symbol lookup.`,
    }],
  };
}

async function handleFindDependencies(path: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{ type: 'text', text: `Dependencies for ${path}. Run "kontextmind index" first to enable dependency lookup.` }],
  };
}

async function handleFindCallers(name: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{ type: 'text', text: `Callers of ${name}. Run "kontextmind index" first to enable caller lookup.` }],
  };
}

async function handleFindRelatedFiles(path: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{ type: 'text', text: `Related files to ${path}. Run "kontextmind index" first to enable related file lookup.` }],
  };
}

async function handleAskReadonly(question: string, noCode?: boolean): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{
      type: 'text',
      text: `Question: ${question}\n\nRun "kontextmind kb build" and "kontextmind ask" via CLI for full Q&A functionality.`,
    }],
  };
}

async function handleCreateHandoff(summary: string, nextSteps?: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectRoot = getProjectRoot();
  const handoffPath = join(projectRoot, '.context', 'handoff.md');

  const content = `# Latest Handoff\n\n## Summary\n${summary}\n\n## Next Steps\n${nextSteps || 'None specified'}\n\n## Timestamp\n${new Date().toISOString()}\n`;

  try {
    writeFileSync(handoffPath, content, 'utf-8');
    return { content: [{ type: 'text', text: `Handoff created at ${handoffPath}` }] };
  } catch {
    return { content: [{ type: 'text', text: 'Failed to create handoff document' }] };
  }
}

async function handleRefreshSummary(paths?: string[]): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{ type: 'text', text: `Refresh summaries for ${paths?.length || 0} files. Run "kontextmind summarize --changed-only" to refresh.` }],
  };
}

async function handleSecurityScan(includeSecrets?: boolean): Promise<{ content: Array<{ type: string; text: string }> }> {
  return {
    content: [{ type: 'text', text: `Security scan${includeSecrets ? ' (including secrets)' : ''}. Run "kontextmind secrets scan" via CLI for full scan.` }],
  };
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
    case 'kontextmind://graph/symbols': {
      content = 'Graph not available. Run "kontextmind index" first.';
      break;
    }

    case 'kontextmind://summaries/files': {
      content = 'Summaries not available. Run "kontextmind summarize" first.';
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

  switch (promptName) {
    case 'explain_project':
      text = 'Explain the project structure and purpose based on available summaries.';
      break;

    case 'resume_last_task':
      text = 'Provide context to resume the last task based on handoff documents.';
      break;

    case 'review_impact':
      text = `Review the impact of changes to files: ${args.changed_files || 'unknown'}`;
      break;

    case 'answer_without_code':
      text = `Answer this question without showing code: ${args.question || 'no question provided'}`;
      break;

    case 'find_bug_area':
      text = `Find the likely location of this bug: ${args.error || 'no error provided'}`;
      break;

    case 'summarize_module':
      text = `Summarize the module at: ${args.path || 'no path provided'}`;
      break;

    case 'prepare_handoff':
      text = `Prepare a handoff. Completed: ${args.completed_work || 'none'}. Pending: ${args.pending_work || 'none'}`;
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
}

let serverStatus: MCPServerStatus | null = null;

export function getMCPServerStatus(): MCPServerStatus | null {
  return serverStatus;
}

export function setMCPServerStatus(status: MCPServerStatus | null): void {
  serverStatus = status;
}

export { MCP_VERSION, LOG_FILE };