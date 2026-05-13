import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname, relative } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { writeFileSafe } from '../filesystem/write-file-safe.js';
import { type QuestionAnswer, type QACategory, type ChatbotPolicy, type QAResult, type AskOptions, type SourceReference, type KBSearchResult } from './chatbot-types.js';
import { loadFileSummary, getAllFileSummaries, getAllFunctionSummaries } from '../summaries/summary-storage.js';
import { loadSymbolIndex } from '../parser/index.js';
import { type ProviderConfig, type ModelProvider } from '../providers/provider-types.js';
import { createProviderFromConfig } from '../providers/provider-registry.js';

// Production pipeline imports
import { classifyQuestion, getIntentPrefix, isCodeRequest } from './intent-classifier.js';
import { semanticSearch, findRawFileContent } from './semantic-search.js';
import { buildHierarchicalContext, buildConversationSummary, mergeContextForPrompt } from './context-builder.js';

// KB directories
const KB_DIR = '.kontextmind/chatbot';
const LOG_FILE = '.logs/qna-events.log';

export interface KBBuildOptions {
  mode?: 'chatbot';
  changedOnly?: boolean;
  mock?: boolean;
  maxQuestions?: number;
  projectRoot?: string;
  providerConfig?: ProviderConfig;
}

// Generate all KB files
export async function buildChatbotKB(options: KBBuildOptions = {}): Promise<{
  filesCreated: string[];
  questionsGenerated: number;
  durationMs: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const {
    projectRoot = process.cwd(),
    maxQuestions = 50,
  } = options;

  const errors: string[] = [];
  const filesCreated: string[] = [];

  // Ensure KB directory exists
  ensureDir(join(projectRoot, KB_DIR));

  // Generate files
  try {
    // 1. Project overview
    const overviewPath = await generateProjectOverview(projectRoot, options);
    filesCreated.push(overviewPath);

    // 2. Architecture
    const archPath = await generateArchitecture(projectRoot, options);
    filesCreated.push(archPath);

    // 3. Common questions
    const qaPath = await generateCommonQuestions(projectRoot, options);
    filesCreated.push(qaPath);

    // 4. API flows
    const apiPath = await generateAPIFlows(projectRoot, options);
    filesCreated.push(apiPath);

    // 5. File summaries
    const fileSumPath = await generateFileSummaries(projectRoot, options);
    filesCreated.push(fileSumPath);

    // 6. Function summaries
    const funcSumPath = await generateFunctionSummaries(projectRoot, options);
    filesCreated.push(funcSumPath);

    // 7. Dependency map
    const depPath = await generateDependencyMap(projectRoot, options);
    filesCreated.push(depPath);

    // 8. Entity map
    const entityPath = await generateEntityMap(projectRoot, options);
    filesCreated.push(entityPath);

    // 9. Troubleshooting
    const troublePath = await generateTroubleshooting(projectRoot, options);
    filesCreated.push(troublePath);

    // 10. Response policy
    const policyPath = await generateResponsePolicy(projectRoot);
    filesCreated.push(policyPath);
  } catch (err) {
    errors.push(`KB build failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    filesCreated,
    questionsGenerated: filesCreated.length,
    durationMs: Date.now() - startTime,
    errors,
  };
}

async function generateProjectOverview(projectRoot: string, options: KBBuildOptions): Promise<string> {
  // Load config from file
  let config: Record<string, unknown> = {};
  const configPath = join(projectRoot, '.kontextmind', 'config.json');
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  // Load file index stats
  const fileIndexPath = join(projectRoot, '.kg', 'file-index.json');
  let fileCount = 0;
  if (existsSync(fileIndexPath)) {
    try {
      const idx = JSON.parse(readFileSync(fileIndexPath, 'utf-8'));
      fileCount = idx.files?.length || 0;
    } catch { /* ignore */ }
  }

  // Load symbol index stats
  const symbolIndexPath = join(projectRoot, '.kg', 'symbol-index.json');
  let symbolCount = 0;
  if (existsSync(symbolIndexPath)) {
    try {
      const sym = JSON.parse(readFileSync(symbolIndexPath, 'utf-8'));
      symbolCount = sym.symbols?.length || 0;
    } catch { /* ignore */ }
  }

  // Load graph if available
  let graph: { nodes: unknown[]; edges: unknown[] } | null = null;
  const graphPath = join(projectRoot, '.kg', 'graph.json');
  if (existsSync(graphPath)) {
    try {
      graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  const content = `# Project Overview

## Project Name
${(config.project as Record<string, unknown>)?.name || 'Unknown Project'}

## Mode
${config.mode || 'readonly'}

## Phase
${config.phase || 'Unknown'}

## Description
${(config.project as Record<string, unknown>)?.description || 'No description available.'}

## Supported Agents
${((config.agents as string[]) || []).join(', ')}

## Git Integration
${(config.git as Record<string, unknown>)?.enabled ? 'Enabled' : 'Disabled'}

## Statistics
- Files indexed: ${fileCount}
- Symbols indexed: ${symbolCount}
- Graph nodes: ${graph?.nodes?.length || 0}

## Last Updated
${new Date().toISOString()}
`;

  const path = join(projectRoot, KB_DIR, 'project-overview.md');
  writeFileSafe(path, content);
  return path;
}

async function generateArchitecture(projectRoot: string, options: KBBuildOptions): Promise<string> {
  // Load graph if available
  let graph: { nodes: Array<{ id: string; label: string; type: string; metadata?: Record<string, unknown> }>; edges: unknown[] } | null = null;
  const graphPath = join(projectRoot, '.kg', 'graph.json');
  if (existsSync(graphPath)) {
    try {
      graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  let architecture = '# Architecture\n\n';

  if (graph && graph.nodes.length > 0) {
    const files = graph.nodes.filter(n => n.type === 'file');
    const symbols = graph.nodes.filter(n => n.type === 'symbol');
    const dependencies = graph.nodes.filter(n => n.type === 'dependency');

    architecture += `## File Structure\n`;
    architecture += `Total files: ${files.length}\n\n`;

    architecture += `## Key Components\n`;
    for (const symbol of symbols.slice(0, 20)) {
      architecture += `- ${symbol.label}: ${symbol.metadata?.kind || 'component'}\n`;
    }

    architecture += `\n## Dependencies\n`;
    architecture += `Total dependencies: ${dependencies.length}\n`;

    if (graph.edges.length > 0) {
      architecture += `\n## Relationships\n`;
      architecture += `Total connections: ${graph.edges.length}\n`;
    }
  } else {
    architecture += 'No architecture data available. Run "kontextmind index" first.\n';
  }

  const path = join(projectRoot, KB_DIR, 'architecture.md');
  writeFileSafe(path, architecture);
  return path;
}

async function generateCommonQuestions(projectRoot: string, options: KBBuildOptions): Promise<string> {
  const qaList = generateCuratedQuestions(projectRoot);
  const output = {
    questions: qaList.slice(0, options.maxQuestions || 50),
    generatedAt: new Date().toISOString(),
    totalCategories: 13,
  };

  const path = join(projectRoot, KB_DIR, 'common-questions.json');
  writeFileSafe(path, JSON.stringify(output, null, 2));
  return path;
}

function generateCuratedQuestions(projectRoot: string): QuestionAnswer[] {
  // Load config from file
  let config: Record<string, unknown> = {};
  const configPath = join(projectRoot, '.kontextmind', 'config.json');
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch { /* ignore */ }
  }
  const projectName = (config.project as Record<string, unknown>)?.name || 'this project';

  const questions: QuestionAnswer[] = [
    // Project overview
    {
      question: `What is this project about?`,
      answer: `${projectName} is a shared project brain for AI coding agents. It provides a centralized knowledge base that stores project context, code summaries, and architectural decisions to help AI assistants understand and work with the codebase more effectively.`,
      category: 'project_overview',
      tags: ['project', 'about', 'overview'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `What is the purpose of this project?`,
      answer: `${projectName} serves as a centralized knowledge base for AI agents. It stores project context, summaries, and policies to improve AI-assisted development. It helps AI coding agents understand the project without reading all the code.`,
      category: 'project_overview',
      tags: ['purpose', 'goals'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `Why should I use this?`,
      answer: `${projectName} helps AI coding agents work more effectively by providing instant context about the project. Instead of reading thousands of files, agents can ask questions and get immediate, informed answers. It also tracks work sessions and tasks for better continuity.`,
      category: 'project_overview',
      tags: ['why', 'use', 'benefits'],
      createdAt: new Date().toISOString(),
    },

    // MCP
    {
      question: `Does this project have MCP support?`,
      answer: `Yes! This project includes a full MCP (Model Context Protocol) server. The MCP server provides tools for AI coding agents to query the project knowledge base, search files, get summaries, and more.`,
      category: 'architecture',
      tags: ['mcp', 'server', 'feature'],
      createdAt: new Date().toISOString(),
    },

    // Features
    {
      question: `What features does this project have?`,
      answer: `${projectName} includes: (1) Code scanning and indexing, (2) AI-powered code summarization, (3) Knowledge graph generation, (4) MCP server for AI integration, (5) Chatbot knowledge base for Q&A, (6) Security audit tools, (7) CLI commands, (8) Session and task tracking.`,
      category: 'project_overview',
      tags: ['features', 'capabilities'],
      createdAt: new Date().toISOString(),
    },

    // Setup
    {
      question: `How do I set up this project?`,
      answer: `Run "pnpm install" to install dependencies, then "pnpm build" to build. Use "kontextmind init" to initialize the project context. For full functionality, configure an LLM provider.`,
      category: 'setup',
      tags: ['setup', 'installation'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `What are the prerequisites?`,
      answer: `Node.js (v18+), pnpm package manager, and optionally a code editor with AI integration. For AI-powered features like summarization, configure an LLM provider.`,
      category: 'setup',
      tags: ['prerequisites', 'requirements'],
      createdAt: new Date().toISOString(),
    },

    // Troubleshooting
    {
      question: `Why is something not working?`,
      answer: `Check the following: (1) Run "pnpm build" to ensure everything is compiled, (2) Run "kontextmind doctor" to diagnose issues, (3) Verify .kontextmind/config.json exists, (4) Check that you have initialized the project with "kontextmind init".`,
      category: 'troubleshooting',
      tags: ['not working', 'debug', 'help'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `How do I troubleshoot issues?`,
      answer: `Use "kontextmind doctor" to check system health. For specific issues: (1) CLI not found → run "pnpm build", (2) No summaries → run "kontextmind summarize", (3) Empty knowledge graph → run "kontextmind scan" then "kontextmind index".`,
      category: 'troubleshooting',
      tags: ['troubleshoot', 'debug', 'fix'],
      createdAt: new Date().toISOString(),
    },

    // Architecture
    {
      question: `How does this project work?`,
      answer: `${projectName} works by: (1) Scanning and indexing your codebase, (2) Generating AI-powered summaries of files and functions, (3) Building a knowledge graph of dependencies, (4) Providing a chatbot interface for asking questions about the project.`,
      category: 'architecture',
      tags: ['how', 'work', 'architecture'],
      createdAt: new Date().toISOString(),
    },

    // Security
    {
      question: `Is this project secure?`,
      answer: `${projectName} is designed with security in mind. It does not expose code or secrets in responses. The security audit feature helps identify potential vulnerabilities in your codebase. Always configure appropriate access controls for your environment.`,
      category: 'security',
      tags: ['security', 'safe'],
      createdAt: new Date().toISOString(),
    },
  ];

  return questions;
}

async function generateAPIFlows(projectRoot: string, options: KBBuildOptions): Promise<string> {
  const output = {
    flows: [
      {
        name: 'Initialization Flow',
        description: 'How KontextMind initializes in a project',
        steps: [
          'Run "kontextmind init" to create configuration',
          'Generate CLAUDE.md and AGENTS.md',
          'Create policy and instruction files',
          'Set up logging directories',
        ],
      },
      {
        name: 'Scanning Flow',
        description: 'How project files are indexed',
        steps: [
          'Run "kontextmind scan" to start scanning',
          'Read .toolignore to exclude files',
          'Hash each file for change detection',
          'Store file list in .kg/file-index.json',
        ],
      },
      {
        name: 'Indexing Flow',
        description: 'How symbols and dependencies are extracted',
        steps: [
          'Run "kontextmind index" after scan',
          'Parse code files for symbols',
          'Extract import/export relationships',
          'Build knowledge graph',
        ],
      },
      {
        name: 'Summarization Flow',
        description: 'How AI summaries are generated',
        steps: [
          'Run "kontextmind summarize" to generate summaries',
          'Load file index and symbol index',
          'Generate summaries using configured provider',
          'Store summaries in .summaries/',
        ],
      },
    ],
    generatedAt: new Date().toISOString(),
  };

  const path = join(projectRoot, KB_DIR, 'api-flows.json');
  writeFileSafe(path, JSON.stringify(output, null, 2));
  return path;
}

async function generateFileSummaries(projectRoot: string, options: KBBuildOptions): Promise<string> {
  const summaries = getAllFileSummaries(projectRoot);

  const output = {
    files: summaries.map(s => ({
      path: s.filePath,
      purpose: s.purpose,
      language: s.language,
      status: s.summaryStatus,
      symbolCount: s.symbols.length,
      dependencies: s.dependencies,
    })),
    total: summaries.length,
    generatedAt: new Date().toISOString(),
  };

  const path = join(projectRoot, KB_DIR, 'file-summaries.json');
  writeFileSafe(path, JSON.stringify(output, null, 2));
  return path;
}

async function generateFunctionSummaries(projectRoot: string, options: KBBuildOptions): Promise<string> {
  const summaries = getAllFunctionSummaries(projectRoot);

  const output = {
    functions: summaries.map(s => ({
      symbolId: s.symbolId,
      name: s.symbolName,
      filePath: s.filePath,
      summary: s.summary,
      purpose: s.purpose,
      signature: s.signature,
    })),
    total: summaries.length,
    generatedAt: new Date().toISOString(),
  };

  const path = join(projectRoot, KB_DIR, 'function-summaries.json');
  writeFileSafe(path, JSON.stringify(output, null, 2));
  return path;
}

async function generateDependencyMap(projectRoot: string, options: KBBuildOptions): Promise<string> {
  // Load graph if available
  let graph: { nodes: Array<{ type: string }>; edges: unknown[] } | null = null;
  const graphPath = join(projectRoot, '.kg', 'graph.json');
  if (existsSync(graphPath)) {
    try {
      graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  const output = {
    nodes: graph?.nodes.filter((n: { type: string }) => n.type === 'dependency') || [],
    edges: graph?.edges || [],
    totalNodes: graph?.nodes.filter((n: { type: string }) => n.type === 'dependency').length || 0,
    totalEdges: graph?.edges.length || 0,
    generatedAt: new Date().toISOString(),
  };

  const path = join(projectRoot, KB_DIR, 'dependency-map.json');
  writeFileSafe(path, JSON.stringify(output, null, 2));
  return path;
}

async function generateEntityMap(projectRoot: string, options: KBBuildOptions): Promise<string> {
  // Load graph if available
  let graph: { nodes: Array<{ id: string; label: string; type: string; metadata?: Record<string, unknown> }>; edges: unknown[] } | null = null;
  const graphPath = join(projectRoot, '.kg', 'graph.json');
  if (existsSync(graphPath)) {
    try {
      graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  const output = {
    entities: (graph?.nodes || []).map((n: { id: string; label: string; type: string; metadata?: Record<string, unknown> }) => ({
      id: n.id,
      name: n.label,
      type: n.type,
      filePath: n.metadata?.filePath,
    })),
    total: graph?.nodes.length || 0,
    generatedAt: new Date().toISOString(),
  };

  const path = join(projectRoot, KB_DIR, 'entity-map.json');
  writeFileSafe(path, JSON.stringify(output, null, 2));
  return path;
}

async function generateTroubleshooting(projectRoot: string, options: KBBuildOptions): Promise<string> {
  const output = {
    issues: [
      {
        problem: 'kontextmind command not found',
        solution: 'Run "pnpm build" to rebuild the CLI, then use "pnpm kontextmind" or link the package globally.',
        category: 'cli',
      },
      {
        problem: 'No summaries generated',
        solution: 'Run "kontextmind scan" first to build file index, then "kontextmind summarize --mock".',
        category: 'summaries',
      },
      {
        problem: 'Stale summaries',
        solution: 'Run "kontextmind summarize --changed-only" to refresh only changed files.',
        category: 'summaries',
      },
      {
        problem: 'Empty knowledge graph',
        solution: 'Run "kontextmind scan" then "kontextmind index" to build the graph.',
        category: 'graph',
      },
      {
        problem: 'Permission errors on Windows',
        solution: 'Ensure you have write permissions to the project directory. Try running as administrator if needed.',
        category: 'platform',
      },
    ],
    generatedAt: new Date().toISOString(),
  };

  const path = join(projectRoot, KB_DIR, 'troubleshooting.json');
  writeFileSafe(path, JSON.stringify(output, null, 2));
  return path;
}

async function generateResponsePolicy(projectRoot: string): Promise<string> {
  // STRICT POLICY - Block all code and file structure requests
  const policy: ChatbotPolicy = {
    // Code protection - ALWAYS OFF
    returnCode: false,
    maxCodeLines: 0,

    // File/Path protection - ALWAYS OFF
    allowFileNames: false,
    allowFilePaths: false,
    allowDirectoryStructure: false,

    // Information protection - limited access
    allowFunctionNames: false,
    allowArchitectureExplanation: true,  // Only high-level explanation, no structure
    allowHighLevelSteps: true,
    allowTechnicalDetails: false,

    // Strict mode - ACTIVE
    strictMode: true,
    blockCodeRequests: true,
    blockFileStructureRequests: true,
    blockRawCodeRequests: true,
  };

  const path = join(projectRoot, KB_DIR, 'response-policy.json');
  writeFileSafe(path, JSON.stringify(policy, null, 2));
  return path;
}

// KB Status
export function getKBStatus(projectRoot: string): {
  ready: boolean;
  hasOverview: boolean;
  hasArchitecture: boolean;
  questionCount: number;
  lastBuildTime: string | null;
  files: string[];
} {
  const kbDir = join(projectRoot, KB_DIR);
  const files: string[] = [];

  let hasOverview = false;
  let hasArchitecture = false;
  let questionCount = 0;

  if (existsSync(kbDir)) {
    const kbFiles = readdirSync(kbDir);
    for (const file of kbFiles) {
      files.push(file);

      if (file === 'project-overview.md') hasOverview = true;
      if (file === 'architecture.md') hasArchitecture = true;
      if (file === 'common-questions.json') {
        try {
          const content = readFileSync(join(kbDir, file), 'utf-8');
          const data = JSON.parse(content);
          questionCount = data.questions?.length || 0;
        } catch { /* ignore */ }
      }
    }
  }

  // Get last build time from any KB file
  let lastBuildTime: string | null = null;
  for (const file of files) {
    try {
      const stats = require('fs').statSync(join(kbDir, file));
      if (!lastBuildTime || stats.mtime > new Date(lastBuildTime)) {
        lastBuildTime = stats.mtime.toISOString();
      }
    } catch { /* ignore */ }
  }

  return {
    ready: hasOverview && hasArchitecture,
    hasOverview,
    hasArchitecture,
    questionCount,
    lastBuildTime,
    files,
  };
}

// Get last ask time from log
export function getLastAskTime(projectRoot: string): string | null {
  const logPath = join(projectRoot, LOG_FILE);

  if (!existsSync(logPath)) {
    return null;
  }

  try {
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;

    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/^\[([^\]]+)\]/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Generate unique response ID
function generateResponseId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

// Ask a question - Production pipeline with semantic search and LLM
// IMPORTANT: Always use the LLM provider to answer questions
export async function askQuestion(
  question: string,
  options: AskOptions = {},
  projectRoot: string = process.cwd()
): Promise<QAResult> {
  const mode = options.mode || 'chatbot-readonly';
  const source = options.source || 'cli';
  const responseId = generateResponseId();
  const startTime = Date.now();

  // Phase 1: Classify the question intent
  const classified = classifyQuestion(question);

  // Detect code request (for quality control)
  const codeRequest = isCodeRequest(question);

  // Phase 2: Semantic search using AI-generated summaries
  // Use lower threshold for overview/exploration questions since they're less specific
  const minRelevance = (classified.intent === 'overview' || classified.intent === 'exploration')
    ? 0.15  // Lower threshold for general questions
    : 0.25; // Normal threshold for specific questions

  let semanticChunks = await semanticSearch(question, classified, projectRoot, {
    maxChunks: 10,
    minRelevance,
    conversationTurn: options.conversationTurn || 0,
  });

  // Phase 3: If no summaries found, try raw file content as fallback
  // NOTE: We still pass these to LLM for context, but they won't be shown to user
  if (semanticChunks.length === 0) {
    semanticChunks = findRawFileContent(question, classified, projectRoot, 3);
  }

  // Phase 4: Build conversation summary if session exists
  const conversationSummary = undefined;

  // Phase 5: Build hierarchical context
  const hierarchicalContext = buildHierarchicalContext(
    question,
    classified,
    semanticChunks,
    conversationSummary,
    { maxTokens: 2500, allowRawCode: false }
  );

  // Get the LLM provider
  const providerResult = await getProvider(projectRoot);

  if (!('error' in providerResult)) {
    const { provider: llmProvider, name: providerName } = providerResult;
    const contextContent = mergeContextForPrompt(hierarchicalContext);

    // Build comprehensive system prompt with intent guidance + security rules
    const intentGuidance = getIntentPrefix(classified.intent);
    const PRODUCTION_SYSTEM_PROMPT = `You are a professional code analyst helping users understand their codebase.

${intentGuidance}

# SECURITY RULES (NEVER VIOLATE)
1. NEVER show file paths, directory structures, or file names
2. NEVER show code snippets, function signatures, or technical syntax
3. NEVER use backticks or code formatting
4. NEVER reveal the existence of specific files or folders
5. NEVER include JSON, configuration, or technical structures

# RESPONSE STYLE
- Use conversational, human language
- Focus on PURPOSE and MEANING, not implementation
- If unsure, say so clearly
- Be helpful and informative`;

    // Build the full user prompt with question + project context
    let userPrompt: string;
    if (contextContent && contextContent.trim().length > 0) {
      // We have AI-generated summaries to use as context
      userPrompt = `Question: ${question}\n\nProject Context:\n${contextContent}\n\nProvide a clear, helpful answer about the project using the context above.`;
    } else if (semanticChunks.length > 0) {
      // We have semantic chunks (from raw file search or empty summaries)
      const chunkContext = semanticChunks.map(c => c.content).join('\n\n---\n\n');
      userPrompt = `Question: ${question}\n\nContext from project files:\n${chunkContext}\n\nProvide a clear, helpful answer about the project.`;
    } else {
      // No context available - ask the LLM to answer based on general knowledge of the project
      userPrompt = `Question: ${question}\n\nNote: I don't have specific context files for this question. Please provide a helpful response based on general understanding of a KontextMind-style project (a code analysis and knowledge management tool for AI coding agents).`;
    }

    try {
      const result = await llmProvider.generateText({
        prompt: userPrompt,
        system: PRODUCTION_SYSTEM_PROMPT,
        maxTokens: 1500,
        temperature: 0.7,
      });

      if (result.text) {
        const finalFiltered = applyNoCodeFilter(result.text);
        const answer = finalFiltered.text;

        await logQNAEvent(projectRoot, {
          responseId,
          sessionId: options.sessionId,
          question: question.slice(0, 50) + (question.length > 50 ? '...' : ''),
          questionHash: simpleHash(question),
          answer: answer.slice(0, 100),
          sources: semanticChunks.slice(0, 5).map(c => c.type),
          rawCodeAccess: false,
          mode,
          source,
          feedbackSupported: source !== 'cli',
          confidence: 0.8,
          codeRequestDetected: codeRequest,
          conversationTurn: options.conversationTurn,
        });

        return {
          responseId,
          answer,
          confidence: 0.8,
          sources: semanticChunks.slice(0, 5).map(c => ({
            type: c.type as SourceReference['type'],
            name: c.id,
            relevanceScore: c.relevance,
          })),
          rawCodeAccess: false,
          policyApplied: true,
          mode: mode as 'readonly' | 'chatbot-readonly',
          llmEnhanced: true,
          provider: providerName,
          source,
          feedbackSupported: source !== 'cli',
        };
      }
    } catch (error) {
      console.warn(`Production LLM call failed: ${error instanceof Error ? error.message : String(error)}`);
      // Continue to error handling below
    }
  }

  // If we get here, LLM call failed. Return error with context about what was searched.
  const errorMessage = 'error' in providerResult
    ? providerResult.error
    : 'Failed to generate response. Please check your LLM provider configuration.';

  // Log the failed attempt
  await logQNAEvent(projectRoot, {
    responseId,
    sessionId: options.sessionId,
    question: question.slice(0, 50) + (question.length > 50 ? '...' : ''),
    questionHash: simpleHash(question),
    answer: `[LLM Error: ${errorMessage}]`,
    sources: semanticChunks.slice(0, 5).map(c => c.type),
    rawCodeAccess: false,
    mode,
    source,
    feedbackSupported: source !== 'cli',
    confidence: 0,
    codeRequestDetected: codeRequest,
    conversationTurn: options.conversationTurn,
  });

  return {
    responseId,
    answer: errorMessage,
    confidence: 0,
    sources: semanticChunks.slice(0, 5).map(c => ({
      type: c.type as SourceReference['type'],
      name: c.id,
      relevanceScore: c.relevance,
    })),
    rawCodeAccess: false,
    policyApplied: true,
    mode: mode as 'readonly' | 'chatbot-readonly',
    llmEnhanced: false,
    source,
    feedbackSupported: source !== 'cli',
  };
}

interface LLMEnhanceResult {
  success: boolean;
  answer: string;
  provider?: string;
  readRawCode: boolean;
}

// Get provider: global config → project config → mock
async function getProvider(projectRoot: string): Promise<{ provider: ModelProvider; name: string } | { error: string }> {
  // 1. Check global config first (same logic as summarize)
  const globalConfigDir = process.env.APPDATA || process.env.HOME || '';
  const globalConfigPath = join(globalConfigDir, '.kontextmind', 'config.json');
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
      const defaultProvider = globalConfig.defaultProvider;

      if (defaultProvider && globalConfig.providers?.[defaultProvider]) {
        const gp = globalConfig.providers[defaultProvider];
        const provider = createProviderFromConfig({
          name: defaultProvider,
          provider: gp.provider as 'openai' | 'anthropic' | 'ollama' | 'openai-compatible' | 'mock',
          apiKey: gp.apiKey,
          baseUrl: gp.baseUrl,
          model: gp.model,
        });

        if (provider && provider.getName() !== 'mock') {
          return { provider, name: `global:${defaultProvider}` };
        }
      }
    } catch { /* ignore */ }
  }

  // 2. Check project providers.json for selected_provider
  const projectConfigPath = join(projectRoot, '.kontextmind', 'providers.json');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      const selectedProvider = projectConfig.selected_provider;

      if (selectedProvider && selectedProvider !== 'none' && projectConfig.providers?.[selectedProvider]) {
        const pp = projectConfig.providers[selectedProvider];

        // Map type to provider
        let providerType: 'openai' | 'anthropic' | 'ollama' | 'openai-compatible' | 'mock' = 'mock';
        if (pp.type === 'openai-compatible') providerType = 'openai-compatible';
        else if (pp.type === 'openai') providerType = 'openai';
        else if (pp.type === 'anthropic') providerType = 'anthropic';
        else if (pp.type === 'ollama') providerType = 'ollama';

        const provider = createProviderFromConfig({
          name: selectedProvider,
          provider: providerType,
          apiKey: pp.api_key || (pp.api_key_env ? process.env[pp.api_key_env] : undefined),
          baseUrl: pp.base_url,
          model: pp.model,
        });

        if (provider && provider.getName() !== 'mock') {
          return { provider, name: selectedProvider };
        }
      }
    } catch { /* ignore */ }
  }

  return {
    error: 'No LLM provider configured. Please configure a provider:\n' +
      '  - Globally: kontextmind config add-provider --name <name> --type openai-compatible --baseUrl <url> --apiKey <key>\n' +
      '  - Then set: kontextmind config set-default-provider --name <name>\n' +
      '  - Or configure in .kontextmind/providers.json'
  };
}

// System prompt for LLM - Clean and simple: explain, don't show code
const LLM_SYSTEM_PROMPT = `You are a helpful assistant for the KontextMind project.

IMPORTANT RULES:
1. NEVER output source code, code snippets, or any code-like content
2. NEVER output file paths, directory structures, or file trees
3. NEVER output JSON structures or object definitions
4. NEVER use code formatting (backticks for code)

YOUR TASK:
Answer the user's question with a clear, verbal explanation.
Think like a product guide or documentation writer.
Use plain text, not code formatting.

GOOD: "The scanner works by reading all files in your project and creating a list of them with their content hashes."

BAD: "The scanner uses \`readdirSync\` to read files..."

Focus on explaining features, concepts, and how things work in words.`;

// Enhance answer with LLM - CAN read code internally but NEVER outputs it
async function enhanceWithLLM(
  question: string,
  searchResult: KBSearchResult,
  options: AskOptions,
  projectRoot: string
): Promise<LLMEnhanceResult> {
  // Get provider
  const providerResult = await getProvider(projectRoot);
  if ('error' in providerResult) {
    console.warn(`LLM enhancement skipped: ${providerResult.error}`);
    return { success: false, answer: searchResult.bestAnswer, readRawCode: false };
  }

  const { provider, name: providerName } = providerResult;

  // Build context from KB
  const contextParts: string[] = [];

  // Add KB content
  contextParts.push('## Knowledge Base Context\n');
  contextParts.push(searchResult.bestAnswer);

  // Add sources info
  if (searchResult.sources.length > 0) {
    contextParts.push('\n## Available Sources\n');
    for (const source of searchResult.sources) {
      contextParts.push(`- [${source.type}] ${source.name || 'unknown'}`);
    }
  }

  // If confidence is low, read actual code INTERNALLY to understand context
  // but NEVER include it in the output
  let readCode = false;
  if (searchResult.confidence < 0.4) {
    const relevantFiles = findRelevantFiles(question, projectRoot);
    if (relevantFiles.length > 0) {
      contextParts.push('\n## Code Analysis (Internal Context)\n');
      for (const file of relevantFiles.slice(0, 3)) {
        try {
          const content = readFileSync(file, 'utf-8');
          // Include code in context for the LLM to understand, but tell it NOT to output it
          contextParts.push(`\n### ${relative(projectRoot, file)} (analysis only - do not include in response)\n`);
          contextParts.push(content.slice(0, 2000));
          readCode = true;
        } catch { /* skip unreadable files */ }
      }
    }
  }

  const context = contextParts.join('\n');

  try {
    // Use the clean system prompt from the constant
    const result = await provider.generateText({
      prompt: `Question from user: ${question}\n\n${context}\n\nPlease answer with a clear verbal explanation only. Do not include any code, file paths, or technical formatting.`,
      system: LLM_SYSTEM_PROMPT,
      maxTokens: 1024,
      temperature: 0.7,
    });

    // Return the response directly - trust the LLM
    return {
      success: true,
      answer: result.text || searchResult.bestAnswer,
      provider: providerName,
      readRawCode: readCode,
    };
  } catch (error) {
    console.warn(`LLM enhancement failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, answer: searchResult.bestAnswer, readRawCode: false };
  }
}

// Find relevant files based on question keywords
function findRelevantFiles(question: string, projectRoot: string): string[] {
  const questionLower = question.toLowerCase();
  const keywords = questionLower.split(/\s+/).filter(w => w.length > 2);

  const relevantFiles: Array<{ path: string; score: number }> = [];

  // Search in .summaries/files/ for matching summaries
  const fileSumsDir = join(projectRoot, '.summaries', 'files');
  if (existsSync(fileSumsDir)) {
    const files = readdirSync(fileSumsDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = join(fileSumsDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        const filePathLower = (data.filePath || file).toLowerCase();

        let score = 0;
        for (const keyword of keywords) {
          if (filePathLower.includes(keyword)) {
            score += 2;
          }
        }

        if (score > 0 && data.filePath) {
          relevantFiles.push({ path: join(projectRoot, data.filePath), score });
        }
      } catch { /* skip */ }
    }
  }

  // Also search symbol index for function names
  const symbolIndexPath = join(projectRoot, '.kg', 'symbol-index.json');
  if (existsSync(symbolIndexPath)) {
    try {
      const data = JSON.parse(readFileSync(symbolIndexPath, 'utf-8'));
      for (const symbol of data.symbols || []) {
        const symbolLower = (symbol.name || '').toLowerCase();
        let score = 0;
        for (const keyword of keywords) {
          if (symbolLower.includes(keyword)) {
            score += 3;
          }
        }
        if (score > 0 && symbol.filePath) {
          relevantFiles.push({ path: join(projectRoot, symbol.filePath), score });
        }
      }
    } catch { /* skip */ }
  }

  // Sort by score and return top matches
  relevantFiles.sort((a, b) => b.score - a.score);
  return relevantFiles.map(f => f.path);
}

// Search across all knowledge base content
function searchKnowledgeBase(question: string, projectRoot: string): KBSearchResult {
  const questionLower = question.toLowerCase();

  let bestAnswer = 'No relevant information found. An LLM-enhanced response can be provided if a provider is configured.';
  let confidence = 0;
  const sources: SourceReference[] = [];
  const fallbackSources: string[] = [];

  // Search Q&A
  const qaPath = join(projectRoot, KB_DIR, 'common-questions.json');
  if (existsSync(qaPath)) {
    try {
      const content = readFileSync(qaPath, 'utf-8');
      const data = JSON.parse(content);

      let bestQA: { question: string; answer: string } | null = null;
      let bestQAScore = 0;

      for (const qa of data.questions || []) {
        const score = calculateRelevance(questionLower, qa.question.toLowerCase());
        // Also check if answer is relevant
        const answerScore = calculateRelevance(questionLower, qa.answer.toLowerCase()) * 0.5;
        const combinedScore = Math.max(score, answerScore);

        if (combinedScore > bestQAScore && combinedScore > 0.1) {
          bestQAScore = combinedScore;
          bestQA = qa;
        }
      }

      if (bestQA) {
        bestAnswer = bestQA.answer;
        confidence = bestQAScore;
        sources.push({ type: 'qa', name: bestQA.question, relevanceScore: bestQAScore });
      }
    } catch { /* ignore */ }
  }

  // Search file summaries
  const fileSumPath = join(projectRoot, KB_DIR, 'file-summaries.json');
  if (existsSync(fileSumPath)) {
    try {
      const content = readFileSync(fileSumPath, 'utf-8');
      const data = JSON.parse(content);

      for (const file of data.files || []) {
        const score = calculateRelevance(questionLower, file.path.toLowerCase() + ' ' + file.purpose.toLowerCase());
        if (score > 0.3) {
          sources.push({
            type: 'file_summary',
            name: file.path,
            relevanceScore: score
          });
        }
      }
    } catch { /* ignore */ }
  }

  // Search function summaries
  const funcSumPath = join(projectRoot, KB_DIR, 'function-summaries.json');
  if (existsSync(funcSumPath)) {
    try {
      const content = readFileSync(funcSumPath, 'utf-8');
      const data = JSON.parse(content);

      for (const func of data.functions || []) {
        const score = calculateRelevance(questionLower, func.name.toLowerCase() + ' ' + func.purpose.toLowerCase());
        if (score > 0.3) {
          sources.push({
            type: 'function_summary',
            name: func.name,
            relevanceScore: score
          });
        }
      }
    } catch { /* ignore */ }
  }

  // Search architecture/overview if no QA match found
  if (confidence < 0.4) {
    const overviewPath = join(projectRoot, KB_DIR, 'project-overview.md');
    if (existsSync(overviewPath)) {
      sources.push({ type: 'project', name: 'project-overview' });
    }
    fallbackSources.push('.summaries', '.kg', 'source code');
  }

  // Search task summaries
  const tasksDir = join(projectRoot, '.kontextmind', 'tasks');
  if (existsSync(tasksDir)) {
    try {
      const taskFiles = readdirSync(tasksDir).filter(f => f.endsWith('.md'));
      for (const file of taskFiles.slice(-5)) { // Search last 5 tasks
        const taskPath = join(tasksDir, file);
        try {
          const content = readFileSync(taskPath, 'utf-8');
          const score = calculateRelevance(questionLower, content.toLowerCase());
          if (score > 0.2) {
            // Extract title from the task summary
            const titleMatch = content.match(/^#\s+Task\s+Summary/m);
            const taskTitle = titleMatch ? file.replace('.md', '') : file;
            sources.push({
              type: 'task_summary',
              name: taskTitle,
              relevanceScore: score * 0.8 // Slightly lower weight than explicit Q&A
            });
            // Update best answer if this task is more relevant
            if (score > confidence && content.length < 2000) {
              bestAnswer = extractTaskSummary(content) || bestAnswer;
              confidence = Math.max(confidence, score * 0.7);
            }
          }
        } catch { /* skip unreadable files */ }
      }
    } catch { /* ignore */ }
  }

  // Search session summaries
  const sessionsDir = join(projectRoot, '.kontextmind', 'sessions');
  if (existsSync(sessionsDir)) {
    try {
      const sessionFiles = readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
      for (const file of sessionFiles.slice(-3)) { // Search last 3 sessions
        const sessionPath = join(sessionsDir, file);
        try {
          const content = readFileSync(sessionPath, 'utf-8');
          const score = calculateRelevance(questionLower, content.toLowerCase());
          if (score > 0.2) {
            const sessionTitle = file.replace('.md', '');
            sources.push({
              type: 'session_summary',
              name: sessionTitle,
              relevanceScore: score * 0.8
            });
            // Update best answer if this session is more relevant
            if (score > confidence && content.length < 2000) {
              bestAnswer = extractSessionSummary(content) || bestAnswer;
              confidence = Math.max(confidence, score * 0.7);
            }
          }
        } catch { /* skip unreadable files */ }
      }
    } catch { /* ignore */ }
  }

  // Determine if LLM is needed
  const needsLLM = confidence < 0.5;

  return {
    qa: null,
    fileSummaries: [],
    functionSummaries: [],
    graphNodes: [],
    bestAnswer,
    confidence,
    sources,
    needsLLM,
    fallbackSources,
  };
}

// Calculate relevance score
function calculateRelevance(query: string, text: string): number {
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();
  let matches = 0;

  for (const word of queryWords) {
    if (textLower.includes(word)) {
      matches++;
    }
  }

  return matches / queryWords.length;
}

// Extract summary from task summary file
function extractTaskSummary(content: string): string | null {
  // Extract key fields from task summary
  const lines = content.split('\n');
  const summaryParts: string[] = [];

  for (const line of lines) {
    // Look for key sections
    if (line.startsWith('## Goal') || line.startsWith('## Progress') || line.startsWith('## Decisions')) {
      summaryParts.push(line);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      // Bold headers
      summaryParts.push(line);
    }
  }

  if (summaryParts.length > 0) {
    return summaryParts.slice(0, 15).join('\n'); // Limit to first 15 relevant lines
  }
  return null;
}

// Extract summary from session summary file
function extractSessionSummary(content: string): string | null {
  // Extract key fields from session summary
  const lines = content.split('\n');
  const summaryParts: string[] = [];

  for (const line of lines) {
    // Look for key sections
    if (line.startsWith('## Goals') || line.startsWith('## Tasks') || line.startsWith('## Decisions') || line.startsWith('## Handoff')) {
      summaryParts.push(line);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      // Bold headers
      summaryParts.push(line);
    }
  }

  if (summaryParts.length > 0) {
    return summaryParts.slice(0, 15).join('\n'); // Limit to first 15 relevant lines
  }
  return null;
}

// Simple hash for logging
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// No-code filter - Removes code blocks from responses only
function applyNoCodeFilter(text: string): { text: string; hadCode: boolean } {
  let hadCode = false;
  let result = text;

  // Remove fenced code blocks (code blocks in responses)
  const codeBlockMatches = result.match(/```[\s\S]*?```/g);
  if (codeBlockMatches && codeBlockMatches.length > 0) {
    hadCode = true;
  }
  result = result.replace(/```[\s\S]*?```/g, '[Code snippet removed]');

  // Remove inline code ONLY if it contains code-like syntax
  result = result.replace(/`([^`\n]+)`/g, (match, content) => {
    // If it contains function-like syntax (arrows, parentheses with params, etc.)
    if (/[=>(]/.test(content) || /\w+\(\)/.test(content)) {
      hadCode = true;
      return '[code]';
    }
    // Otherwise keep it (it's probably a filename or term)
    return match;
  });

  // Clean up multiple newlines from removed content
  result = result.replace(/\n{3,}/g, '\n\n');

  return { text: result.trim(), hadCode };
}

// Log Q&A event - stores in JSON format for dataset generation
async function logQNAEvent(
  projectRoot: string,
  event: {
    responseId: string;
    sessionId?: string;
    question: string;
    questionHash: string;
    answer: string;
    sources: string[];
    rawCodeAccess: boolean;
    mode: string;
    source: 'cli' | 'api' | 'mcp';
    feedbackSupported: boolean;
    confidence: number;
    codeRequestDetected: boolean;
    conversationTurn?: number;
  }
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logPath = join(projectRoot, LOG_FILE);

  // Create JSON event for easier dataset generation
  const jsonEvent = JSON.stringify({
    responseId: event.responseId,
    sessionId: event.sessionId || null,
    question: event.question,
    questionHash: event.questionHash,
    answer: event.answer,
    confidence: event.confidence,
    sources: event.sources,
    rawCodeAccess: event.rawCodeAccess,
    mode: event.mode,
    source: event.source,
    feedbackSupported: event.feedbackSupported,
    codeRequestDetected: event.codeRequestDetected,
    conversationTurn: event.conversationTurn || 0,
    feedbackReceived: null, // Will be updated if user provides feedback
    feedbackTimestamp: null,
    timestamp,
  });

  // Also add text log for human readability
  const textLog = `[${timestamp}] Q&A: ${event.questionHash} | source: ${event.source} | conf: ${event.confidence.toFixed(2)} | code_req: ${event.codeRequestDetected} | feedback: none\n`;

  try {
    const dirPath = join(projectRoot, '.logs');
    ensureDir(dirPath);

    // Write JSON event
    const jsonPath = join(projectRoot, '.logs', 'qna-events.jsonl');
    if (existsSync(jsonPath)) {
      const existing = readFileSync(jsonPath, 'utf-8');
      writeFileSafe(jsonPath, existing + jsonEvent + '\n');
    } else {
      writeFileSafe(jsonPath, jsonEvent + '\n');
    }

    // Append text log
    if (existsSync(logPath)) {
      const existing = readFileSync(logPath, 'utf-8');
      writeFileSafe(logPath, existing + textLog);
    } else {
      writeFileSafe(logPath, textLog);
    }
  } catch {
    // Silently ignore logging errors
  }
}

// Record feedback for a response
export async function recordFeedback(
  responseId: string,
  feedback: 'like' | 'dislike',
  projectRoot: string = process.cwd()
): Promise<boolean> {
  const jsonPath = join(projectRoot, '.logs', 'qna-events.jsonl');

  if (!existsSync(jsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(jsonPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const timestamp = new Date().toISOString();

    // Find and update the matching response
    let updated = false;
    const updatedLines: string[] = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.responseId === responseId) {
          event.feedbackReceived = feedback;
          event.feedbackTimestamp = timestamp;
          updated = true;
        }
        updatedLines.push(JSON.stringify(event));
      } catch {
        // Skip invalid JSON lines
        updatedLines.push(line);
      }
    }

    if (updated) {
      writeFileSafe(jsonPath, updatedLines.join('\n') + '\n');

      // Also log to text file
      const textLog = `[${timestamp}] FEEDBACK: ${responseId} -> ${feedback}\n`;
      const logPath = join(projectRoot, LOG_FILE);
      if (existsSync(logPath)) {
        const existing = readFileSync(logPath, 'utf-8');
        writeFileSafe(logPath, existing + textLog);
      } else {
        writeFileSafe(logPath, textLog);
      }

      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Get feedback stats for dataset quality analysis
export function getFeedbackStats(projectRoot: string = process.cwd()): {
  total: number;
  likes: number;
  dislikes: number;
  codeRequests: number;
  codeRequestDislikes: number;
} {
  const jsonPath = join(projectRoot, '.logs', 'qna-events.jsonl');

  if (!existsSync(jsonPath)) {
    return { total: 0, likes: 0, dislikes: 0, codeRequests: 0, codeRequestDislikes: 0 };
  }

  try {
    const content = readFileSync(jsonPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    let total = 0;
    let likes = 0;
    let dislikes = 0;
    let codeRequests = 0;
    let codeRequestDislikes = 0;

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        total++;
        if (event.feedbackReceived === 'like') likes++;
        if (event.feedbackReceived === 'dislike') dislikes++;
        if (event.codeRequestDetected) codeRequests++;
        if (event.codeRequestDetected && event.feedbackReceived === 'dislike') {
          codeRequestDislikes++;
        }
      } catch {
        // Skip invalid lines
      }
    }

    return { total, likes, dislikes, codeRequests, codeRequestDislikes };
  } catch {
    return { total: 0, likes: 0, dislikes: 0, codeRequests: 0, codeRequestDislikes: 0 };
  }
}

export { KB_DIR, LOG_FILE };