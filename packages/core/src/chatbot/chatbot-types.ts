// Chatbot Knowledge Base types

export interface QAAccuracy {
  score: number;
  confidence: number;
  sourceTypes: string[];
}

export interface QAResult {
  answer: string;
  confidence: number;
  sources: SourceReference[];
  rawCodeAccess: boolean;
  policyApplied: boolean;
  mode: 'readonly' | 'chatbot-readonly';
  llmEnhanced: boolean;
  provider?: string;
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