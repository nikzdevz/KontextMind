import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  IndexedFile,
  ParsedFile,
  DependencyRecord,
  SymbolIndex,
  DependencyIndex,
  GraphData,
  CodeParser,
} from '../parser/parser-types.js';
import { loadFileIndex, type FileIndex } from '../scanner/index.js';
import { TypeScriptParser } from '../parser/typescript-parser.js';
import { PythonParser } from '../parser/python-parser.js';
import { createSymbolIndex, saveSymbolIndex, addSymbolToIndex } from '../parser/symbol-index.js';
import { createDependencyIndex, saveDependencyIndex, addDependencyToIndex, classifyDependency } from '../parser/dependency-index.js';
import { buildGraphFromParsedFiles, saveGraph } from '../parser/knowledge-graph.js';

export interface IndexProjectOptions {
  projectRoot: string;
  projectName: string;
  languages?: string[];
  changedOnly?: boolean;
}

export interface IndexProjectResult {
  filesProcessed: number;
  filesSkipped: number;
  symbolsIndexed: number;
  dependenciesIndexed: number;
  graphNodes: number;
  graphEdges: number;
  duration_ms: number;
  errors: string[];
}

const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python'];

export async function indexProject(options: IndexProjectOptions): Promise<IndexProjectResult> {
  const startTime = Date.now();
  const {
    projectRoot,
    projectName,
    languages = SUPPORTED_LANGUAGES,
    changedOnly = false,
  } = options;

  const errors: string[] = [];
  const symbolIndex = createSymbolIndex();
  const dependencyIndex = createDependencyIndex();
  const parsedFiles: ParsedFile[] = [];

  // Load file index
  const fileIndex = loadFileIndex(projectRoot);
  if (!fileIndex) {
    return {
      filesProcessed: 0,
      filesSkipped: 0,
      symbolsIndexed: 0,
      dependenciesIndexed: 0,
      graphNodes: 0,
      graphEdges: 0,
      duration_ms: Date.now() - startTime,
      errors: ['No file index found. Run "kontextmind scan" first.'],
    };
  }

  // Create parsers
  const parsers: CodeParser[] = [
    new TypeScriptParser(),
    new PythonParser(),
  ];

  // Filter files by language
  const filesToProcess = fileIndex.files.filter(f =>
    languages.some(lang => lang.toLowerCase() === f.language?.toLowerCase())
  );

  // Process each file
  for (const fileRecord of filesToProcess) {
    try {
      const filePath = join(projectRoot, fileRecord.path);

      if (!existsSync(filePath)) {
        errors.push(`File not found: ${fileRecord.path}`);
        continue;
      }

      const content = readFileSync(filePath, 'utf-8');
      const indexedFile: IndexedFile = {
        filePath: fileRecord.path,
        language: fileRecord.language || 'unknown',
        size_bytes: fileRecord.size_bytes,
        hash: fileRecord.hash,
        modified_at: fileRecord.modified_at,
        indexed_at: fileRecord.indexed_at,
      };

      // Find appropriate parser
      const parser = parsers.find(p => p.supports(indexedFile.language));
      if (!parser) {
        errors.push(`No parser for ${indexedFile.language}: ${indexedFile.filePath}`);
        continue;
      }

      const parsed = parser.parse(indexedFile, content);
      parsedFiles.push(parsed);

      // Add symbols to index
      for (const symbol of parsed.symbols) {
        addSymbolToIndex(symbolIndex, symbol);
      }

      // Add dependencies to index
      for (const imp of parsed.imports) {
        const dep: DependencyRecord = {
          sourceFile: parsed.filePath,
          target: imp.path,
          kind: classifyDependency(parsed.filePath, imp.path),
          line: imp.startLine,
        };
        addDependencyToIndex(dependencyIndex, dep);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Error parsing ${fileRecord.path}: ${message}`);
    }
  }

  // Build knowledge graph
  const graph = buildGraphFromParsedFiles(
    projectName,
    projectRoot,
    parsedFiles.map(pf => ({
      filePath: pf.filePath,
      language: pf.language,
      symbols: pf.symbols,
      imports: pf.imports.map(i => ({ path: i.path, kind: i.kind })),
      exports: pf.exports.map(e => ({ name: e.name })),
      envReads: pf.envReads,
      apiRoutes: pf.apiRoutes,
    })),
  );

  // Save all indexes
  saveSymbolIndex(symbolIndex, projectRoot);
  saveDependencyIndex(dependencyIndex, projectRoot);
  saveGraph(graph, projectRoot);

  const duration = Date.now() - startTime;

  return {
    filesProcessed: parsedFiles.length,
    filesSkipped: fileIndex.files.length - parsedFiles.length,
    symbolsIndexed: symbolIndex.totalSymbols,
    dependenciesIndexed: dependencyIndex.totalDependencies,
    graphNodes: graph.nodes.length,
    graphEdges: graph.edges.length,
    duration_ms: duration,
    errors,
  };
}

export function getLastIndexTime(projectRoot: string): string | null {
  const indexPath = join(projectRoot, '.kg', 'symbol-index.json');
  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content);
    return index.generatedAt || null;
  } catch {
    return null;
  }
}

export function getIndexStatus(projectRoot: string): {
  hasFileIndex: boolean;
  hasSymbolIndex: boolean;
  hasDependencyIndex: boolean;
  hasGraph: boolean;
  symbolCount: number;
  dependencyCount: number;
  graphNodes: number;
  graphEdges: number;
} {
  const symbolIndex = loadSymbolIndexFromPath(join(projectRoot, '.kg', 'symbol-index.json'));
  const depIndex = loadDependencyIndexFromPath(join(projectRoot, '.kg', 'dependency-index.json'));
  const graph = loadGraphFromPath(join(projectRoot, '.kg', 'graph.json'));

  return {
    hasFileIndex: existsSync(join(projectRoot, '.kg', 'file-index.json')),
    hasSymbolIndex: symbolIndex !== null,
    hasDependencyIndex: depIndex !== null,
    hasGraph: graph !== null,
    symbolCount: symbolIndex?.totalSymbols || 0,
    dependencyCount: depIndex?.totalDependencies || 0,
    graphNodes: graph?.nodes.length || 0,
    graphEdges: graph?.edges.length || 0,
  };
}

function loadSymbolIndexFromPath(path: string): SymbolIndex | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SymbolIndex;
  } catch {
    return null;
  }
}

function loadDependencyIndexFromPath(path: string): DependencyIndex | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as DependencyIndex;
  } catch {
    return null;
  }
}

function loadGraphFromPath(path: string): GraphData | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as GraphData;
  } catch {
    return null;
  }
}
