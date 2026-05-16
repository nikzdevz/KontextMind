// Conversation Service - Full Chat Lifecycle with User Isolation
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  Conversation,
  Message,
  ConversationFeedback,
  CreateConversationRequest,
  SendMessageRequest
} from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

interface ConversationIndex {
  conversations: ConversationMeta[];
}

interface ConversationMeta {
  id: string;
  projectId: string;
  userId?: string;
  title?: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  messageCount: number;
}

interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    sources?: string[];
    streaming?: boolean;
    cached?: boolean;
  };
}

interface FeedbackRecord {
  id: string;
  conversationId: string;
  userId?: string;
  rating: string;
  feedbackType: string;
  comment?: string;
  responseId?: string;
  question?: string;
  answer?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  timestamp: string;
}

export class ConversationService {
  private getProjectDir(projectName: string): string {
    return join(PROJECTS_DIR, projectName);
  }

  private getConversationIndexDir(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'chatbot');
  }

  private getIndexPath(projectDir: string): string {
    return join(this.getConversationIndexDir(projectDir), 'conversations-index.json');
  }

  private getMessagesPath(projectDir: string, conversationId: string): string {
    return join(this.getConversationIndexDir(projectDir), `messages-${conversationId}.jsonl`);
  }

  private getFeedbackPath(projectDir: string, conversationId: string): string {
    return join(this.getConversationIndexDir(projectDir), `feedback-${conversationId}.jsonl`);
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Create a new conversation
  async createConversation(
    projectName: string,
    userId?: string,
    options?: CreateConversationRequest
  ): Promise<Conversation> {
    const projectDir = this.getProjectDir(projectName);
    this.ensureDirectory(this.getConversationIndexDir(projectDir));

    const id = `conv_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const now = new Date().toISOString();

    const conversation: Conversation = {
      id,
      projectId: projectName,
      userId,
      title: options?.title,
      status: 'active',
      messages: [],
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      messageCount: 0,
      metadata: options?.metadata
    };

    // Update index
    const index = this.loadIndex(projectDir);
    index.conversations.push({
      id,
      projectId: projectName,
      userId,
      title: options?.title,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      messageCount: 0
    });
    this.saveIndex(projectDir, index);

    // Create empty messages file
    writeFileSync(this.getMessagesPath(projectDir, id), '', 'utf-8');

    return conversation;
  }

  // List conversations (with user isolation)
  async listConversations(
    projectName: string,
    userId?: string,
    options?: {
      status?: 'active' | 'archived' | 'deleted';
      limit?: number;
      offset?: number;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const projectDir = this.getProjectDir(projectName);
    const index = this.loadIndex(projectDir);

    // Filter by user if provided (user isolation!)
    let filtered = index.conversations.filter(c => {
      if (c.status === 'deleted') return false;
      if (userId) {
        return c.userId === userId || !c.userId; // Include if user matches or no user set
      }
      return true;
    });

    // Filter by status
    if (options?.status) {
      filtered = filtered.filter(c => c.status === options.status);
    }

    // Sort
    const sortField = options?.sort || 'lastActivityAt';
    const sortOrder = options?.order || 'desc';
    filtered.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortField];
      const bVal = (b as unknown as Record<string, unknown>)[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return 0;
    });

    // Pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    // Load full conversation data
    const conversations: Conversation[] = [];
    for (const meta of paginated) {
      const conv = await this.getConversation(projectName, meta.id, userId);
      if (conv) conversations.push(conv);
    }

    return { conversations, total };
  }

  // Get single conversation (with user isolation)
  async getConversation(
    projectName: string,
    conversationId: string,
    userId?: string
  ): Promise<Conversation | null> {
    const projectDir = this.getProjectDir(projectName);
    const index = this.loadIndex(projectDir);

    const meta = index.conversations.find(c => c.id === conversationId);
    if (!meta) return null;

    // User isolation check
    if (userId && meta.userId && meta.userId !== userId) {
      return null; // User can only access their own conversations
    }

    // Load messages
    const messagesPath = this.getMessagesPath(projectDir, conversationId);
    const messages: Message[] = [];

    if (existsSync(messagesPath)) {
      const content = readFileSync(messagesPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as MessageRecord;
          messages.push({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            metadata: msg.metadata
          });
        } catch {
          // Skip malformed line
        }
      }
    }

    return {
      id: meta.id,
      projectId: meta.projectId,
      userId: meta.userId,
      title: meta.title,
      status: meta.status,
      messages,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      lastActivityAt: meta.lastActivityAt,
      messageCount: meta.messageCount
    };
  }

  // Update conversation (metadata/title)
  async updateConversation(
    projectName: string,
    conversationId: string,
    userId: string | undefined,
    updates: { title?: string; status?: 'active' | 'archived' | 'deleted' }
  ): Promise<Conversation | null> {
    const projectDir = this.getProjectDir(projectName);
    const index = this.loadIndex(projectDir);

    const metaIndex = index.conversations.findIndex(c => c.id === conversationId);
    if (metaIndex === -1) return null;

    const meta = index.conversations[metaIndex];

    // User isolation check
    if (userId && meta.userId && meta.userId !== userId) {
      return null;
    }

    // Apply updates
    if (updates.title !== undefined) meta.title = updates.title;
    if (updates.status !== undefined) {
      meta.status = updates.status;
      if (updates.status === 'deleted') {
        meta.status = 'deleted';
      }
    }
    meta.updatedAt = new Date().toISOString();

    index.conversations[metaIndex] = meta;
    this.saveIndex(projectDir, index);

    return this.getConversation(projectName, conversationId, userId);
  }

  // Delete conversation (soft delete)
  async deleteConversation(
    projectName: string,
    conversationId: string,
    userId?: string
  ): Promise<boolean> {
    const result = await this.updateConversation(projectName, conversationId, userId, { status: 'deleted' });
    return result !== null;
  }

  // Add message to conversation
  async addMessage(
    projectName: string,
    conversationId: string,
    request: SendMessageRequest,
    metadata?: {
      confidence?: number;
      sources?: string[];
      streaming?: boolean;
      cached?: boolean;
    }
  ): Promise<Message> {
    const projectDir = this.getProjectDir(projectName);
    const index = this.loadIndex(projectDir);

    const meta = index.conversations.find(c => c.id === conversationId);
    if (!meta) {
      throw new Error('Conversation not found');
    }

    const id = `msg_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const now = new Date().toISOString();

    const record: MessageRecord = {
      id,
      conversationId,
      role: request.role || 'user',
      content: request.content,
      timestamp: now,
      metadata
    };

    // Append to messages file
    const messagesPath = this.getMessagesPath(projectDir, conversationId);
    const line = JSON.stringify(record) + '\n';
    writeFileSync(messagesPath, line, { flag: 'a' });

    // Update index
    meta.messageCount++;
    meta.lastActivityAt = now;
    meta.updatedAt = now;
    this.saveIndex(projectDir, index);

    return {
      id,
      role: record.role,
      content: record.content,
      timestamp: now,
      metadata
    };
  }

  // Get messages with pagination
  async getMessages(
    projectName: string,
    conversationId: string,
    options?: {
      limit?: number;
      offset?: number;
      before?: string;
    }
  ): Promise<{ messages: Message[]; total: number }> {
    const projectDir = this.getProjectDir(projectName);
    const messagesPath = this.getMessagesPath(projectDir, conversationId);

    if (!existsSync(messagesPath)) {
      return { messages: [], total: 0 };
    }

    const content = readFileSync(messagesPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    let messages: Message[] = [];
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as MessageRecord;
        messages.push({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          metadata: msg.metadata
        });
      } catch {
        // Skip malformed line
      }
    }

    // Filter by timestamp if provided
    if (options?.before) {
      const beforeTime = new Date(options.before).getTime();
      messages = messages.filter(m => new Date(m.timestamp).getTime() < beforeTime);
    }

    const total = messages.length;

    // Pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    messages = messages.slice(offset, offset + limit);

    return { messages, total };
  }

  // Submit feedback
  async submitFeedback(
    projectName: string,
    conversationId: string,
    userId: string | undefined,
    feedback: {
      rating: 'positive' | 'negative' | 'neutral' | number;
      feedbackType: 'rating' | 'stars' | 'correction' | 'follow-up' | 'resolution';
      comment?: string;
      responseId?: string;
      question?: string;
      answer?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
    }
  ): Promise<ConversationFeedback> {
    const projectDir = this.getProjectDir(projectName);
    const id = `fb_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const now = new Date().toISOString();

    const record: FeedbackRecord = {
      id,
      conversationId,
      userId,
      rating: String(feedback.rating),
      feedbackType: feedback.feedbackType,
      comment: feedback.comment,
      responseId: feedback.responseId,
      question: feedback.question,
      answer: feedback.answer,
      metadata: feedback.metadata,
      tags: feedback.tags,
      timestamp: now
    };

    // Append to feedback file
    const feedbackPath = this.getFeedbackPath(projectDir, conversationId);
    this.ensureDirectory(this.getConversationIndexDir(projectDir));
    const line = JSON.stringify(record) + '\n';
    writeFileSync(feedbackPath, line, { flag: 'a' });

    return {
      id,
      conversationId,
      userId,
      rating: feedback.rating,
      feedbackType: feedback.feedbackType,
      comment: feedback.comment,
      responseId: feedback.responseId,
      question: feedback.question,
      answer: feedback.answer,
      metadata: feedback.metadata,
      tags: feedback.tags,
      timestamp: now
    };
  }

  // Get conversation feedback
  async getFeedback(
    projectName: string,
    conversationId: string
  ): Promise<ConversationFeedback[]> {
    const projectDir = this.getProjectDir(projectName);
    const feedbackPath = this.getFeedbackPath(projectDir, conversationId);

    if (!existsSync(feedbackPath)) {
      return [];
    }

    const content = readFileSync(feedbackPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const feedbacks: ConversationFeedback[] = [];
    for (const line of lines) {
      try {
        const fb = JSON.parse(line) as FeedbackRecord;
        feedbacks.push({
          id: fb.id,
          conversationId: fb.conversationId,
          userId: fb.userId,
          rating: fb.rating as 'positive' | 'negative' | 'neutral' | number,
          feedbackType: fb.feedbackType as 'rating' | 'stars' | 'correction' | 'follow-up' | 'resolution',
          comment: fb.comment,
          responseId: fb.responseId,
          question: fb.question,
          answer: fb.answer,
          metadata: fb.metadata,
          tags: fb.tags,
          timestamp: fb.timestamp
        });
      } catch {
        // Skip malformed line
      }
    }

    return feedbacks;
  }

  // Get conversation summary (AI-generated)
  async getConversationSummary(
    projectName: string,
    conversationId: string
  ): Promise<{ summary: string; topics: string[]; messageCount: number }> {
    const conv = await this.getConversation(projectName, conversationId);
    if (!conv) {
      throw new Error('Conversation not found');
    }

    // Simple summary based on message content
    const topics = this.extractTopics(conv.messages);
    const summary = this.generateSummary(conv.messages);

    return {
      summary,
      topics,
      messageCount: conv.messageCount
    };
  }

  private extractTopics(messages: Message[]): string[] {
    const topics = new Set<string>();

    // Simple keyword extraction
    const keywords = ['auth', 'api', 'database', 'config', 'deploy', 'error', 'test', 'build', 'model', 'provider'];

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      }
    }

    return Array.from(topics);
  }

  private generateSummary(messages: Message[]): string {
    if (messages.length === 0) {
      return 'Empty conversation';
    }

    const userMessages = messages.filter(m => m.role === 'user');
    const firstQuestion = userMessages[0]?.content.substring(0, 100) || 'Unknown';
    const lastResponse = messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content.substring(0, 100) || 'N/A';

    return `Conversation started with: "${firstQuestion}..." - Last response: "${lastResponse}..."`;
  }

  private loadIndex(projectDir: string): ConversationIndex {
    const indexPath = this.getIndexPath(projectDir);

    if (existsSync(indexPath)) {
      try {
        return JSON.parse(readFileSync(indexPath, 'utf-8'));
      } catch {
        // Fall through to default
      }
    }

    return { conversations: [] };
  }

  private saveIndex(projectDir: string, index: ConversationIndex): void {
    const indexPath = this.getIndexPath(projectDir);
    this.ensureDirectory(this.getConversationIndexDir(projectDir));
    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
}

export const conversationService = new ConversationService();