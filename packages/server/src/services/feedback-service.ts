// Feedback Service - Collects and exports feedback data
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { FeedbackRequest, FeedbackRecord, FeedbackExportResponse } from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

export class FeedbackService {
  private getProjectDir(name: string): string {
    return join(PROJECTS_DIR, name);
  }

  private getFeedbackFile(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'chatbot', 'feedback.jsonl');
  }

  private getQNAEventsFile(projectDir: string): string {
    return join(projectDir, '.logs', 'qna-events.jsonl');
  }

  async recordFeedback(feedback: FeedbackRequest): Promise<{ qa_id: string; recorded: boolean }> {
    const projectDir = this.getProjectDir(feedback.project);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    const feedbackPath = this.getFeedbackFile(projectDir);
    const qnaEventsPath = this.getQNAEventsFile(projectDir);
    const record = {
      qa_id: feedback.qa_id,
      project: feedback.project,
      signal: feedback.signal,
      reason: feedback.reason || null,
      metadata: feedback.metadata || {},
      timestamp: new Date().toISOString(),
    };

    try {
      // Record to feedback file
      const line = JSON.stringify(record) + '\n';
      writeFileSync(feedbackPath, line, { flag: 'a' });

      // Also update the qna-events.jsonl if it exists
      if (existsSync(qnaEventsPath)) {
        this.updateQNAEventFeedback(qnaEventsPath, feedback.qa_id, feedback.signal);
      }

      return { qa_id: feedback.qa_id, recorded: true };
    } catch (error) {
      throw new Error('Failed to record feedback');
    }
  }

  private updateQNAEventFeedback(qnaEventsPath: string, responseId: string, signal: string): void {
    try {
      const content = readFileSync(qnaEventsPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      const updatedLines: string[] = [];
      const timestamp = new Date().toISOString();

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.responseId === responseId) {
            event.feedbackReceived = signal === 'helpful' ? 'like' : 'dislike';
            event.feedbackTimestamp = timestamp;
          }
          updatedLines.push(JSON.stringify(event));
        } catch {
          updatedLines.push(line);
        }
      }

      writeFileSync(qnaEventsPath, updatedLines.join('\n') + '\n');
    } catch {
      // Silently fail - not critical
    }
  }

  async exportFeedback(
    projectName: string,
    format: 'jsonl' | 'json' = 'json',
    since?: string
  ): Promise<FeedbackExportResponse> {
    const projectDir = this.getProjectDir(projectName);
    const feedbackPath = this.getFeedbackFile(projectDir);
    const historyPath = join(projectDir, '.kontextmind', 'chatbot', 'qa-history.jsonl');
    const qnaEventsPath = this.getQNAEventsFile(projectDir);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    const sinceDate = since ? new Date(since).getTime() : 0;

    // Load feedback records
    const feedbackRecords: Record<string, FeedbackRequest & { timestamp: string }> = {};
    if (existsSync(feedbackPath)) {
      const content = readFileSync(feedbackPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const fb = JSON.parse(line);
          if (new Date(fb.timestamp).getTime() >= sinceDate) {
            feedbackRecords[fb.qa_id] = fb;
          }
        } catch {
          // Skip invalid lines
        }
      }
    }

    // Load Q&A history to match with feedback
    const qaData: Record<string, Record<string, unknown>> = {};
    if (existsSync(historyPath)) {
      const content = readFileSync(historyPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const qa = JSON.parse(line);
          if (qa.id) {
            qaData[qa.id] = qa;
          }
        } catch {
          // Skip invalid lines
        }
      }
    }

    // Load Q&A events for code request tracking
    const qnaEvents: Record<string, { codeRequestDetected?: boolean }> = {};
    if (existsSync(qnaEventsPath)) {
      const content = readFileSync(qnaEventsPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.responseId) {
            qnaEvents[event.responseId] = { codeRequestDetected: event.codeRequestDetected };
          }
        } catch {
          // Skip invalid lines
        }
      }
    }

    // Build combined records
    const data: FeedbackRecord[] = [];
    for (const [qaId, fb] of Object.entries(feedbackRecords)) {
      const qa = qaData[qaId];
      const qnaEvent = qnaEvents[qaId];
      const sources = Array.isArray(qa?.sources) ? qa.sources : [];

      data.push({
        qa_id: qaId,
        question: typeof qa?.question === 'string' ? qa.question : 'Unknown',
        answer: typeof qa?.answer === 'string' ? qa.answer : 'Unknown',
        feedback: {
          signal: fb.signal,
          reason: fb.reason || undefined,
          timestamp: fb.timestamp,
          user_id: fb.metadata?.user_id,
        },
        qa_metadata: {
          confidence: typeof qa?.confidence === 'number' ? qa.confidence : 0,
          tier: typeof qa?.tier === 'number' ? qa.tier : 0,
          sources: sources.map((source) => {
            if (typeof source === 'string') return source;
            if (source && typeof source === 'object' && 'type' in source && typeof source.type === 'string') {
              return source.type;
            }
            return 'unknown';
          }),
          llm_model: fb.metadata?.llm_model,
          kb_version: '1.0.0',
          code_request: qnaEvent?.codeRequestDetected || false,
        },
      });
    }

    return {
      project: projectName,
      exported_at: new Date().toISOString(),
      total_records: data.length,
      format,
      data,
    };
  }

  getFeedbackStats(projectName: string): {
    total: number;
    helpful: number;
    not_helpful: number;
    neutral: number;
    code_requests: number;
    code_request_dislikes: number;
  } {
    const projectDir = this.getProjectDir(projectName);
    const feedbackPath = this.getFeedbackFile(projectDir);
    const qnaEventsPath = this.getQNAEventsFile(projectDir);

    if (!existsSync(feedbackPath)) {
      return { total: 0, helpful: 0, not_helpful: 0, neutral: 0, code_requests: 0, code_request_dislikes: 0 };
    }

    const content = readFileSync(feedbackPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    let helpful = 0;
    let notHelpful = 0;
    let neutral = 0;

    // Track code requests from qna-events
    let codeRequests = 0;
    let codeRequestDislikes = 0;

    // Load code request data
    if (existsSync(qnaEventsPath)) {
      const eventsContent = readFileSync(qnaEventsPath, 'utf-8');
      const eventLines = eventsContent.split('\n').filter(l => l.trim());

      for (const line of eventLines) {
        try {
          const event = JSON.parse(line);
          if (event.codeRequestDetected) {
            codeRequests++;
            if (event.feedbackReceived === 'dislike') {
              codeRequestDislikes++;
            }
          }
        } catch {
          // Skip invalid lines
        }
      }
    }

    for (const line of lines) {
      try {
        const fb = JSON.parse(line);
        switch (fb.signal) {
          case 'helpful':
            helpful++;
            break;
          case 'not_helpful':
            notHelpful++;
            break;
          case 'neutral':
            neutral++;
            break;
        }
      } catch {
        // Skip invalid lines
      }
    }

    return {
      total: lines.length,
      helpful,
      not_helpful: notHelpful,
      neutral,
      code_requests: codeRequests,
      code_request_dislikes: codeRequestDislikes,
    };
  }
}

export const feedbackService = new FeedbackService();
