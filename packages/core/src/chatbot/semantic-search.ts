// Semantic Search - Summary-first retrieval using AI-generated content
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
  SemanticChunk,
  SearchOptions,
  ClassifiedQuestion,
  QuestionIntent,
} from './chatbot-types.js';
import type {
  FileSummary,
  FunctionSummary,
  ModuleSummary,
  APISummary,
  DecisionSummary,
} from '../summaries/summary-types.js';
import {
  getAllFileSummaries,
  getAllFunctionSummaries,
  getAllModuleSummaries,
  getAllAPISummaries,
  getAllDecisionSummaries,
  getFileSummaryPath,
  getFunctionSummaryPath,
  getModuleSummaryPath,
  getAPISummaryPath,
  getDecisionSummaryPath,
} from '../summaries/summary-storage.js';

// Default search options
const DEFAULT_OPTIONS: SearchOptions = {
  maxChunks: 10,
  minRelevance: 0.3,
  includeStale: false,
  allowRawCode: false,
  conversationTurn: 0,
};

/**
 * Perform semantic search across all AI-generated summaries
 */
export async function semanticSearch(
  question: string,
  classified: ClassifiedQuestion,
  projectRoot: string,
  options: SearchOptions = {}
): Promise<SemanticChunk[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allChunks: SemanticChunk[] = [];

  // Load all summaries
  const summaries = loadAllSummaries(projectRoot);

  // Priority 1: File summaries (HIGHEST - most important context)
  for (const summary of summaries.files) {
    if (summary.summaryStatus === 'failed') continue;
    if (!opts.includeStale && summary.summaryStatus === 'stale') continue;

    const content = buildFileSummaryContent(summary);
    const relevance = calculateSemanticRelevance(question, classified, content, {
      filePath: summary.filePath,
      purpose: summary.purpose,
    });

    if (relevance >= opts.minRelevance!) {
      allChunks.push({
        id: `file:${summary.filePath}`,
        type: 'file_summary',
        content,
        sourcePath: getFileSummaryPath(projectRoot, summary.filePath),
        filePath: summary.filePath,
        relevance,
        freshness: summary.summaryStatus as 'fresh' | 'stale' | 'unknown',
        metadata: {
          language: summary.language,
          symbolCount: summary.symbols.length,
          confidence: summary.confidence,
        },
      });
    }
  }

  // Priority 2: Function summaries (HIGH - detailed implementation context)
  for (const summary of summaries.functions) {
    if (summary.summaryStatus === 'failed') continue;

    const content = buildFunctionSummaryContent(summary);
    const relevance = calculateSemanticRelevance(question, classified, content, {
      filePath: summary.filePath,
      symbolName: summary.symbolName,
    });

    if (relevance >= opts.minRelevance!) {
      allChunks.push({
        id: `func:${summary.symbolId}`,
        type: 'function_summary',
        content,
        sourcePath: getFunctionSummaryPath(projectRoot, summary.symbolId),
        filePath: summary.filePath,
        relevance,
        freshness: summary.summaryStatus as 'fresh' | 'stale' | 'unknown',
        metadata: {
          symbolName: summary.symbolName,
          signature: summary.signature,
          purpose: summary.purpose,
          complexity: summary.complexity,
        },
      });
    }
  }

  // Priority 3: Module summaries (MEDIUM - structural context)
  for (const summary of summaries.modules) {
    const content = buildModuleSummaryContent(summary);
    const relevance = calculateSemanticRelevance(question, classified, content, {
      directoryPath: summary.directoryPath,
    });

    if (relevance >= opts.minRelevance!) {
      allChunks.push({
        id: `module:${summary.directoryPath}`,
        type: 'module_summary',
        content,
        sourcePath: getModuleSummaryPath(projectRoot, summary.directoryPath),
        relevance,
        freshness: summary.summaryStatus as 'fresh' | 'stale' | 'unknown',
        metadata: {
          fileCount: summary.fileCount,
          exportedSymbols: summary.exportedSymbols?.slice(0, 5),
        },
      });
    }
  }

  // Priority 4: API summaries (contextual - for API-related questions)
  if (classified.intent === 'usage' || classified.intent === 'implementation') {
    for (const summary of summaries.apis) {
      const content = buildAPISummaryContent(summary);
      const relevance = calculateSemanticRelevance(question, classified, content, {
        endpoint: summary.endpoint,
      });

      if (relevance >= opts.minRelevance!) {
        allChunks.push({
          id: `api:${summary.endpoint}`,
          type: 'api_summary',
          content,
          sourcePath: getAPISummaryPath(projectRoot, summary.endpoint),
          relevance,
          freshness: summary.summaryStatus as 'fresh' | 'stale' | 'unknown',
          metadata: {
            method: summary.method,
            description: summary.description,
          },
        });
      }
    }
  }

  // Priority 5: Decision summaries (contextual - for decision-related questions)
  if (classified.intent === 'decision' || classified.intent === 'exploration') {
    for (const summary of summaries.decisions) {
      const content = buildDecisionSummaryContent(summary);
      const relevance = calculateSemanticRelevance(question, classified, content, {});

      if (relevance >= opts.minRelevance!) {
        allChunks.push({
          id: `decision:${summary.decisionId}`,
          type: 'decision_summary',
          content,
          sourcePath: getDecisionSummaryPath(projectRoot, summary.decisionId),
          relevance,
          freshness: summary.summaryStatus as 'fresh' | 'stale' | 'unknown',
          metadata: {
            title: summary.title,
            rationale: summary.rationale,
          },
        });
      }
    }
  }

  // Sort by relevance and limit
  allChunks.sort((a, b) => b.relevance - a.relevance);
  const limitedChunks = allChunks.slice(0, opts.maxChunks!);

  // Add conversation relevance if this is a follow-up
  if (classified.isFollowUp && classified.previousContext) {
    for (const chunk of limitedChunks) {
      chunk.conversationRelevance = calculateConversationRelevance(
        chunk.content,
        classified.previousContext
      );
    }
  }

  return limitedChunks;
}

/**
 * Load all summaries from the project
 */
function loadAllSummaries(projectRoot: string): {
  files: FileSummary[];
  functions: FunctionSummary[];
  modules: ModuleSummary[];
  apis: APISummary[];
  decisions: DecisionSummary[];
} {
  return {
    files: getAllFileSummaries(projectRoot),
    functions: getAllFunctionSummaries(projectRoot),
    modules: getAllModuleSummaries(projectRoot),
    apis: getAllAPISummaries(projectRoot),
    decisions: getAllDecisionSummaries(projectRoot),
  };
}

/**
 * Build rich content from FileSummary (AI-generated, not raw code)
 */
export function buildFileSummaryContent(summary: FileSummary): string {
  const lines: string[] = [];

  lines.push(`## File`);
  lines.push(`**Purpose**: ${summary.purpose}`);

  if (summary.symbols.length > 0) {
    lines.push('\n**Exported Symbols**:');
    for (const symbol of summary.symbols.slice(0, 10)) {
      const blocked = symbol.blockedBy?.length
        ? ` [BLOCKED: ${symbol.blockedBy.map(b => b.name).join(', ')}]`
        : '';
      lines.push(`- ${symbol.name} (${symbol.kind}): ${symbol.summary}${blocked}`);
    }
    if (summary.symbols.length > 10) {
      lines.push(`  ... and ${summary.symbols.length - 10} more symbols`);
    }
  }

  if (summary.dependencies.length > 0) {
    lines.push(`\n**Dependencies**: ${summary.dependencies.slice(0, 10).join(', ')}`);
    if (summary.dependencies.length > 10) {
      lines.push(`  ... and ${summary.dependencies.length - 10} more`);
    }
  }

  if (summary.relatedFiles?.length) {
    lines.push(`\n**Related Files**: ${summary.relatedFiles.slice(0, 5).join(', ')}`);
  }

  if (summary.blockedBy?.length) {
    lines.push('\n**⚠️ Blockers**:');
    for (const blocker of summary.blockedBy) {
      lines.push(`- ${blocker.name}: ${blocker.reason}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build rich content from FunctionSummary (AI-generated, not raw code)
 */
export function buildFunctionSummaryContent(summary: FunctionSummary): string {
  const lines: string[] = [];

  lines.push(`## Function: ${summary.symbolName}`);
  lines.push(`**Purpose**: ${summary.purpose}`);
  lines.push(`**Signature**: ${summary.signature}`);

  if (summary.parameters?.length) {
    lines.push('\n**Parameters**:');
    for (const param of summary.parameters) {
      lines.push(`- ${param}`);
    }
  }

  if (summary.returnType) {
    lines.push(`**Returns**: ${summary.returnType}`);
  }

  lines.push(`\n**Description**: ${summary.summary}`);

  if (summary.complexity) {
    const complexityLabel = summary.complexity <= 5 ? 'Low' : summary.complexity <= 10 ? 'Medium' : 'High';
    lines.push(`**Complexity**: ${complexityLabel} (${summary.complexity})`);
  }

  if (summary.blockedBy?.length) {
    lines.push('\n**⚠️ Blockers**:');
    for (const blocker of summary.blockedBy) {
      lines.push(`- ${blocker.name}: ${blocker.reason}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build rich content from ModuleSummary
 */
export function buildModuleSummaryContent(summary: ModuleSummary): string {
  const lines: string[] = [];

  lines.push(`## Module`);
  lines.push(`**Summary**: ${summary.summary}`);
  lines.push(`**Files**: ${summary.fileCount}`);

  if (summary.exportedSymbols?.length) {
    lines.push('\n**Exports**:');
    for (const symbol of summary.exportedSymbols.slice(0, 10)) {
      lines.push(`- ${symbol}`);
    }
    if (summary.exportedSymbols.length > 10) {
      lines.push(`  ... and ${summary.exportedSymbols.length - 10} more`);
    }
  }

  if (summary.imports?.length) {
    lines.push(`\n**Imports**: ${summary.imports.slice(0, 10).join(', ')}`);
    if (summary.imports.length > 10) {
      lines.push(`  ... and ${summary.imports.length - 10} more`);
    }
  }

  if (summary.keyFiles?.length) {
    lines.push(`\n**Key Files**: ${summary.keyFiles.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Build rich content from APISummary
 */
export function buildAPISummaryContent(summary: APISummary): string {
  const lines: string[] = [];

  lines.push(`## API Endpoint: ${summary.endpoint}`);
  if (summary.method) {
    lines.push(`**Method**: ${summary.method}`);
  }
  lines.push(`**Description**: ${summary.description}`);

  if (summary.parameters?.length) {
    lines.push('\n**Parameters**:');
    for (const param of summary.parameters) {
      const required = param.required ? '(required)' : '(optional)';
      lines.push(`- ${param.name} ${required}: ${param.description || param.type}`);
    }
  }

  if (summary.responseType) {
    lines.push(`**Response**: ${summary.responseType}`);
  }

  return lines.join('\n');
}

/**
 * Build rich content from DecisionSummary
 */
export function buildDecisionSummaryContent(summary: DecisionSummary): string {
  const lines: string[] = [];

  lines.push(`## Decision: ${summary.title}`);
  lines.push(`**Context**: ${summary.context}`);
  lines.push(`**Rationale**: ${summary.rationale}`);

  if (summary.alternatives?.length) {
    lines.push('\n**Alternatives Considered**:');
    for (const alt of summary.alternatives) {
      lines.push(`- ${alt}`);
    }
  }

  if (summary.consequences?.length) {
    lines.push('\n**Consequences**:');
    for (const consequence of summary.consequences) {
      lines.push(`- ${consequence}`);
    }
  }

  return lines.join('\n');
}

/**
 * Enhanced semantic relevance calculation
 */
export function calculateSemanticRelevance(
  question: string,
  classified: ClassifiedQuestion,
  content: string,
  metadata: Record<string, string>
): number {
  let score = 0;
  const contentLower = content.toLowerCase();
  const questionLower = question.toLowerCase();

  // 1. Entity matches (highest weight - files/modules mentioned)
  for (const entity of classified.entities) {
    const entityLower = entity.toLowerCase();
    if (contentLower.includes(entityLower)) {
      score += 0.25;
    }
    // Check metadata too (filePath, symbolName, etc.)
    for (const value of Object.values(metadata)) {
      if (value && value.toLowerCase().includes(entityLower)) {
        score += 0.3;
      }
    }
  }

  // 2. Intent-specific scoring
  switch (classified.intent) {
    case 'overview':
      if (content.includes('Purpose') || content.includes('## File')) score += 0.15;
      break;
    case 'architecture':
      if (content.includes('Exported') || content.includes('Dependencies')) score += 0.2;
      if (content.includes('Related Files')) score += 0.15;
      break;
    case 'implementation':
      if (content.includes('## Function') || content.includes('Signature')) score += 0.3;
      if (content.includes('Description') || content.includes('Purpose')) score += 0.2;
      break;
    case 'usage':
      if (content.includes('Parameters') || content.includes('Usage')) score += 0.25;
      if (content.includes('API')) score += 0.2;
      break;
    case 'troubleshooting':
      if (content.includes('Blockers') || content.includes('ERROR') || content.includes('⚠️')) score += 0.3;
      break;
    case 'decision':
      if (content.includes('Rationale') || content.includes('Decision') || content.includes('Context')) score += 0.4;
      break;
    case 'exploration':
      // Lower threshold for exploration - be more inclusive
      score += 0.1;
      break;
  }

  // 3. Keyword matches (basic relevance)
  for (const keyword of classified.keywords) {
    if (contentLower.includes(keyword)) {
      score += 0.1;
    }
  }

  // 4. Follow-up bonus (conversation continuity)
  if (classified.isFollowUp && classified.previousContext) {
    for (const prevTopic of classified.previousContext) {
      if (contentLower.includes(prevTopic.toLowerCase())) {
        score += 0.15;
      }
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate conversation relevance for follow-up questions
 */
function calculateConversationRelevance(content: string, previousTopics: string[]): number {
  let relevance = 0;
  const contentLower = content.toLowerCase();

  for (const topic of previousTopics) {
    if (contentLower.includes(topic.toLowerCase())) {
      relevance += 0.1;
    }
  }

  return Math.min(relevance, 0.5);
}

/**
 * Find relevant raw file content as fallback (when no summaries available)
 */
export function findRawFileContent(
  question: string,
  classified: ClassifiedQuestion,
  projectRoot: string,
  maxFiles: number = 3
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];

  // Load file index
  const fileIndexPath = join(projectRoot, '.kg', 'file-index.json');
  if (!existsSync(fileIndexPath)) return chunks;

  try {
    const fileIndex = JSON.parse(readFileSync(fileIndexPath, 'utf-8'));
    const files = fileIndex.files || [];

    // Score files by relevance
    const scoredFiles: Array<{ path: string; score: number }> = [];
    for (const file of files) {
      const pathLower = (file.path || '').toLowerCase();
      let score = 0;

      for (const entity of classified.entities) {
        if (pathLower.includes(entity.toLowerCase())) {
          score += 0.3;
        }
      }

      for (const keyword of classified.keywords) {
        if (pathLower.includes(keyword)) {
          score += 0.1;
        }
      }

      if (score > 0) {
        scoredFiles.push({ path: file.path, score });
      }
    }

    // Sort and take top files
    scoredFiles.sort((a, b) => b.score - a.score);
    const topFiles = scoredFiles.slice(0, maxFiles);

    // Read content of top files
    for (const { path } of topFiles) {
      try {
        const content = readFileSync(path, 'utf-8');
        const truncatedContent = content.length > 2000 ? content.slice(0, 2000) + '\n...' : content;

        chunks.push({
          id: `raw:${path}`,
          type: 'raw_code',
          content: truncatedContent,
          sourcePath: path,
          filePath: path,
          relevance: 0.4, // Lower relevance than summaries
          freshness: 'unknown',
        });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Skip on error
  }

  return chunks;
}

/**
 * Group chunks by type for context building
 */
export function groupChunksByType(chunks: SemanticChunk[]): Record<string, SemanticChunk[]> {
  const groups: Record<string, SemanticChunk[]> = {};

  for (const chunk of chunks) {
    if (!groups[chunk.type]) {
      groups[chunk.type] = [];
    }
    groups[chunk.type].push(chunk);
  }

  return groups;
}

/**
 * Get the highest relevance chunk for a given type
 */
export function getBestChunk(chunks: SemanticChunk[], type: SemanticChunk['type']): SemanticChunk | undefined {
  const filtered = chunks.filter(c => c.type === type);
  return filtered.sort((a, b) => b.relevance - a.relevance)[0];
}