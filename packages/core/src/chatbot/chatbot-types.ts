// Chatbot Knowledge Base types

export interface QAAccuracy {
  score: number;
  confidence: number;
  sourceTypes: string[];
}

export interface QAResult {
  // Unique ID for tracking and feedback (especially for API clients)
  responseId: string;
  answer: string;
  confidence: number;
  sources: SourceReference[];
  rawCodeAccess: boolean;
  policyApplied: boolean;
  mode: 'readonly' | 'chatbot-readonly';
  llmEnhanced: boolean;
  provider?: string;
  // Source of the request - helps determine if feedback is expected
  source: 'cli' | 'api' | 'mcp';
  // Feedback status for API clients
  feedbackSupported: boolean;
  feedbackReceived?: 'like' | 'dislike' | null;
}

export interface SourceReference {
  type: 'qa' | 'file_summary' | 'function_summary' | 'graph' | 'project' | 'llm-synthesis' | 'llm-intuition' | 'llm-code-synthesis' | 'code-context' | 'code-reading' | 'task_summary' | 'session_summary';
  id?: string;
  name?: string;
  relevanceScore?: number;
}

export interface QuestionAnswer {
  question: string;
  answer: string;
  category: QACategory;
  tags: string[];
  relatedFiles?: string[];
  relatedFunctions?: string[];
  createdAt: string;
}

export type QACategory =
  | 'project_overview'
  | 'architecture'
  | 'setup'
  | 'api_behavior'
  | 'authentication'
  | 'database'
  | 'deployment'
  | 'error_handling'
  | 'security'
  | 'dependencies'
  | 'impact_analysis'
  | 'troubleshooting'
  | 'developer_onboarding';

export interface ChatbotPolicy {
  // Code protection - default is STRICT NO
  returnCode: boolean;
  maxCodeLines: number;

  // File/Path protection - default is NO
  allowFileNames: boolean;
  allowFilePaths: boolean;
  allowDirectoryStructure: boolean;

  // Information protection
  allowFunctionNames: boolean;
  allowArchitectureExplanation: boolean;
  allowHighLevelSteps: boolean;
  allowTechnicalDetails: boolean;

  // Strict mode - completely blocks code/structure requests
  strictMode: boolean;
  blockCodeRequests: boolean;
  blockFileStructureRequests: boolean;
  blockRawCodeRequests: boolean;
}

export interface ChatbotKBStatus {
  ready: boolean;
  hasOverview: boolean;
  hasArchitecture: boolean;
  questionCount: number;
  lastBuildTime: string | null;
  lastAskTime: string | null;
}

export interface KBBuildOptions {
  mode?: 'chatbot';
  changedOnly?: boolean;
  mock?: boolean;
  maxQuestions?: number;
}

export interface AskOptions {
  mode?: 'readonly' | 'chatbot-readonly';
  json?: boolean;
  noCode?: boolean;
  useLLM?: boolean;
  // Source of the request - determines if feedback is expected
  source?: 'cli' | 'api' | 'mcp';
  // Session tracking for multi-turn conversations
  sessionId?: string;
  conversationTurn?: number;
}

export interface KBSearchResult {
  qa: QuestionAnswer | null;
  fileSummaries: Array<{ path: string; purpose: string; relevance: number }>;
  functionSummaries: Array<{ symbolId: string; summary: string; relevance: number }>;
  graphNodes: Array<{ id: string; label: string; type: string; relevance: number }>;
  bestAnswer: string;
  confidence: number;
  sources: SourceReference[];
  needsLLM: boolean;
  fallbackSources: string[];
}

// Feedback types for response quality tracking
export interface ResponseFeedback {
  responseId: string;
  feedback: 'like' | 'dislike';
  reason?: string;
  userComment?: string;
  timestamp: string;
  source: 'cli' | 'api' | 'mcp';
}

// Q&A event for logging with feedback support
export interface QNAEvent {
  responseId: string;
  sessionId: string | null;  // Link to session for conversation context
  question: string;
  questionHash: string;
  answer: string;
  confidence: number;
  sources: string[];
  rawCodeAccess: boolean;
  mode: string;
  source: 'cli' | 'api' | 'mcp';
  feedbackSupported: boolean;
  feedbackReceived?: 'like' | 'dislike' | null;
  feedbackTimestamp?: string;
  codeRequestDetected?: boolean;
  timestamp: string;
  conversationTurn?: number;  // Position in conversation for session tracking
  topics?: string[];        // Topics discussed in this turn
}

// Session types for multi-turn conversations
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  responseId?: string;           // Links to QNAEvent
  feedbackReceived?: 'like' | 'dislike';
  attachments?: Attachment[];
}

export interface Attachment {
  type: 'file' | 'image' | 'code';
  name: string;
  content?: string;
  path?: string;
}

export interface ConversationContext {
  topics: string[];             // Topics discussed in session
  entities: EntityReference[];   // Files/modules referenced
  intentHistory: string[];        // User intent progression
  lastQuestionEmbedding?: number[];
}

export interface EntityReference {
  id: string;
  name: string;
  type: string;
  referenceCount: number;
}

export interface SessionMetadata {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  totalTokens: number;
  averageConfidence: number;
  sourcesUsed: string[];
  startedAt: string;
  lastActivityAt: string;
}

export interface ChatSession {
  id: string;
  projectName: string;
  projectRoot: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  context: ConversationContext;
  metadata: SessionMetadata;
}

export interface SessionSummary {
  id: string;
  projectName: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  topics: string[];
  preview: string;  // First user message or "New conversation"
}

// Options for creating a session
export interface SessionOptions {
  projectName?: string;
  systemPrompt?: string;
  metadata?: Partial<SessionMetadata>;
}

// Context building options for askQuestion integration
export interface ContextOptions {
  maxTurns?: number;        // Number of conversation turns to include
  maxTokens?: number;       // Token budget for context
  includeSystemPrompt?: boolean;
  includeTopics?: boolean;
}

// ====== PHASE 1: Production-Grade Types ======

// Question Intent Classification
export type QuestionIntent =
  | 'overview'          // "what is this project?"
  | 'architecture'     // "how does it work?"
  | 'implementation'    // "how is X implemented?"
  | 'usage'             // "how do I use X?"
  | 'troubleshooting'  // "why is X broken?"
  | 'status'            // "what's the status of X?"
  | 'decision'          // "why was X done this way?"
  | 'exploration';       // open-ended exploration

export interface ClassifiedQuestion {
  intent: QuestionIntent;
  entities: string[];           // Files/modules mentioned
  keywords: string[];
  isFollowUp: boolean;
  previousContext?: string[];    // Topics from prior turns
}

// Semantic Search Chunks
export interface SemanticChunk {
  id: string;
  type: 'file_summary' | 'function_summary' | 'module_summary' | 'api_summary' | 'decision_summary' | 'raw_code';
  content: string;              // The actual content (summary or code)
  sourcePath: string;
  filePath?: string;
  relevance: number;
  conversationRelevance?: number; // How relevant to conversation flow
  freshness: 'fresh' | 'stale' | 'unknown';
  metadata?: Record<string, unknown>; // Additional context
}

// Hierarchical Context Layers
export interface ContextLayer {
  layer: 1 | 2 | 3 | 4;
  name: string;
  tokens: number;
  content: string;
  sources: string[];
}

export interface HierarchicalContext {
  layers: ContextLayer[];
  totalTokens: number;
  maxTokens: number;
  truncated: boolean;
}

// Response Provenance
export interface ResponseProvenance {
  retrievalPath: string[];      // KB files consulted
  semanticChunks: SemanticChunk[];
  conversationContext?: {
    priorTurns: number;
    topicsPreserved: string[];
  };
  confidenceFactors: {
    summaryFreshness: number;
    retrievalRelevance: number;
    conversationContinuity: number;
  };
}

// Production QA Result
export interface ProductionQAResult extends QAResult {
  provenance: ResponseProvenance;
  intent: QuestionIntent;
  contextLayers: ContextLayer[];
  qualityScore: number;         // Internal quality metric
}

// Search Options
export interface SearchOptions {
  maxChunks?: number;
  minRelevance?: number;
  intent?: QuestionIntent;
  includeStale?: boolean;
  conversationTurn?: number;
  allowRawCode?: boolean;
}

// Token Limits for Context
export const TOKEN_LIMITS = {
  layer1: 200,      // Session context
  layer2: 800,      // AI-generated summaries (file, function)
  layer3: 500,      // Module/Decision summaries
  layer4: 1000,     // Raw file chunks (ONLY when necessary)
  total: 2500,      // Total budget
} as const;

// Quality Metrics
export interface QualityMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageConfidence: number;
  averageQualityScore: number;
  intentDistribution: Partial<Record<QuestionIntent, number>>;
  averageResponseTime: number;
  tokenUsage: {
    total: number;
    average: number;
  };
  contextHitRate: number;       // % of requests with semantic hits
  followUpRate: number;         // % of follow-up questions
  llmFallbackRate: number;      // % falling back to KB-only
}

export interface QualityMetricsEvent {
  responseId: string;
  intent: QuestionIntent;
  qualityScore: number;
  contextLayers: number;
  totalTokens: number;
  responseTimeMs: number;
  conversationTurn: number;
  timestamp: string;
}