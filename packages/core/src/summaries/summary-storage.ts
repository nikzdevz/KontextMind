import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import type {
  FileSummary,
  FunctionSummary,
  ModuleSummary,
  APISummary,
  DecisionSummary,
  BlockerInfo,
  SummaryStatus,
  SummaryStats
} from './summary-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

// Summary directories
const SUMMARIES_DIR = '.summaries';
const FILES_DIR = 'files';
const FUNCTIONS_DIR = 'functions';
const MODULES_DIR = 'modules';
const API_DIR = 'api';
const DECISIONS_DIR = 'decisions';
const BLOCKERS_DIR = 'blockers';

function getSafeFileName(filePath: string): string {
  return filePath
    .replace(/[/\\:]/g, '__')
    .replace(/\.json$/, '_json');
}

function getSafeSymbolId(symbolId: string): string {
  return symbolId
    .replace(/[/\\:]/g, '__')
    .replace(/\.json$/, '_json');
}

// ==================== File Summaries ====================

export function getFileSummaryPath(projectRoot: string, filePath: string): string {
  const safeName = getSafeFileName(filePath);
  return join(projectRoot, SUMMARIES_DIR, FILES_DIR, safeName + '.json');
}

export function saveFileSummary(projectRoot: string, summary: FileSummary): string {
  const summaryPath = getFileSummaryPath(projectRoot, summary.filePath);
  const dirPath = dirname(summaryPath);

  ensureDir(dirPath);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return summaryPath;
}

export function loadFileSummary(projectRoot: string, filePath: string): FileSummary | null {
  const summaryPath = getFileSummaryPath(projectRoot, filePath);

  if (!existsSync(summaryPath)) {
    return null;
  }

  try {
    const content = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(content) as FileSummary;
  } catch {
    return null;
  }
}

export function getAllFileSummaries(projectRoot: string): FileSummary[] {
  const summaryDir = join(projectRoot, SUMMARIES_DIR, FILES_DIR);
  const summaries: FileSummary[] = [];

  if (!existsSync(summaryDir)) {
    return summaries;
  }

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content) as FileSummary);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return summaries;
}

// ==================== Function Summaries ====================

export function getFunctionSummaryPath(projectRoot: string, symbolId: string): string {
  const safeName = getSafeSymbolId(symbolId);
  return join(projectRoot, SUMMARIES_DIR, FUNCTIONS_DIR, safeName + '.json');
}

export function saveFunctionSummary(projectRoot: string, summary: FunctionSummary): string {
  const summaryPath = getFunctionSummaryPath(projectRoot, summary.symbolId);
  const dirPath = dirname(summaryPath);

  ensureDir(dirPath);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return summaryPath;
}

export function loadFunctionSummary(projectRoot: string, symbolId: string): FunctionSummary | null {
  const summaryPath = getFunctionSummaryPath(projectRoot, symbolId);

  if (!existsSync(summaryPath)) {
    return null;
  }

  try {
    const content = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(content) as FunctionSummary;
  } catch {
    return null;
  }
}

export function getAllFunctionSummaries(projectRoot: string): FunctionSummary[] {
  const summaryDir = join(projectRoot, SUMMARIES_DIR, FUNCTIONS_DIR);
  const summaries: FunctionSummary[] = [];

  if (!existsSync(summaryDir)) {
    return summaries;
  }

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content) as FunctionSummary);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return summaries;
}

// ==================== Module Summaries ====================

export function getModuleSummaryPath(projectRoot: string, dirPath: string): string {
  const safeName = getSafeFileName(dirPath);
  return join(projectRoot, SUMMARIES_DIR, MODULES_DIR, safeName + '.json');
}

export function saveModuleSummary(projectRoot: string, summary: ModuleSummary): string {
  const summaryPath = getModuleSummaryPath(projectRoot, summary.directoryPath);
  const dirPath = dirname(summaryPath);

  ensureDir(dirPath);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return summaryPath;
}

export function loadModuleSummary(projectRoot: string, dirPath: string): ModuleSummary | null {
  const summaryPath = getModuleSummaryPath(projectRoot, dirPath);

  if (!existsSync(summaryPath)) {
    return null;
  }

  try {
    const content = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(content) as ModuleSummary;
  } catch {
    return null;
  }
}

export function getAllModuleSummaries(projectRoot: string): ModuleSummary[] {
  const summaryDir = join(projectRoot, SUMMARIES_DIR, MODULES_DIR);
  const summaries: ModuleSummary[] = [];

  if (!existsSync(summaryDir)) {
    return summaries;
  }

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content) as ModuleSummary);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return summaries;
}

// ==================== API Summaries ====================

export function getAPISummaryPath(projectRoot: string, endpoint: string): string {
  const safeName = getSafeSymbolId(endpoint);
  return join(projectRoot, SUMMARIES_DIR, API_DIR, safeName + '.json');
}

export function saveAPISummary(projectRoot: string, summary: APISummary): string {
  const summaryPath = getAPISummaryPath(projectRoot, summary.endpoint);
  const dirPath = dirname(summaryPath);

  ensureDir(dirPath);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return summaryPath;
}

export function loadAPISummary(projectRoot: string, endpoint: string): APISummary | null {
  const summaryPath = getAPISummaryPath(projectRoot, endpoint);

  if (!existsSync(summaryPath)) {
    return null;
  }

  try {
    const content = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(content) as APISummary;
  } catch {
    return null;
  }
}

export function getAllAPISummaries(projectRoot: string): APISummary[] {
  const summaryDir = join(projectRoot, SUMMARIES_DIR, API_DIR);
  const summaries: APISummary[] = [];

  if (!existsSync(summaryDir)) {
    return summaries;
  }

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content) as APISummary);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return summaries;
}

// ==================== Decision Summaries ====================

export function getDecisionSummaryPath(projectRoot: string, decisionId: string): string {
  const safeName = getSafeSymbolId(decisionId);
  return join(projectRoot, SUMMARIES_DIR, DECISIONS_DIR, safeName + '.json');
}

export function saveDecisionSummary(projectRoot: string, summary: DecisionSummary): string {
  const summaryPath = getDecisionSummaryPath(projectRoot, summary.decisionId);
  const dirPath = dirname(summaryPath);

  ensureDir(dirPath);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return summaryPath;
}

export function loadDecisionSummary(projectRoot: string, decisionId: string): DecisionSummary | null {
  const summaryPath = getDecisionSummaryPath(projectRoot, decisionId);

  if (!existsSync(summaryPath)) {
    return null;
  }

  try {
    const content = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(content) as DecisionSummary;
  } catch {
    return null;
  }
}

export function getAllDecisionSummaries(projectRoot: string): DecisionSummary[] {
  const summaryDir = join(projectRoot, SUMMARIES_DIR, DECISIONS_DIR);
  const summaries: DecisionSummary[] = [];

  if (!existsSync(summaryDir)) {
    return summaries;
  }

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content) as DecisionSummary);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return summaries;
}

// ==================== Blocker Summaries ====================

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

export function getBlockerSummaryPath(projectRoot: string, blockerId: string): string {
  const safeName = getSafeSymbolId(blockerId);
  return join(projectRoot, SUMMARIES_DIR, BLOCKERS_DIR, safeName + '.json');
}

export function saveBlockerSummary(projectRoot: string, summary: BlockerSummary): string {
  const summaryPath = getBlockerSummaryPath(projectRoot, summary.blockerId);
  const dirPath = dirname(summaryPath);

  ensureDir(dirPath);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return summaryPath;
}

export function loadBlockerSummary(projectRoot: string, blockerId: string): BlockerSummary | null {
  const summaryPath = getBlockerSummaryPath(projectRoot, blockerId);

  if (!existsSync(summaryPath)) {
    return null;
  }

  try {
    const content = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(content) as BlockerSummary;
  } catch {
    return null;
  }
}

export function getAllBlockerSummaries(projectRoot: string): BlockerSummary[] {
  const summaryDir = join(projectRoot, SUMMARIES_DIR, BLOCKERS_DIR);
  const summaries: BlockerSummary[] = [];

  if (!existsSync(summaryDir)) {
    return summaries;
  }

  try {
    const files = readdirSync(summaryDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(summaryDir, file), 'utf-8');
          summaries.push(JSON.parse(content) as BlockerSummary);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return summaries;
}

// ==================== Stats and Utilities ====================

export function calculateSummaryStats(projectRoot: string): SummaryStats {
  const fileSummaries = getAllFileSummaries(projectRoot);
  const functionSummaries = getAllFunctionSummaries(projectRoot);
  const moduleSummaries = getAllModuleSummaries(projectRoot);
  const apiSummaries = getAllAPISummaries(projectRoot);
  const decisionSummaries = getAllDecisionSummaries(projectRoot);
  const blockerSummaries = getAllBlockerSummaries(projectRoot);

  const countByStatus = (summaries: Array<{ summaryStatus: SummaryStatus }>) => {
    const counts = { fresh: 0, stale: 0, missing: 0, failed: 0, partial: 0 };
    for (const summary of summaries) {
      const status = summary.summaryStatus;
      if (status in counts) {
        counts[status as SummaryStatus]++;
      }
    }
    return counts;
  };

  const fileStats = countByStatus(fileSummaries);
  const funcStats = countByStatus(functionSummaries);
  const modStats = countByStatus(moduleSummaries);
  const apiStats = countByStatus(apiSummaries);
  const decStats = countByStatus(decisionSummaries);

  return {
    total: fileSummaries.length + functionSummaries.length + moduleSummaries.length + apiSummaries.length + decisionSummaries.length + blockerSummaries.length,
    fresh: fileStats.fresh + funcStats.fresh + modStats.fresh + apiStats.fresh + decStats.fresh,
    stale: fileStats.stale + funcStats.stale + modStats.stale + apiStats.stale + decStats.stale,
    missing: fileStats.missing + funcStats.missing + modStats.missing + apiStats.missing + decStats.missing,
    failed: fileStats.failed + funcStats.failed + modStats.failed + apiStats.failed + decStats.failed,
    partial: fileStats.partial + funcStats.partial + modStats.partial + apiStats.partial + decStats.partial,
    byType: {
      files: fileSummaries.length,
      functions: functionSummaries.length,
      modules: moduleSummaries.length,
      apis: apiSummaries.length,
      decisions: decisionSummaries.length,
    },
  };
}

export function isSummaryStale(summary: { hash?: string; summaryStatus: SummaryStatus }, currentHash?: string): boolean {
  if (!currentHash) {
    return summary.summaryStatus !== 'fresh';
  }
  if (summary.hash && summary.hash === currentHash) {
    return false;
  }
  if (summary.hash && currentHash && summary.hash !== currentHash) {
    return true;
  }
  return summary.summaryStatus !== 'fresh';
}

export function markSummaryStale(projectRoot: string, filePath: string, currentHash: string): boolean {
  const summary = loadFileSummary(projectRoot, filePath);

  if (!summary) {
    return false;
  }

  if (summary.hash !== currentHash) {
    summary.summaryStatus = 'stale';
    summary.updatedAt = new Date().toISOString();
    saveFileSummary(projectRoot, summary);
    return true;
  }

  return false;
}

export function getAllSummaries(projectRoot: string): {
  files: FileSummary[];
  functions: FunctionSummary[];
  modules: ModuleSummary[];
  apis: APISummary[];
  decisions: DecisionSummary[];
  blockers: BlockerSummary[];
} {
  return {
    files: getAllFileSummaries(projectRoot),
    functions: getAllFunctionSummaries(projectRoot),
    modules: getAllModuleSummaries(projectRoot),
    apis: getAllAPISummaries(projectRoot),
    decisions: getAllDecisionSummaries(projectRoot),
    blockers: getAllBlockerSummaries(projectRoot),
  };
}

export {
  SUMMARIES_DIR,
  FILES_DIR,
  FUNCTIONS_DIR,
  MODULES_DIR,
  API_DIR,
  DECISIONS_DIR,
  BLOCKERS_DIR
};