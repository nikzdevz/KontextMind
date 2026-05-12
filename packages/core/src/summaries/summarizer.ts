import { readFileSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import type { FileSummary, FunctionSummary, SymbolSummary, SummarizeOptions, SummarizeResult, SummaryStats } from './summary-types.js';
import { loadFileIndex, loadSymbolIndex, type FileIndex, type FileRecord } from '../scanner/index.js';
import { createProviderFromConfig, type ModelProvider } from '../providers/provider-registry.js';
import { type ProviderConfig } from '../providers/provider-types.js';
import { saveFileSummary, loadFileSummary, markSummaryStale, SUMMARIES_DIR, getAllFileSummaries, getAllFunctionSummaries, calculateSummaryStats } from './summary-storage.js';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { writeFileSafe } from '../filesystem/write-file-safe.js';

const LOG_FILE = '.logs/summary-generation.log';

export interface SummarizerOptions extends SummarizeOptions {
  projectRoot: string;
  projectName: string;
  providerConfig?: ProviderConfig;
}

export async function summarizeProject(options: SummarizerOptions): Promise<SummarizeResult> {
  const startTime = Date.now();
  const {
    projectRoot,
    projectName,
    providerConfig = { name: 'mock', provider: 'mock' },
    maxFiles = 50,
    changedOnly = false,
    dryRun = false,
    includeSymbols = true,
  } = options;

  const errors: string[] = [];
  let summariesGenerated = 0;
  let summariesUpdated = 0;
  let summariesFailed = 0;
  let totalCost = 0;

  // Create provider
  const provider = createProviderFromConfig(providerConfig);
  if (!provider) {
    return {
      summariesGenerated: 0,
      summariesUpdated: 0,
      summariesFailed: 0,
      totalCost: 0,
      durationMs: Date.now() - startTime,
      errors: ['No provider available. Configure a provider in .kontextmind/config.json'],
    };
  }
  const model = options.model || 'gpt-3.5-turbo';

  // Load file index
  const fileIndex = loadFileIndex(projectRoot);
  if (!fileIndex) {
    return {
      summariesGenerated: 0,
      summariesUpdated: 0,
      summariesFailed: 0,
      totalCost: 0,
      durationMs: Date.now() - startTime,
      errors: ['No file index found. Run "kontextmind scan" first.'],
    };
  }

  // Load symbol index
  const symbolIndex = loadSymbolIndex(projectRoot);

  // Ensure summaries directory exists
  if (!dryRun) {
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'files'));
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'functions'));
  }

  // Get files to summarize
  const filesToSummarize = getFilesToSummarize(projectRoot, fileIndex, changedOnly);
  const limitedFiles = filesToSummarize.slice(0, maxFiles);

  // Log start
  await logSummaryEvent(projectRoot, `Starting summarization: ${limitedFiles.length} files`);

  // Process files
  for (const fileRecord of limitedFiles) {
    try {
      const existingSummary = loadFileSummary(projectRoot, fileRecord.path);
      const shouldGenerate = !existingSummary || existingSummary.summaryStatus !== 'fresh';

      if (dryRun) {
        if (shouldGenerate) {
          console.log(`[DRY RUN] Would summarize: ${fileRecord.path}`);
        }
        continue;
      }

      if (!shouldGenerate) {
        continue;
      }

      // Generate summary
      const summary = await generateFileSummary(projectRoot, fileRecord, symbolIndex, provider, model);

      if (summary) {
        saveFileSummary(projectRoot, summary);
        summariesGenerated++;
        totalCost += summary.cost?.total || 0;

        await logSummaryEvent(projectRoot, `Generated summary: ${fileRecord.path}`);
      } else {
        summariesFailed++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to summarize ${fileRecord.path}: ${message}`);
      summariesFailed++;
    }
  }

  // Mark changed files as stale
  if (!dryRun && changedOnly) {
    for (const summary of getExistingSummaries(projectRoot)) {
      const currentFile = fileIndex.files.find(f => f.path === extractPathFromSummary(summary));
      if (currentFile && summary.hash !== currentFile.hash) {
        markSummaryStale(projectRoot, summary.filePath, currentFile.hash);
      }
    }
  }

  // Log completion
  await logSummaryEvent(projectRoot, `Summarization complete: ${summariesGenerated} generated, ${summariesFailed} failed`);

  return {
    summariesGenerated,
    summariesUpdated,
    summariesFailed,
    totalCost,
    durationMs: Date.now() - startTime,
    errors,
    dryRun,
  };
}

async function generateFileSummary(
  projectRoot: string,
  file: FileRecord,
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  provider: ModelProvider,
  model: string,
): Promise<FileSummary | null> {
  const filePath = join(projectRoot, file.path);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const now = new Date().toISOString();

  // Build symbols list
  const symbols: SymbolSummary[] = [];
  const fileSymbols = symbolIndex?.symbols.filter(s => s.filePath === file.path) || [];

  for (const symbol of fileSymbols.slice(0, 10)) {
    symbols.push({
      name: symbol.name,
      kind: symbol.kind,
      summary: `Symbol ${symbol.name} of kind ${symbol.kind}.`,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
    });
  }

  // Build dependencies list
  const dependencies: string[] = [];
  // Extract imports from content (simplified)
  const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
  if (importMatches) {
    for (const match of importMatches) {
      const depMatch = match.match(/from\s+['"]([^'"]+)['"]/);
      if (depMatch) {
        dependencies.push(depMatch[1]);
      }
    }
  }

  // Generate purpose using mock provider
  const prompt = buildSummaryPrompt(file, content, symbols, dependencies);
  const result = await provider.generateText({ prompt, model });

  // Build cost info if available
  const cost = result.usage ? {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    total: result.usage.totalTokens,
  } : undefined;

  return {
    targetType: 'file',
    filePath: file.path,
    hash: file.hash,
    language: file.language || 'unknown',
    summaryStatus: 'fresh',
    provider: provider.getName(),
    model,
    confidence: provider.getName() === 'mock' ? 0.5 : 0.8,
    cost,
    purpose: result.text,
    symbols,
    dependencies,
    relatedFiles: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildSummaryPrompt(
  file: FileRecord,
  content: string,
  symbols: SymbolSummary[],
  dependencies: string[],
): string {
  const lines = content.split('\n').slice(0, 50).join('\n');
  const symbolList = symbols.map(s => `  - ${s.kind} ${s.name}`).join('\n');
  const depList = dependencies.join(', ') || 'none';

  return `Summarize the following file in 1-2 sentences:

File: ${file.path}
Language: ${file.language || 'unknown'}
Size: ${file.size_bytes} bytes

Functions/Classes:
${symbolList || '  (none detected)'}

Dependencies: ${depList}

First 50 lines:
${lines}

Purpose:`;
}

function getFilesToSummarize(
  projectRoot: string,
  fileIndex: FileIndex,
  changedOnly: boolean,
): FileRecord[] {
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];

  let files = fileIndex.files.filter(f => {
    const ext = f.path.toLowerCase();
    return supportedExtensions.some(e => ext.endsWith(e)) && !f.ignored;
  });

  if (changedOnly) {
    files = files.filter(f => {
      const summary = loadFileSummary(projectRoot, f.path);
      return !summary || summary.summaryStatus !== 'fresh' || summary.hash !== f.hash;
    });
  }

  return files;
}

function getExistingSummaries(projectRoot: string): FileSummary[] {
  // This would load all existing summaries
  // For now, return empty array
  return [];
}

function extractPathFromSummary(summary: FileSummary): string {
  return summary.filePath;
}

async function logSummaryEvent(projectRoot: string, message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  const logPath = join(projectRoot, LOG_FILE);

  try {
    const dirPath = join(projectRoot, '.logs');
    ensureDir(dirPath);

    if (existsSync(logPath)) {
      const existing = readFileSync(logPath, 'utf-8');
      writeFileSafe(logPath, existing + logLine);
    } else {
      writeFileSafe(logPath, logLine);
    }
  } catch {
    // Silently ignore logging errors
  }
}

export function getLastSummarizeTime(projectRoot: string): string | null {
  const logPath = join(projectRoot, LOG_FILE);

  if (!existsSync(logPath)) {
    return null;
  }

  try {
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const lastLine = lines[lines.length - 1];

    const match = lastLine.match(/^\[([^[]+)\]/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function getSummaryStatus(projectRoot: string): {
  hasSummaries: boolean;
  fileCount: number;
  functionCount: number;
  stats: SummaryStats;
} {
  const fileSummaries = getAllFileSummaries(projectRoot);
  const functionSummaries = getAllFunctionSummaries(projectRoot);
  const stats = calculateSummaryStats(projectRoot);

  return {
    hasSummaries: fileSummaries.length > 0 || functionSummaries.length > 0,
    fileCount: fileSummaries.length,
    functionCount: functionSummaries.length,
    stats,
  };
}
