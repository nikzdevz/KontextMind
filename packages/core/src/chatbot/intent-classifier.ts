// Intent Classifier - Routes questions to appropriate retrieval strategies
import type { QuestionIntent, ClassifiedQuestion } from './chatbot-types.js';

// Intent detection patterns
const INTENT_PATTERNS: Record<QuestionIntent, RegExp[]> = {
  overview: [
    /what (is|does) this (project|repo|codebase)/i,
    /what('s| is) the purpose/i,
    /tell me about/i,
    /can you describe/i,
    /what can you tell me/i,
  ],
  architecture: [
    /how (does|do) (it|this|the system)/i,
    /what('s| is) the (structure|architecture|design)/i,
    /explain the (flow|process|workflow)/i,
    /how (are|is) (components|modules|parts) (connected|organized)/i,
    /what('s| is) the overall (structure|design)/i,
  ],
  implementation: [
    /how (is|was) .+ (implemented|built|created)/i,
    /where is .+ (defined|located|implemented)/i,
    /what .+ (does|doesn)/i,
    /show me how/i,
    /what('s| is) the (code|implementation) for/i,
    /can you show.*(function|method|class)/i,
  ],
  usage: [
    /how do I (use|configure|set up|get started)/i,
    /how can I .+ (with|using)/i,
    /(getting started|quick start)/i,
    /how should I.*(integrate|use|implement)/i,
    /(install|setup|configure).*(how|what)/i,
  ],
  troubleshooting: [
    /why (is|doesn|won't|doesn't)/i,
    /why did .+ (fail|break|error)/i,
    /(fix|debug|troubleshoot)/i,
    /not working/i,
    /having (trouble|problems|issues)/i,
    /how to fix.*(error|issue|problem)/i,
    /something went wrong/i,
  ],
  status: [
    /what('s| is) the status/i,
    /is .+ (done|working|complete|ready)/i,
    /how (far|much) (have|is) .+ (progress|done)/i,
    /what('s| is) the progress/i,
    /where are we (at|with)/i,
  ],
  decision: [
    /why was .+ (done|chosen|implemented)/i,
    /why didn('t| not) .+ (use|choose)/i,
    /what was the reasoning/i,
    /(rationale|reason) behind/i,
    /why (did we|was) .+ (instead of|rather than)/i,
    /what (led to|caused) .+ (decision|choice)/i,
  ],
  exploration: [
    /what .+ (features|capabilities|abilities)/i,
    /what can .+ (do|handle|support)/i,
    /tell me more about/i,
    /what else/i,
    /show me (everything|all|what)/i,
    /(discover|explore).*(project|codebase|system)/i,
  ],
};

// Follow-up detection patterns
const FOLLOW_UP_PATTERNS = [
  /^and\b/i,
  /^also\b/i,
  /^but\b/i,
  /^so\b/i,
  /^then\b/i,
  /^now\b/i,
  /(what about|how about|and for)/i,
  /more (details?|info)/i,
  /tell me more/i,
  /go on/i,
  /continue/i,
  /what else can.*(tell|show)/i,
  /that('s| is) (interesting|cool|great)/i,
];

// Stop words to filter from keywords
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'or', 'if', 'because', 'as', 'until', 'while',
  'this', 'that', 'these', 'those', 'am', 'it', 'its', 'what',
  'which', 'who', 'whom', 'whose', 'how', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'she', 'they', 'them', 'his', 'her',
]);

/**
 * Classify a question to determine its intent and extract entities
 */
export function classifyQuestion(
  question: string,
  conversationHistory?: string[]
): ClassifiedQuestion {
  const questionLower = question.toLowerCase();

  // Detect intent using pattern matching
  let intent: QuestionIntent = 'exploration';
  let bestIntentScore = 0;

  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    let bestPatternScore = 0;

    for (const pattern of patterns) {
      if (pattern.test(questionLower)) {
        bestPatternScore = Math.max(bestPatternScore, 1);
      }
    }

    if (bestPatternScore > bestIntentScore) {
      bestIntentScore = bestPatternScore;
      intent = intentType as QuestionIntent;
    }
  }

  // Extract entities (likely file/module names)
  const entities = extractEntities(questionLower);

  // Extract keywords (excluding stop words)
  const keywords = extractKeywords(questionLower);

  // Detect follow-up
  const isFollowUp = FOLLOW_UP_PATTERNS.some(p => p.test(questionLower));

  // Extract topics from conversation history for continuity
  const previousContext = conversationHistory?.length
    ? extractTopicsFromHistory(conversationHistory)
    : undefined;

  return {
    intent,
    entities,
    keywords,
    isFollowUp,
    previousContext,
  };
}

/**
 * Extract likely entity names (file names, module names, function names)
 */
function extractEntities(question: string): string[] {
  const entities: string[] = [];

  // CamelCase pattern (e.g., "apiServer", "myFunction")
  const camelCasePattern = /\b[a-z]+(?:[A-Z][a-z]+)+\b/g;
  const camelMatches = question.match(camelCasePattern) || [];
  entities.push(...camelMatches);

  // PascalCase pattern
  const pascalCasePattern = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g;
  const pascalMatches = question.match(pascalCasePattern) || [];
  entities.push(...pascalMatches);

  // snake_case pattern
  const snakeCasePattern = /\b[a-z]+(?:_[a-z]+)+\b/g;
  const snakeMatches = question.match(snakeCasePattern) || [];
  entities.push(...snakeMatches);

  // kebab-case pattern
  const kebabCasePattern = /\b[a-z]+(?:-[a-z]+)+\b/g;
  const kebabMatches = question.match(kebabCasePattern) || [];
  entities.push(...kebabMatches);

  // Common file extensions as context
  const filePatterns = /\b(\w+\.(js|ts|tsx|jsx|py|go|rs|java|cpp|c|h|rb|php|json|md|yaml|yml|toml))\b/gi;
  const fileMatches = question.match(filePatterns) || [];
  entities.push(...fileMatches);

  // Programming-related terms as potential entities
  const programmingTerms = [
    /\b(class|interface|trait|module|namespace|package)\s+([a-zA-Z_]\w*)/gi,
    /\b(function|method|function|procedure)\s+([a-zA-Z_]\w*)/gi,
    /\b(const|let|var|def|fn|func)\s+([a-zA-Z_]\w*)/gi,
  ];

  for (const pattern of programmingTerms) {
    let match;
    while ((match = pattern.exec(question)) !== null) {
      entities.push(match[2]);
    }
  }

  // Deduplicate and filter
  return [...new Set(entities)].filter(e => e.length > 2);
}

/**
 * Extract meaningful keywords from question
 */
function extractKeywords(question: string): string[] {
  const words = question.split(/\s+/);
  return words
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && /^[a-z]+$/i.test(w))
    .map(w => w.replace(/[^a-z]/gi, '').toLowerCase());
}

/**
 * Extract topics from conversation history for continuity
 */
function extractTopicsFromHistory(messages: string[]): string[] {
  const topics = new Set<string>();

  for (const message of messages) {
    // Extract camelCase and PascalCase words as potential topics
    const entityMatches = message.match(/[a-z]+(?:[A-Z][a-z]+)+/g);
    if (entityMatches) {
      entityMatches.forEach(m => topics.add(m.toLowerCase()));
    }

    // Extract significant words
    const words = message.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 4 && !STOP_WORDS.has(word)) {
        topics.add(word);
      }
    }
  }

  return Array.from(topics).slice(-10); // Keep last 10 topics
}

/**
 * Get human-readable intent label
 */
export function getIntentLabel(intent: QuestionIntent): string {
  const labels: Record<QuestionIntent, string> = {
    overview: 'Project Overview',
    architecture: 'Architecture Explanation',
    implementation: 'Implementation Details',
    usage: 'Usage Instructions',
    troubleshooting: 'Troubleshooting Help',
    status: 'Status Check',
    decision: 'Decision Rationale',
    exploration: 'Project Exploration',
  };
  return labels[intent];
}

/**
 * Get intent-specific system prompt prefix
 */
export function getIntentPrefix(intent: QuestionIntent): string {
  const prefixes: Record<QuestionIntent, string> = {
    overview: 'The user wants to understand what this project is about. Provide a clear, high-level description.',
    architecture: 'The user wants to understand how the system is structured. Explain components and their relationships without revealing file paths.',
    implementation: 'The user wants to understand how something is implemented. Explain the purpose and behavior without showing code.',
    usage: 'The user wants to know how to use or configure something. Provide clear, actionable instructions.',
    troubleshooting: 'The user is experiencing a problem. Help diagnose the issue and provide guidance.',
    status: 'The user wants to know the current state. Provide status information clearly.',
    decision: 'The user wants to understand the reasoning behind a choice. Explain the rationale.',
    exploration: 'The user wants to discover capabilities. Present information in an organized, comprehensive way.',
  };
  return prefixes[intent];
}

/**
 * Check if question is asking for code
 */
export function isCodeRequest(question: string): boolean {
  const q = question.toLowerCase();
  const codePatterns = [
    /show\s+me\s+(the\s+)?code/i,
    /give\s+me\s+(the\s+)?code/i,
    /provide\s+(the\s+)?code/i,
    /print\s+(the\s+)?code/i,
    /source\s+code\s+(of|for)/i,
    /complete\s+code\s+(of|for)/i,
    /raw\s+code\s+(of|for)/i,
    /what\s+is\s+(written|stored)\s+in/i,
    /content\s+of\s+(file|code)/i,
    /can you show.*(implementation|function|method)/i,
    /show me how.*(implemented|works)/i,
  ];
  return codePatterns.some(pattern => pattern.test(q));
}

/**
 * Check if question is asking for file paths
 */
export function isFilePathRequest(question: string): boolean {
  const q = question.toLowerCase();
  const pathPatterns = [
    /where (is|are|should|i find)/i,
    /file\s+path/i,
    /location\s+of/i,
    /directory\s+(structure|layout)/i,
    /show.*(folder|directory|tree) (structure|layout)/i,
  ];
  return pathPatterns.some(pattern => pattern.test(q));
}