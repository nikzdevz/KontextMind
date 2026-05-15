/**
 * Brain Ask
 *
 * Uses learned knowledge to answer questions.
 * Falls back to AGENTIC code reading when no learned knowledge found.
 *
 * Flow:
 * 1. Query Semantic Memory (learned knowledge)
 * 2. Query Mental Model (project entities)
 * 3. Search Q&A history
 * 4. If nothing found → AGENTIC Code Reading:
 *    a. Find relevant files via semantic search
 *    b. Read file, ask LLM "do you have answer?"
 *    c. If no, continue to next file
 *    d. Iterate until answer found or files exhausted
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getSemanticMemory } from '../memory/semantic/semantic-memory.js';
import { getProjectMentalModel } from '../mental-model/project-mental-model.js';
import { getLearningBridge, type BrainStatus } from '../learning/learning-bridge.js';
import { createProviderFromConfig } from '../providers/provider-registry.js';
import type { ProviderConfig, ModelProvider } from '../providers/provider-types.js';
import { semanticSearch, findRawFileContent } from '../chatbot/semantic-search.js';
import { classifyQuestion } from '../chatbot/intent-classifier.js';
import type { SemanticChunk } from '../chatbot/chatbot-types.js';

const CHUNK_SIZE = 5000; // Read 5000 chars at a time
const MAX_CONTEXT_CHARS = 25000; // Max accumulated context (supports multiple files)
const MAX_FILES_TO_SUGGEST = 3; // Max files LLM can suggest per iteration
const BRACE_LOOKBACK = 500; // Max characters to look back for nearest closing brace

const QNA_LOG_FILE = '.logs/qna-events.jsonl';

export interface BrainAskOptions {
  projectRoot: string;
  providerConfig?: ProviderConfig;
  searchMemories?: boolean;
  searchEntities?: boolean;
  searchQnA?: boolean;
  searchCode?: boolean;
  maxResults?: number;
}

export interface BrainAskResult {
  answer: string;
  sources: BrainSource[];
  confidence: number;
  learnedFrom: LearnedSource[];
  fallbackUsed: boolean;
}

export interface BrainSource {
  type: 'memory' | 'entity' | 'qna' | 'summary' | 'code';
  content: string;
  relevance: number;
  filePath?: string;
  metadata?: Record<string, any>;
}

export interface LearnedSource {
  source: 'memory' | 'entity' | 'qna' | 'code' | 'imported';
  name: string;
  importance: number;
}

/**
 * BrainAsk - Answer questions using learned knowledge + fallback
 *
 * Example:
 * $ kontextmind brain-ask "how does auth work in this project?"
 *
 * If learned knowledge exists:
 *   → Returns answer from Semantic Memory, Mental Model, Q&A
 *
 * If no learned knowledge:
 *   → Falls back to reading code + LLM for answer
 */
export class BrainAsk {
  private projectRoot: string;
  private provider: ModelProvider | null = null;

  constructor(projectRoot: string, providerConfig?: ProviderConfig) {
    this.projectRoot = projectRoot;
    if (providerConfig) {
      this.provider = createProviderFromConfig(providerConfig);
    }
  }

  /**
   * Answer question - tries learned knowledge first, falls back to code + LLM
   */
  async answer(question: string, options: Partial<BrainAskOptions> = {}): Promise<BrainAskResult> {
    const opts = {
      projectRoot: this.projectRoot,
      searchMemories: true,
      searchEntities: true,
      searchQnA: true,
      searchCode: true,
      maxResults: 5,
      ...options,
    };

    const sources: BrainSource[] = [];
    const learnedFrom: LearnedSource[] = [];
    let confidence = 0;
    let fallbackUsed = false;

    // 1. Search Semantic Memory
    if (opts.searchMemories) {
      const memories = await this.searchMemories(question, opts.maxResults);
      for (const memory of memories) {
        sources.push({
          type: 'memory',
          content: memory.content,
          relevance: (memory.accessCount ?? 0) > 0 ? 0.7 : 0.5,
          metadata: { source: memory.source, tags: memory.tags },
        });
        learnedFrom.push({
          source: memory.tags?.includes('imported-summary') || memory.tags?.includes('imported-decision') ? 'imported' : 'memory',
          name: memory.source || 'Local',
          importance: memory.importance ?? 0.5,
        });
      }
      if (memories.length > 0) confidence += 0.25;
    }

    // 2. Search Mental Model
    if (opts.searchEntities) {
      const entities = this.searchEntities(question, opts.maxResults);
      for (const entity of entities) {
        sources.push({
          type: 'entity',
          content: entity.description,
          relevance: entity.importance,
          filePath: entity.filePath,
        });
        learnedFrom.push({ source: 'entity', name: entity.name, importance: entity.importance });
      }
      if (entities.length > 0) confidence += 0.2;
    }

    // 3. Search Q&A history
    if (opts.searchQnA) {
      const qnaResults = await this.searchQnA(question, opts.maxResults);
      for (const qna of qnaResults) {
        sources.push({
          type: 'qna',
          content: qna.content,
          relevance: qna.relevance,
        });
        learnedFrom.push({ source: 'qna', name: 'Q&A History', importance: qna.relevance });
      }
      if (qnaResults.length > 0) confidence += 0.15;
    }

    // 4. If nothing found → Fallback to code reading + LLM
    if (sources.length === 0 && opts.searchCode) {
      const codeResult = await this.fallbackToCode(question, opts.maxResults);
      sources.push(...codeResult.sources);
      learnedFrom.push(...codeResult.learnedFrom);
      confidence = codeResult.confidence;
      fallbackUsed = true;
    }

    // Generate answer
    const answer = this.generateAnswer(question, sources, confidence);

    return {
      answer,
      sources,
      confidence: Math.min(confidence, 1),
      learnedFrom: this.deduplicateSources(learnedFrom).slice(0, 5),
      fallbackUsed,
    };
  }

  private async searchMemories(query: string, limit: number) {
    const semanticMemory = getSemanticMemory(this.projectRoot);
    try {
      return await semanticMemory.recall(query, { limit });
    } catch {
      return [];
    }
  }

  private searchEntities(query: string, limit: number) {
    const mentalModel = getProjectMentalModel(this.projectRoot);
    const queryLower = query.toLowerCase();
    const allEntities = mentalModel.getAllEntities();

    return allEntities
      .map(entity => ({
        ...entity,
        score: this.calculateRelevance(entity, queryLower),
      }))
      .filter(e => e.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private calculateRelevance(entity: any, query: string): number {
    let score = 0;
    if (entity.name?.toLowerCase().includes(query)) score += 0.5;
    if (entity.description?.toLowerCase().includes(query)) score += 0.3;
    if (entity.filePath?.toLowerCase().includes(query)) score += 0.2;
    score += (entity.importance || 0) * 0.1;
    return Math.min(score, 1);
  }

  private async searchQnA(query: string, limit: number) {
    if (!existsSync(QNA_LOG_FILE)) return [];
    const results: Array<{ content: string; relevance: number }> = [];

    try {
      const lines = readFileSync(QNA_LOG_FILE, 'utf-8').split('\n').filter(l => l.trim());
      const queryWords = query.toLowerCase().split(/\s+/);

      for (const line of lines.slice(-100)) {
        try {
          const event = JSON.parse(line);
          const q = (event.question || '').toLowerCase();
          const a = event.answer || '';

          let relevance = 0;
          for (const word of queryWords) {
            if (q.includes(word)) relevance += 0.3;
            if (a.toLowerCase().includes(word)) relevance += 0.2;
          }

          if (relevance > 0.2) {
            results.push({
              content: `Q: ${event.question}\nA: ${a.slice(0, 300)}`,
              relevance: Math.min(relevance, 1),
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* file error */ }

    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  }

  /**
   * FALLBACK: Agentic Code Reading
   *
   * Reads files ITERATIVELY until answer is found or files exhausted.
   * - Uses semantic search to find relevant files
   * - Reads one file at a time
   * - Asks LLM "do you have enough info?"
   * - Continues if not, stops when answer found
   */
  private async fallbackToCode(question: string, limit: number) {
    const sources: BrainSource[] = [];
    const learnedFrom: LearnedSource[] = [];
    let confidence = 0.3;

    // Step 1: Classify the question for smarter file finding
    const classified = classifyQuestion(question);

    // Step 2: Use semantic search (finds AI-generated summaries first)
    const summaryChunks = await semanticSearch(question, classified, this.projectRoot, {
      maxChunks: limit,
      minRelevance: 0.2,
      includeStale: false,
      allowRawCode: false,
    });

    // Step 3: If summaries available, use them as primary source
    if (summaryChunks.length > 0) {
      for (const chunk of summaryChunks) {
        sources.push({
          type: 'summary',
          content: chunk.content,
          relevance: chunk.relevance,
          filePath: chunk.filePath,
        });
      }

      // Generate answer from summaries with LLM
      if (this.provider) {
        const summaryContext = sources.map(s => s.content).join('\n\n---\n\n');
        const llmAnswer = await this.askLLMForAnswer(question, summaryContext);
        if (llmAnswer) {
          sources.unshift({ type: 'code', content: `Answer: ${llmAnswer}`, relevance: 0.95 });
          confidence = 0.85;
        }
      }

      learnedFrom.push({ source: 'code', name: 'Semantic Search + AI Summaries', importance: confidence });
      return { sources, learnedFrom, confidence };
    }

    // Step 4: Fall back to raw file search (when no summaries exist)
    const rawChunks = findRawFileContent(question, classified, this.projectRoot, limit);
    if (rawChunks.length > 0) {
      // AGENTIC READING: Read files iteratively
      const result = await this.agenticReadFiles(question, rawChunks);
      sources.push(...result.sources);
      confidence = result.confidence;
      learnedFrom.push({ source: 'code', name: 'Agentic Code Analysis', importance: confidence });
      return { sources, learnedFrom, confidence };
    }

    // Step 5: No files found at all
    learnedFrom.push({ source: 'code', name: 'No Files Found', importance: 0.1 });
    return { sources, learnedFrom, confidence: 0.1 };
  }

  /**
   * AGENTIC FILE READING
   *
   * Key improvements over simple approach:
   * 1. Reads FULL file content (up to 8000 chars per file)
   * 2. Dynamic file suggestion - LLM can suggest which files to read next
   * 3. Auto-generates summaries for files when answer not found
   * 4. Accumulates context with smart truncation if needed
   */
  private async agenticReadFiles(
    question: string,
    chunks: SemanticChunk[]
  ): Promise<{ sources: BrainSource[]; confidence: number; found: boolean }> {
    if (!this.provider || chunks.length === 0) {
      return {
        sources: chunks.map(c => ({
          type: 'code' as const,
          content: `File: ${c.filePath}\n${c.content.slice(0, CHUNK_SIZE)}`,
          relevance: c.relevance,
          filePath: c.filePath,
        })),
        confidence: 0.4,
        found: false,
      };
    }

    const readSources: BrainSource[] = [];
    const readFiles = new Set<string>(); // Track which files we've read
    const suggestedFiles: string[] = []; // Files suggested by LLM
    const allChunks = [...chunks]; // Working list of chunks to process
    let accumulatedContext = '';

    // Priority queue: first read initial chunks, then suggested files
    let maxIterations = Math.min(allChunks.length, 8); // Allow up to 8 files
    let iterations = 0;

    while (iterations < maxIterations && allChunks.length > 0) {
      // Get next chunk (prefer suggested files if available)
      let chunkIndex = 0;
      if (suggestedFiles.length > 0) {
        const suggested = suggestedFiles.shift()!;
        const idx = allChunks.findIndex(c =>
          c.filePath?.includes(suggested) || c.sourcePath?.includes(suggested)
        );
        if (idx >= 0) chunkIndex = idx;
      }

      const chunk = allChunks[chunkIndex];
      allChunks.splice(chunkIndex, 1);

      // Skip if already read
      if (readFiles.has(chunk.filePath || chunk.sourcePath)) {
        continue;
      }

      // SMART FILE READING: Read file in smart chunks
      const filePath = join(this.projectRoot, chunk.filePath || chunk.sourcePath);
      let fileContent = '';

      if (existsSync(filePath)) {
        const fullContent = readFileSync(filePath, 'utf-8');
        // Smart chunk: read up to 5000 chars, but smart-truncate at brace boundary
        fileContent = this.smartChunkRead(fullContent);
      } else {
        fileContent = chunk.content;
      }

      readFiles.add(chunk.filePath || chunk.sourcePath);

      // Accumulate context (with safety truncation)
      const fileHeader = `\n\n--- File ${readFiles.size}: ${chunk.filePath} ---\n`;
      if (accumulatedContext.length + fileHeader.length + fileContent.length > MAX_CONTEXT_CHARS) {
        // Truncate accumulated context to make room
        accumulatedContext = accumulatedContext.slice(-15000);
      }
      accumulatedContext += fileHeader + fileContent;

      readSources.push({
        type: 'code',
        content: `File: ${chunk.filePath}\n${fileContent.slice(0, 800)}...`,
        relevance: chunk.relevance,
        filePath: chunk.filePath,
      });

      iterations++;

      // Ask LLM with smart prompting - can suggest more files or provide answer
      const response = await this.askLLMSmart(question, accumulatedContext, readFiles);

      if (response.found && response.answer) {
        // Found the answer!
        readSources.unshift({
          type: 'code',
          content: `LLM Answer: ${response.answer}`,
          relevance: 0.95,
        });

        // Auto-generate summary for files we read
        await this.autoGenerateSummary(readFiles, question, response.answer);

        return {
          sources: readSources,
          confidence: 0.85,
          found: true,
        };
      }

      // LLM wants more files - add suggestions to queue
      if (response.suggestedFiles && response.suggestedFiles.length > 0) {
        for (const suggestion of response.suggestedFiles.slice(0, MAX_FILES_TO_SUGGEST)) {
          if (!readFiles.has(suggestion) && !suggestedFiles.includes(suggestion)) {
            // Add to suggested files for next iteration
            suggestedFiles.push(suggestion);
            maxIterations = Math.min(maxIterations + 1, 12); // Allow more iterations if LLM suggests
          }
        }
      }
    }

    // Exhausted all files - generate partial answer
    const partialAnswer = await this.generatePartialAnswer(question, accumulatedContext);

    // Auto-generate summary for files read (even if no answer found)
    await this.autoGenerateSummary(readFiles, question, partialAnswer || 'No answer found');

    if (partialAnswer) {
      readSources.unshift({
        type: 'code',
        content: `Partial Answer: ${partialAnswer}`,
        relevance: 0.6,
      });
    }

    return {
      sources: readSources,
      confidence: partialAnswer ? 0.5 : 0.3,
      found: false,
    };
  }

  /**
   * Smart LLM query that can either:
   * - Provide answer (YES: ...)
   * - Request more files (SUGGEST: file1, file2)
   * - Report inability to answer (NO: reason)
   */
  private async askLLMSmart(
    question: string,
    context: string,
    readFiles: Set<string>
  ): Promise<{ found: boolean; answer?: string; suggestedFiles?: string[] }> {
    const prompt = `You are analyzing code to answer a question.

QUESTION: ${question}

CONTEXT (files read so far):
${context}

TASK: Determine if you have enough information to answer the question.

Respond with EXACTLY ONE of these formats:

1. If you can FULLY answer the question:
   YES: [your complete answer here - be specific and reference code]

2. If you need MORE files:
   SUGGEST: [comma-separated list of filenames or paths that might help]
   Examples: "auth/middleware.ts, auth/service.ts" or "src/utils/helpers.js"

3. If you CANNOT answer despite reading all files:
   NO: [brief explanation why this info doesn't exist in the code]

Do NOT say "I need more context" - be specific about which files you need.`;

    try {
      const llmResponse = await this.provider!.generateText({
        prompt,
        model: 'gpt-4',
        maxTokens: 600,
      });

      if (!llmResponse?.text) return { found: false, suggestedFiles: [] };

      const text: string = llmResponse.text;

      if (text.startsWith('YES:')) {
        return { found: true, answer: text.slice(4).trim() };
      }

      if (text.startsWith('SUGGEST:')) {
        const suggestions = text.slice(8)
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        return { found: false, suggestedFiles: suggestions };
      }

      if (text.startsWith('NO:')) {
        return { found: false, suggestedFiles: [] };
      }

      // Fallback: treat as NO
      return { found: false, suggestedFiles: [] };

    } catch {
      return { found: false, suggestedFiles: [] };
    }
  }

  /**
   * Auto-generate summary for files read during agentic reading
   * These summaries can be stored for future use
   */
  private async autoGenerateSummary(
    readFiles: Set<string>,
    question: string,
    answer: string
  ): Promise<void> {
    if (!this.provider || readFiles.size === 0) return;

    const semanticMemory = getSemanticMemory(this.projectRoot);
    const mentalModel = getProjectMentalModel(this.projectRoot);

    for (const filePath of readFiles) {
      try {
        // Get full file content
        const fullPath = join(this.projectRoot, filePath);
        if (!existsSync(fullPath)) continue;

        const content = readFileSync(fullPath, 'utf-8');
        const fileName = filePath.split('/').pop() || filePath;

        // Generate summary using LLM
        const summaryPrompt = `Analyze this code file and provide a brief summary.

FILE: ${filePath}

CONTENT (first 4000 chars):
${content.slice(0, 4000)}

Provide a summary with:
- Purpose: What does this file do?
- Key exports: What are the main functions/classes?
- Dependencies: What does it import?

Keep it under 200 words.`;

        const summaryResponse = await this.provider.generateText({
          prompt: summaryPrompt,
          model: 'gpt-4',
          maxTokens: 400,
        });

        const summary = summaryResponse.text?.trim();
        if (summary) {
          // Store in semantic memory
          await semanticMemory.store(
            `auto-file-${fileName}`,
            summary,
            {
              source: 'code_analysis',
              tags: ['auto-summary', 'brain-ask', 'learned-from-question'],
              importance: 0.6,
            }
          );

          // Add to mental model
          mentalModel.addEntity({
            id: `auto-entity-${fileName}`,
            name: fileName,
            type: 'file',
            filePath,
            description: summary,
            properties: {
              learnedFrom: question,
              learnedAnswer: answer.slice(0, 200),
              learnedAt: new Date().toISOString(),
            },
            relationships: [],
            importance: 0.7,
          });
        }
      } catch {
        // Skip summary generation on error
      }
    }
  }

  /**
   * Generate partial answer when files exhausted
   */
  private async generatePartialAnswer(question: string, context: string): Promise<string | null> {
    if (!this.provider) return null;

    const prompt = `Based on these code files, answer the question as best you can.

QUESTION: ${question}

FILES:
${context}

IMPORTANT:
- If you know some part of the answer, provide it
- If you don't know, say: "Based on my analysis of the project, this information does not exist in the codebase."
- Be specific about what you found and what you didn't find`;

    try {
      const response = await this.provider.generateText({
        prompt,
        model: 'gpt-4',
        maxTokens: 800,
      });
      return response.text?.trim() || null;
    } catch {
      return null;
    }
  }

  private async askLLMForAnswer(question: string, context: string): Promise<string | null> {
    if (!this.provider) return null;

    const prompt = `Based on the following context, answer the question concisely.

QUESTION: ${question}

CONTEXT:
${context}

Provide a clear, specific answer with references to the context.`;

    try {
      const response = await this.provider.generateText({
        prompt,
        model: 'gpt-4',
        maxTokens: 600,
      });
      return response.text?.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Smart Chunk Read - Reads file in chunks with brace-aware truncation
   *
   * - Reads up to CHUNK_SIZE characters
   * - If at a brace boundary, extends to end of current block
   * - Looks back up to BRACE_LOOKBACK characters for nearest closing brace
   * - Ensures complete code blocks are read (no half-finished functions)
   */
  private smartChunkRead(fullContent: string): string {
    // If file is small enough, return full content
    if (fullContent.length <= CHUNK_SIZE) {
      return fullContent;
    }

    // Get the chunk we need to smart-truncate
    const content = fullContent.slice(0, CHUNK_SIZE);
    const remaining = fullContent.slice(CHUNK_SIZE);

    // If remaining content is just whitespace or small, return full content
    if (remaining.trim().length < 50) {
      return fullContent;
    }

    // Check if we're in the middle of a block (have open braces)
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const balance = openBraces - closeBraces;

    if (balance <= 0) {
      // No unclosed blocks, safe to cut at chunk boundary
      return content + '\n... [truncated at chunk boundary]';
    }

    // We have unclosed braces - find nearest closing brace
    // Look at the last BRACE_LOOKBACK characters of the chunk
    const lookbackStart = Math.max(0, content.length - BRACE_LOOKBACK);
    const lookbackSection = content.slice(lookbackStart);

    // Find the last closing brace in the lookback section
    const lastBraceIndex = lookbackSection.lastIndexOf('}');

    if (lastBraceIndex >= 0) {
      // Cut at the actual closing brace (not at chunk boundary)
      const cutPoint = lookbackStart + lastBraceIndex + 1;
      return content.slice(0, cutPoint) + '\n... [truncated at code block boundary]';
    }

    // No closing brace found in lookback range - check for other patterns
    // Try to find last complete statement (semicolon, but not in string)
    const lastSemicolon = this.findLastCompleteStatement(content);

    if (lastSemicolon > CHUNK_SIZE * 0.7) {
      // Found a good statement boundary
      return content.slice(0, lastSemicolon + 1) + '\n... [truncated at statement]';
    }

    // Fallback: just return chunk
    return content + '\n... [truncated]';
  }

  /**
   * Find the last complete statement (ending with semicolon)
   * Avoids matching semicolons inside strings or comments
   */
  private findLastCompleteStatement(content: string): number {
    let lastValidSemicolon = -1;
    let inString = false;
    let stringChar = '';
    let inComment = false;
    let inMultiLineComment = false;

    for (let i = content.length - 1; i >= 0; i--) {
      const char = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      // Handle multi-line comments
      if (inMultiLineComment) {
        if (char === '/' && prev === '*') {
          inMultiLineComment = false;
        }
        continue;
      }

      // Handle single-line comments
      if (inComment) {
        if (char === '\n') {
          inComment = false;
        }
        continue;
      }

      // Enter multi-line comment
      if (char === '*' && prev === '/') {
        inMultiLineComment = true;
        continue;
      }

      // Enter single-line comment
      if (char === '/' && prev === '/') {
        inComment = true;
        continue;
      }

      // Handle strings
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        continue;
      }

      if (inString && char === stringChar && prev !== '\\') {
        inString = false;
        continue;
      }

      // Skip if in string or comment
      if (inString || inComment || inMultiLineComment) {
        continue;
      }

      // Found valid semicolon
      if (char === ';') {
        lastValidSemicolon = i;
        break;
      }
    }

    return lastValidSemicolon;
  }

  private generateAnswer(question: string, sources: BrainSource[], confidence: number): string {
    // Case 1: No sources found at all
    if (sources.length === 0) {
      return this.getOutOfContextResponse();
    }

    // Case 2: Only partial files read without clear answer
    const codeSources = sources.filter(s => s.type === 'code');
    const partialAnswer = codeSources.find(s => s.content.startsWith('Partial Answer:'));
    if (partialAnswer && confidence < 0.6) {
      return this.getOutOfContextResponse();
    }

    // Case 3: Normal answer generation
    const memorySources = sources.filter(s => s.type === 'memory');
    const entitySources = sources.filter(s => s.type === 'entity');
    const qnaSources = sources.filter(s => s.type === 'qna');
    const summarySources = sources.filter(s => s.type === 'summary');

    let answer = '';

    // Add source type indicator
    if (summarySources.length > 0) {
      answer += '[From AI-Generated Summaries]\n\n';
    } else if (codeSources.length > 0 && !sources.some(s => s.type !== 'code')) {
      answer += '[From Code Analysis + LLM]\n\n';
    } else if (memorySources.length > 0) {
      answer += '[From Learned Knowledge]\n\n';
    }

    // Build from summaries
    if (summarySources.length > 0) {
      const llmAnswer = codeSources.find(s => s.content.startsWith('Answer:'));
      if (llmAnswer) {
        answer += `Answer: ${llmAnswer.content.replace('Answer: ', '')}\n\n`;
      } else {
        answer += 'Based on project summaries:\n';
        for (const s of summarySources.slice(0, 2)) {
          answer += `• ${s.filePath}: ${s.content.slice(0, 150)}...\n`;
        }
        answer += '\n';
      }
    }

    // Build from memories
    if (memorySources.length > 0) {
      answer += 'From my memory:\n';
      for (const m of memorySources.slice(0, 3)) {
        answer += `• ${m.content.slice(0, 200)}\n\n`;
      }
    }

    // Build from entities
    if (entitySources.length > 0) {
      answer += 'Related project elements:\n';
      for (const e of entitySources.slice(0, 2)) {
        answer += `• ${e.filePath || e.content.slice(0, 80)}\n`;
      }
      answer += '\n';
    }

    // Build from Q&A
    if (qnaSources.length > 0) {
      answer += 'From previous Q&A:\n';
      for (const q of qnaSources.slice(0, 2)) {
        answer += `• ${q.content.slice(0, 150)}...\n`;
      }
      answer += '\n';
    }

    // Build from code
    if (codeSources.length > 0 && summarySources.length === 0) {
      const llmAnswer = codeSources.find(s => s.content.startsWith('LLM Answer:'));
      if (llmAnswer) {
        answer += `Answer: ${llmAnswer.content.replace('LLM Answer: ', '')}\n\n`;
      } else {
        answer += 'From code analysis:\n';
        for (const c of codeSources.slice(0, 3)) {
          answer += `• ${c.filePath}: ${c.content.slice(0, 100)}...\n`;
        }
      }
    }

    answer += `\n[Confidence: ${Math.round(confidence * 100)}%]`;

    return answer;
  }

  /**
   * Get an "out of context" response when answer cannot be found
   */
  private getOutOfContextResponse(): string {
    const responses = [
      'As per the project, I am not able to answer this question. The relevant information does not exist in the codebase.',
      'In your project, such a feature is not implemented yet.',
      'As per the project, this topic is not covered. You may need to implement it or the codebase does not contain related information.',
      'We don\'t have such features in this project based on the current codebase analysis.',
      'This question is out of context for the current project. The codebase does not contain relevant information to answer.',
      'Based on my analysis of the project, I couldn\'t find information related to this question. It may not be implemented yet.',
    ];

    // Use a deterministic selection based on timestamp for consistency
    const index = new Date().getSeconds() % responses.length;
    return responses[index];
  }

  private deduplicateSources(sources: LearnedSource[]): LearnedSource[] {
    const seen = new Map<string, LearnedSource>();
    for (const s of sources) {
      if (!seen.has(s.name)) seen.set(s.name, s);
    }
    return [...seen.values()];
  }

  getBrainStatus(): BrainStatus {
    return getLearningBridge(this.projectRoot).getStatus();
  }

  async sync(): Promise<void> {
    await getLearningBridge(this.projectRoot).syncNow();
  }
}

const instances: Map<string, BrainAsk> = new Map();

export function getBrainAsk(projectRoot: string = process.cwd()): BrainAsk {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new BrainAsk(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export function createBrainAsk(projectRoot: string, providerConfig?: ProviderConfig): BrainAsk {
  return new BrainAsk(projectRoot, providerConfig);
}

export type { BrainStatus } from '../learning/learning-bridge.js';