import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import type { FileSummary, FunctionSummary, ModuleSummary, SummaryStatus, SummaryStats } from './summary-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

// Summary directories
const SUMMARIES_DIR = '.summaries';
const FILES_DIR = 'files';
const FUNCTIONS_DIR = 'functions';
const MODULES_DIR = 'modules';

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

function getFileSummaryPath(projectRoot: string, filePath: string): string {
  const safeName = getSafeFileName(filePath);
  return join(projectRoot, SUMMARIES_DIR, FILES_DIR, safeName + '.json');
}

function getFunctionSummaryPath(projectRoot: string, symbolId: string): string {
  const safeName = getSafeSymbolId(symbolId);
  return join(projectRoot, SUMMARIES_DIR, FUNCTIONS_DIR, safeName + '.json');
}

function getModuleSummaryPath(projectRoot: string, dirPath: string): string {
  const safeName = getSafeFileName(dirPath);
  return join(projectRoot, SUMMARIES_DIR, MODULES_DIR, safeName + '.json');
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

export function calculateSummaryStats(projectRoot: string): SummaryStats {
  const fileSummaries = getAllFileSummaries(projectRoot);
  const functionSummaries = getAllFunctionSummaries(projectRoot);

  const stats: SummaryStats = {
    total: fileSummaries.length + functionSummaries.length,
    fresh: 0,
    stale: 0,
    missing: 0,
    failed: 0,
    partial: 0,
  };

  for (const summary of fileSummaries) {
    const status = summary.summaryStatus;
    if (status === 'fresh') stats.fresh++;
    else if (status === 'stale') stats.stale++;
    else if (status === 'missing') stats.missing++;
    else if (status === 'failed') stats.failed++;
    else if (status === 'partial') stats.partial++;
  }

  for (const summary of functionSummaries) {
    const status = summary.summaryStatus;
    if (status === 'fresh') stats.fresh++;
    else if (status === 'stale') stats.stale++;
    else if (status === 'missing') stats.missing++;
    else if (status === 'failed') stats.failed++;
    else if (status === 'partial') stats.partial++;
  }

  return stats;
}

export function isSummaryStale(summary: { hash?: string; summaryStatus: SummaryStatus }, currentHash?: string): boolean {
  // If no hash tracked, consider stale if not fresh
  if (!currentHash) {
    return summary.summaryStatus !== 'fresh';
  }

  // If hash is provided and matches, it's fresh
  if (summary.hash && summary.hash === currentHash) {
    return false;
  }

  // Hash mismatch means stale
  if (summary.hash && currentHash && summary.hash !== currentHash) {
    return true;
  }

  // Default: if status is not fresh, consider stale
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

export { SUMMARIES_DIR, FILES_DIR, FUNCTIONS_DIR, MODULES_DIR };
