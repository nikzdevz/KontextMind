import path from 'path';
import { existsSync, readFileSync } from 'fs';
import type { InitOptions, InitResult, AgentType, Mode, GitMode, Provider } from '../types/index.js';
import { detectProject, detectGitAvailable } from './detect-project.js';
import { createFiles, createDirectories, prepareFileContent, FileToCreate } from './create-files.js';
import {
  ALL_TEMPLATES,
} from '../templates/template-types.js';
import {
  createDefaultConfig,
  createDefaultPolicy,
  createDefaultProviders,
  createDefaultModels,
  createDefaultToolLinking,
  createDefaultRegistry,
  createDefaultSession,
  getDefaultAgents,
  getDefaultMode,
  getDefaultGitMode,
  getDefaultProvider,
  KONTEXTMIND_VERSION,
} from '../config/defaults.js';
import { writeFileSafe } from '../filesystem/write-file-safe.js';

// MCP Configuration file paths for different clients
const MCP_CONFIG_FILES = {
  // Claude Code, Continue.dev, and other STDIO-based MCP clients
  ClaudeCode: '.mcp.json',
  // Roo Code MCP settings
  RooCode: '.roo/mcp.json',
  // VS Code MCP extension settings
  VSCode: 'mcp_settings.json',
};

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPConfigResult {
  created: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Creates MCP configuration files for external MCP clients
 */
function createMCPConfigFiles(
  projectRoot: string,
  options: {
    transport?: 'stdio' | 'http';
    port?: number;
    serverCommand?: string;
  } = {}
): MCPConfigResult {
  const result: MCPConfigResult = { created: [], skipped: [], errors: [] };
  const { transport = 'stdio', port = 7332, serverCommand = 'kontextmind' } = options;

  // Prepare server configurations
  const stdioServerConfig: MCPServerConfig = {
    command: serverCommand,
    args: ['mcp'],
    env: {
      DATA_DIR: '${DATA_DIR}',
    },
  };

  const httpServerConfig: MCPServerConfig = {
    command: serverCommand,
    args: ['mcp', '--transport', 'http', '--port', String(port)],
    env: {
      DATA_DIR: '${DATA_DIR}',
    },
  };

  const serverConfig = transport === 'http' ? httpServerConfig : stdioServerConfig;

  // 1. Create .mcp.json (Claude Code, Continue.dev, and generic MCP clients)
  try {
    const mcpConfig: MCPConfig = {
      mcpServers: {
        kontextmind: serverConfig,
      },
    };

    // Check if file exists
    const mcpJsonPath = path.join(projectRoot, MCP_CONFIG_FILES.ClaudeCode);
    if (existsSync(mcpJsonPath)) {
      // Merge with existing config
      const existing = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
      const merged: MCPConfig = {
        mcpServers: {
          ...existing.mcpServers,
          kontextmind: serverConfig,
        },
      };
      writeFileSafe(mcpJsonPath, JSON.stringify(merged, null, 2));
    } else {
      writeFileSafe(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));
    }
    result.created.push(MCP_CONFIG_FILES.ClaudeCode);
  } catch (error) {
    result.errors.push(`Failed to create ${MCP_CONFIG_FILES.ClaudeCode}: ${error}`);
  }

  // 2. Create .roo/mcp.json (Roo Code)
  try {
    const rooDir = path.join(projectRoot, '.roo');
    const rooMcpPath = path.join(rooDir, 'mcp.json');

    // Ensure .roo directory exists
    if (!existsSync(rooDir)) {
      // Directory creation would be handled by createDirectories
    }

    const rooConfig: MCPConfig = {
      mcpServers: {
        kontextmind: serverConfig,
      },
    };

    if (existsSync(rooMcpPath)) {
      const existing = JSON.parse(readFileSync(rooMcpPath, 'utf-8'));
      const merged: MCPConfig = {
        mcpServers: {
          ...existing.mcpServers,
          kontextmind: serverConfig,
        },
      };
      writeFileSafe(rooMcpPath, JSON.stringify(merged, null, 2));
    } else {
      writeFileSafe(rooMcpPath, JSON.stringify(rooConfig, null, 2));
    }
    result.created.push(MCP_CONFIG_FILES.RooCode);
  } catch (error) {
    result.errors.push(`Failed to create ${MCP_CONFIG_FILES.RooCode}: ${error}`);
  }

  // 3. Create mcp_settings.json (VS Code MCP extensions)
  try {
    const vscodeConfig: MCPConfig = {
      mcpServers: {
        kontextmind: serverConfig,
      },
    };

    const vscodePath = path.join(projectRoot, MCP_CONFIG_FILES.VSCode);
    if (existsSync(vscodePath)) {
      const existing = JSON.parse(readFileSync(vscodePath, 'utf-8'));
      const merged: MCPConfig = {
        mcpServers: {
          ...existing.mcpServers,
          kontextmind: serverConfig,
        },
      };
      writeFileSafe(vscodePath, JSON.stringify(merged, null, 2));
    } else {
      writeFileSafe(vscodePath, JSON.stringify(vscodeConfig, null, 2));
    }
    result.created.push(MCP_CONFIG_FILES.VSCode);
  } catch (error) {
    result.errors.push(`Failed to create ${MCP_CONFIG_FILES.VSCode}: ${error}`);
  }

  return result;
}

// KontextMind generated files patterns to add to .gitignore
const KONTEXTMIND_GITIGNORE_PATTERNS = `

# KontextMind Generated Files
# These are automatically generated by KontextMind and should not be committed

# KontextMind core directories
.kontextmind/
.kontextmind/cache/
.kontextmind/chatbot/

# Context and project memory
.context/
.context/handoff.md
.context/current-state.md
.context/project.md
.context/architecture.md
.context/conventions.md
.context/decisions.md
.context/task-history.md
.context/agent-policy.md

# Knowledge graph
.kg/
.kg/README.md
.kg/nodes/
.kg/edges/
.kg/embeddings/
.kg/*.json

# Summaries
.summaries/
.summaries/README.md
.summaries/files/
.summaries/functions/
.summaries/modules/
.summaries/api/
.summaries/decisions/
.summaries/blockers/
.summaries/*.json

# Sessions
.sessions/
.sessions/README.md
.sessions/latest.json
.sessions/history/

# Logs (KontextMind audit logs)
.logs/
.logs/README.md
.logs/*.log

# Obsidian export
.obsidian-export/
.obsidian-export/README.md

# Tooling
.toolignore
`;

function updateGitignore(projectRoot: string, warnings: string[]): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  try {
    let existingContent = '';
    if (existsSync(gitignorePath)) {
      existingContent = readFileSync(gitignorePath, 'utf-8');
    }

    // Check if KontextMind patterns are already present
    if (existingContent.includes('# KontextMind Generated Files')) {
      return; // Already has KontextMind patterns
    }

    // Append KontextMind patterns
    const newContent = existingContent.trimEnd() + KONTEXTMIND_GITIGNORE_PATTERNS;
    writeFileSafe(gitignorePath, newContent);
  } catch (error) {
    warnings.push(`Failed to update .gitignore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function resolveOptions(options: InitOptions): {
  agents: AgentType[];
  mode: Mode;
  git: GitMode;
  provider: Provider;
  force: boolean;
} {
  return {
    agents: options.agents ?? getDefaultAgents(),
    mode: options.mode ?? getDefaultMode(),
    git: options.git ?? getDefaultGitMode(),
    provider: options.provider ?? getDefaultProvider(),
    force: options.force ?? false,
  };
}

function getTemplateVariables(
  projectName: string,
  mode: Mode,
  gitMode: GitMode,
  gitAvailable: boolean,
  provider: Provider,
  agents: AgentType[]
): Record<string, string | boolean> {
  return {
    PROJECT_NAME: projectName,
    CREATED_AT: new Date().toISOString(),
    MODE: mode,
    GIT_MODE: gitMode,
    GIT_AVAILABLE: gitAvailable,
    PROVIDER: provider,
    AGENTS: agents.join(','),
    AGENTS_JSON: JSON.stringify(agents),
    KONTEXTMIND_VERSION,
  };
}

export async function initProject(options: InitOptions = {}): Promise<InitResult> {
  const projectRoot = process.cwd();
  const resolved = resolveOptions(options);

  // Detect project details
  const detected = detectProject(projectRoot);
  const gitAvailable = detectGitAvailable(projectRoot);

  // Create template variables
  const variables = getTemplateVariables(
    detected.name,
    resolved.mode,
    resolved.git,
    gitAvailable,
    resolved.provider,
    resolved.agents
  );

  // Ensure base directories exist
  const baseDirs = [
    '.kontextmind',
    '.kontextmind/chatbot',
    '.kontextmind/cache',
    '.context',
    '.mcp',
    '.roo',
    '.kg',
    '.kg/nodes',
    '.kg/edges',
    '.kg/embeddings',
    '.summaries',
    '.summaries/files',
    '.summaries/functions',
    '.summaries/modules',
    '.summaries/api',
    '.summaries/decisions',
    '.summaries/blockers',
    '.sessions',
    '.sessions/history',
    '.logs',
    '.obsidian-export',
  ];

  await createDirectories(baseDirs);

  // Prepare files from templates
  const filesToCreate: FileToCreate[] = [];

  for (const template of ALL_TEMPLATES) {
    const content = prepareFileContent(template, variables);
    filesToCreate.push({
      relativePath: path.join(projectRoot, template.filename),
      content,
    });
  }

  // Create config files
  const configJson = createDefaultConfig(
    detected.name,
    variables.CREATED_AT as string,
    resolved.mode,
    resolved.agents,
    resolved.git,
    gitAvailable,
    resolved.provider
  );

  const policyJson = createDefaultPolicy(resolved.mode);
  const providersJson = createDefaultProviders(resolved.provider);
  const modelsJson = createDefaultModels();
  const toolLinkingJson = createDefaultToolLinking();
  const registryJson = createDefaultRegistry(variables.CREATED_AT as string);
  const sessionJson = createDefaultSession(resolved.mode);

  const configFiles: FileToCreate[] = [
    {
      relativePath: path.join(projectRoot, '.kontextmind/config.json'),
      content: JSON.stringify(configJson, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.kontextmind/policy.json'),
      content: JSON.stringify(policyJson, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.kontextmind/providers.json'),
      content: JSON.stringify(providersJson, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.kontextmind/models.json'),
      content: JSON.stringify(modelsJson, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.kontextmind/tool-linking.json'),
      content: JSON.stringify(toolLinkingJson, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.kontextmind/registry.json'),
      content: JSON.stringify(registryJson, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.kontextmind/local.config.json'),
      content: JSON.stringify({
        note: 'Local-only configuration. Do not commit real secrets.',
        api_keys: { use_environment_variables: true },
      }, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.kontextmind/secrets.example.json'),
      content: JSON.stringify({
        OPENAI_API_KEY: 'set-this-in-your-environment',
        ANTHROPIC_API_KEY: 'set-this-in-your-environment',
        OLLAMA_API_KEY: 'optional-for-local',
        OPENAI_COMPATIBLE_API_KEY: 'set-this-in-your-environment',
      }, null, 2),
    },
    {
      relativePath: path.join(projectRoot, '.sessions/latest.json'),
      content: JSON.stringify(sessionJson, null, 2),
    },
  ];

  // Create empty log files
  const logFiles: FileToCreate[] = [
    'agent-actions.log',
    'read-events.log',
    'summary-generation.log',
    'security-events.log',
    'qna-events.log',
    'mcp-events.log',
    'api-events.log',
    'cost-events.log',
    'error-events.log',
  ].map(logFile => ({
    relativePath: path.join(projectRoot, '.logs', logFile),
    content: '',
  }));

  // Combine all files
  const allFiles = [...filesToCreate, ...configFiles, ...logFiles];

  // Create files
  const result = await createFiles(allFiles, resolved.force);

  // Update .gitignore with KontextMind patterns
  updateGitignore(projectRoot, result.warnings);

  // Create MCP configuration files for external clients
  const mcpResult = createMCPConfigFiles(projectRoot, {
    transport: 'stdio',
    port: 7332,
    serverCommand: 'kontextmind',
  });

  // Merge MCP results with main results
  const allCreated = [
    ...result.created.map(f => path.relative(projectRoot, f)),
    ...mcpResult.created,
  ];
  const allSkipped = [
    ...result.skipped.map(f => path.relative(projectRoot, f)),
    ...mcpResult.skipped,
  ];
  const allWarnings = [
    ...result.warnings,
    ...mcpResult.errors.map(e => e),
  ];

  return {
    created: allCreated,
    skipped: allSkipped,
    warnings: allWarnings,
  };
}

export { detectProject, detectGitAvailable } from './detect-project.js';
export { createFiles, createDirectories } from './create-files.js';