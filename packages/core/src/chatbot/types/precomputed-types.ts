import type { SourceReference } from '../chatbot-types.js';

export type PatternType = 'exact' | 'prefix' | 'contains' | 'fuzzy';

export interface QuestionPattern {
  id: string;
  regex: RegExp;
  patternType: PatternType;
  weight: number;
  category: string;
  exampleQuestion?: string;
}

export interface PrecomputedAnswer {
  id: string;
  patternId: string;
  question: string;
  answer: string;
  confidence: number;
  sources: SourceReference[];
  generatedAt: string;
  invalidatedAt?: string;
  hitCount: number;
}

export interface PrecomputedManifest {
  version: string;
  generatedAt: string;
  patternCount: number;
  answerCount: number;
  sourceFiles: string[];
}

export const DEFAULT_PATTERNS: Omit<QuestionPattern, 'regex'>[] = [
  { id: 'proj-purpose', patternType: 'contains', weight: 0.9, category: 'project_overview', exampleQuestion: 'What is this project about?' },
  { id: 'proj-name', patternType: 'exact', weight: 0.95, category: 'project_overview', exampleQuestion: 'What is the name of this project?' },
  { id: 'proj-description', patternType: 'contains', weight: 0.85, category: 'project_overview', exampleQuestion: 'Tell me about this project' },
  { id: 'arch-overview', patternType: 'contains', weight: 0.85, category: 'architecture', exampleQuestion: 'What is the architecture?' },
  { id: 'arch-components', patternType: 'contains', weight: 0.8, category: 'architecture', exampleQuestion: 'What are the main components?' },
  { id: 'arch-structure', patternType: 'contains', weight: 0.8, category: 'architecture', exampleQuestion: 'How is the project structured?' },
  { id: 'setup-prereq', patternType: 'contains', weight: 0.85, category: 'setup', exampleQuestion: 'What are the prerequisites?' },
  { id: 'setup-install', patternType: 'contains', weight: 0.85, category: 'setup', exampleQuestion: 'How do I install dependencies?' },
  { id: 'setup-start', patternType: 'contains', weight: 0.85, category: 'setup', exampleQuestion: 'How do I start the project?' },
  { id: 'setup-dev', patternType: 'contains', weight: 0.8, category: 'setup', exampleQuestion: 'How do I run in development mode?' },
  { id: 'api-usage', patternType: 'contains', weight: 0.8, category: 'api_behavior', exampleQuestion: 'How do I use the API?' },
  { id: 'deps-list', patternType: 'contains', weight: 0.8, category: 'dependencies', exampleQuestion: 'What dependencies does this project have?' },
  { id: 'deps-main', patternType: 'contains', weight: 0.75, category: 'dependencies', exampleQuestion: 'What are the main packages?' },
  { id: 'trouble-error', patternType: 'contains', weight: 0.75, category: 'troubleshooting', exampleQuestion: 'Why am I getting an error?' },
  { id: 'trouble-debug', patternType: 'contains', weight: 0.7, category: 'troubleshooting', exampleQuestion: 'How do I debug an issue?' },
  { id: 'onboard-contribute', patternType: 'contains', weight: 0.8, category: 'developer_onboarding', exampleQuestion: 'How do I contribute?' },
  { id: 'onboard-test', patternType: 'contains', weight: 0.75, category: 'developer_onboarding', exampleQuestion: 'How do I run tests?' },
  { id: 'onboard-build', patternType: 'contains', weight: 0.75, category: 'developer_onboarding', exampleQuestion: 'How do I build the project?' },
  { id: 'auth-overview', patternType: 'contains', weight: 0.8, category: 'authentication', exampleQuestion: 'How does authentication work?' },
  { id: 'db-schema', patternType: 'contains', weight: 0.75, category: 'database', exampleQuestion: 'What is the database schema?' },
];
