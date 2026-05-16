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
  feedback_supported?: boolean;
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
    code_request?: boolean;
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

// ====== ENHANCED API TYPES ======

// Standardized Response Wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
  meta: ResponseMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string | null;
  suggestion?: string;
}

export interface ResponseMeta {
  requestId: string;
  projectId?: string;
  timestamp: string;
  processingTime?: number;
}

// Auth Types
export interface AuthRequest {
  email?: string;
  password?: string;
  apiKey?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  tenantId?: string;
}

export interface ApiKeyConfig {
  key: string;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string;
}

// User Types (Anonymous)
export interface User {
  userId: string;
  projectId: string;
  createdAt: string;
  lastSeen: string;
  visitCount: number;
  preferences: UserPreferences;
  stats: UserStats;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
}

export interface UserStats {
  conversationsCreated: number;
  questionsAsked: number;
  feedbackGiven: number;
}

// Conversation Types (Enhanced)
export interface Conversation {
  id: string;
  projectId: string;
  userId?: string;
  title?: string;
  status: 'active' | 'archived' | 'deleted';
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  messageCount: number;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  confidence?: number;
  sources?: (Source | string)[];
  streaming?: boolean;
  cached?: boolean;
}

export interface CreateConversationRequest {
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  content: string;
  role?: 'user' | 'assistant';
  stream?: boolean;
}

export interface StreamMessageResponse {
  conversationId: string;
  messageId: string;
  streaming: boolean;
}

// Pipeline Types
export interface PipelineStatus {
  projectId: string;
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
  percentComplete: number;
  estimatedSecondsRemaining?: number;
  steps: PipelineStep[];
  canAnswerQuestions: boolean;
  readinessMessage?: string;
}

export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentFile?: string;
  details?: {
    totalFiles?: number;
    completedFiles?: number;
    failedFiles?: number;
  };
}

export interface ReadinessCheck {
  ready: boolean;
  canAnswerQuestions: boolean;
  stages: {
    clone: { complete: boolean };
    scan: { complete: boolean };
    index: { complete: boolean };
    summarize: { complete: boolean; files?: number };
    kb_build: { complete: boolean };
  };
  stats: {
    totalFiles: number;
    totalSymbols: number;
    totalSummaries: number;
    knowledgeBaseSize: string;
  };
}

// LLM Provider Types
export interface LLMProvider {
  name: string;
  displayName: string;
  models: string[];
  requiresApiKey: boolean;
  supportsStreaming: boolean;
}

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
}

export interface ProviderTestResult {
  success: boolean;
  provider: string;
  model: string;
  latencyMs?: number;
  error?: string;
}

// Learning Types
export interface LearningConfig {
  enabled: boolean;
  triggers: {
    autoSync: boolean;
    syncIntervalMinutes: number;
    syncOnConversationEnd: boolean;
    syncOnFeedbackReceived: boolean;
  };
  sources: {
    conversations: boolean;
    feedback: boolean;
    codeChanges: boolean;
    taskCompletions: boolean;
    searchQueries: boolean;
  };
  thresholds: {
    minConfidenceToLearn: number;
    minOccurrencesBeforePattern: number;
    failureThresholdToAlert: number;
  };
  retention: {
    learnedPatternsDays: number;
    conversationHistoryDays: number;
    feedbackHistoryDays: number;
  };
  feedbackLoop: {
    enabled: boolean;
    collectFrom: {
      explicitRatings: boolean;
      implicitSignals: boolean;
      conversationOutcome: boolean;
    };
    learnFrom: {
      cacheHits: boolean;
      cacheMisses: boolean;
      fallbacks: boolean;
    };
  };
}

export interface LearningStats {
  enabled: boolean;
  lastSync: string;
  patternsLearned: number;
  outcomes: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  patterns: Array<{ pattern: string; frequency: number; successRate: number }>;
  antiPatterns: Array<{ pattern: string; occurrences: number }>;
  suggestions: LearningSuggestion[];
}

export interface LearningSuggestion {
  category: 'skill' | 'pattern' | 'approach' | 'documentation';
  title: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

// Webhook Types
export interface Webhook {
  id: string;
  projectId: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: string;
  active: boolean;
}

export interface WebhookRequest {
  url: string;
  events: string[];
  secret?: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Tenant Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  suspendedAt?: string;
  settings: TenantSettings;
  billing?: TenantBilling;
  usage: TenantUsage;
}

export interface TenantSettings {
  maxUsers: number;
  maxProjects: number;
  currentUsers: number;
  currentProjects: number;
  allowUserSignups: boolean;
  requireEmailVerification: boolean;
}

export interface TenantBilling {
  email: string;
  status: 'paid' | 'pending' | 'overdue';
  nextBillingDate?: string;
  monthlyAmount?: number;
  paymentMethod?: string;
}

export interface TenantUsage {
  requestsThisMonth: number;
  storageMb: number;
  apiCalls: number;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  plan?: string;
  settings?: Partial<TenantSettings>;
  billing?: { email: string; paymentMethod?: string };
  metadata?: Record<string, unknown>;
}

// Pagination Types
export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total?: number;
    limit: number;
    offset?: number;
    hasMore: boolean;
    nextOffset?: number;
    nextCursor?: string;
  };
}

// Feedback Types (Enhanced)
export interface ConversationFeedback {
  id: string;
  conversationId: string;
  userId?: string;
  rating: 'positive' | 'negative' | 'neutral' | number;
  feedbackType: 'rating' | 'stars' | 'correction' | 'follow-up' | 'resolution';
  comment?: string;
  responseId?: string;
  question?: string;
  answer?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  timestamp: string;
}

export interface FeedbackAnalytics {
  period: string;
  summary: {
    totalFeedback: number;
    positive: number;
    negative: number;
    neutral: number;
    satisfactionRate: number;
  };
  byConversation: Array<{
    conversationId: string;
    questionsAsked: number;
    avgRating: number;
    followUpCount: number;
    resolvedRate: number;
  }>;
  byTopic: Array<{
    topic: string;
    questionCount: number;
    avgRating: number;
    feedbackCount: number;
  }>;
  negativePatterns: Array<{
    question: string;
    negativeCount: number;
    reason: string;
    suggestedFix: string;
  }>;
  improvementSuggestions: Array<{
    type: string;
    file?: string;
    pattern?: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

// SSE Event Types
export interface SSEProgressEvent {
  step: string;
  percent: number;
  currentFile?: string;
}

export interface SSEFileCompletedEvent {
  file: string;
  status: 'success' | 'failed';
}

export interface SSEPipelineCompletedEvent {
  message: string;
}

export type SSEEventType = 'progress' | 'file_completed' | 'pipeline_completed' | 'message_start' | 'message_delta' | 'message_end' | 'typing_start' | 'typing_end';

// Error Codes
export const ErrorCodes = {
  // Auth errors
  AUTH001: 'INVALID_API_KEY',
  AUTH002: 'EXPIRED_TOKEN',
  AUTH003: 'MISSING_AUTH_HEADER',
  AUTH004: 'INSUFFICIENT_PERMISSIONS',
  // Project errors
  PRJ001: 'PROJECT_NOT_FOUND',
  PRJ002: 'PROJECT_NOT_READY',
  PRJ003: 'PROJECT_PAUSED',
  PRJ004: 'PROJECT_ARCHIVED',
  PRJ005: 'PROJECT_DELETED',
  PRJ006: 'GIT_CLONE_FAILED',
  PRJ007: 'GIT_SYNC_CONFLICT',
  // LLM errors
  LLM001: 'INVALID_PROVIDER_CONFIG',
  LLM002: 'PROVIDER_CONNECTION_FAILED',
  LLM003: 'MODEL_NOT_FOUND',
  LLM004: 'RATE_LIMIT_EXCEEDED',
  LLM005: 'CONTENT_TOO_LARGE',
  LLM006: 'INVALID_RESPONSE',
  // Pipeline errors
  PIP001: 'PIPELINE_IN_PROGRESS',
  PIP002: 'PIPELINE_FAILED',
  PIP003: 'STEP_DEPENDS_ON_FAILED',
  // Rate limiting
  RATE001: 'MINUTE_LIMIT_EXCEEDED',
  RATE002: 'DAILY_LIMIT_EXCEEDED',
  RATE003: 'CONCURRENT_LIMIT_EXCEEDED',
  // Validation errors
  VAL001: 'INVALID_GIT_URL',
  VAL002: 'INVALID_MODEL_NAME',
  VAL003: 'MISSING_REQUIRED_FIELD',
  VAL004: 'FIELD_TOO_LONG',
  // User quota
  USER001: 'USER_QUOTA_EXCEEDED',
  USER002: 'USER_NOT_FOUND',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
