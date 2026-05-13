// Session Service - API layer for session management
import { existsSync } from 'fs';
import { join } from 'path';
import { SessionManager, getSessionManager } from '@kontextmind/core';
import { buildEnhancedPrompt, getCurrentTurn } from '@kontextmind/core';
import { askQuestion } from '@kontextmind/core';
import type { ChatSession, ChatMessage, SessionOptions, SessionSummary } from '@kontextmind/core';
import type { AskResponse } from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

export class SessionService {
  private getProjectDir(name: string): string {
    return join(PROJECTS_DIR, name);
  }

  private getSessionManager(projectDir: string): SessionManager {
    return getSessionManager(projectDir);
  }

  async createSession(
    projectName: string,
    options?: SessionOptions
  ): Promise<{ session: ChatSession }> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    if (!existsSync(join(projectDir, '.kontextmind'))) {
      throw new Error('Project not initialized');
    }

    const manager = this.getSessionManager(projectDir);
    const session = await manager.createSession(projectName, options);

    return { session };
  }

  async getSession(projectName: string, sessionId: string): Promise<{ session: ChatSession }> {
    const projectDir = this.getProjectDir(projectName);
    const manager = this.getSessionManager(projectDir);

    const session = await manager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return { session };
  }

  async listSessions(projectName: string): Promise<{ sessions: SessionSummary[] }> {
    const projectDir = this.getProjectDir(projectName);
    const manager = this.getSessionManager(projectDir);

    const sessions = await manager.listSessions(projectName);
    return { sessions };
  }

  async deleteSession(projectName: string, sessionId: string): Promise<{ deleted: boolean }> {
    const projectDir = this.getProjectDir(projectName);
    const manager = this.getSessionManager(projectDir);

    const deleted = await manager.deleteSession(sessionId);
    return { deleted };
  }

  async addMessage(
    projectName: string,
    sessionId: string,
    message: { role: 'user' | 'assistant' | 'system'; content: string }
  ): Promise<{ message: ChatMessage }> {
    const projectDir = this.getProjectDir(projectName);
    const manager = this.getSessionManager(projectDir);

    const msg = await manager.addMessage(sessionId, message.role, message.content);
    if (!msg) {
      throw new Error('Session not found');
    }

    return { message: msg };
  }

  async askWithSession(
    projectName: string,
    question: string,
    sessionId?: string,
    mode: string = 'chatbot-readonly'
  ): Promise<AskResponse & { sessionId: string; conversationTurn: number }> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(join(projectDir, '.kontextmind'))) {
      throw new Error('Project not initialized');
    }

    const manager = this.getSessionManager(projectDir);
    let session: ChatSession | null = null;
    let conversationTurn = 0;

    // Get or create session
    if (sessionId) {
      session = await manager.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      conversationTurn = await manager.getTurnCount(sessionId);
    } else {
      // Create ephemeral session for single ask
      session = await manager.createSession(projectName);
      sessionId = session.id;
    }

    // Build enhanced prompt with conversation context
    const enhancedQuestion = buildEnhancedPrompt(question, session, {
      maxTurns: 5,
      includeSystemPrompt: true,
    });

    // Call askQuestion with enhanced context
    const result = await askQuestion(
      session.metadata.totalTokens > 0 ? enhancedQuestion : question,
      {
        mode: mode as 'readonly' | 'chatbot-readonly',
        noCode: true,
        source: 'api',
        sessionId, // Pass session ID for logging
        conversationTurn,
      },
      projectDir
    );

    // Add user message to session
    await manager.addMessage(sessionId!, 'user', question, {
      responseId: result.responseId,
    });

    // Add assistant response to session
    await manager.addMessage(sessionId!, 'assistant', result.answer, {
      responseId: result.responseId,
    });

    // Update session stats
    await manager.updateStats(sessionId!, {
      confidence: result.confidence,
      source: result.sources[0]?.type || 'unknown',
    });

    // Increment turn count
    conversationTurn = await manager.getTurnCount(sessionId!);

    return {
      qa_id: result.responseId,
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources,
      tier: result.tier || 0,
      cached: result.cached || false,
      feedback_supported: true,
      sessionId: sessionId!,
      conversationTurn,
    };
  }

  async getContext(
    projectName: string,
    sessionId: string,
    maxTurns?: number
  ): Promise<{ turns: { userMessage: string; assistantMessage: string; responseId?: string; timestamp: string }[]; context: { topics: string[]; entities: { id: string; name: string; type: string; referenceCount: number }[] } }> {
    const projectDir = this.getProjectDir(projectName);
    const manager = this.getSessionManager(projectDir);

    const contextResult = await manager.getContext(sessionId, maxTurns || 5);
    if (!contextResult) {
      throw new Error('Session not found');
    }

    return {
      turns: contextResult.turns.map(t => ({
        userMessage: t.userMessage,
        assistantMessage: t.assistantMessage,
        responseId: t.responseId,
        timestamp: t.timestamp,
      })),
      context: {
        topics: contextResult.context.topics,
        entities: contextResult.context.entities,
      },
    };
  }

  async getSessionStats(projectName: string, sessionId: string): Promise<{
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    totalTokens: number;
    averageConfidence: number;
    sourcesUsed: string[];
    startedAt: string;
    lastActivityAt: string;
  }> {
    const projectDir = this.getProjectDir(projectName);
    const manager = this.getSessionManager(projectDir);

    const session = await manager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return session.metadata;
  }
}

export const sessionService = new SessionService();