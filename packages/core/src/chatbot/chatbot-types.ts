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
  type: 'qa' | 'file_summary' | 'function_summary' | 'graph' | 'project' | 'llm-synthesis' | 'code-reading' | 'task_summary' | 'session_summary';
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