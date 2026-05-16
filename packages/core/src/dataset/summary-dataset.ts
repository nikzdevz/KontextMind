// Summary Dataset Collector - Generates training data from code summaries
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import type {
  FileSummary,
  FunctionSummary,
  ModuleSummary,
  APISummary,
  DecisionSummary,
  BlockerSummary,
} from '../summaries/summary-types.js';

// Training record types
export interface SummaryTrainingRecord {
  id: string;
  type: 'file' | 'function' | 'module' | 'api' | 'decision' | 'blocker';
  question: string;
  answer: string;
  context: string;
  sourceFile?: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    provider?: string;
    model?: string;
    language?: string;
    confidence: number;
    tags: string[];
  };
}

// Dataset statistics
export interface SummaryDatasetStats {
  totalRecords: number;
  byType: Record<string, number>;
  averageQuality: number;
  languages: Record<string, number>;
}

// Configuration
const SUMMARIES_DIR = '.summaries';
const DATASET_DIR = '.kontextmind/dataset';
const SUMMARIES_DATASET_FILE = 'summaries-training.jsonl';

/**
 * Load all file summaries
 */
function loadFileSummaries(projectRoot: string): FileSummary[] {
  const summaries: FileSummary[] = [];
  const dir = join(projectRoot, SUMMARIES_DIR, 'files');

  if (!existsSync(dir)) return summaries;

  try {
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        summaries.push(JSON.parse(content) as FileSummary);
      } catch { /* skip */ }
    }
  } catch { /* dir error */ }

  return summaries;
}

/**
 * Load all function summaries
 */
function loadFunctionSummaries(projectRoot: string): FunctionSummary[] {
  const summaries: FunctionSummary[] = [];
  const dir = join(projectRoot, SUMMARIES_DIR, 'functions');

  if (!existsSync(dir)) return summaries;

  try {
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        summaries.push(JSON.parse(content) as FunctionSummary);
      } catch { /* skip */ }
    }
  } catch { /* dir error */ }

  return summaries;
}

/**
 * Load all module summaries
 */
function loadModuleSummaries(projectRoot: string): ModuleSummary[] {
  const summaries: ModuleSummary[] = [];
  const dir = join(projectRoot, SUMMARIES_DIR, 'modules');

  if (!existsSync(dir)) return summaries;

  try {
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        summaries.push(JSON.parse(content) as ModuleSummary);
      } catch { /* skip */ }
    }
  } catch { /* dir error */ }

  return summaries;
}

/**
 * Load all API summaries
 */
function loadAPISummaries(projectRoot: string): APISummary[] {
  const summaries: APISummary[] = [];
  const dir = join(projectRoot, SUMMARIES_DIR, 'api');

  if (!existsSync(dir)) return summaries;

  try {
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        summaries.push(JSON.parse(content) as APISummary);
      } catch { /* skip */ }
    }
  } catch { /* dir error */ }

  return summaries;
}

/**
 * Load all decision summaries
 */
function loadDecisionSummaries(projectRoot: string): DecisionSummary[] {
  const summaries: DecisionSummary[] = [];
  const dir = join(projectRoot, SUMMARIES_DIR, 'decisions');

  if (!existsSync(dir)) return summaries;

  try {
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        summaries.push(JSON.parse(content) as DecisionSummary);
      } catch { /* skip */ }
    }
  } catch { /* dir error */ }

  return summaries;
}

/**
 * Convert file summary to training records
 */
function fileSummaryToRecords(summary: FileSummary): SummaryTrainingRecord[] {
  const records: SummaryTrainingRecord[] = [];

  // Record 1: What does this file do?
  if (summary.purpose) {
    records.push({
      id: `file-purpose-${summary.filePath.replace(/[^a-z0-9]/gi, '_')}`,
      type: 'file',
      question: `What does ${summary.filePath.split('/').pop()} do?`,
      answer: summary.purpose,
      context: `File: ${summary.filePath} (${summary.language})`,
      sourceFile: summary.filePath,
      metadata: {
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        provider: summary.provider,
        model: summary.model,
        language: summary.language,
        confidence: summary.confidence ?? 0.8, // Default confidence
        tags: ['file-summary', 'purpose', summary.language || 'unknown'],
      },
    });
  }

  // Record 2: What are the key exports?
  if (summary.symbols && summary.symbols.length > 0) {
    // Filter for exported functions, classes, and types
    const exportKinds = ['function', 'class', 'type', 'interface'];
    const keyExports = summary.symbols
      .filter(s => exportKinds.includes(s.kind) || s.name.startsWith('export '))
      .slice(0, 5)
      .map(s => `${s.kind} ${s.name}`)
      .join(', ');

    if (keyExports) {
      records.push({
        id: `file-exports-${summary.filePath.replace(/[^a-z0-9]/gi, '_')}`,
        type: 'file',
        question: `What are the main exports in ${summary.filePath.split('/').pop()}?`,
        answer: `Key exports: ${keyExports}`,
        context: `File: ${summary.filePath}`,
        sourceFile: summary.filePath,
        metadata: {
          createdAt: summary.createdAt,
          updatedAt: summary.updatedAt,
          provider: summary.provider,
          model: summary.model,
          language: summary.language,
          confidence: summary.confidence ?? 0.8,
          tags: ['file-summary', 'exports'],
        },
      });
    }
  }

  return records;
}

/**
 * Convert function summary to training records
 */
function functionSummaryToRecords(summary: FunctionSummary): SummaryTrainingRecord[] {
  const records: SummaryTrainingRecord[] = [];

  // Default confidence for functions (no direct confidence field on FunctionSummary)
  const functionConfidence = 0.75;

  // Record: What does this function do?
  if (summary.summary || summary.purpose) {
    const answerText = summary.summary || summary.purpose || '';
    const paramText = summary.parameters?.length
      ? ` Parameters: ${summary.parameters.join(', ')}`
      : '';
    const returnText = summary.returnType ? ` Returns: ${summary.returnType}` : '';

    records.push({
      id: `func-${summary.symbolId.replace(/[^a-z0-9]/gi, '_')}`,
      type: 'function',
      question: `What does the function ${summary.symbolName} do?`,
      answer: `${answerText}${paramText}${returnText}`,
      context: `Function: ${summary.symbolName} in ${summary.filePath}`,
      sourceFile: summary.filePath,
      metadata: {
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        provider: summary.provider,
        model: summary.model,
        confidence: functionConfidence,
        tags: ['function-summary', summary.symbolName],
      },
    });
  }

  return records;
}

/**
 * Convert module summary to training records
 */
function moduleSummaryToRecords(summary: ModuleSummary): SummaryTrainingRecord[] {
  const records: SummaryTrainingRecord[] = [];

  if (summary.summary) {
    records.push({
      id: `module-${summary.directoryPath.replace(/[^a-z0-9]/gi, '_')}`,
      type: 'module',
      question: `What does the module ${summary.directoryPath} contain?`,
      answer: summary.summary,
      context: `Module: ${summary.directoryPath} (${summary.fileCount} files)`,
      metadata: {
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        provider: summary.provider,
        model: summary.model,
        confidence: 0.8,
        tags: ['module-summary', 'directory'],
      },
    });
  }

  return records;
}

/**
 * Convert API summary to training records
 */
function apiSummaryToRecords(summary: APISummary): SummaryTrainingRecord[] {
  const records: SummaryTrainingRecord[] = [];

  if (summary.summary || summary.description) {
    const methodText = summary.method ? `[${summary.method}] ` : '';
    records.push({
      id: `api-${summary.endpoint.replace(/[^a-z0-9]/gi, '_')}`,
      type: 'api',
      question: `What does the API ${methodText}${summary.endpoint} do?`,
      answer: summary.summary || summary.description || '',
      context: `API Endpoint: ${summary.endpoint}`,
      sourceFile: summary.filePath,
      metadata: {
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        provider: summary.provider,
        model: summary.model,
        confidence: 0.8,
        tags: ['api-summary', summary.method || 'unknown'],
      },
    });
  }

  return records;
}

/**
 * Convert decision summary to training records
 */
function decisionSummaryToRecords(summary: DecisionSummary): SummaryTrainingRecord[] {
  const records: SummaryTrainingRecord[] = [];

  if (summary.summary) {
    const rationaleText = summary.rationale ? `\n\nRationale: ${summary.rationale}` : '';
    const contextText = summary.context ? `\n\nContext: ${summary.context}` : '';

    records.push({
      id: `decision-${summary.decisionId.replace(/[^a-z0-9]/gi, '_')}`,
      type: 'decision',
      question: `Why was the decision "${summary.title}" made?`,
      answer: `${summary.summary}${contextText}${rationaleText}`,
      context: `Decision: ${summary.title}`,
      sourceFile: summary.filePath,
      metadata: {
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        provider: summary.provider,
        model: summary.model,
        confidence: 0.85,
        tags: ['decision-summary', 'architecture'],
      },
    });
  }

  return records;
}

/**
 * Collect all summaries and convert to training records
 */
export function collectSummaryTrainingData(
  projectRoot: string,
  options: {
    minConfidence?: number;
    types?: Array<'file' | 'function' | 'module' | 'api' | 'decision'>;
  } = {}
): SummaryTrainingRecord[] {
  const { minConfidence = 0.3, types } = options;
  const records: SummaryTrainingRecord[] = [];

  const includeFile = !types || types.includes('file');
  const includeFunction = !types || types.includes('function');
  const includeModule = !types || types.includes('module');
  const includeAPI = !types || types.includes('api');
  const includeDecision = !types || types.includes('decision');

  // Load and convert file summaries
  if (includeFile) {
    for (const summary of loadFileSummaries(projectRoot)) {
      // Only filter if confidence field exists and passes threshold
      if (summary.confidence === undefined || summary.confidence >= minConfidence) {
        records.push(...fileSummaryToRecords(summary));
      }
    }
  }

  // Load and convert function summaries
  if (includeFunction) {
    for (const summary of loadFunctionSummaries(projectRoot)) {
      // Functions always included (no confidence field to check)
      records.push(...functionSummaryToRecords(summary));
    }
  }

  // Load and convert module summaries
  if (includeModule) {
    for (const summary of loadModuleSummaries(projectRoot)) {
      records.push(...moduleSummaryToRecords(summary));
    }
  }

  // Load and convert API summaries
  if (includeAPI) {
    for (const summary of loadAPISummaries(projectRoot)) {
      records.push(...apiSummaryToRecords(summary));
    }
  }

  // Load and convert decision summaries
  if (includeDecision) {
    for (const summary of loadDecisionSummaries(projectRoot)) {
      records.push(...decisionSummaryToRecords(summary));
    }
  }

  return records;
}

/**
 * Export summaries dataset to file
 */
export function exportSummaryDataset(
  projectRoot: string,
  options: {
    outputPath?: string;
    format?: 'jsonl' | 'json' | 'sharegpt';
    minConfidence?: number;
    types?: Array<'file' | 'function' | 'module' | 'api' | 'decision'>;
  } = {}
): { outputPath: string; recordCount: number } {
  const {
    outputPath,
    format = 'jsonl',
    minConfidence = 0.3,
    types,
  } = options;

  const records = collectSummaryTrainingData(projectRoot, { minConfidence, types });

  let content: string;
  switch (format) {
    case 'json':
      content = JSON.stringify(records, null, 2);
      break;
    case 'sharegpt':
      content = records.map(r => JSON.stringify({
        id: r.id,
        conversations: [
          { from: 'human', value: r.question },
          { from: 'gpt', value: r.answer },
        ],
        category: 'code-explanation',
        tags: r.metadata.tags,
        metadata: {
          type: r.type,
          sourceFile: r.sourceFile,
          confidence: r.metadata.confidence,
          createdAt: r.metadata.createdAt,
        },
      })).join('\n');
      break;
    default: // jsonl
      content = records.map(r => JSON.stringify(r)).join('\n');
  }

  const outPath = outputPath || join(projectRoot, DATASET_DIR, 'summaries', `training.${format === 'jsonl' ? 'jsonl' : format}`);
  ensureDir(join(outPath, '..', '..'));
  ensureDir(join(outPath, '..'));

  import('fs').then(({ writeFileSync }) => {
    writeFileSync(outPath, content, 'utf-8');
  });

  return { outputPath: outPath, recordCount: records.length };
}

/**
 * Get summary dataset statistics
 */
export function getSummaryDatasetStats(projectRoot: string): SummaryDatasetStats {
  const records = collectSummaryTrainingData(projectRoot);

  const stats: SummaryDatasetStats = {
    totalRecords: records.length,
    byType: {},
    averageQuality: 0,
    languages: {},
  };

  let totalConfidence = 0;

  for (const record of records) {
    // By type
    stats.byType[record.type] = (stats.byType[record.type] || 0) + 1;

    // Quality
    totalConfidence += record.metadata.confidence;

    // Languages
    if (record.metadata.language) {
      stats.languages[record.metadata.language] = (stats.languages[record.metadata.language] || 0) + 1;
    }
  }

  stats.averageQuality = records.length > 0 ? totalConfidence / records.length : 0;

  return stats;
}

/**
 * Format summaries dataset for ShareGPT multi-turn
 * Groups file/function summaries into cohesive training examples
 */
export function formatAsCodeExplanationDataset(projectRoot: string): string {
  const records = collectSummaryTrainingData(projectRoot);

  // Group by source file
  const byFile = new Map<string, SummaryTrainingRecord[]>();
  for (const record of records) {
    if (record.sourceFile) {
      const existing = byFile.get(record.sourceFile) || [];
      existing.push(record);
      byFile.set(record.sourceFile, existing);
    }
  }

  // Create training examples from grouped records
  const trainingExamples: string[] = [];

  for (const [file, fileRecords] of byFile) {
    const example = {
      id: `code-explainer-${file.replace(/[^a-z0-9]/gi, '_')}`,
      conversations: fileRecords.flatMap(r => [
        { from: 'human', value: r.question },
        { from: 'gpt', value: r.answer },
      ]),
      category: 'code-explanation',
      tags: ['code-explanation', 'summarized'],
      metadata: {
        sourceFile: file,
        recordCount: fileRecords.length,
        averageConfidence: fileRecords.reduce((sum, r) => sum + r.metadata.confidence, 0) / fileRecords.length,
      },
    };

    trainingExamples.push(JSON.stringify(example));
  }

  return trainingExamples.join('\n');
}