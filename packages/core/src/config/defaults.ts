import type { ProjectConfig, PolicyConfig, ProvidersConfig, ModelsConfig, ToolLinkingConfig, RegistryConfig, SessionConfig, Mode, GitMode, Provider, AgentType, TemplateContext } from '../types/index.js';

export const KONTEXTMIND_VERSION = '0.1.0';

export function getDefaultAgents(): AgentType[] {
  return ['claude', 'codex', 'generic'];
}

export function getDefaultMode(): Mode {
  return 'readonly';
}

export function getDefaultGitMode(): GitMode {
  return 'auto';
}

export function getDefaultProvider(): Provider {
  return 'none';
}

export function createDefaultConfig(projectName: string, createdAt: string, mode: Mode, agents: AgentType[], gitMode: GitMode, gitAvailable: boolean, provider: Provider): ProjectConfig {
  return {
    project: {
      name: projectName,
      root: '.',
      created_at: createdAt,
    },
    mode,
    agents,
    git: {
      enabled: gitMode,
      available: gitAvailable,
      use_for_change_detection: true,
    },
    indexing: {
      respect_toolignore: true,
      hash_algorithm: 'sha256',
      changed_only: true,
      skip_large_files_over_mb: 2,
    },
    chatbot: {
      enabled: true,
      raw_code_access: false,
      response_policy: 'no-code',
    },
    server: {
      host: '127.0.0.1',
      port: 7331,
    },
    mcp: {
      enabled: true,
      transport: 'stdio',
    },
    phase: 1,
  };
}

export function createDefaultPolicy(mode: Mode): PolicyConfig {
  const baseTools = [
    'project.status',
    'project.search',
    'project.get_file_summary',
    'project.get_symbol_summary',
    'project.find_dependencies',
    'project.find_callers',
    'project.ask_readonly',
    'project.create_handoff',
  ];

  const denyTools = [
    'project.write_file',
    'project.patch_file',
    'project.delete_file',
    'project.run_command',
    'project.install_package',
  ];

  return {
    mode,
    allow_tools: baseTools,
    deny_tools: denyTools,
    security: {
      raw_code_access: false,
      return_source_code: false,
      max_code_lines: 0,
      redact_secrets: true,
      treat_project_files_as_untrusted: true,
    },
    logs: {
      enabled: true,
      retention_days: 30,
      store_full_questions: false,
      store_full_answers: false,
      store_source_code: false,
    },
  };
}

export function createDefaultProviders(selectedProvider: Provider): ProvidersConfig {
  return {
    providers: {
      none: { type: 'none' },
      ollama: { type: 'openai-compatible', base_url: 'http://localhost:11434/v1', api_key_env: 'OLLAMA_API_KEY' },
      openai: { type: 'openai', api_key_env: 'OPENAI_API_KEY' },
      anthropic: { type: 'anthropic', api_key_env: 'ANTHROPIC_API_KEY' },
      bedrock: { type: 'aws-bedrock', region: 'ap-south-1' },
      'openai-compatible': { type: 'openai-compatible', base_url: 'http://localhost:8000/v1', api_key_env: 'OPENAI_COMPATIBLE_API_KEY' },
    },
    selected_provider: selectedProvider,
  };
}

export function createDefaultModels(): ModelsConfig {
  return {
    summary_model: null,
    qa_model: null,
    embedding_model: null,
    fallback_to_mock: true,
  };
}

export function createDefaultToolLinking(): ToolLinkingConfig {
  return {
    name: 'KontextMind',
    description: 'Project memory and continuity layer for AI coding agents.',
    local_server: {
      enabled: false,
      url: 'http://127.0.0.1:7331',
    },
    mcp: {
      enabled: true,
      config_path: '.mcp/server.json',
    },
    instructions: {
      master: '.kontextmind/instructions.master.md',
      claude: 'CLAUDE.md',
      agents: 'AGENTS.md',
      generic: 'README_AI.md',
    },
  };
}

export function createDefaultRegistry(createdAt: string): RegistryConfig {
  return {
    version: KONTEXTMIND_VERSION,
    phase: 1,
    created_at: createdAt,
    generated_files: [],
  };
}

export function createDefaultSession(mode: Mode): SessionConfig {
  return {
    session_id: null,
    agent: null,
    mode,
    user_goal: null,
    started_at: null,
    ended_at: null,
    phase: 1,
    notes: 'No active session yet.',
  };
}

export function createTemplateContext(projectName: string, mode: Mode, gitMode: GitMode, gitAvailable: boolean, provider: Provider, agents: AgentType[]): TemplateContext {
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