import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import type { GraphNode, GraphEdge, GraphData, SymbolRecord, DependencyRecord, ApiRouteRecord } from '../parser/parser-types.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

export function createGraph(): GraphData {
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
  };
}

export function addNodeToGraph(graph: GraphData, node: GraphNode): void {
  // Don't add duplicates
  if (!graph.nodes.find(n => n.id === node.id)) {
    graph.nodes.push(node);
  }
}

export function addEdgeToGraph(graph: GraphData, edge: GraphEdge): void {
  // Check if edge already exists
  const exists = graph.edges.find(
    e => e.source === edge.source && e.target === edge.target && e.relation === edge.relation
  );
  if (!exists) {
    graph.edges.push(edge);
  }
}

export function saveGraph(graph: GraphData, projectRoot: string): string {
  const graphPath = join(projectRoot, '.kg', 'graph.json');
  const dirPath = join(projectRoot, '.kg');

  ensureDir(dirPath);
  writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf-8');
  return graphPath;
}

export function loadGraph(projectRoot: string): GraphData | null {
  const graphPath = join(projectRoot, '.kg', 'graph.json');

  if (!existsSync(graphPath)) {
    return null;
  }

  try {
    const content = readFileSync(graphPath, 'utf-8');
    return JSON.parse(content) as GraphData;
  } catch {
    return null;
  }
}

export function createProjectNode(projectName: string): GraphNode {
  return {
    id: `project:${projectName}`,
    type: 'project',
    name: projectName,
  };
}

export function createDirectoryNode(dirPath: string): GraphNode {
  return {
    id: `dir:${dirPath}`,
    type: 'directory',
    name: dirPath.split('/').pop() || dirPath,
    filePath: dirPath,
  };
}

export function createFileNode(filePath: string, language?: string): GraphNode {
  return {
    id: `file:${filePath}`,
    type: 'file',
    name: filePath.split('/').pop() || filePath,
    filePath,
    metadata: language ? { language } : undefined,
  };
}

export function createSymbolNode(symbol: SymbolRecord): GraphNode {
  return {
    id: symbol.id,
    type: symbol.kind === 'class' ? 'class' : 'function',
    name: symbol.name,
    filePath: symbol.filePath,
    metadata: {
      kind: symbol.kind,
      exported: symbol.exported,
      signature: symbol.signature,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
    },
  };
}

export function createPackageNode(packageName: string): GraphNode {
  return {
    id: `package:${packageName}`,
    type: 'package',
    name: packageName,
  };
}

export function createApiEndpointNode(route: ApiRouteRecord): GraphNode {
  return {
    id: `api:${route.filePath}:${route.method}:${route.path}`,
    type: 'api-endpoint',
    name: `${route.method} ${route.path}`,
    filePath: route.filePath,
    metadata: {
      method: route.method,
      path: route.path,
      handler: route.handler,
    },
  };
}

export function createEnvVarNode(varName: string, files: string[]): GraphNode {
  return {
    id: `env:${varName}`,
    type: 'env-var',
    name: varName,
    metadata: {
      usedIn: files,
    },
  };
}

// Edge creators
export function createContainsEdge(parent: string, child: string): GraphEdge {
  return {
    source: parent,
    target: child,
    relation: 'contains',
  };
}

export function createImportsEdge(source: string, target: string, isPackage: boolean): GraphEdge {
  return {
    source,
    target,
    relation: 'imports',
    metadata: { isPackage },
  };
}

export function createExportsEdge(source: string, target: string): GraphEdge {
  return {
    source,
    target,
    relation: 'exports',
  };
}

export function createDependsOnEdge(source: string, target: string): GraphEdge {
  return {
    source,
    target,
    relation: 'depends-on',
  };
}

export function createExposesApiEdge(source: string, target: string): GraphEdge {
  return {
    source,
    target,
    relation: 'exposes-api',
  };
}

export function createReadsEnvEdge(source: string, target: string): GraphEdge {
  return {
    source,
    target,
    relation: 'reads-env',
  };
}

export function buildGraphFromParsedFiles(
  projectName: string,
  projectRoot: string,
  parsedFiles: Array<{
    filePath: string;
    language: string;
    symbols: SymbolRecord[];
    imports: Array<{ path: string; kind: string }>;
    exports: Array<{ name: string }>;
    envReads: string[];
    apiRoutes: ApiRouteRecord[];
  }>,
): GraphData {
  const graph = createGraph();

  // Add project node
  addNodeToGraph(graph, createProjectNode(projectName));

  // Group files by directory for CONTAINS relationships
  const dirs = new Map<string, Set<string>>();
  const filesByDir = new Map<string, string[]>();

  for (const parsed of parsedFiles) {
    const filePath = parsed.filePath;
    const parts = filePath.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

    if (dir) {
      if (!filesByDir.has(dir)) {
        filesByDir.set(dir, []);
      }
      filesByDir.get(dir)!.push(filePath);
    }

    // Add file node
    addNodeToGraph(graph, createFileNode(filePath, parsed.language));

    // Add file to project
    addEdgeToGraph(graph, createContainsEdge(`project:${projectName}`, `file:${filePath}`));

    // Add directory to project if top-level
    if (dir && parts.length === 2) {
      addNodeToGraph(graph, createDirectoryNode(dir));
      addEdgeToGraph(graph, createContainsEdge(`project:${projectName}`, `dir:${dir}`));
    }

    // Add symbol nodes
    for (const symbol of parsed.symbols) {
      addNodeToGraph(graph, createSymbolNode(symbol));
      addEdgeToGraph(graph, createContainsEdge(`file:${filePath}`, symbol.id));
    }

    // Add import relationships
    for (const imp of parsed.imports) {
      if (imp.path.startsWith('.')) {
        // Local import - target is the file
        addEdgeToGraph(graph, createImportsEdge(`file:${filePath}`, `file:${imp.path}`, false));
      } else {
        // Package import
        addNodeToGraph(graph, createPackageNode(imp.path));
        addEdgeToGraph(graph, createImportsEdge(`file:${filePath}`, `package:${imp.path}`, true));
      }
    }

    // Add export relationships
    for (const exp of parsed.exports) {
      addEdgeToGraph(graph, createExportsEdge(`file:${filePath}`, `file:${filePath}`));
    }

    // Add API route nodes
    for (const route of parsed.apiRoutes) {
      addNodeToGraph(graph, createApiEndpointNode(route));
      addEdgeToGraph(graph, createExposesApiEdge(`file:${filePath}`, `api:${filePath}:${route.method}:${route.path}`));
    }

    // Add env var nodes
    for (const envVar of parsed.envReads) {
      const envNodeId = `env:${envVar}`;
      addNodeToGraph(graph, createEnvVarNode(envVar, [filePath]));
      addEdgeToGraph(graph, createReadsEnvEdge(`file:${filePath}`, envNodeId));
    }
  }

  return graph;
}

export function getGraphStats(graph: GraphData): {
  totalNodes: number;
  nodesByType: Record<string, number>;
  totalEdges: number;
  edgesByRelation: Record<string, number>;
} {
  const nodesByType: Record<string, number> = {};
  const edgesByRelation: Record<string, number> = {};

  for (const node of graph.nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  for (const edge of graph.edges) {
    edgesByRelation[edge.relation] = (edgesByRelation[edge.relation] || 0) + 1;
  }

  return {
    totalNodes: graph.nodes.length,
    nodesByType,
    totalEdges: graph.edges.length,
    edgesByRelation,
  };
}
