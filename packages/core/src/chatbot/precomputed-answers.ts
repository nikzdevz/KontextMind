import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import type { QuestionPattern, PrecomputedAnswer, PrecomputedManifest } from './types/precomputed-types.js';

const PRECOMPUTED_DIR = '.kontextmind/chatbot/precomputed';
const MANIFEST_FILE = 'manifest.json';

// Default patterns with RegExp objects
const DEFAULT_PATTERNS_WITH_REGEX: QuestionPattern[] = [
  { id: 'proj-purpose', regex: /what is|what does|explain.*project/i, patternType: 'contains', weight: 0.9, category: 'project_overview' },
  { id: 'proj-name', regex: /^(what is|project name)\s/i, patternType: 'prefix', weight: 0.95, category: 'project_overview' },
  { id: 'proj-description', regex: /tell me about|overview|describe/i, patternType: 'contains', weight: 0.85, category: 'project_overview' },
  { id: 'arch-overview', regex: /architecture|designed|organiz/i, patternType: 'contains', weight: 0.85, category: 'architecture' },
  { id: 'arch-components', regex: /components?|modules?|key files/i, patternType: 'contains', weight: 0.8, category: 'architecture' },
  { id: 'arch-structure', regex: /structure|folder|directory/i, patternType: 'contains', weight: 0.8, category: 'architecture' },
  { id: 'setup-prereq', regex: /prerequisite|requirement/i, patternType: 'contains', weight: 0.85, category: 'setup' },
  { id: 'setup-install', regex: /install|setup.*dependencies/i, patternType: 'contains', weight: 0.85, category: 'setup' },
  { id: 'setup-start', regex: /how do i start|run.*project|getting started/i, patternType: 'contains', weight: 0.85, category: 'setup' },
  { id: 'setup-dev', regex: /development|dev mode|local/i, patternType: 'contains', weight: 0.8, category: 'setup' },
  { id: 'api-usage', regex: /how (do|can|to) (use|call|invoke)|api.*usage/i, patternType: 'contains', weight: 0.8, category: 'api_behavior' },
  { id: 'deps-list', regex: /dependencies|packages|imports/i, patternType: 'contains', weight: 0.8, category: 'dependencies' },
  { id: 'deps-main', regex: /main packages|key dependencies/i, patternType: 'contains', weight: 0.75, category: 'dependencies' },
  { id: 'trouble-error', regex: /(why|error|problem|fail|not working)/i, patternType: 'contains', weight: 0.75, category: 'troubleshooting' },
  { id: 'trouble-debug', regex: /debug|diagnose|troubleshoot/i, patternType: 'contains', weight: 0.7, category: 'troubleshooting' },
  { id: 'onboard-contribute', regex: /contribute|add.*feature|develop/i, patternType: 'contains', weight: 0.8, category: 'developer_onboarding' },
  { id: 'onboard-test', regex: /test|testing|vitest|jest|run.*test/i, patternType: 'contains', weight: 0.75, category: 'developer_onboarding' },
  { id: 'onboard-build', regex: /build|compile|production/i, patternType: 'contains', weight: 0.75, category: 'developer_onboarding' },
  { id: 'auth-overview', regex: /auth|authentication|login|security/i, patternType: 'contains', weight: 0.8, category: 'authentication' },
  { id: 'db-schema', regex: /database|schema|db.*structure/i, patternType: 'contains', weight: 0.75, category: 'database' },
];

export function getPatterns(): QuestionPattern[] {
  return DEFAULT_PATTERNS_WITH_REGEX;
}

export function matchPattern(question: string): QuestionPattern | null {
  const lowerQuestion = question.toLowerCase();
  let bestMatch: QuestionPattern | null = null;
  let bestWeight = 0;

  for (const pattern of DEFAULT_PATTERNS_WITH_REGEX) {
    if (pattern.regex.test(lowerQuestion)) {
      if (pattern.weight > bestWeight) {
        bestMatch = pattern;
        bestWeight = pattern.weight;
      }
    }
  }

  return bestMatch;
}

export function loadManifest(projectRoot: string): PrecomputedManifest | null {
  const path = join(projectRoot, PRECOMPUTED_DIR, MANIFEST_FILE);
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as PrecomputedManifest;
  } catch {
    return null;
  }
}

export function loadPrecomputedAnswer(projectRoot: string, patternId: string): PrecomputedAnswer | null {
  const path = join(projectRoot, PRECOMPUTED_DIR, `${patternId}.json`);
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as PrecomputedAnswer;
  } catch {
    return null;
  }
}

export function loadAllPrecomputedAnswers(projectRoot: string): PrecomputedAnswer[] {
  const dir = join(projectRoot, PRECOMPUTED_DIR);
  if (!existsSync(dir)) return [];

  const answers: PrecomputedAnswer[] = [];

  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.json') && file !== MANIFEST_FILE) {
        const content = readFileSync(join(dir, file), 'utf-8');
        try {
          answers.push(JSON.parse(content) as PrecomputedAnswer);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return answers;
}

export async function savePrecomputedAnswer(
  projectRoot: string,
  answer: PrecomputedAnswer
): Promise<string> {
  const dir = join(projectRoot, PRECOMPUTED_DIR);
  ensureDir(dir);

  const path = join(dir, `${answer.patternId}.json`);
  writeFileSync(path, JSON.stringify(answer, null, 2), 'utf-8');

  return path;
}

export async function saveManifest(
  projectRoot: string,
  manifest: PrecomputedManifest
): Promise<void> {
  const dir = join(projectRoot, PRECOMPUTED_DIR);
  ensureDir(dir);

  const path = join(dir, MANIFEST_FILE);
  writeFileSync(path, JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function generatePrecomputedAnswers(
  projectRoot: string,
  context: {
    projectOverview?: string;
    architecture?: string;
    dependencies?: string[];
    setup?: string;
    testing?: string;
  }
): Promise<{ generated: number; errors: string[] }> {
  const errors: string[] = [];
  let generated = 0;

  const answers: PrecomputedAnswer[] = [];

  for (const pattern of DEFAULT_PATTERNS_WITH_REGEX) {
    try {
      const answer = generateAnswerForPattern(pattern, context);
      await savePrecomputedAnswer(projectRoot, answer);
      answers.push(answer);
      generated++;
    } catch (err) {
      errors.push(`Failed to generate answer for ${pattern.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const manifest: PrecomputedManifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    patternCount: DEFAULT_PATTERNS_WITH_REGEX.length,
    answerCount: generated,
    sourceFiles: [],
  };

  await saveManifest(projectRoot, manifest);

  return { generated, errors };
}

function generateAnswerForPattern(
  pattern: QuestionPattern,
  context: {
    projectOverview?: string;
    architecture?: string;
    dependencies?: string[];
    setup?: string;
    testing?: string;
  }
): PrecomputedAnswer {
  let answer = '';

  switch (pattern.category) {
    case 'project_overview':
      answer = buildProjectOverviewAnswer(context.projectOverview);
      break;
    case 'architecture':
      answer = buildArchitectureAnswer(context.architecture);
      break;
    case 'setup':
      answer = buildSetupAnswer(context.setup, context.projectOverview);
      break;
    case 'dependencies':
      answer = buildDependenciesAnswer(context.dependencies);
      break;
    case 'developer_onboarding':
      if (pattern.id === 'onboard-test') {
        answer = buildTestingAnswer(context.testing);
      } else {
        answer = buildOnboardingAnswer(context.setup);
      }
      break;
    default:
      answer = buildGenericAnswer(pattern.category, context);
  }

  return {
    id: `${pattern.id}-${Date.now()}`,
    patternId: pattern.id,
    question: pattern.exampleQuestion || `Example: ${pattern.category}`,
    answer,
    confidence: pattern.weight,
    sources: [{ type: 'llm-synthesis' as const, name: 'precomputed', relevanceScore: pattern.weight }],
    generatedAt: new Date().toISOString(),
    hitCount: 0,
  };
}

function buildProjectOverviewAnswer(overview?: string): string {
  if (overview) {
    return overview;
  }
  return 'This is a project managed with KontextMind. Run "kontextmind scan" and "kontextmind summarize" to generate a detailed project overview.';
}

function buildArchitectureAnswer(architecture?: string): string {
  if (architecture) {
    return architecture;
  }
  return 'The project architecture follows a modular structure. Run "kontextmind kb build" to generate a detailed architecture diagram.';
}

function buildSetupAnswer(setup?: string, projectOverview?: string): string {
  const parts: string[] = [];

  if (setup) {
    parts.push(setup);
  }

  parts.push('### Getting Started');
  parts.push('1. Install dependencies: `npm install`');
  parts.push('2. Run development server: `npm run dev`');
  parts.push('3. Build for production: `npm run build`');

  return parts.join('\n');
}

function buildDependenciesAnswer(dependencies?: string[]): string {
  const parts: string[] = [];

  parts.push('### Dependencies');
  parts.push('Key dependencies include:');

  if (dependencies && dependencies.length > 0) {
    for (const dep of dependencies.slice(0, 15)) {
      parts.push(`- \`${dep}\``);
    }
  } else {
    parts.push('- Run `kontextmind scan` to detect project dependencies');
  }

  return parts.join('\n');
}

function buildTestingAnswer(testing?: string): string {
  if (testing) {
    return testing;
  }
  return '### Testing\nTo run tests, use one of the following commands:\n- `npm test` - Run all tests\n- `npm run test:watch` - Run tests in watch mode\n- `npm run test:coverage` - Generate coverage report';
}

function buildOnboardingAnswer(setup?: string): string {
  const parts: string[] = [];

  parts.push('### Contributing\n1. Fork the repository');
  parts.push('2. Create a feature branch: `git checkout -b feat/your-feature`');
  parts.push('3. Make your changes and add tests');
  parts.push('4. Run `npm test` to ensure all tests pass');
  parts.push('5. Submit a pull request');

  return parts.join('\n');
}

function buildGenericAnswer(category: string, context: { projectOverview?: string }): string {
  return `This question relates to **${category}**. Run "kontextmind ask" with your specific question for detailed information.\n\n${context.projectOverview ? `Project context:\n${context.projectOverview}` : ''}`;
}

export async function clearPrecomputedCache(projectRoot: string): Promise<void> {
  const dir = join(projectRoot, PRECOMPUTED_DIR);
  if (!existsSync(dir)) return;

  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file !== '.gitkeep') {
        const path = join(dir, file);
        writeFileSync(path, '', 'utf-8');
      }
    }
  } catch {
    // Silently fail
  }
}