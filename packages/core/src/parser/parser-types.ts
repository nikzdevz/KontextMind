// Parser types and interfaces

export interface ImportRecord {
  path: string;
  kind: 'import' | 'require' | 'dynamic';
  startLine: number;
  endLine: number;
  isDefault: boolean;
  namedImports: string[];
}

export interface ExportRecord {
  name: string;
  kind: 'default' | 'named' | 'all';
  startLine: number;
  endLine: number;
}

export interface SymbolRecord {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'constant';
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  signature: string;
  exported: boolean;
  summaryStatus: 'missing' | 'pending' | 'complete';
  decorators?: string[];
}

export interface ApiRouteRecord {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  handler: string;
  startLine: number;
  filePath: string;
  framework?: string;
}

export interface ParsedFile {
  filePath: string;
  language: string;
  imports: ImportRecord[];
  exports: ExportRecord[];
  symbols: SymbolRecord[];
  envReads: string[];
  apiRoutes: ApiRouteRecord[];
  parseErrors: string[];
}

export interface IndexedFile {
  filePath: string;
  language: string;
  size_bytes: number;
  hash: string;
  modified_at: string;
  indexed_at: string;
}

// Parser interface
export interface CodeParser {
  readonly language: string;
  supports(language: string): boolean;
  parse(file: IndexedFile, content: string): ParsedFile;
}

export interface DependencyRecord {
  sourceFile: string;
  target: string;
  kind: 'package-import' | 'local-import' | 'reexport';
  line?: number;
}

export interface GraphNode {
  id: string;
  type: 'project' | 'directory' | 'file' | 'function' | 'class' | 'package' | 'api-endpoint' | 'env-var';
  name: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: 'contains' | 'imports' | 'exports' | 'depends-on' | 'exposes-api' | 'reads-env';
  metadata?: Record<string, unknown>;
}

export interface GraphData {
  version: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SymbolIndex {
  version: string;
  generatedAt: string;
  totalSymbols: number;
  symbols: SymbolRecord[];
}

export interface DependencyIndex {
  version: string;
  generatedAt: string;
  totalDependencies: number;
  dependencies: DependencyRecord[];
}
