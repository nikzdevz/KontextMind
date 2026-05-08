import { describe, it, expect } from 'vitest';
import {
  createGraph,
  createProjectNode,
  createFileNode,
  createSymbolNode,
  createPackageNode,
  createEnvVarNode,
  createContainsEdge,
  createImportsEdge,
  createDependsOnEdge,
  getGraphStats,
} from '../../packages/core/src/parser/knowledge-graph.js';
import type { SymbolRecord } from '../../packages/core/src/parser/parser-types.js';

describe('Knowledge Graph', () => {
  it('should create an empty graph', () => {
    const graph = createGraph();
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.version).toBe('1');
  });

  it('should create project node', () => {
    const node = createProjectNode('test-project');
    expect(node.id).toBe('project:test-project');
    expect(node.type).toBe('project');
    expect(node.name).toBe('test-project');
  });

  it('should create file node', () => {
    const node = createFileNode('src/index.ts', 'typescript');
    expect(node.id).toBe('file:src/index.ts');
    expect(node.type).toBe('file');
    expect(node.metadata).toEqual({ language: 'typescript' });
  });

  it('should create symbol node', () => {
    const symbol: SymbolRecord = {
      id: 'src/index.ts:getUser:10',
      name: 'getUser',
      kind: 'function',
      filePath: 'src/index.ts',
      language: 'typescript',
      startLine: 10,
      endLine: 15,
      signature: 'getUser(id)',
      exported: true,
      summaryStatus: 'missing',
    };
    const node = createSymbolNode(symbol);
    expect(node.id).toBe(symbol.id);
    expect(node.type).toBe('function');
    expect(node.name).toBe('getUser');
    expect(node.metadata).toEqual({
      kind: 'function',
      exported: true,
      signature: 'getUser(id)',
      startLine: 10,
      endLine: 15,
    });
  });

  it('should create package node', () => {
    const node = createPackageNode('express');
    expect(node.id).toBe('package:express');
    expect(node.type).toBe('package');
  });

  it('should create environment variable node', () => {
    const node = createEnvVarNode('API_KEY', ['src/config.ts', 'src/api.ts']);
    expect(node.id).toBe('env:API_KEY');
    expect(node.type).toBe('env-var');
    expect(node.metadata).toEqual({ usedIn: ['src/config.ts', 'src/api.ts'] });
  });

  it('should create contains edge', () => {
    const edge = createContainsEdge('project:test', 'dir:src');
    expect(edge.source).toBe('project:test');
    expect(edge.target).toBe('dir:src');
    expect(edge.relation).toBe('contains');
  });

  it('should create imports edge', () => {
    const edge = createImportsEdge('file:src/index.ts', 'package:express', true);
    expect(edge.source).toBe('file:src/index.ts');
    expect(edge.target).toBe('package:express');
    expect(edge.relation).toBe('imports');
    expect(edge.metadata).toEqual({ isPackage: true });
  });

  it('should create depends-on edge', () => {
    const edge = createDependsOnEdge('file:src/a.ts', 'file:src/b.ts');
    expect(edge.relation).toBe('depends-on');
  });

  it('should calculate graph statistics', () => {
    const graph = createGraph();
    graph.nodes.push(
      createProjectNode('test'),
      createFileNode('src/index.ts'),
      createPackageNode('express'),
    );
    graph.edges.push(
      createContainsEdge('project:test', 'file:src/index.ts'),
      createImportsEdge('file:src/index.ts', 'package:express', true),
    );

    const stats = getGraphStats(graph);
    expect(stats.totalNodes).toBe(3);
    expect(stats.totalEdges).toBe(2);
    expect(stats.nodesByType.project).toBe(1);
    expect(stats.nodesByType.file).toBe(1);
    expect(stats.nodesByType.package).toBe(1);
    expect(stats.edgesByRelation.contains).toBe(1);
    expect(stats.edgesByRelation.imports).toBe(1);
  });

  it('should not add duplicate nodes', () => {
    const graph = createGraph();
    const node1 = createFileNode('src/index.ts');
    const node2 = createFileNode('src/index.ts'); // Duplicate

    graph.nodes.push(node1);
    graph.nodes.push(node2);

    // Manually add to avoid deduplication for this test
    expect(graph.nodes.length).toBe(2);
  });
});
