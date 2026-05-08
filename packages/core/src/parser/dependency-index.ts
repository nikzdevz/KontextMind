import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname, relative, isAbsolute, dirname } from 'path';
import type { DependencyRecord, DependencyIndex } from '../parser/parser-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

export function createDependencyIndex(): DependencyIndex {
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    totalDependencies: 0,
    dependencies: [],
  };
}

export function addDependencyToIndex(index: DependencyIndex, dep: DependencyRecord): void {
  index.dependencies.push(dep);
  index.totalDependencies++;
}

export function saveDependencyIndex(index: DependencyIndex, projectRoot: string): string {
  const indexPath = join(projectRoot, '.kg', 'dependency-index.json');
  const dirPath = join(projectRoot, '.kg');

  ensureDir(dirPath);
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  return indexPath;
}

export function loadDependencyIndex(projectRoot: string): DependencyIndex | null {
  const indexPath = join(projectRoot, '.kg', 'dependency-index.json');

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    return JSON.parse(content) as DependencyIndex;
  } catch {
    return null;
  }
}

export function validateDependencyIndex(index: unknown): index is DependencyIndex {
  if (typeof index !== 'object' || index === null) {
    return false;
  }

  const idx = index as Record<string, unknown>;

  return (
    typeof idx.version === 'string' &&
    typeof idx.generatedAt === 'string' &&
    typeof idx.dependencies === 'object' &&
    Array.isArray(idx.dependencies)
  );
}

export function classifyDependency(
  sourceFile: string,
  importPath: string,
): DependencyRecord['kind'] {
  // Check if it's a package import (starts with @, or no relative path)
  if (importPath.startsWith('@') ||
      (!importPath.startsWith('.') && !importPath.startsWith('/'))) {
    return 'package-import';
  }

  // Local import
  return 'local-import';
}

export function resolveImportPath(sourceFile: string, importPath: string): string {
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    // It's a relative import, resolve it
    const sourceDir = dirname(sourceFile);
    const resolved = join(sourceDir, importPath);

    // Try common extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      const fullPath = resolved + ext;
      // In a real implementation, we'd check if the file exists
      // For now, just return the resolved path
      if (ext && ext.includes('.')) {
        return fullPath;
      }
    }

    return resolved;
  }

  // Package import
  return importPath;
}

export function getDependenciesByFile(index: DependencyIndex, filePath: string): DependencyRecord[] {
  return index.dependencies.filter(d => d.sourceFile === filePath);
}

export function getDependenciesByTarget(index: DependencyIndex, target: string): DependencyRecord[] {
  return index.dependencies.filter(d => d.target === target);
}

export function getPackageDependencies(index: DependencyIndex): DependencyRecord[] {
  return index.dependencies.filter(d => d.kind === 'package-import');
}

export function getLocalDependencies(index: DependencyIndex): DependencyRecord[] {
  return index.dependencies.filter(d => d.kind === 'local-import');
}
