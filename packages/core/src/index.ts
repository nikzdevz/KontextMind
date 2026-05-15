// Types
export * from './types/index.js';

// Config schemas (not types - those come from types/index.ts)
export {
  AgentTypeSchema,
  ModeSchema,
  GitModeSchema,
  ProviderSchema,
  ProjectConfigSchema,
  PolicyConfigSchema,
  ProvidersConfigSchema,
  ModelsConfigSchema,
  ToolLinkingConfigSchema,
  RegistryConfigSchema,
  SessionConfigSchema,
  validateConfig,
} from './config/schema.js';

// Config defaults
export * from './config/defaults.js';

// Templates
export * from './templates/render-template.js';
export * from './templates/template-types.js';

// Policies
export * from './policies/default-policy.js';

// Filesystem
export * from './filesystem/ensure-dir.js';
export * from './filesystem/write-file-safe.js';
export * from './filesystem/file-exists.js';

// Init
export { initProject, detectProject, detectGitAvailable, createFiles, createDirectories } from './init/init-project.js';
export type { DetectedProject } from './init/detect-project.js';
export type { FileToCreate } from './init/create-files.js';
export type { MCPServerConfig, MCPConfig, MCPConfigResult } from './init/init-project.js';

// Scanner
export * from './scanner/index.js';

// Parser
export * from './parser/index.js';

// Providers
export * from './providers/index.js';

// Summaries
export * from './summaries/index.js';

// Chatbot
export * from './chatbot/chatbot-types.js';
export { buildChatbotKB, getKBStatus, getLastAskTime, askQuestion, recordFeedback, getFeedbackStats, KB_DIR, LOG_FILE as QNA_LOG_FILE } from './chatbot/kb-builder.js';
export type { QAResult, KBSearchResult, AskOptions, KBBuildOptions, ChatbotKBStatus, ResponseFeedback, QNAEvent } from './chatbot/chatbot-types.js';
export { getAnalyticsReport, getTopQuestions, getCacheCoverage } from './chatbot/analytics.js';
export { getCacheStatus, invalidateCache, clearCacheMetadata } from './chatbot/cache-invalidation.js';
export { clearEmbeddingIndex } from './chatbot/embedding-cache.js';
export { clearQualityScores } from './chatbot/quality-scoring.js';

// Production Ask Pipeline
export { classifyQuestion, getIntentPrefix, getIntentLabel, isCodeRequest, isFilePathRequest } from './chatbot/intent-classifier.js';
export { semanticSearch, findRawFileContent, buildFileSummaryContent, buildFunctionSummaryContent } from './chatbot/semantic-search.js';
export { buildHierarchicalContext, buildConversationSummary, mergeContextForPrompt, calculateFreshnessScore, calculateRelevanceScore, estimateTokens as estimateContextTokens } from './chatbot/context-builder.js';
export { calculateQualityMetrics, getQualityTrends, getIntentDistribution, getPerformanceStats, generateQualityReport, recordQualityEvent, checkQualityThreshold } from './chatbot/quality-metrics.js';

// Session Management
export { SessionManager, getSessionManager } from './chatbot/session-manager.js';
export type { ChatSession, ChatMessage, SessionOptions, SessionSummary, ConversationContext } from './chatbot/chatbot-types.js';

// Context Building (legacy + new)
export { buildConversationContext, buildEnhancedPrompt, buildSingleTurnContext, getCurrentTurn, truncateToTokenBudget, estimateTokens, formatTurnsForDisplay, getConversationTurns } from './chatbot/context-builder.js';
export type { ConversationTurn, BuiltContext, ContextOptions } from './chatbot/context-builder.js';

// Production Types
export type {
  QuestionIntent,
  ClassifiedQuestion,
  SemanticChunk,
  HierarchicalContext,
  ContextLayer,
  ResponseProvenance,
  ProductionQAResult,
  SearchOptions,
  QualityMetrics,
  QualityMetricsEvent,
} from './chatbot/chatbot-types.js';

// Security
export * from './security/index.js';

// Obsidian Export
export * from './obsidian/index.js';

// Dataset Preparation
export * from './dataset/index.js';

// ====== Cross-Session Memory System (Phase 1-7) ======
export * from './memory/index.js';
