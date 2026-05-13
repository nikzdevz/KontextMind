// Context Builder - Builds conversation context for multi-turn ask
import type { ChatSession, ChatMessage } from './chatbot-types.js';
import type { ContextOptions } from './chatbot-types.js';

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

// Build conversation context string for LLM
export function buildConversationContext(
  session: ChatSession,
  options: ContextOptions = {}
): string {
  const maxTurns = options.maxTurns || 5;
  const turns = getConversationTurns(session, maxTurns);

  let context = '';

  // Add system prompt if requested
  if (options.includeSystemPrompt) {
    context += buildSystemPrompt(session, options);
  }

  // Add conversation turns
  for (const turn of turns) {
    context += `User: ${turn.userMessage}\n`;
    context += `Assistant: ${turn.assistantMessage}\n\n`;
  }

  return context.trim();
}

function buildSystemPrompt(session: ChatSession, options: ContextOptions): string {
  let prompt = `Project: ${session.projectName}\n`;

  // Add topics if requested
  if (options.includeTopics !== false && session.context.topics.length > 0) {
    prompt += `Topics: ${session.context.topics.join(', ')}\n`;
  }

  // Add entities
  if (session.context.entities.length > 0) {
    const topEntities = session.context.entities
      .sort((a, b) => b.referenceCount - a.referenceCount)
      .slice(0, 10);
    prompt += `Related entities: ${topEntities.map(e => `${e.name} (${e.type})`).join(', ')}\n`;
  }

  prompt += '\n';
  return prompt;
}

// Extract user-assistant pairs from messages
export function getConversationTurns(session: ChatSession, maxTurns?: number): ConversationTurn[] {
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

// Build enhanced prompt with conversation history
export function buildEnhancedPrompt(
  originalQuestion: string,
  session: ChatSession,
  options: ContextOptions = {}
): string {
  const conversationContext = buildConversationContext(session, {
    ...options,
    includeSystemPrompt: true,
  });

  // Build entity context
  const entitySummary = buildEntitySummary(session);

  // Build topic context
  const topicSummary = buildTopicSummary(session);

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

// Build entity summary from session context
function buildEntitySummary(session: ChatSession): string {
  if (session.context.entities.length === 0) return '';

  const topEntities = session.context.entities
    .sort((a, b) => b.referenceCount - a.referenceCount)
    .slice(0, 15);

  return topEntities
    .map(e => `- ${e.name} (${e.type}): mentioned ${e.referenceCount} time(s)`)
    .join('\n');
}

// Build topic summary from session context
function buildTopicSummary(session: ChatSession): string {
  return session.context.topics.join(' > ');
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

// Count tokens (rough estimate: 1 token ≈ 4 chars)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate context to fit token budget
export function truncateToTokenBudget(
  context: string,
  maxTokens: number,
  strategy: 'keep-start' | 'keep-end' | 'smart' = 'smart'
): { text: string; tokensUsed: number; truncated: boolean } {
  const currentTokens = estimateTokens(context);

  if (currentTokens <= maxTokens) {
    return { text: context, tokensUsed: currentTokens, truncated: false };
  }

  // Target token count with buffer
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
      // Keep recent turns + current question
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
  // Find conversation turns and keep the most recent ones
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

  // Keep most recent turns that fit
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

  // If we removed some turns, add marker
  if (turns.length > result.filter(l => l.includes('User:') || l.includes('Assistant:')).length / 2) {
    return '...(earlier conversation)...\n\n' + result.join('\n');
  }

  return result.join('\n');
}

// Format turns for display or debugging
export function formatTurnsForDisplay(turns: ConversationTurn[]): string {
  return turns
    .map((turn, i) => {
      return `=== Turn ${i + 1} ===\nUser: ${turn.userMessage}\nAssistant: ${turn.assistantMessage}`;
    })
    .join('\n\n');
}

// Get turn number for current question
export function getCurrentTurn(session: ChatSession): number {
  return session.messages.filter(m => m.role === 'user').length;
}