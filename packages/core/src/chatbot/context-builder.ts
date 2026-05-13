// Hierarchical Context Builder - Assembles context in layers for optimal LLM input
import type {
  SemanticChunk,
  HierarchicalContext,
  ContextLayer,
  ClassifiedQuestion,
} from './chatbot-types.js';
import { groupChunksByType } from './semantic-search.js';

// Token limits for each layer
const LAYER_TOKEN_LIMITS = {
  layer1: 200,      // Session context
  layer2: 800,      // AI-generated summaries (file, function)
  layer3: 500,      // Module/Decision summaries
  layer4: 1000,     // Raw file chunks (ONLY when necessary)
  total: 2500,      // Total budget
};

/**
 * Build hierarchical context from semantic chunks
 */
export function buildHierarchicalContext(
  question: string,
  classified: ClassifiedQuestion,
  semanticChunks: SemanticChunk[],
  conversationSummary?: string,
  options: {
    maxTokens?: number;
    allowRawCode?: boolean;
  } = {}
): HierarchicalContext {
  const { maxTokens = LAYER_TOKEN_LIMITS.total, allowRawCode = false } = options;

  const layers: ContextLayer[] = [];
  let totalTokens = 0;

  // Layer 1: Session Context (always first)
  const sessionLayer = buildSessionContextLayer(conversationSummary);
  if (sessionLayer) {
    layers.push(sessionLayer);
    totalTokens += sessionLayer.tokens;
  }

  // Layer 2: AI-Generated Summaries (PRIMARY - file and function summaries)
  const summaryLayer = buildSummaryLayer(semanticChunks, classified.intent);
  if (summaryLayer) {
    // Truncate if needed
    const truncated = truncateToTokenLimit(summaryLayer, LAYER_TOKEN_LIMITS.layer2);
    layers.push(truncated);
    totalTokens += truncated.tokens;
  }

  // Layer 3: Module/Decision Summaries (if relevant)
  const moduleDecisionChunks = semanticChunks.filter(
    c => c.type === 'module_summary' || c.type === 'decision_summary' || c.type === 'api_summary'
  );

  if (moduleDecisionChunks.length > 0) {
    const moduleLayer = buildModuleDecisionLayer(moduleDecisionChunks, classified.intent);
    if (moduleLayer) {
      const truncated = truncateToTokenLimit(moduleLayer, LAYER_TOKEN_LIMITS.layer3);
      layers.push(truncated);
      totalTokens += truncated.tokens;
    }
  }

  // Layer 4: Raw Code (ONLY for implementation/troubleshooting, and only if no summaries available)
  const summaryChunks = semanticChunks.filter(
    c => c.type === 'file_summary' || c.type === 'function_summary'
  );

  if (allowRawCode &&
      ['implementation', 'troubleshooting'].includes(classified.intent) &&
      summaryChunks.length === 0) {

    const rawChunks = semanticChunks.filter(c => c.type === 'raw_code');
    if (rawChunks.length > 0) {
      const rawLayer = buildRawContextLayer(rawChunks);
      if (rawLayer) {
        const truncated = truncateToTokenLimit(rawLayer, LAYER_TOKEN_LIMITS.layer4);
        layers.push(truncated);
        totalTokens += truncated.tokens;
      }
    }
  }

  return {
    layers,
    totalTokens,
    maxTokens,
    truncated: totalTokens > maxTokens,
  };
}

/**
 * Build session context layer
 */
function buildSessionContextLayer(conversationSummary?: string): ContextLayer | null {
  if (!conversationSummary) return null;

  const tokens = estimateTokens(conversationSummary);
  if (tokens > LAYER_TOKEN_LIMITS.layer1) {
    // Truncate to fit
    return {
      layer: 1,
      name: 'conversation_context',
      tokens: LAYER_TOKEN_LIMITS.layer1,
      content: truncateToTokens(conversationSummary, LAYER_TOKEN_LIMITS.layer1),
      sources: ['conversation_history'],
    };
  }

  return {
    layer: 1,
    name: 'conversation_context',
    tokens,
    content: conversationSummary,
    sources: ['conversation_history'],
  };
}

/**
 * Build AI-generated summaries layer (file and function summaries)
 */
function buildSummaryLayer(chunks: SemanticChunk[], intent: string): ContextLayer | null {
  const summaryChunks = chunks.filter(
    c => c.type === 'file_summary' || c.type === 'function_summary'
  );

  if (summaryChunks.length === 0) return null;

  // Sort by relevance
  const sorted = [...summaryChunks].sort((a, b) => b.relevance - a.relevance);

  // Take top chunks (prioritize by intent)
  let selected = sorted.slice(0, 5);

  // If implementation intent, prioritize function summaries
  if (intent === 'implementation') {
    const funcChunks = selected.filter(c => c.type === 'function_summary');
    const fileChunks = selected.filter(c => c.type === 'file_summary');
    selected = [...funcChunks, ...fileChunks].slice(0, 5);
  }

  const content = selected
    .map(c => c.content)
    .join('\n\n---\n\n');

  return {
    layer: 2,
    name: 'ai_summaries',
    tokens: estimateTokens(content),
    content,
    sources: selected.map(c => c.id),
  };
}

/**
 * Build module/decision summaries layer
 */
function buildModuleDecisionLayer(
  chunks: SemanticChunk[],
  _intent: string
): ContextLayer | null {
  if (chunks.length === 0) return null;

  // Sort by relevance
  const sorted = [...chunks].sort((a, b) => b.relevance - a.relevance);

  // Take top 3
  const selected = sorted.slice(0, 3);

  const content = selected
    .map(c => c.content)
    .join('\n\n---\n\n');

  return {
    layer: 3,
    name: 'module_decisions',
    tokens: estimateTokens(content),
    content,
    sources: selected.map(c => c.id),
  };
}

/**
 * Build raw code context layer (fallback only)
 */
function buildRawContextLayer(chunks: SemanticChunk[]): ContextLayer | null {
  if (chunks.length === 0) return null;

  // Sort by relevance
  const sorted = [...chunks].sort((a, b) => b.relevance - a.relevance);

  // Take top 2
  const selected = sorted.slice(0, 2);

  const content = selected
    .map(c => `// Source: ${c.filePath || 'unknown'}\n${c.content}`)
    .join('\n\n---\n\n');

  return {
    layer: 4,
    name: 'raw_context',
    tokens: estimateTokens(content),
    content,
    sources: selected.map(c => c.sourcePath),
  };
}

/**
 * Estimate tokens (rough approximation: chars / 4)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate content to fit token limit
 */
function truncateToTokenLimit(layer: ContextLayer, maxTokens: number): ContextLayer {
  if (layer.tokens <= maxTokens) return layer;

  return {
    ...layer,
    tokens: maxTokens,
    content: truncateToTokens(layer.content, maxTokens),
  };
}

/**
 * Truncate text to approximate token count
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n...[content truncated to fit context limits]';
}

/**
 * Build conversation summary from session messages (Production version)
 */
export function buildConversationSummary(
  messages: Array<{ role: string; content: string }>,
  maxTurns: number = 3
): string | undefined {
  if (messages.length === 0) return undefined;

  // Get last N turns (user + assistant pairs)
  const recentMessages = messages.slice(-maxTurns * 2);

  if (recentMessages.length === 0) return undefined;

  const summaryParts: string[] = [
    '## Recent Conversation Context',
    '',
  ];

  for (let i = 0; i < recentMessages.length; i += 2) {
    const userMsg = recentMessages[i];
    const assistantMsg = recentMessages[i + 1];

    if (userMsg?.role === 'user') {
      // Truncate long questions
      const questionText = userMsg.content.length > 100
        ? userMsg.content.slice(0, 100) + '...'
        : userMsg.content;

      summaryParts.push(`**Previous Question**: ${questionText}`);

      if (assistantMsg?.role === 'assistant') {
        // Truncate long answers
        const answerText = assistantMsg.content.length > 150
          ? assistantMsg.content.slice(0, 150) + '...'
          : assistantMsg.content;

        summaryParts.push(`**Previous Answer Summary**: ${answerText}`);
      }
      summaryParts.push('');
    }
  }

  return summaryParts.join('\n');
}

/**
 * Merge multiple context layers into a single prompt
 */
export function mergeContextForPrompt(context: HierarchicalContext): string {
  const parts: string[] = [];

  for (const layer of context.layers) {
    const layerHeader = getLayerHeader(layer.layer);
    parts.push(`${layerHeader}\n${layer.content}`);
  }

  if (context.truncated) {
    parts.push('\n---\n[Note: Some context was truncated due to length limits]');
  }

  return parts.join('\n\n');
}

/**
 * Get human-readable layer header
 */
function getLayerHeader(layer: number): string {
  const headers: Record<number, string> = {
    1: '## Conversation History',
    2: '## Project Knowledge',
    3: '## Architecture & Decisions',
    4: '## Technical Details',
  };
  return headers[layer] || `## Context`;
}

/**
 * Calculate freshness score for context quality
 */
export function calculateFreshnessScore(context: HierarchicalContext): number {
  const summaryLayer = context.layers.find(l => l.name === 'ai_summaries');
  if (!summaryLayer) return 0;

  // If we have summaries, assume they're reasonably fresh
  // (actual freshness would require checking summary timestamps)
  return 0.8;
}

/**
 * Calculate overall relevance score for context quality
 */
export function calculateRelevanceScore(context: HierarchicalContext): number {
  if (context.layers.length === 0) return 0;

  // Average relevance from layer sources
  let totalRelevance = 0;
  let count = 0;

  // We don't have direct relevance scores here, so we estimate based on layers
  if (context.layers.some(l => l.name === 'ai_summaries')) {
    totalRelevance += 0.8;
    count++;
  }
  if (context.layers.some(l => l.name === 'module_decisions')) {
    totalRelevance += 0.6;
    count++;
  }
  if (context.layers.some(l => l.name === 'conversation_context')) {
    totalRelevance += 0.5;
    count++;
  }

  return count > 0 ? totalRelevance / count : 0;
}

/**
 * Get context statistics
 */
export function getContextStats(context: HierarchicalContext): {
  layerCount: number;
  totalTokens: number;
  totalChars: number;
  sourceCount: number;
  layers: string[];
} {
  return {
    layerCount: context.layers.length,
    totalTokens: context.totalTokens,
    totalChars: context.layers.reduce((sum, l) => sum + l.content.length, 0),
    sourceCount: context.layers.reduce((sum, l) => sum + l.sources.length, 0),
    layers: context.layers.map(l => l.name),
  };
}

// ==================== Legacy exports for backward compatibility ====================

export type { ContextOptions } from './chatbot-types.js';

export interface ConversationTurn {
  userMessage: string;
  assistantMessage: string;
  responseId?: string;
  timestamp: string;
}

export interface BuiltContext {
  fullContext: string;
  recentTurns: ConversationTurn[];
  topicSummary: string;
  entitySummary: string;
  maxTokensUsed: number;
}

// Legacy: Build conversation context string for LLM
export function buildConversationContext(
  session: { messages: Array<{ role: string; content: string }>; context: { topics: string[]; entities: Array<{ name: string; type: string; referenceCount: number }> }; projectName: string },
  options: { maxTurns?: number; includeSystemPrompt?: boolean; includeTopics?: boolean } = {}
): string {
  const maxTurns = options.maxTurns || 5;
  const messages = session.messages;
  const turns = messages.slice(-maxTurns * 2);

  let context = '';

  // Add system prompt if requested
  if (options.includeSystemPrompt) {
    context += `Project: ${session.projectName}\n`;
    if (options.includeTopics !== false && session.context.topics.length > 0) {
      context += `Topics: ${session.context.topics.join(', ')}\n`;
    }
    context += '\n';
  }

  // Add conversation turns
  for (let i = 0; i < turns.length; i += 2) {
    const userMsg = turns[i];
    const assistantMsg = turns[i + 1];
    if (userMsg?.role === 'user') {
      context += `User: ${userMsg.content}\n`;
      if (assistantMsg?.role === 'assistant') {
        context += `Assistant: ${assistantMsg.content}\n\n`;
      }
    }
  }

  return context.trim();
}

// Legacy: Build enhanced prompt with conversation history
export function buildEnhancedPrompt(
  originalQuestion: string,
  session: { messages: Array<{ role: string; content: string }>; context: { topics: string[]; entities: Array<{ name: string; type: string; referenceCount: number }> }; projectName: string },
  options: { maxTurns?: number; includeSystemPrompt?: boolean } = {}
): string {
  const conversationContext = buildConversationContext(session, {
    ...options,
    includeSystemPrompt: true,
  });

  // Build entity context
  let entitySummary = '';
  if (session.context.entities.length > 0) {
    const topEntities = session.context.entities
      .sort((a, b) => b.referenceCount - a.referenceCount)
      .slice(0, 10);
    entitySummary = topEntities.map(e => `- ${e.name} (${e.type}): mentioned ${e.referenceCount} time(s)`).join('\n');
  }

  // Build topic context
  const topicSummary = session.context.topics.join(' > ');

  let enhancedPrompt = conversationContext;
  enhancedPrompt += '\n\n';

  if (entitySummary) {
    enhancedPrompt += `Related entities from conversation:\n${entitySummary}\n\n`;
  }

  if (topicSummary) {
    enhancedPrompt += `Conversation topics: ${topicSummary}\n\n`;
  }

  enhancedPrompt += `Current question: ${originalQuestion}`;

  return enhancedPrompt;
}

// Legacy: Get turn number for current question
export function getCurrentTurn(session: { messages: Array<{ role: string }> }): number {
  return session.messages.filter(m => m.role === 'user').length;
}

// Legacy: Truncate context to fit token budget
export function truncateToTokenBudget(
  context: string,
  maxTokens: number,
  strategy: 'keep-start' | 'keep-end' | 'smart' = 'smart'
): { text: string; tokensUsed: number; truncated: boolean } {
  const currentTokens = estimateTokens(context);

  if (currentTokens <= maxTokens) {
    return { text: context, tokensUsed: currentTokens, truncated: false };
  }

  const targetTokens = Math.floor(maxTokens * 0.9);

  let truncated: string;
  switch (strategy) {
    case 'keep-start':
      truncated = truncateFromStart(context, targetTokens);
      break;
    case 'keep-end':
      truncated = truncateFromEnd(context, targetTokens);
      break;
    case 'smart':
    default:
      truncated = smartTruncate(context, targetTokens);
      break;
  }

  return {
    text: truncated,
    tokensUsed: estimateTokens(truncated),
    truncated: true,
  };
}

function truncateFromEnd(text: string, targetTokens: number): string {
  let tokens = 0;
  let start = text.length;

  for (let i = text.length - 1; i >= 0 && tokens < targetTokens; i--) {
    tokens++;
    if (text[i] === '\n' && tokens > 20) {
      start = i + 1;
    }
  }

  return '...(previous context)...\n' + text.slice(start);
}

function truncateFromStart(text: string, targetTokens: number): string {
  let tokens = 0;
  let end = 0;

  for (let i = 0; i < text.length && tokens < targetTokens; i++) {
    tokens++;
    if (text[i] === '\n' && tokens > 20 && text.length - i > 50) {
      end = i + 1;
    }
  }

  return text.slice(0, end) + '\n...(continued context)...';
}

function smartTruncate(text: string, targetTokens: number): string {
  const lines = text.split('\n');
  const turns: { lines: string[]; tokens: number }[] = [];
  let currentTurn: string[] = [];
  let currentTokens = 0;

  for (const line of lines) {
    currentTurn.push(line);
    currentTokens += estimateTokens(line) + 1;

    if (line.startsWith('User:') || line.startsWith('Assistant:')) {
      if (currentTurn.length > 2) {
        turns.push({ lines: [...currentTurn], tokens: currentTokens });
      }
      currentTurn = [];
      currentTokens = 0;
    }
  }

  const result: string[] = [];
  let usedTokens = 0;

  for (let i = turns.length - 1; i >= 0 && usedTokens < targetTokens; i--) {
    if (usedTokens + turns[i].tokens <= targetTokens) {
      result.unshift(...turns[i].lines);
      usedTokens += turns[i].tokens;
    } else {
      break;
    }
  }

  if (turns.length > result.filter(l => l.includes('User:') || l.includes('Assistant:')).length / 2) {
    return '...(earlier conversation)...\n\n' + result.join('\n');
  }

  return result.join('\n');
}

// Build context for a session-less ask (single turn)
export function buildSingleTurnContext(
  question: string,
  context?: {
    projectName?: string;
    recentQuestions?: string[];
    topics?: string[];
  }
): string {
  let contextStr = '';

  if (context?.projectName) {
    contextStr += `Project: ${context.projectName}\n`;
  }

  if (context?.topics && context.topics.length > 0) {
    contextStr += `Topics: ${context.topics.join(', ')}\n`;
  }

  if (context?.recentQuestions && context.recentQuestions.length > 0) {
    contextStr += '\nRecent context:\n';
    for (const q of context.recentQuestions.slice(-3)) {
      contextStr += `- ${q}\n`;
    }
    contextStr += '\n';
  }

  contextStr += `Question: ${question}`;
  return contextStr;
}

// Format turns for display or debugging
export function formatTurnsForDisplay(turns: ConversationTurn[]): string {
  return turns
    .map((turn, i) => {
      return `=== Turn ${i + 1} ===\nUser: ${turn.userMessage}\nAssistant: ${turn.assistantMessage}`;
    })
    .join('\n\n');
}

// Legacy: Extract conversation turns from session messages
export function getConversationTurns(
  session: { messages: Array<{ role: string; content: string; timestamp: string; responseId?: string }> },
  maxTurns?: number
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  const messages = session.messages;
  const max = maxTurns ? maxTurns * 2 : messages.length;

  for (let i = 0; i < messages.length && i < max; i += 2) {
    if (messages[i].role === 'user') {
      const assistantMsg = messages[i + 1];
      turns.push({
        userMessage: messages[i].content,
        assistantMessage: assistantMsg?.role === 'assistant' ? assistantMsg.content : '',
        responseId: assistantMsg?.responseId,
        timestamp: messages[i].timestamp,
      });
    }
  }

  return turns;
}