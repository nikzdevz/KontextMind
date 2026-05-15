// Summary types for file, function, module, API, and decision summaries

export type SummaryStatus = 'fresh' | 'stale' | 'missing' | 'failed' | 'partial';

export interface SymbolSummary {
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'constant';
  summary: string;
  startLine?: number;
  endLine?: number;
  blockedBy?: BlockerInfo[];
  blocks?: string[];
}

export interface BlockerInfo {
  name: string;
  kind: string;
  filePath: string;
  reason: string;
  severity: 'blocking' | 'degraded' | 'warning';
}

export interface FileSummary {
  targetType: 'file';
  filePath: string;
  hash: string;
  language: string;
  summaryStatus: SummaryStatus;
  provider: string;
  model: string;
  confidence?: number;
  cost?: {
    inputTokens: number;
    outputTokens: number;
    total: number;
  };
  purpose: string;
  symbols: SymbolSummary[];
  dependencies: string[];
  relatedFiles: string[];
  blockedBy?: BlockerInfo[];
  blocks?: string[];
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export interface FunctionSummary {
  targetType: 'function';
  symbolId: string;
  symbolName: string;
  filePath: string;
  hash: string;
  summaryStatus: SummaryStatus;
  provider: string;
  model: string;
  summary: string;
  signature: string;
  purpose: string;
  parameters?: string[];
  returnType?: string;
  blockedBy?: BlockerInfo[];
  blocks?: string[];
  complexity?: number;
  cost?: {
    inputTokens: number;
    outputTokens: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export interface ModuleSummary {
  targetType: 'module';
  directoryPath: string;
  fileCount: number;
  summaryStatus: SummaryStatus;
  provider: string;
  model: string;
  summary: string;
  keyFiles: string[];
  exportedSymbols: string[];
  imports: string[];
  exports: string[];
  blockedBy?: BlockerInfo[];
  blocks?: string[];
  cost?: {
    inputTokens: number;
    outputTokens: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface APISummary {
  targetType: 'api';
  endpoint: string;
  method?: string;
  filePath: string;
  hash: string;
  summaryStatus: SummaryStatus;
  provider: string;
  model: string;
  summary: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  responseType?: string;
  blockedBy?: BlockerInfo[];
  blocks?: string[];
  cost?: {
    inputTokens: number;
    outputTokens: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DecisionSummary {
  targetType: 'decision';
  decisionId: string;
  filePath: string;
  hash: string;
  summaryStatus: SummaryStatus;
  provider: string;
  model: string;
  summary: string;
  title: string;
  context: string;
  rationale: string;
  alternatives?: string[];
  consequences?: string[];
  blockedBy?: BlockerInfo[];
  blocks?: string[];
  cost?: {
    inputTokens: number;
    outputTokens: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BlockerSummary {
  targetType: 'blocker';
  blockerId: string;
  sourceSymbol: string;
  targetSymbol: string;
  reason: string;
  severity: 'blocking' | 'degraded' | 'warning';
  filePath: string;
  line?: number;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryStats {
  total: number;
  fresh: number;
  stale: number;
  missing: number;
  failed: number;
  partial: number;
  byType?: {
    files: number;
    functions: number;
    modules: number;
    apis: number;
    decisions: number;
  };
}

export interface SummarizeOptions {
  provider?: string;
  model?: string;
  maxFiles?: number;
  maxFunctions?: number;
  maxModules?: number;
  maxAPIs?: number;
  maxDecisions?: number;
  changedOnly?: boolean;
  dryRun?: boolean;
  includeSymbols?: boolean;
  includeBlockers?: boolean;
  skipOnNoProvider?: boolean;
}

export interface SummarizeResult {
  summariesGenerated: number;
  summariesUpdated: number;
  summariesFailed: number;
  byType: {
    files: number;
    functions: number;
    modules: number;
    apis: number;
    decisions: number;
    blockers: number;
  };
  totalCost: number;
  durationMs: number;
  errors: string[];
  warnings: string[];
  dryRun?: boolean;
  skipped: boolean;
  reason?: string;
}