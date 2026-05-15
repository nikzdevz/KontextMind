// Session Manager - In-memory session store with disk persistence
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type {
  ChatSession,
  ChatMessage,
  SessionOptions,
  SessionSummary,
  ConversationContext,
  SessionMetadata,
  EntityReference,
} from './chatbot-types.js';
import {
  updateSessionInIndex,
  loadSessionIndex,
  deleteSessionFromIndex,
  type SessionIndexEntry,
} from '../memory/session-index.js';

const SESSION_DIR = '.kontextmind/sessions';
const SESSION_FILE_VERSION = '1.0';

// Generate UUID-like ID without external dependency
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

export class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();
  private projectSessions: Map<string, Set<string>> = new Map();
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.ensureSessionDir();
    this.loadPersistedSessions();
  }

  private ensureSessionDir(): void {
    const sessionPath = join(this.projectRoot, SESSION_DIR);
    if (!existsSync(sessionPath)) {
      mkdirSync(sessionPath, { recursive: true });
    }
  }

  private getSessionPath(sessionId: string): string {
    return join(this.projectRoot, SESSION_DIR, `${sessionId}.json`);
  }

  // Load all persisted sessions from disk on startup
  private loadPersistedSessions(): void {
    const sessionPath = join(this.projectRoot, SESSION_DIR);
    if (!existsSync(sessionPath)) return;

    try {
      const files = readdirSync(sessionPath).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const sessionId = file.replace('.json', '');
        const session = this.loadSession(sessionId);
        if (session) {
          this.sessions.set(sessionId, session);
          this.trackProjectSession(session.projectName, sessionId);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted sessions:', error);
    }
  }

  private loadSession(sessionId: string): ChatSession | null {
    const path = this.getSessionPath(sessionId);
    if (!existsSync(path)) return null;

    try {
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content);
      // Validate version
      if (data._version !== SESSION_FILE_VERSION) {
        console.warn(`Session ${sessionId} has outdated version, skipping`);
        return null;
      }
      const { _version, ...session } = data;
      return session as ChatSession;
    } catch {
      return null;
    }
  }

  private trackProjectSession(projectName: string, sessionId: string): void {
    if (!this.projectSessions.has(projectName)) {
      this.projectSessions.set(projectName, new Set());
    }
    this.projectSessions.get(projectName)!.add(sessionId);
  }

  private untrackProjectSession(projectName: string, sessionId: string): void {
    const projectSet = this.projectSessions.get(projectName);
    if (projectSet) {
      projectSet.delete(sessionId);
      if (projectSet.size === 0) {
        this.projectSessions.delete(projectName);
      }
    }
  }

  // Create a new session
  async createSession(projectName: string, options?: SessionOptions): Promise<ChatSession> {
    const sessionId = generateId();
    const now = new Date().toISOString();

    const session: ChatSession = {
      id: sessionId,
      projectName,
      projectRoot: this.projectRoot,
      createdAt: now,
      updatedAt: now,
      messages: [],
      context: {
        topics: [],
        entities: [],
        intentHistory: [],
      },
      metadata: {
        messageCount: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
        totalTokens: 0,
        averageConfidence: 0,
        sourcesUsed: [],
        startedAt: now,
        lastActivityAt: now,
        ...options?.metadata,
      },
    };

    this.sessions.set(sessionId, session);
    this.trackProjectSession(projectName, sessionId);
    await this.persistSession(session);

    return session;
  }

  // Get an existing session
  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  // Add a message to a session
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: {
      responseId?: string;
      feedbackReceived?: 'like' | 'dislike';
      attachments?: { type: string; name: string; content?: string; path?: string }[];
    }
  ): Promise<ChatMessage | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
      responseId: metadata?.responseId,
      feedbackReceived: metadata?.feedbackReceived,
      attachments: metadata?.attachments as any,
    };

    session.messages.push(message);
    session.updatedAt = message.timestamp;
    session.metadata.lastActivityAt = message.timestamp;
    session.metadata.messageCount++;

    if (role === 'user') {
      session.metadata.userMessageCount++;
    } else if (role === 'assistant') {
      session.metadata.assistantMessageCount++;
    }

    // Update context
    this.updateContext(session, message);

    // Persist to disk
    await this.persistSession(session);

    return message;
  }

  private updateContext(session: ChatSession, message: ChatMessage): void {
    if (message.role === 'user') {
      // Add to intent history
      const intent = this.extractIntent(message.content);
      if (intent) {
        session.context.intentHistory.push(intent);
        // Keep only last 10 intents
        if (session.context.intentHistory.length > 10) {
          session.context.intentHistory = session.context.intentHistory.slice(-10);
        }
      }
    }

    // Track entities from assistant responses
    if (message.role === 'assistant') {
      const entities = this.extractEntities(message.content);
      for (const entity of entities) {
        const existing = session.context.entities.find(e => e.name === entity.name);
        if (existing) {
          existing.referenceCount++;
        } else {
          session.context.entities.push({ ...entity, referenceCount: 1 });
        }
      }
    }
  }

  private extractIntent(content: string): string | null {
    // Simple intent extraction - first 50 chars or first sentence
    if (content.length <= 50) return content;
    const firstSentence = content.split(/[.!?]/)[0];
    return firstSentence.slice(0, 50) + (firstSentence.length > 50 ? '...' : '');
  }

  private extractEntities(content: string): EntityReference[] {
    // Simple entity extraction - look for code-like patterns
    const entities: EntityReference[] = [];
    const filePattern = /[\w-]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|hpp)/gi;
    const functionPattern = /\b(function|const|let|var|class|interface|type|enum)\s+(\w+)/gi;
    const componentPattern = /<(\w+)(?:\s|>|>)/gi;

    let match;
    while ((match = filePattern.exec(content)) !== null) {
      entities.push({ id: match[0], name: match[0], type: 'file', referenceCount: 0 });
    }
    while ((match = functionPattern.exec(content)) !== null) {
      entities.push({ id: match[2], name: match[2], type: 'function', referenceCount: 0 });
    }
    while ((match = componentPattern.exec(content)) !== null) {
      entities.push({ id: match[1], name: match[1], type: 'component', referenceCount: 0 });
    }

    return entities.slice(0, 20); // Limit to 20 entities
  }

  // Add topic to session
  async addTopic(sessionId: string, topic: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (!session.context.topics.includes(topic)) {
      session.context.topics.push(topic);
      session.updatedAt = new Date().toISOString();
      await this.persistSession(session);
    }
  }

  // Update session metadata
  async updateMetadata(sessionId: string, updates: Partial<SessionMetadata>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.metadata = { ...session.metadata, ...updates };
    session.updatedAt = new Date().toISOString();
    await this.persistSession(session);
  }

  // Update conversation statistics
  async updateStats(
    sessionId: string,
    stats: { tokens?: number; confidence?: number; source?: string }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (stats.tokens !== undefined) {
      session.metadata.totalTokens += stats.tokens;
    }
    if (stats.confidence !== undefined) {
      const currentAvg = session.metadata.averageConfidence;
      const count = session.metadata.assistantMessageCount;
      session.metadata.averageConfidence = (currentAvg * (count - 1) + stats.confidence) / count;
    }
    if (stats.source && !session.metadata.sourcesUsed.includes(stats.source)) {
      session.metadata.sourcesUsed.push(stats.source);
    }

    session.updatedAt = new Date().toISOString();
    await this.persistSession(session);
  }

  // Get conversation context for askQuestion
  async getContext(sessionId: string, maxTurns: number = 5): Promise<{ turns: ChatMessage[]; context: ConversationContext } | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const turns = session.messages.slice(-maxTurns * 2); // user + assistant pairs
    return { turns, context: session.context };
  }

  // Get all messages for export
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  // List all sessions for a project
  async listSessions(projectName: string): Promise<SessionSummary[]> {
    const sessionIds = this.projectSessions.get(projectName);
    if (!sessionIds) return [];

    const summaries: SessionSummary[] = [];
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        summaries.push(this.sessionToSummary(session));
      }
    }

    // Sort by last activity, most recent first
    return summaries.sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
  }

  private sessionToSummary(session: ChatSession): SessionSummary {
    // Get preview from first user message
    let preview = 'New conversation';
    const firstUserMessage = session.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      preview = firstUserMessage.content.slice(0, 80) + (firstUserMessage.content.length > 80 ? '...' : '');
    }

    return {
      id: session.id,
      projectName: session.projectName,
      createdAt: session.createdAt,
      lastActivityAt: session.metadata.lastActivityAt,
      messageCount: session.metadata.messageCount,
      topics: session.context.topics.slice(0, 5),
      preview,
    };
  }

  // Delete a session
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Remove from maps
    this.sessions.delete(sessionId);
    this.untrackProjectSession(session.projectName, sessionId);

    // Remove from session index
    deleteSessionFromIndex(this.projectRoot, sessionId);

    // Remove from disk
    const path = this.getSessionPath(sessionId);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        // Ignore deletion errors
      }
    }

    return true;
  }

  // Persist session to disk
  async persistSession(session: ChatSession): Promise<void> {
    const path = this.getSessionPath(session.id);
    const data = { ...session, _version: SESSION_FILE_VERSION };
    try {
      writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to persist session ${session.id}:`, error);
    }
  }

  // End a session - update index and mark completion
  async endSession(sessionId: string, summary?: string, pendingWork?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const endTime = new Date().toISOString();
    session.metadata.lastActivityAt = endTime;

    // Create session index entry
    const indexEntry: SessionIndexEntry = {
      sessionId: session.id,
      projectName: session.projectName,
      date: session.createdAt.split('T')[0],
      startTime: session.createdAt,
      endTime,
      durationMs: new Date(endTime).getTime() - new Date(session.createdAt).getTime(),
      messageCount: session.metadata.messageCount,
      topics: session.context.topics.slice(0, 20),
      keyEntities: session.context.entities.slice(0, 10).map(e => ({
        name: e.name,
        type: e.type,
        referenceCount: e.referenceCount,
      })),
      summary: summary || this.generateSessionSummary(session),
      pendingWork: pendingWork,
      filesModified: this.extractFilesFromMessages(session.messages),
    };

    // Update session index
    updateSessionInIndex(this.projectRoot, indexEntry);

    // Persist final state
    await this.persistSession(session);
  }

  // Generate a summary from session
  private generateSessionSummary(session: ChatSession): string {
    const topics = session.context.topics.slice(0, 5).join(', ');
    const messageCount = session.metadata.messageCount;
    const firstMessage = session.messages.find(m => m.role === 'user');

    if (firstMessage) {
      const preview = firstMessage.content.slice(0, 100);
      return `Session discussing: ${topics || preview}. ${messageCount} messages exchanged.`;
    }

    return `Session with ${messageCount} messages. Topics: ${topics || 'general'}.`;
  }

  // Extract files mentioned in messages
  private extractFilesFromMessages(messages: ChatMessage[]): string[] {
    const files = new Set<string>();
    const filePattern = /[\w-]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|hpp)/gi;

    for (const message of messages) {
      let match;
      while ((match = filePattern.exec(message.content)) !== null) {
        files.add(match[0]);
      }
    }

    return Array.from(files).slice(0, 50);
  }

  // Get session index for cross-session queries
  getSessionIndex(): SessionIndexEntry[] {
    const index = loadSessionIndex(this.projectRoot);
    return index.sessions.sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  // Get current turn count for a session
  async getTurnCount(sessionId: string): Promise<number> {
    const session = this.sessions.get(sessionId);
    return session ? Math.floor(session.messages.filter(m => m.role === 'user').length) : 0;
  }

  // Clear all sessions (for testing)
  async clearAllSessions(): Promise<void> {
    const sessionPath = join(this.projectRoot, SESSION_DIR);
    if (existsSync(sessionPath)) {
      const files = readdirSync(sessionPath).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          unlinkSync(join(sessionPath, file));
        } catch {
          // Ignore
        }
      }
    }
    this.sessions.clear();
    this.projectSessions.clear();
  }

  // Get session count
  getSessionCount(): number {
    return this.sessions.size;
  }

  // Check if session exists
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

// Singleton instance per project (lazily created)
const sessionManagers: Map<string, SessionManager> = new Map();

export function getSessionManager(projectRoot: string = process.cwd()): SessionManager {
  if (!sessionManagers.has(projectRoot)) {
    sessionManagers.set(projectRoot, new SessionManager(projectRoot));
  }
  return sessionManagers.get(projectRoot)!;
}