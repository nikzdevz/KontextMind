export type AgentType = 'claude' | 'codex' | 'cursor' | 'continue' | 'copilot' | 'generic';
export type Mode = 'readonly' | 'suggest' | 'edit-with-approval' | 'full-agent';
export type GitMode = 'auto' | 'enabled' | 'disabled';
export type Provider = 'none' | 'openai' | 'anthropic' | 'ollama' | 'bedrock' | 'openai-compatible';

export interface InitOptions {
  yes?: boolean;
  force?: boolean;
  agents?: AgentType[];
  mode?: Mode;
  git?: GitMode;
  provider?: Provider;
}

export interface InitResult {
  created: string[];
  skipped: string[];
  warnings: string[];
}

export interface ProjectConfig {
  project: {
    name: string;
    root: string;
    created_at: string;
  };
  mode: Mode;
  agents: AgentType[];
  git: {
    enabled: GitMode;
    available: boolean;
    use_for_change_detection: boolean;
  };
  indexing: {
    respect_toolignore: boolean;
    hash_algorithm: string;
    changed_only: boolean;
    skip_large_files_over_mb: number;
  };
  chatbot: {
    enabled: boolean;
    raw_code_access: boolean;
    response_policy: string;
  };
  server: {
    host: string;
    port: number;
  };
  mcp: {
    enabled: boolean;
    transport: string;
  };
  phase: number;
}

export interface PolicyConfig {
  mode: Mode;
  allow_tools: string[];
  deny_tools: string[];
  security: {
    raw_code_access: boolean;
    return_source_code: boolean;
    max_code_lines: number;
    redact_secrets: boolean;
    treat_project_files_as_untrusted: boolean;
  };
  logs: {
    enabled: boolean;
    retention_days: number;
    store_full_questions: boolean;
    store_full_answers: boolean;
    store_source_code: boolean;
  };
}

export interface TemplateContext {
  PROJECT_NAME: string;
  CREATED_AT: string;
  MODE: Mode;
  GIT_MODE: GitMode;
  GIT_AVAILABLE: boolean;
  PROVIDER: Provider;
  AGENTS: string;
  AGENTS_JSON: string;
  KONTEXTMIND_VERSION: string;
}

export interface ProvidersConfig {
  providers: Record<string, {
    type: string;
    base_url?: string;
    api_key_env?: string;
    region?: string;
  }>;
  selected_provider: Provider;
}

export interface ModelsConfig {
  summary_model: string | null;
  qa_model: string | null;
  embedding_model: string | null;
  fallback_to_mock: boolean;
}

export interface ToolLinkingConfig {
  name: string;
  description: string;
  local_server: {
    enabled: boolean;
    url: string;
  };
  mcp: {
    enabled: boolean;
    config_path: string;
  };
  instructions: {
    master: string;
    claude: string;
    agents: string;
    generic: string;
  };
}

export interface RegistryConfig {
  version: string;
  phase: number;
  created_at: string;
  generated_files: string[];
}

export interface SessionConfig {
  session_id: string | null;
  agent: string | null;
  mode: Mode;
  user_goal: string | null;
  started_at: string | null;
  ended_at: string | null;
  phase: number;
  notes: string;
}