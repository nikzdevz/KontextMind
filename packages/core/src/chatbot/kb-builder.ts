import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname, relative } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { writeFileSafe } from '../filesystem/write-file-safe.js';
import { type QuestionAnswer, type QACategory, type ChatbotPolicy, type QAResult, type AskOptions, type SourceReference, type KBSearchResult } from './chatbot-types.js';
import { loadFileSummary, getAllFileSummaries, getAllFunctionSummaries } from '../summaries/summary-storage.js';
import { loadSymbolIndex } from '../parser/index.js';
import { type ProviderConfig } from '../providers/provider-types.js';

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
      question: `What is ${projectName}?`,
      answer: `${projectName} is a project managed by KontextMind. It provides a shared context and knowledge base for AI coding agents.`,
      category: 'project_overview',
      tags: ['project', 'overview', 'basic'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `What is the purpose of ${projectName}?`,
      answer: `This project serves as a centralized knowledge base for AI agents. It stores project context, summaries, and policies to improve AI-assisted development.`,
      category: 'project_overview',
      tags: ['purpose', 'goals'],
      createdAt: new Date().toISOString(),
    },

    // Architecture
    {
      question: `What is the architecture of ${projectName}?`,
      answer: `The project uses a modular architecture with separate packages for core functionality, adapters, MCP server, and CLI. Run "kontextmind index" and check the knowledge graph for detailed architecture.`,
      category: 'architecture',
      tags: ['architecture', 'structure', 'modules'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `How is the codebase organized?`,
      answer: `The codebase is organized into packages: /packages/core for core logic, /packages/adapters for integrations, /packages/mcp for MCP server, and /apps/cli for the command-line interface.`,
      category: 'architecture',
      tags: ['organization', 'structure', 'folders'],
      createdAt: new Date().toISOString(),
    },

    // Setup
    {
      question: `How do I set up ${projectName}?`,
      answer: `Run "pnpm install" to install dependencies, then "pnpm build" to build the project. Use "kontextmind init" to initialize KontextMind in your project.`,
      category: 'setup',
      tags: ['setup', 'installation', 'getting started'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `What are the prerequisites for running this project?`,
      answer: `Node.js (v18+), pnpm, and a code editor with Claude Code integration are recommended. For full functionality, configure an LLM provider in .kontextmind/config.json.`,
      category: 'setup',
      tags: ['prerequisites', 'requirements', 'dependencies'],
      createdAt: new Date().toISOString(),
    },

    // API behavior
    {
      question: `How do I use the main APIs?`,
      answer: `Import from @kontextmind/core for core functionality. See the individual package exports and README files for detailed API usage.`,
      category: 'api_behavior',
      tags: ['api', 'usage', 'interface'],
      createdAt: new Date().toISOString(),
    },

    // Authentication
    {
      question: `Does this project handle authentication?`,
      answer: `KontextMind itself doesn't implement application authentication. It provides security policies that AI agents must follow. Configure your application's auth separately.`,
      category: 'authentication',
      tags: ['auth', 'security', 'login'],
      createdAt: new Date().toISOString(),
    },

    // Error handling
    {
      question: `How are errors handled?`,
      answer: `Errors are logged to .logs/ directory and surfaced through CLI commands. Use "kontextmind doctor" to check system health and diagnose issues.`,
      category: 'error_handling',
      tags: ['errors', 'debugging', 'troubleshooting'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `Why did the scan/index fail?`,
      answer: `Check that .toolignore exists and is properly configured. Ensure you have run "kontextmind init" first. Use "kontextmind doctor" to identify issues.`,
      category: 'error_handling',
      tags: ['scan', 'index', 'failure'],
      createdAt: new Date().toISOString(),
    },

    // Dependencies
    {
      question: `What dependencies does this project have?`,
      answer: `Run "kontextmind index" to generate a dependency graph. The knowledge graph will show all imports and relationships between files.`,
      category: 'dependencies',
      tags: ['dependencies', 'packages', 'imports'],
      createdAt: new Date().toISOString(),
    },

    // Troubleshooting
    {
      question: `The CLI is not working, what should I check?`,
      answer: `1. Run "pnpm build" to ensure CLI is built\n2. Check "kontextmind doctor" for configuration issues\n3. Verify Node.js version (v18+)\n4. Check .kontextmind/config.json exists`,
      category: 'troubleshooting',
      tags: ['cli', 'not working', 'debugging'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `How do I regenerate the knowledge base?`,
      answer: `Run "kontextmind kb build --changed-only" to rebuild only changed content, or "kontextmind kb build" for a full rebuild.`,
      category: 'troubleshooting',
      tags: ['kb', 'rebuild', 'refresh'],
      createdAt: new Date().toISOString(),
    },

    // Developer onboarding
    {
      question: `How do I add a new feature?`,
      answer: `1. Read CLAUDE.md for project guidelines\n2. Make changes in the appropriate package\n3. Run tests with "pnpm test"\n4. Build with "pnpm build"\n5. Update relevant documentation`,
      category: 'developer_onboarding',
      tags: ['contributing', 'development', 'workflow'],
      createdAt: new Date().toISOString(),
    },
    {
      question: `What testing approach is used?`,
      answer: `The project uses Vitest for unit and integration testing. Run "pnpm test" to execute all tests. Tests are located in /tests directory.`,
      category: 'developer_onboarding',
      tags: ['testing', 'vitest', 'tdd'],
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
  const policy: ChatbotPolicy = {
    returnCode: false,
    maxCodeLines: 0,
    allowFileNames: true,
    allowFunctionNames: true,
    allowArchitectureExplanation: true,
    allowHighLevelSteps: true,
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

// Ask a question
export async function askQuestion(
  question: string,
  options: AskOptions = {},
  projectRoot: string = process.cwd()
): Promise<QAResult> {
  const mode = options.mode || 'chatbot-readonly';

  // Search KB
  const searchResult = searchKnowledgeBase(question, projectRoot);

  // Apply policy based on mode
  const policy: ChatbotPolicy = {
    returnCode: mode === 'chatbot-readonly' ? false : true,
    maxCodeLines: mode === 'chatbot-readonly' ? 0 : 10,
    allowFileNames: true,
    allowFunctionNames: true,
    allowArchitectureExplanation: true,
    allowHighLevelSteps: true,
  };

  // Build answer
  let answer = searchResult.bestAnswer;
  let rawCodeAccess = false;

  // Apply no-code filter if requested
  if (options.noCode || mode === 'chatbot-readonly') {
    const filtered = applyNoCodeFilter(answer);
    answer = filtered.text;
    rawCodeAccess = filtered.hadCode;
  }

  // Log Q&A event
  await logQNAEvent(projectRoot, {
    question: question.slice(0, 50) + (question.length > 50 ? '...' : ''),
    questionHash: simpleHash(question),
    sources: searchResult.sources.map(s => s.type),
    rawCodeAccess,
    mode,
    confidence: searchResult.confidence,
    result: answer.slice(0, 100),
  });

  return {
    answer,
    confidence: searchResult.confidence,
    sources: searchResult.sources,
    rawCodeAccess,
    policyApplied: true,
    mode: mode as 'readonly' | 'chatbot-readonly',
  };
}

// Search across all knowledge base content
function searchKnowledgeBase(question: string, projectRoot: string): KBSearchResult {
  const questionLower = question.toLowerCase();
  const words = questionLower.split(/\s+/);

  let bestAnswer = 'No relevant information found. Try rephrasing your question.';
  let confidence = 0;
  const sources: SourceReference[] = [];

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
        if (score > bestQAScore && score > 0.3) {
          bestQAScore = score;
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
  }

  return {
    qa: null,
    fileSummaries: [],
    functionSummaries: [],
    graphNodes: [],
    bestAnswer,
    confidence,
    sources,
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

// No-code filter
function applyNoCodeFilter(text: string): { text: string; hadCode: boolean } {
  let hadCode = false;
  let result = text;

  // Remove fenced code blocks
  result = result.replace(/```[\s\S]*?```/g, () => {
    hadCode = true;
    return '[Code block removed - enable raw code access for full response]';
  });

  // Remove inline code
  result = result.replace(/`[^`]+`/g, (match) => {
    // Check for potential secrets
    if (match.includes('=') || match.includes('KEY') || match.includes('SECRET')) {
      hadCode = true;
      return '[value hidden]';
    }
    return match;
  });

  return { text: result, hadCode };
}

// Log Q&A event
async function logQNAEvent(
  projectRoot: string,
  event: {
    question: string;
    questionHash: string;
    sources: string[];
    rawCodeAccess: boolean;
    mode: string;
    confidence: number;
    result: string;
  }
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] Q&A: ${event.questionHash} | sources: ${event.sources.join(',')} | raw: ${event.rawCodeAccess} | mode: ${event.mode} | conf: ${event.confidence.toFixed(2)} | result: ${event.result}\n`;
  const logPath = join(projectRoot, LOG_FILE);

  try {
    const dirPath = join(projectRoot, '.logs');
    ensureDir(dirPath);

    if (existsSync(logPath)) {
      const existing = readFileSync(logPath, 'utf-8');
      writeFileSafe(logPath, existing + logLine);
    } else {
      writeFileSafe(logPath, logLine);
    }
  } catch {
    // Silently ignore logging errors
  }
}

export { KB_DIR, LOG_FILE };