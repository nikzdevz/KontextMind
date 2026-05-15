import path from 'path';

export function getProjectRoot(): string {
  return process.cwd();
}

export function resolveInProject(...segments: string[]): string {
  return path.resolve(getProjectRoot(), ...segments);
}

export const KONTEXTMIND_DIR = '.kontextmind';
export const CONTEXT_DIR = '.context';
export const MCP_DIR = '.mcp';
export const KG_DIR = '.kg';
export const SUMMARIES_DIR = '.summaries';
export const SESSIONS_DIR = '.sessions';
export const LOGS_DIR = '.logs';
export const OBSIDIAN_DIR = '.obsidian-export';

export const FILES = {
  configJson: '.kontextmind/config.json',
  policyJson: '.kontextmind/policy.json',
  instructionsMaster: '.kontextmind/instructions.master.md',
  providersJson: '.kontextmind/providers.json',
  modelsJson: '.kontextmind/models.json',
  toolLinkingJson: '.kontextmind/tool-linking.json',
  registryJson: '.kontextmind/registry.json',
  localConfigJson: '.kontextmind/local.config.json',
  secretsExampleJson: '.kontextmind/secrets.example.json',
  claudeMd: 'CLAUDE.md',
  agentsMd: 'AGENTS.md',
  readmeAiMd: 'README_AI.md',
  toolignore: '.toolignore',
  mcpServerJson: '.mcp/server.json',
  mcpToolsJson: '.mcp/tools.json',
  mcpResourcesJson: '.mcp/resources.json',
  mcpPromptsJson: '.mcp/prompts.json',
  mcpPermissionsJson: '.mcp/permissions.json',
  sessionLatestJson: '.sessions/latest.json',
  handoffMd: '.context/handoff.md',
  currentStateMd: '.context/current-state.md',
  projectMd: '.context/project.md',
  architectureMd: '.context/architecture.md',
  conventionsMd: '.context/conventions.md',
  decisionsMd: '.context/decisions.md',
  taskHistoryMd: '.context/task-history.md',
  agentPolicyMd: '.context/agent-policy.md',
  logsReadmeMd: '.logs/README.md',
  kgReadmeMd: '.kg/README.md',
  summariesReadmeMd: '.summaries/README.md',
  obsidianReadmeMd: '.obsidian-export/README.md',
  chatbotReadmeMd: '.kontextmind/chatbot/README.md',
} as const;