// Summary types for file, function, and module summaries

export type SummaryStatus = 'fresh' | 'stale' | 'missing' | 'failed' | 'partial';

export interface SymbolSummary {
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'constant';
  summary: string;
  startLine?: number;
  endLine?: number;
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
}

export interface SummarizeOptions {
  provider?: string;
  model?: string;
  maxFiles?: number;
  changedOnly?: boolean;
  dryRun?: boolean;
  includeSymbols?: boolean;
}

export interface SummarizeResult {
  summariesGenerated: number;
  summariesUpdated: number;
  summariesFailed: number;
  totalCost: number;
  durationMs: number;
  errors: string[];
  dryRun?: boolean;
}
