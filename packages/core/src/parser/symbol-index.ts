import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { SymbolRecord, SymbolIndex } from '../parser/parser-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

export function createSymbolIndex(): SymbolIndex {
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    totalSymbols: 0,
    symbols: [],
  };
}

export function addSymbolToIndex(index: SymbolIndex, symbol: SymbolRecord): void {
  index.symbols.push(symbol);
  index.totalSymbols++;
}

export function saveSymbolIndex(index: SymbolIndex, projectRoot: string): string {
  const indexPath = join(projectRoot, '.kg', 'symbol-index.json');
  const dirPath = join(projectRoot, '.kg');

  ensureDir(dirPath);
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  return indexPath;
}

export function loadSymbolIndex(projectRoot: string): SymbolIndex | null {
  const indexPath = join(projectRoot, '.kg', 'symbol-index.json');

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    return JSON.parse(content) as SymbolIndex;
  } catch {
    return null;
  }
}

export function validateSymbolIndex(index: unknown): index is SymbolIndex {
  if (typeof index !== 'object' || index === null) {
    return false;
  }

  const idx = index as Record<string, unknown>;

  return (
    typeof idx.version === 'string' &&
    typeof idx.generatedAt === 'string' &&
    typeof idx.symbols === 'object' &&
    Array.isArray(idx.symbols)
  );
}

export function searchSymbols(index: SymbolIndex, query: string): SymbolRecord[] {
  const lowerQuery = query.toLowerCase();
  return index.symbols.filter(s =>
    s.name.toLowerCase().includes(lowerQuery) ||
    s.filePath.toLowerCase().includes(lowerQuery)
  );
}

export function getSymbolsByFile(index: SymbolIndex, filePath: string): SymbolRecord[] {
  return index.symbols.filter(s => s.filePath === filePath);
}

export function getSymbolsByKind(index: SymbolIndex, kind: SymbolRecord['kind']): SymbolRecord[] {
  return index.symbols.filter(s => s.kind === kind);
}

export function getExportedSymbols(index: SymbolIndex): SymbolRecord[] {
  return index.symbols.filter(s => s.exported);
}
