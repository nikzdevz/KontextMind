import { readFileSync, existsSync } from 'fs';
import { join, dirname, relative, basename } from 'path';
import type {
  FileSummary,
  FunctionSummary,
  ModuleSummary,
  APISummary,
  DecisionSummary,
  BlockerSummary,
  SymbolSummary,
  BlockerInfo,
  SummarizeOptions,
  SummarizeResult
} from './summary-types.js';
import { loadFileIndex, loadSymbolIndex, type FileIndex, type FileRecord, type SymbolRecord } from '../scanner/index.js';
import { loadDependencyIndex, type DependencyIndex } from '../parser/index.js';
import { createProviderFromConfig, type ModelProvider } from '../providers/provider-registry.js';
import { type ProviderConfig } from '../providers/provider-types.js';
import {
  saveFileSummary,
  loadFileSummary,
  saveFunctionSummary,
  loadFunctionSummary,
  saveModuleSummary,
  loadModuleSummary,
  saveAPISummary,
  loadAPISummary,
  saveDecisionSummary,
  loadDecisionSummary,
  saveBlockerSummary,
  SUMMARIES_DIR,
  getAllFileSummaries,
  getAllFunctionSummaries,
  getAllModuleSummaries,
  getAllAPISummaries,
  getAllDecisionSummaries,
  getAllBlockerSummaries,
  calculateSummaryStats,
  markSummaryStale,
} from './summary-storage.js';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { writeFileSafe } from '../filesystem/write-file-safe.js';

const LOG_FILE = '.logs/summary-generation.log';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export interface SummarizerOptions extends SummarizeOptions {
  projectRoot: string;
  projectName: string;
  providerConfig?: ProviderConfig;
}

// Error class for missing provider
export class NoProviderError extends Error {
  constructor(message: string = 'No LLM provider configured. Please configure a provider globally or locally.') {
    super(message);
    this.name = 'NoProviderError';
  }
}

/**
 * Check if a valid LLM provider is configured
 */
export function validateProvider(providerConfig?: ProviderConfig): ModelProvider | null {
  if (!providerConfig) {
    return null;
  }

  const provider = createProviderFromConfig(providerConfig);
  if (!provider) {
    return null;
  }

  // Check if it's mock (no real provider)
  if (provider.getName() === 'mock') {
    return null;
  }

  return provider;
}

export async function summarizeProject(options: SummarizerOptions): Promise<SummarizeResult> {
  const startTime = Date.now();
  const {
    projectRoot,
    projectName,
    providerConfig,
    maxFiles = 50,
    maxFunctions = 100,
    maxModules = 20,
    maxAPIs = 50,
    maxDecisions = 20,
    changedOnly = false,
    dryRun = false,
    includeBlockers = true,
    skipOnNoProvider = false,
  } = options;

  // Initialize result counters
  const result = {
    summariesGenerated: 0,
    summariesUpdated: 0,
    summariesFailed: 0,
    byType: {
      files: 0,
      functions: 0,
      modules: 0,
      apis: 0,
      decisions: 0,
      blockers: 0,
    },
    totalCost: 0,
    durationMs: 0,
    errors: [] as string[],
    warnings: [] as string[],
    skipped: false,
    reason: undefined as string | undefined,
  };

  // Validate provider
  const provider = validateProvider(providerConfig);

  if (!provider) {
    const errorMsg = 'No LLM provider configured. Cannot generate summaries.\n' +
      'Please configure a provider:\n' +
      '  - Globally: kontextmind config add --name <name> --type openai-compatible --baseUrl <url> --apiKey <key> --global\n' +
      '  - Then set: kontextmind config set --name <name> --global';

    if (skipOnNoProvider) {
      return {
        ...result,
        skipped: true,
        reason: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }

    throw new NoProviderError(errorMsg);
  }

  const model = options.model || providerConfig?.model || 'gpt-4';

  // Load file index
  const fileIndex = loadFileIndex(projectRoot);
  if (!fileIndex) {
    return {
      ...result,
      errors: ['No file index found. Run "kontextmind scan" first.'],
      durationMs: Date.now() - startTime,
    };
  }

  // Load symbol and dependency indexes
  const symbolIndex = loadSymbolIndex(projectRoot);
  const dependencyIndex = loadDependencyIndex(projectRoot);

  // Ensure all summary directories exist
  if (!dryRun) {
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'files'));
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'functions'));
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'modules'));
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'api'));
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'decisions'));
    ensureDir(join(projectRoot, SUMMARIES_DIR, 'blockers'));
  }

  // Log start
  await logSummaryEvent(projectRoot, `Starting summarization with provider: ${provider.getName()}`);

  // ==================== 1. Generate File Summaries ====================
  const filesToSummarize = getFilesToSummarize(projectRoot, fileIndex, changedOnly);
  const limitedFiles = filesToSummarize.slice(0, maxFiles);

  for (const fileRecord of limitedFiles) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would summarize file: ${fileRecord.path}`);
        continue;
      }

      const existingSummary = loadFileSummary(projectRoot, fileRecord.path);
      if (existingSummary && existingSummary.summaryStatus === 'fresh' && existingSummary.hash === fileRecord.hash) {
        continue;
      }

      const summary = await generateFileSummary(
        projectRoot,
        fileRecord,
        symbolIndex,
        provider,
        model,
        includeBlockers ? dependencyIndex : undefined
      );

      if (summary) {
        saveFileSummary(projectRoot, summary);
        result.summariesGenerated++;
        result.byType.files++;
        result.totalCost += summary.cost?.total || 0;
        await logSummaryEvent(projectRoot, `Generated file summary: ${fileRecord.path}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to summarize file ${fileRecord.path}: ${message}`);
      result.summariesFailed++;
    }
  }

  // ==================== 2. Generate Function Summaries ====================
  const functionsToSummarize = getFunctionsToSummarize(symbolIndex, projectRoot);
  const limitedFunctions = functionsToSummarize.slice(0, maxFunctions);

  for (const symbol of limitedFunctions) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would summarize function: ${symbol.name}`);
        continue;
      }

      const existingSummary = loadFunctionSummary(projectRoot, symbol.id);
      if (existingSummary && existingSummary.summaryStatus === 'fresh') {
        continue;
      }

      const summary = await generateFunctionSummary(
        projectRoot,
        symbol,
        symbolIndex,
        provider,
        model,
        includeBlockers ? dependencyIndex : undefined
      );

      if (summary) {
        saveFunctionSummary(projectRoot, summary);
        result.summariesGenerated++;
        result.byType.functions++;
        result.totalCost += summary.cost?.total || 0;
        await logSummaryEvent(projectRoot, `Generated function summary: ${symbol.name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to summarize function ${symbol.name}: ${message}`);
      result.summariesFailed++;
    }
  }

  // ==================== 3. Generate Module Summaries ====================
  const modulesToSummarize = getModulesToSummarize(fileIndex, projectRoot);
  const limitedModules = modulesToSummarize.slice(0, maxModules);

  for (const dirPath of limitedModules) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would summarize module: ${dirPath}`);
        continue;
      }

      const existingSummary = loadModuleSummary(projectRoot, dirPath);
      if (existingSummary && existingSummary.summaryStatus === 'fresh') {
        continue;
      }

      const summary = await generateModuleSummary(
        projectRoot,
        dirPath,
        fileIndex,
        symbolIndex,
        provider,
        model
      );

      if (summary) {
        saveModuleSummary(projectRoot, summary);
        result.summariesGenerated++;
        result.byType.modules++;
        result.totalCost += summary.cost?.total || 0;
        await logSummaryEvent(projectRoot, `Generated module summary: ${dirPath}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to summarize module ${dirPath}: ${message}`);
      result.summariesFailed++;
    }
  }

  // ==================== 4. Generate API Summaries ====================
  const apisToSummarize = getAPIsToSummarize(symbolIndex, projectRoot);
  const limitedAPIs = apisToSummarize.slice(0, maxAPIs);

  for (const apiEndpoint of limitedAPIs) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would summarize API: ${apiEndpoint.name}`);
        continue;
      }

      const existingSummary = loadAPISummary(projectRoot, apiEndpoint.id);
      if (existingSummary && existingSummary.summaryStatus === 'fresh') {
        continue;
      }

      const summary = await generateAPISummary(
        projectRoot,
        apiEndpoint,
        symbolIndex,
        provider,
        model
      );

      if (summary) {
        saveAPISummary(projectRoot, summary);
        result.summariesGenerated++;
        result.byType.apis++;
        result.totalCost += summary.cost?.total || 0;
        await logSummaryEvent(projectRoot, `Generated API summary: ${apiEndpoint.name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to summarize API ${apiEndpoint.name}: ${message}`);
      result.summariesFailed++;
    }
  }

  // ==================== 5. Generate Decision Summaries ====================
  const decisionsToSummarize = getDecisionsToSummarize(symbolIndex, projectRoot);
  const limitedDecisions = decisionsToSummarize.slice(0, maxDecisions);

  for (const decision of limitedDecisions) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would summarize decision: ${decision.name}`);
        continue;
      }

      const existingSummary = loadDecisionSummary(projectRoot, decision.id);
      if (existingSummary && existingSummary.summaryStatus === 'fresh') {
        continue;
      }

      const summary = await generateDecisionSummary(
        projectRoot,
        decision,
        symbolIndex,
        provider,
        model
      );

      if (summary) {
        saveDecisionSummary(projectRoot, summary);
        result.summariesGenerated++;
        result.byType.decisions++;
        result.totalCost += summary.cost?.total || 0;
        await logSummaryEvent(projectRoot, `Generated decision summary: ${decision.name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to summarize decision ${decision.name}: ${message}`);
      result.summariesFailed++;
    }
  }

  // ==================== 6. Generate Blocker Summaries ====================
  if (includeBlockers) {
    const blockers = detectBlockers(fileIndex, symbolIndex, dependencyIndex, projectRoot);

    for (const blocker of blockers) {
      try {
        if (dryRun) {
          console.log(`[DRY RUN] Would summarize blocker: ${blocker.sourceSymbol} -> ${blocker.targetSymbol}`);
          continue;
        }

        const blockerSummary = await generateBlockerSummary(
          projectRoot,
          blocker,
          provider,
          model
        );

        if (blockerSummary) {
          saveBlockerSummary(projectRoot, blockerSummary);
          result.summariesGenerated++;
          result.byType.blockers++;
          await logSummaryEvent(projectRoot, `Generated blocker summary: ${blocker.sourceSymbol}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to summarize blocker: ${message}`);
      }
    }
  }

  // Log completion
  await logSummaryEvent(projectRoot, `Summarization complete: ${result.summariesGenerated} generated, ${result.summariesFailed} failed`);

  return {
    ...result,
    durationMs: Date.now() - startTime,
    dryRun,
  };
}

// ==================== File Summary Generator ====================

async function generateFileSummary(
  projectRoot: string,
  file: FileRecord,
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  provider: ModelProvider,
  model: string,
  dependencyIndex?: DependencyIndex | null
): Promise<FileSummary | null> {
  const filePath = join(projectRoot, file.path);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const now = new Date().toISOString();

  // Build symbols list with blockers
  const symbols: SymbolSummary[] = [];
  const fileSymbols = symbolIndex?.symbols.filter(s => s.filePath === file.path) || [];

  for (const symbol of fileSymbols.slice(0, 20)) {
    const symbolBlockers = dependencyIndex
      ? getBlockersForSymbol(symbol.id, dependencyIndex)
      : [];

    symbols.push({
      name: symbol.name,
      kind: symbol.kind as SymbolSummary['kind'],
      summary: `Symbol ${symbol.name} of kind ${symbol.kind}.`,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      blockedBy: symbolBlockers.length > 0 ? symbolBlockers : undefined,
    });
  }

  // Build dependencies list
  const dependencies: string[] = [];
  const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
  if (importMatches) {
    for (const match of importMatches) {
      const depMatch = match.match(/from\s+['"]([^'"]+)['"]/);
      if (depMatch) {
        dependencies.push(depMatch[1]);
      }
    }
  }

  // Detect blockers for this file
  const fileBlockers = dependencyIndex
    ? getBlockersForFile(file.path, dependencyIndex)
    : [];

  // Generate purpose using LLM
  const prompt = buildFileSummaryPrompt(file, content, symbols, dependencies);
  const result = await provider.generateText({ prompt, model });

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
    confidence: provider.getName() === 'mock' ? 0.5 : 0.85,
    cost,
    purpose: result.text || 'Summary generation failed.',
    symbols,
    dependencies,
    blockedBy: fileBlockers.length > 0 ? fileBlockers : undefined,
    relatedFiles: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildFileSummaryPrompt(
  file: FileRecord,
  content: string,
  symbols: SymbolSummary[],
  dependencies: string[],
): string {
  const lines = content.split('\n').slice(0, 100).join('\n');
  const symbolList = symbols.map(s => `  - ${s.kind} ${s.name} (lines ${s.startLine}-${s.endLine})`).join('\n');
  const depList = dependencies.join(', ') || 'none';
  const blockerList = symbols
    .filter(s => s.blockedBy && s.blockedBy.length > 0)
    .map(s => `  - ${s.name} blocked by: ${s.blockedBy?.map(b => b.name).join(', ')}`)
    .join('\n');

  return `Summarize the following file in 2-3 sentences. Include what the file does, its key exports, and any important dependencies.

File: ${file.path}
Language: ${file.language || 'unknown'}
Size: ${file.size_bytes} bytes

Exported Symbols:
${symbolList || '  (none detected)'}

Dependencies: ${depList}

${blockerList ? `Blockers (things that depend on this):\n${blockerList}` : ''}

First 100 lines:
${lines}

Purpose:`;
}

// ==================== Function Summary Generator ====================

interface FunctionSymbol {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

async function generateFunctionSummary(
  projectRoot: string,
  symbol: FunctionSymbol,
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  provider: ModelProvider,
  model: string,
  dependencyIndex?: DependencyIndex | null
): Promise<FunctionSummary | null> {
  const filePath = join(projectRoot, symbol.filePath);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const functionBody = lines.slice(symbol.startLine - 1, symbol.endLine).join('\n');
  const now = new Date().toISOString();

  // Extract function signature
  const signature = extractFunctionSignature(functionBody, symbol.name);

  // Detect parameters and return type
  const params = extractParameters(signature);
  const returnType = extractReturnType(signature);

  // Get blockers for this function
  const symbolBlockers = dependencyIndex
    ? getBlockersForSymbol(symbol.id, dependencyIndex)
    : [];

  // Calculate complexity (simple metric)
  const complexity = calculateComplexity(functionBody);

  // Generate summary
  const prompt = buildFunctionSummaryPrompt(symbol, signature, functionBody, params, returnType, symbolBlockers);
  const result = await provider.generateText({ prompt, model });

  const cost = result.usage ? {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    total: result.usage.totalTokens,
  } : undefined;

  return {
    targetType: 'function',
    symbolId: symbol.id,
    symbolName: symbol.name,
    filePath: symbol.filePath,
    hash: hashString(`${symbol.filePath}:${symbol.startLine}:${symbol.endLine}`),
    summaryStatus: 'fresh',
    provider: provider.getName(),
    model,
    summary: result.text || 'Summary generation failed.',
    signature,
    purpose: result.text || 'Summary generation failed.',
    parameters: params,
    returnType,
    blockedBy: symbolBlockers.length > 0 ? symbolBlockers : undefined,
    complexity,
    createdAt: now,
    updatedAt: now,
  };
}

function buildFunctionSummaryPrompt(
  symbol: FunctionSymbol,
  signature: string,
  body: string,
  params: string[],
  returnType: string | undefined,
  blockers: BlockerInfo[]
): string {
  const blockerInfo = blockers.length > 0
    ? `Blocked by: ${blockers.map(b => `${b.name} (${b.reason})`).join(', ')}`
    : 'No blockers detected.';

  return `Summarize this function in 2-3 sentences. Explain what it does, its purpose, and any notable characteristics.

Function: ${symbol.name}
File: ${symbol.filePath}
Lines: ${symbol.startLine}-${symbol.endLine}

Signature: ${signature}
Parameters: ${params.join(', ') || 'none'}
Return Type: ${returnType || 'unknown'}
${blockerInfo}

Code:
${body.slice(0, 2000)}

Purpose:`;
}

function extractFunctionSignature(body: string, functionName: string): string {
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.includes(functionName) && (line.includes('function') || line.includes('const ') || line.includes('async '))) {
      // Extract up to the opening brace or equals
      const match = line.match(/(?:function\s+)?(?:\w+\s+)?(?:\*)?\s*(\w+)\s*\([^)]*\)[^=]*(?:=>)?/);
      if (match) {
        return match[0].split('{')[0].trim();
      }
      return line.split('{')[0].trim();
    }
  }
  return functionName;
}

function extractParameters(signature: string): string[] {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

function extractReturnType(signature: string): string | undefined {
  const match = signature.match(/:\s*([^=>\s]+)/);
  return match ? match[1] : undefined;
}

function calculateComplexity(body: string): number {
  let complexity = 1;
  const patterns = [
    /if\s*\(/g,
    /else\s+if/g,
    /for\s*\(/g,
    /while\s*\(/g,
    /case\s+/g,
    /\?\s*[^:]+:/g,
    /catch\s*\(/g,
  ];

  for (const pattern of patterns) {
    const matches = body.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return Math.min(complexity, 10);
}

// ==================== Module Summary Generator ====================

async function generateModuleSummary(
  projectRoot: string,
  dirPath: string,
  fileIndex: FileIndex,
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  provider: ModelProvider,
  model: string
): Promise<ModuleSummary | null> {
  const now = new Date().toISOString();

  // Get files in this module
  const moduleFiles = fileIndex.files.filter(f => {
    const fileDir = f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : '';
    return fileDir === dirPath || f.path.startsWith(dirPath + '/');
  });

  // Get symbols in this module
  const moduleSymbols = symbolIndex?.symbols.filter(s => {
    const symbolDir = s.filePath.includes('/') ? s.filePath.split('/').slice(0, -1).join('/') : '';
    return symbolDir === dirPath || s.filePath.startsWith(dirPath + '/');
  }) || [];

  // Get key files (main entry points)
  const keyFiles = moduleFiles
    .filter(f => f.path.match(/index\.|main\.|exports?\./))
    .map(f => f.path);

  // Get exported symbols
  const exportedSymbols = moduleSymbols
    .filter(s => s.name.startsWith('export'))
    .map(s => s.name.replace('export ', ''))
    .slice(0, 20);

  // Get imports/exports
  const imports = new Set<string>();
  const exports = new Set<string>();

  for (const file of moduleFiles.slice(0, 10)) {
    const filePath = join(projectRoot, file.path);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
      if (importMatches) {
        for (const match of importMatches) {
          const m = match.match(/from\s+['"]([^'"]+)['"]/);
          if (m) imports.add(m[1]);
        }
      }
      const exportMatches = content.match(/export\s+(?:default\s+)?(?:const|function|class|type|interface)\s+(\w+)/g);
      if (exportMatches) {
        for (const match of exportMatches) {
          const m = match.match(/export\s+(?:default\s+)?(?:const|function|class|type|interface)\s+(\w+)/);
          if (m) exports.add(m[1]);
        }
      }
    }
  }

  // Build content for summarization
  const summaryContent = `Module: ${dirPath}
Files: ${moduleFiles.length}
Exports: ${Array.from(exports).slice(0, 15).join(', ') || 'none'}
Imports: ${Array.from(imports).slice(0, 15).join(', ') || 'none'}
Key Symbols: ${exportedSymbols.slice(0, 10).join(', ') || 'none'}
`;

  const prompt = buildModuleSummaryPrompt(dirPath, moduleFiles, exportedSymbols, Array.from(imports), Array.from(exports));
  const result = await provider.generateText({ prompt, model });

  const cost = result.usage ? {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    total: result.usage.totalTokens,
  } : undefined;

  return {
    targetType: 'module',
    directoryPath: dirPath,
    fileCount: moduleFiles.length,
    summaryStatus: 'fresh',
    provider: provider.getName(),
    model,
    summary: result.text || 'Summary generation failed.',
    keyFiles,
    exportedSymbols,
    imports: Array.from(imports).slice(0, 20),
    exports: Array.from(exports).slice(0, 20),
    createdAt: now,
    updatedAt: now,
  };
}

function buildModuleSummaryPrompt(
  dirPath: string,
  files: FileRecord[],
  exports: string[],
  imports: string[],
  moduleExports: string[]
): string {
  const fileList = files.slice(0, 20).map(f => `  - ${f.path} (${f.language})`).join('\n');

  return `Summarize this module/directory in 2-3 sentences. Explain what this module provides, its purpose, and how it fits into the project structure.

Module: ${dirPath}
File Count: ${files.length}

Files:
${fileList}

Exported Symbols: ${exports.join(', ') || 'none'}
External Imports: ${imports.slice(0, 15).join(', ') || 'none'}
Module Exports: ${moduleExports.slice(0, 15).join(', ') || 'none'}

Summary:`;
}

// ==================== API Summary Generator ====================

interface APIEndpoint {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  method?: string;
  path?: string;
}

async function generateAPISummary(
  projectRoot: string,
  api: APIEndpoint,
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  provider: ModelProvider,
  model: string
): Promise<APISummary | null> {
  const filePath = join(projectRoot, api.filePath);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const apiBody = lines.slice(Math.max(0, api.startLine - 1), api.endLine).join('\n');
  const now = new Date().toISOString();

  // Detect HTTP method
  const method = api.method || detectHTTPMethod(api.name, apiBody);

  // Detect path
  const path = api.path || detectHTTPPath(api.name, apiBody) || api.name;

  // Extract parameters
  const parameters = extractAPIParameters(apiBody);

  // Detect response type
  const responseType = detectResponseType(apiBody);

  const prompt = buildAPISummaryPrompt(api, method, path, apiBody, parameters, responseType);
  const result = await provider.generateText({ prompt, model });

  const cost = result.usage ? {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    total: result.usage.totalTokens,
  } : undefined;

  return {
    targetType: 'api',
    endpoint: api.id,
    method,
    filePath: api.filePath,
    hash: '', // TODO: calculate hash
    summaryStatus: 'fresh',
    provider: provider.getName(),
    model,
    summary: result.text || 'Summary generation failed.',
    description: result.text || 'Summary generation failed.',
    parameters,
    responseType,
    createdAt: now,
    updatedAt: now,
  };
}

function buildAPISummaryPrompt(
  api: APIEndpoint,
  method: string,
  path: string,
  body: string,
  parameters: { name: string; type: string; required: boolean; description?: string }[],
  responseType: string | undefined
): string {
  const paramList = parameters.map(p => `  - ${p.name}: ${p.type}${p.required ? ' (required)' : ' (optional)'}`).join('\n');

  return `Summarize this API endpoint in 2-3 sentences. Explain what it does, its purpose, and any important constraints.

Endpoint: ${api.name}
File: ${api.filePath}
HTTP Method: ${method}
Path: ${path}

Parameters:
${paramList || '  (none detected)'}

Response Type: ${responseType || 'unknown'}

Code:
${body.slice(0, 1500)}

Summary:`;
}

function detectHTTPMethod(name: string, body: string): string {
  const upperName = name.toUpperCase();
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  for (const method of methods) {
    if (upperName.includes(method)) {
      return method;
    }
  }

  // Try to detect from code patterns
  if (body.includes('.get(') || body.includes("['get']")) return 'GET';
  if (body.includes('.post(') || body.includes("['post']")) return 'POST';
  if (body.includes('.put(') || body.includes("['put']")) return 'PUT';
  if (body.includes('.delete(') || body.includes("['delete']")) return 'DELETE';

  return 'GET'; // default
}

function detectHTTPPath(name: string, body: string): string | undefined {
  // Try to extract from decorator or route config
  const decoratorMatch = body.match(/@(?:Get|Post|Put|Delete|Patch|Options)\(['"]([^'"]+)['"]/);
  if (decoratorMatch) {
    return decoratorMatch[1];
  }

  // Try router pattern
  const routerMatch = body.match(/router\.(?:get|post|put|delete|patch)\(['"]([^'"]+)['"]/);
  if (routerMatch) {
    return routerMatch[1];
  }

  return undefined;
}

function extractAPIParameters(body: string): { name: string; type: string; required: boolean; description?: string }[] {
  const params: { name: string; type: string; required: boolean; description?: string }[] = [];

  // Try to extract from function parameters
  const paramMatch = body.match(/function\s*\([^)]*\)|(?:\(|async\s*\()([^)]*)\)/);
  if (paramMatch && paramMatch[1]) {
    const paramStr = paramMatch[1];
    const paramParts = paramStr.split(',');
    for (const part of paramParts) {
      const cleanPart = part.trim();
      const typeMatch = cleanPart.match(/(\w+)(?:\??:\s*)([\w[\]|]+)/);
      if (typeMatch) {
        params.push({
          name: typeMatch[1],
          type: typeMatch[2],
          required: !cleanPart.includes('?'),
        });
      }
    }
  }

  return params;
}

function detectResponseType(body: string): string | undefined {
  // Try to detect from return type
  const returnMatch = body.match(/:\s*([A-Z]\w*(?:<[^>]+>)?)\s*(?:\{|$|=>)/);
  if (returnMatch) {
    return returnMatch[1];
  }

  // Try Promise type
  const promiseMatch = body.match(/Promise<([^>]+)>/);
  if (promiseMatch) {
    return `Promise<${promiseMatch[1]}>`;
  }

  return undefined;
}

// ==================== Decision Summary Generator ====================

interface DecisionInfo {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

async function generateDecisionSummary(
  projectRoot: string,
  decision: DecisionInfo,
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  provider: ModelProvider,
  model: string
): Promise<DecisionSummary | null> {
  const filePath = join(projectRoot, decision.filePath);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const decisionBody = lines.slice(Math.max(0, decision.startLine - 1), decision.endLine).join('\n');
  const now = new Date().toISOString();

  const prompt = buildDecisionSummaryPrompt(decision, decisionBody);
  const result = await provider.generateText({ prompt, model });

  // Parse the result to extract decision components
  const lines_result = (result.text || '').split('\n');
  const title = decision.name;
  const context = extractContextFromBody(decisionBody);
  const rationale = extractRationale(result.text || '');
  const alternatives = extractAlternatives(result.text || '');
  const consequences = extractConsequences(result.text || '');

  const cost = result.usage ? {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    total: result.usage.totalTokens,
  } : undefined;

  return {
    targetType: 'decision',
    decisionId: decision.id,
    filePath: decision.filePath,
    hash: '', // TODO: calculate hash
    summaryStatus: 'fresh',
    provider: provider.getName(),
    model,
    summary: result.text || 'Summary generation failed.',
    title,
    context,
    rationale,
    alternatives,
    consequences,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDecisionSummaryPrompt(
  decision: DecisionInfo,
  body: string
): string {
  return `Analyze this code and identify if it represents a significant architectural or design decision. If so, summarize it with:

1. Title: A brief name for this decision
2. Context: Why this decision was made
3. Rationale: The reasoning behind it
4. Alternatives: What other options were considered
5. Consequences: The impact of this decision

Decision: ${decision.name}
File: ${decision.filePath}
Lines: ${decision.startLine}-${decision.endLine}

Code:
${body.slice(0, 2000)}

Analysis (format as structured summary or indicate "Not a significant decision"):`;
}

function extractContextFromBody(body: string): string {
  // Try to extract context from comments
  const commentMatch = body.match(/\/\*\*[\s\S]*?@description\s+([^\n]+)/);
  if (commentMatch) {
    return commentMatch[1].trim();
  }

  // Try JSDoc
  const jsdocMatch = body.match(/<summary>([\s\S]*?)<\/summary>/i);
  if (jsdocMatch) {
    return jsdocMatch[1].trim();
  }

  return body.split('\n').slice(0, 5).join(' ').substring(0, 500);
}

function extractRationale(text: string): string {
  const rationaleMatch = text.match(/rationale:?\s*([^\n]+(?:(?:\n(?!\w+:))[^\n]+)*)/i);
  if (rationaleMatch) {
    return rationaleMatch[1].trim();
  }
  return text.substring(0, 500);
}

function extractAlternatives(text: string): string[] {
  const altMatch = text.match(/alternatives:?\s*([^\n]+(?:(?:\n(?!\w+:))[^\n]+)*)/i);
  if (altMatch) {
    return altMatch[1].split(/[,;]/).map(a => a.trim()).filter(a => a.length > 0);
  }
  return [];
}

function extractConsequences(text: string): string[] {
  const consMatch = text.match(/consequences?:?\s*([^\n]+(?:(?:\n(?!\w+:))[^\n]+)*)/i);
  if (consMatch) {
    return consMatch[1].split(/[,;]/).map(c => c.trim()).filter(c => c.length > 0);
  }
  return [];
}

// ==================== Blocker Summary Generator ====================

interface Blocker {
  sourceSymbol: string;
  targetSymbol: string;
  reason: string;
  severity: 'blocking' | 'degraded' | 'warning';
  sourceFile: string;
  targetFile?: string;
  line?: number;
}

async function generateBlockerSummary(
  projectRoot: string,
  blocker: Blocker,
  provider: ModelProvider,
  model: string
): Promise<BlockerSummary | null> {
  const now = new Date().toISOString();

  const prompt = `Analyze this dependency blocker and provide resolution suggestions.

Blocker: ${blocker.sourceSymbol} blocks ${blocker.targetSymbol}
Reason: ${blocker.reason}
Severity: ${blocker.severity}
Source: ${blocker.sourceFile}${blocker.line ? `:${blocker.line}` : ''}

Provide:
1. Why this is a blocker
2. How to resolve it
3. Any workarounds

Analysis:`;

  const result = await provider.generateText({ prompt, model });

  return {
    targetType: 'blocker',
    blockerId: `${blocker.sourceSymbol}__${blocker.targetSymbol}`.replace(/\s+/g, '_'),
    sourceSymbol: blocker.sourceSymbol,
    targetSymbol: blocker.targetSymbol,
    reason: blocker.reason,
    severity: blocker.severity,
    filePath: blocker.sourceFile,
    line: blocker.line,
    resolution: result.text || 'No resolution provided.',
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== Helper Functions ====================

function getFilesToSummarize(
  projectRoot: string,
  fileIndex: FileIndex,
  changedOnly: boolean,
): FileRecord[] {
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cs'];

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

function getFunctionsToSummarize(
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  projectRoot: string
): FunctionSymbol[] {
  if (!symbolIndex) {
    return [];
  }

  const functions = symbolIndex.symbols
    .filter(s => ['function', 'method', 'constructor'].includes(s.kind.toLowerCase()))
    .map(s => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      filePath: s.filePath,
      startLine: s.startLine,
      endLine: s.endLine,
    }));

  // Filter out already fresh summaries
  return functions.filter(f => {
    const summary = loadFunctionSummary(projectRoot, f.id);
    return !summary || summary.summaryStatus !== 'fresh';
  });
}

function getModulesToSummarize(
  fileIndex: FileIndex,
  projectRoot: string
): string[] {
  const moduleDirs = new Set<string>();

  for (const file of fileIndex.files) {
    const parts = file.path.split('/');
    if (parts.length > 1) {
      // Get parent directories that might be modules
      for (let i = 1; i < parts.length - 1; i++) {
        const dir = parts.slice(0, i + 1).join('/');
        moduleDirs.add(dir);
      }
    }
  }

  // Filter out already fresh modules
  return Array.from(moduleDirs).filter(dir => {
    const summary = loadModuleSummary(projectRoot, dir);
    return !summary || summary.summaryStatus !== 'fresh';
  });
}

function getAPIsToSummarize(
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  projectRoot: string
): APIEndpoint[] {
  if (!symbolIndex) {
    return [];
  }

  const apiPatterns = [
    /handler/i,
    /controller/i,
    /route/i,
    /endpoint/i,
    /api/i,
    /http/i,
    /request/i,
    /response/i,
  ];

  const apis = symbolIndex.symbols
    .filter(s => {
      const name = s.name.toLowerCase();
      return apiPatterns.some(p => p.test(name)) || s.kind.toLowerCase().includes('function');
    })
    .map(s => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      filePath: s.filePath,
      startLine: s.startLine,
      endLine: s.endLine,
    }));

  // Filter out already fresh APIs
  return apis.filter(api => {
    const summary = loadAPISummary(projectRoot, api.id);
    return !summary || summary.summaryStatus !== 'fresh';
  });
}

function getDecisionsToSummarize(
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  projectRoot: string
): DecisionInfo[] {
  if (!symbolIndex) {
    return [];
  }

  const decisionPatterns = [
    /strategy/i,
    /policy/i,
    /decision/i,
    /rule/i,
    /config/i,
    /constant/i,
    /^adrs?$/i,
    /\.adr\./i,
  ];

  const decisions = symbolIndex.symbols
    .filter(s => {
      const name = s.name.toLowerCase();
      return decisionPatterns.some(p => p.test(name));
    })
    .map(s => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      filePath: s.filePath,
      startLine: s.startLine,
      endLine: s.endLine,
    }));

  // Filter out already fresh decisions
  return decisions.filter(d => {
    const summary = loadDecisionSummary(projectRoot, d.id);
    return !summary || summary.summaryStatus !== 'fresh';
  });
}

function detectBlockers(
  fileIndex: FileIndex,
  symbolIndex: ReturnType<typeof loadSymbolIndex>,
  dependencyIndex: DependencyIndex | null | undefined,
  projectRoot: string
): Blocker[] {
  const blockers: Blocker[] = [];

  if (!dependencyIndex) {
    return blockers;
  }

  // Analyze dependencies to find circular dependencies or heavy coupling
  const dependencyMap = new Map<string, Set<string>>();

  for (const dep of dependencyIndex.dependencies || []) {
    if (!dependencyMap.has(dep.sourceFile)) {
      dependencyMap.set(dep.sourceFile, new Set());
    }
    dependencyMap.get(dep.sourceFile)!.add(dep.target);
  }

  // Find potential circular dependencies
  for (const [from, deps] of dependencyMap.entries()) {
    for (const to of deps) {
      const reverseDeps = dependencyMap.get(to);
      if (reverseDeps && reverseDeps.has(from)) {
        blockers.push({
          sourceSymbol: from,
          targetSymbol: to,
          reason: 'Circular dependency detected',
          severity: 'blocking',
          sourceFile: from.split('::')[0] || from,
        });
      }
    }
  }

  // Find files with many dependencies (potential bottleneck)
  for (const file of fileIndex.files) {
    const deps = dependencyMap.get(file.path);
    if (deps && deps.size > 10) {
      blockers.push({
        sourceSymbol: file.path,
        targetSymbol: 'Multiple dependencies',
        reason: `File has ${deps.size} dependencies - potential bottleneck`,
        severity: deps.size > 20 ? 'blocking' : 'degraded',
        sourceFile: file.path,
      });
    }
  }

  return blockers;
}

function getBlockersForSymbol(symbolId: string, dependencyIndex: DependencyIndex): BlockerInfo[] {
  const blockers: BlockerInfo[] = [];

  if (!dependencyIndex?.dependencies) {
    return blockers;
  }

  // Find what depends on this symbol
  for (const dep of dependencyIndex.dependencies) {
    if (dep.target === symbolId || dep.target.includes(symbolId)) {
      blockers.push({
        name: dep.sourceFile.split('::').pop() || dep.sourceFile,
        kind: 'dependency',
        filePath: dep.sourceFile.split('::')[0] || dep.sourceFile,
        reason: `Depends on ${symbolId}`,
        severity: 'warning',
      });
    }
  }

  return blockers;
}

function getBlockersForFile(filePath: string, dependencyIndex: DependencyIndex): BlockerInfo[] {
  const blockers: BlockerInfo[] = [];

  if (!dependencyIndex?.dependencies) {
    return blockers;
  }

  // Find what depends on this file
  for (const dep of dependencyIndex.dependencies) {
    if (dep.target.startsWith(filePath) || dep.sourceFile.startsWith(filePath + '/')) {
      blockers.push({
        name: dep.sourceFile.split('::').pop() || dep.sourceFile,
        kind: 'dependency',
        filePath: dep.sourceFile.split('::')[0] || dep.sourceFile,
        reason: `Depends on this module`,
        severity: 'warning',
      });
    }
  }

  return blockers;
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
  moduleCount: number;
  apiCount: number;
  decisionCount: number;
  blockerCount: number;
  stats: ReturnType<typeof calculateSummaryStats>;
} {
  const stats = calculateSummaryStats(projectRoot);

  return {
    hasSummaries: stats.total > 0,
    fileCount: stats.byType?.files || 0,
    functionCount: stats.byType?.functions || 0,
    moduleCount: stats.byType?.modules || 0,
    apiCount: stats.byType?.apis || 0,
    decisionCount: stats.byType?.decisions || 0,
    blockerCount: 0, // TODO: count blockers
    stats,
  };
}

// Re-export for index
export type { FileSummary, FunctionSummary, ModuleSummary, APISummary, DecisionSummary, BlockerSummary } from './summary-types.js';