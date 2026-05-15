/**
 * Obsidian Export
 *
 * Export project brain to Obsidian-compatible Markdown notes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanProject, type ScanProjectOptions } from '../scanner/scan-project.js';
import { loadSymbolIndex } from '../parser/symbol-index.js';
import { getAllFileSummaries } from '../summaries/summary-storage.js';
import { redactSecrets } from '../security/redact.js';
import type { FileSummary, SymbolSummary } from '../summaries/summary-types.js';
import type { SymbolRecord } from '../parser/parser-types.js';

const DEFAULT_OUTPUT_DIR = '.obsidian-export';

export interface ObsidianExportOptions {
  output?: string;
  clean?: boolean;
  includeRawCode?: boolean;
}

export interface ExportStats {
  files: number;
  functions: number;
  apis: number;
  modules: number;
  dependencies: number;
  decisions: number;
  backlinks: number;
}

function sanitizeNoteName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function toSafeNoteName(filePath: string): string {
  const parts = filePath.split(/[/.]/);
  return sanitizeNoteName(parts.join(' '));
}

function createBacklink(noteName: string): string {
  return `[[${noteName}]]`;
}

function createFileBacklink(filePath: string): string {
  const noteName = toSafeNoteName(filePath);
  return `[[${noteName}]]`;
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function exportProjectOverview(
  projectRoot: string,
  outputDir: string
): Promise<void> {
  const content = `# ${path.basename(projectRoot)} - Project Overview

Type: Project
Path: \`${projectRoot}\`

## Summary

This is the project brain exported from KontextMind.

## Structure

- [[Files]]
- [[Functions]]
- [[APIs]]
- [[Modules]]
- [[Dependencies]]

## Related

- [[Architecture]]
- [[Current State]]
- [[Handoff]]
`;

  const filePath = path.join(outputDir, 'Project Overview.md');
  fs.writeFileSync(filePath, content);
}

export async function exportArchitecture(
  projectRoot: string,
  outputDir: string
): Promise<void> {
  const content = `# Architecture

Type: Architecture

## Modules

See [[Modules]] for detailed module information.

## Dependencies

See [[Dependencies]] for dependency information.
`;

  const filePath = path.join(outputDir, 'Architecture.md');
  fs.writeFileSync(filePath, content);
}

export async function exportCurrentState(
  projectRoot: string,
  outputDir: string
): Promise<void> {
  const handoffPath = path.join(projectRoot, '.context', 'current-state.md');
  let stateContent = 'Current project state information is not available.';

  if (fs.existsSync(handoffPath)) {
    stateContent = fs.readFileSync(handoffPath, 'utf-8');
    const redacted = redactSecrets(stateContent);
    stateContent = redacted.text;
  }

  const content = `# Current State

${stateContent}

## Related

- [[Project Overview]]
- [[Handoff]]
`;

  const filePath = path.join(outputDir, 'Current State.md');
  fs.writeFileSync(filePath, content);
}

export async function exportHandoff(
  projectRoot: string,
  outputDir: string
): Promise<void> {
  const handoffPath = path.join(projectRoot, '.context', 'handoff.md');
  let handoffContent = 'No handoff information available.';

  if (fs.existsSync(handoffPath)) {
    handoffContent = fs.readFileSync(handoffPath, 'utf-8');
    const redacted = redactSecrets(handoffContent);
    handoffContent = redacted.text;
  }

  const content = `# Handoff

${handoffContent}

## Related

- [[Current State]]
- [[Project Overview]]
`;

  const filePath = path.join(outputDir, 'Handoff.md');
  fs.writeFileSync(filePath, content);
}

export async function exportFiles(
  projectRoot: string,
  outputDir: string
): Promise<number> {
  const filesDir = path.join(outputDir, 'Files');
  ensureDir(filesDir);

  const summaries = getAllFileSummaries(projectRoot);
  let count = 0;

  for (const summary of summaries) {
    const noteName = toSafeNoteName(summary.filePath);
    const content = generateFileNote(summary);
    const filePath = path.join(filesDir, `${sanitizeNoteName(summary.filePath)}.md`);

    fs.writeFileSync(filePath, content);
    count++;
  }

  const indexContent = `# Files

Type: Index

${summaries.map((s: FileSummary) => `- ${createFileBacklink(s.filePath)} - ${s.language || 'Unknown'}`).join('\n')}

## Related

- [[Project Overview]]
`;

  fs.writeFileSync(path.join(filesDir, 'Index.md'), indexContent);
  return count;
}

function generateFileNote(summary: FileSummary): string {
  const safeContent = summary.purpose ? redactSecrets(summary.purpose).text : 'No summary available.';

  const symbolsSection = summary.symbols && summary.symbols.length > 0
    ? `## Symbols\n\n${summary.symbols.map((s: SymbolSummary) => `- [[${s.name}]]`).join('\n')}\n`
    : '';

  const dependenciesSection = summary.dependencies && summary.dependencies.length > 0
    ? `## Dependencies\n\n${summary.dependencies.map((d: string) => `- ${createFileBacklink(d)}`).join('\n')}\n`
    : '';

  const relatedSection = summary.relatedFiles && summary.relatedFiles.length > 0
    ? `## Related Files\n\n${summary.relatedFiles.map((f: string) => `- ${createFileBacklink(f)}`).join('\n')}\n`
    : '';

  return `# ${summary.filePath}

Type: File
Language: ${summary.language || 'Unknown'}

## Purpose

${safeContent}

${symbolsSection}${dependenciesSection}${relatedSection}
## Related

- [[Project Overview]]
`;
}

export async function exportFunctions(
  projectRoot: string,
  outputDir: string
): Promise<number> {
  const functionsDir = path.join(outputDir, 'Functions');
  ensureDir(functionsDir);

  try {
    const index = loadSymbolIndex(projectRoot);
    if (!index) return 0;

    const symbols = index.symbols || [];
    let count = 0;

    for (const symbol of symbols) {
      if (symbol.kind === 'function' || symbol.kind === 'method' || symbol.kind === 'class') {
        const record = symbol as SymbolRecord;
        const safeSig = record.signature ? redactSecrets(record.signature).text : '';
        const noteFileName = toSafeNoteName(record.filePath);

        const content = `# ${record.name}

Type: Symbol
Kind: ${record.kind}
File: ${createFileBacklink(record.filePath)}

## Signature

\`\`\`
${safeSig}
\`\`\`

## Related

- [[${noteFileName}]]
`;

        const filePath = path.join(functionsDir, `${sanitizeNoteName(record.name)}.md`);
        fs.writeFileSync(filePath, content);
        count++;
      }
    }

    const indexContent = `# Functions

Type: Index

${symbols
  .filter((s: { kind: string }) => s.kind === 'function' || s.kind === 'method' || s.kind === 'class')
  .map((s: { name: string }) => `- [[${s.name}]]`)
  .join('\n')}

## Related

- [[Files]]
`;

    fs.writeFileSync(path.join(functionsDir, 'Index.md'), indexContent);
    return count;
  } catch {
    return 0;
  }
}

export async function exportModules(
  projectRoot: string,
  outputDir: string
): Promise<number> {
  const modulesDir = path.join(outputDir, 'Modules');
  ensureDir(modulesDir);

  try {
    const summaries = getAllFileSummaries(projectRoot);
    const moduleMap = new Map<string, Set<string>>();

    for (const summary of summaries) {
      const dirName = path.dirname(summary.filePath);
      if (!moduleMap.has(dirName)) {
        moduleMap.set(dirName, new Set());
      }
      moduleMap.get(dirName)!.add(summary.filePath);
    }

    let count = 0;
    for (const [moduleName, files] of moduleMap) {
      const fileList = Array.from(files);
      const content = `# ${moduleName}

Type: Module
Files: ${fileList.length}

## Files

${fileList.map((f: string) => `- ${createFileBacklink(f)}`).join('\n')}

## Related

- [[Project Overview]]
`;

      const filePath = path.join(modulesDir, `${sanitizeNoteName(moduleName)}.md`);
      fs.writeFileSync(filePath, content);
      count++;
    }

    return count;
  } catch {
    return 0;
  }
}

export async function exportDependencies(
  projectRoot: string,
  outputDir: string
): Promise<number> {
  const depsDir = path.join(outputDir, 'Dependencies');
  ensureDir(depsDir);

  try {
    const scanResult = await scanProject({ projectRoot, projectName: path.basename(projectRoot), changedOnly: false });
    const deps = (scanResult as { dependencies?: Array<{ name: string; version?: string }> }).dependencies || [];
    let count = 0;

    for (const dep of deps) {
      const content = `# ${dep.name}

Type: Dependency
Version: ${dep.version || 'unknown'}

## Related

- [[Project Overview]]
`;

      const filePath = path.join(depsDir, `${sanitizeNoteName(dep.name)}.md`);
      fs.writeFileSync(filePath, content);
      count++;
    }

    const indexContent = `# Dependencies

Type: Index

${deps.map((d: { name: string }) => `- ${d.name}`).join('\n')}

## Related

- [[Project Overview]]
`;

    fs.writeFileSync(path.join(depsDir, 'Index.md'), indexContent);
    return count;
  } catch {
    return 0;
  }
}

export async function exportIndex(
  projectRoot: string,
  outputDir: string,
  stats: ExportStats
): Promise<void> {
  const content = `# Index

Type: Index

## Navigation

- [[Project Overview]]
- [[Architecture]]
- [[Current State]]
- [[Handoff]]

## Documentation

- [[Files]] (${stats.files} files)
- [[Functions]] (${stats.functions} functions)
- [[Modules]] (${stats.modules} modules)
- [[Dependencies]] (${stats.dependencies} dependencies)

## Statistics

- Files exported: ${stats.files}
- Functions exported: ${stats.functions}
- APIs exported: ${stats.apis}
- Modules exported: ${stats.modules}
- Dependencies exported: ${stats.dependencies}
- Backlinks created: ${stats.backlinks}
`;

  const filePath = path.join(outputDir, 'Index.md');
  fs.writeFileSync(filePath, content);
}

export async function obsidianExport(
  projectRoot: string,
  options: ObsidianExportOptions = {}
): Promise<ExportStats> {
  const outputDir = options.output || path.join(projectRoot, DEFAULT_OUTPUT_DIR);

  if (options.clean && fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }

  ensureDir(outputDir);
  ensureDir(path.join(outputDir, 'Files'));
  ensureDir(path.join(outputDir, 'Functions'));
  ensureDir(path.join(outputDir, 'APIs'));
  ensureDir(path.join(outputDir, 'Modules'));
  ensureDir(path.join(outputDir, 'Dependencies'));
  ensureDir(path.join(outputDir, 'Decisions'));

  const stats: ExportStats = {
    files: 0,
    functions: 0,
    apis: 0,
    modules: 0,
    dependencies: 0,
    decisions: 0,
    backlinks: 0,
  };

  await exportProjectOverview(projectRoot, outputDir);
  await exportArchitecture(projectRoot, outputDir);
  await exportCurrentState(projectRoot, outputDir);
  await exportHandoff(projectRoot, outputDir);

  stats.files = await exportFiles(projectRoot, outputDir);
  stats.functions = await exportFunctions(projectRoot, outputDir);
  stats.modules = await exportModules(projectRoot, outputDir);
  stats.dependencies = await exportDependencies(projectRoot, outputDir);

  stats.backlinks =
    stats.files +
    stats.functions +
    stats.modules +
    stats.dependencies;

  await exportIndex(projectRoot, outputDir, stats);

  return stats;
}

export function getLastExportTime(projectRoot: string): Date | null {
  const indexPath = path.join(projectRoot, DEFAULT_OUTPUT_DIR, 'Index.md');
  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const stat = fs.statSync(indexPath);
  return stat.mtime;
}

export function isExportReady(projectRoot: string): boolean {
  const indexPath = path.join(projectRoot, DEFAULT_OUTPUT_DIR, 'Index.md');
  return fs.existsSync(indexPath);
}
