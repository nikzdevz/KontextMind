// API Types for KontextMind Container API

export interface Project {
  name: string;
  git_url: string;
  branch: string;
  status: ProjectStatus;
  created_at: string;
  last_asked: string | null;
  qa_count: number;
  files_indexed?: number;
  symbols_indexed?: number;
  summaries_generated?: number;
  kb_version?: string;
}

export type ProjectStatus =
  | 'initializing'
  | 'cloning'
  | 'indexing'
  | 'summarizing'
  | 'kb_building'
  | 'ready'
  | 'error'
  | 'reindexing';

export interface SetupProjectRequest {
  git_url: string;
  name: string;
  branch?: string;
  callback_url?: string;
}

export interface SetupProjectResponse {
  project_id: string;
  status: ProjectStatus;
  job_id: string;
}

export interface AskRequest {
  question: string;
  mode?: 'readonly' | 'chatbot-readonly';
}

export interface AskResponse {
  qa_id: string;
  answer: string;
  confidence: number;
  sources: Source[];
  tier: number;
  cached: boolean;
}

export interface Source {
  type: string;
  name?: string;
  relevance?: number;
}

export interface FeedbackRequest {
  qa_id: string;
  project: string;
  signal: 'helpful' | 'not_helpful' | 'neutral';
  reason?: string;
  metadata?: FeedbackMetadata;
}

export interface FeedbackMetadata {
  user_id?: string;
  llm_model?: string;
  [key: string]: unknown;
}

export interface FeedbackRecord {
  qa_id: string;
  question: string;
  answer: string;
  feedback: {
    signal: string;
    reason?: string;
    timestamp: string;
    user_id?: string;
  };
  qa_metadata: {
    confidence: number;
    tier: number;
    sources: string[];
    llm_model?: string;
    kb_version?: string;
  };
}

export interface FeedbackExportResponse {
  project: string;
  exported_at: string;
  total_records: number;
  format: string;
  data: FeedbackRecord[];
}

export interface Settings {
  llm_provider: string;
  llm_model: string;
  llm_base_url: string | null;
  github_token_configured: boolean;
  projects_count: number;
}

export interface UpdateSettingsRequest {
  llm_provider?: string;
  llm_model?: string;
  llm_api_key?: string;
  llm_base_url?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  projects: {
    total: number;
    ready: number;
    initializing: number;
  };
}

export interface Job {
  job_id: string;
  project_name: string;
  type: 'setup' | 'reindex';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percent: number;
  current_step: string;
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface JobStatusResponse {
  job_id: string;
  project_id: string;
  status: string;
  progress_percent: number;
  current_step: string;
  error?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  code?: string;
}

// Prompt Instructions Types
export interface ResponseStyle {
  format: 'detailed' | 'concise' | 'bullet';
  includeCode: boolean;
  includeExamples: boolean;
}

export interface PromptInstructions {
  systemPrompt: string;
  userInstructions: string[];
  responseStyle: ResponseStyle;
  updatedAt: string;
}

export interface UpdatePromptRequest {
  systemPrompt?: string;
  userInstructions?: string[];
  responseStyle?: Partial<ResponseStyle>;
}
