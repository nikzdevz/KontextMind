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

  async recordFeedback(feedback: FeedbackRequest): Promise<{ qa_id: string; recorded: boolean }> {
    const projectDir = this.getProjectDir(feedback.project);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    const feedbackPath = this.getFeedbackFile(projectDir);
    const record = {
      qa_id: feedback.qa_id,
      project: feedback.project,
      signal: feedback.signal,
      reason: feedback.reason || null,
      metadata: feedback.metadata || {},
      timestamp: new Date().toISOString(),
    };

    try {
      const line = JSON.stringify(record) + '\n';
      writeFileSync(feedbackPath, line, { flag: 'a' });
      return { qa_id: feedback.qa_id, recorded: true };
    } catch (error) {
      throw new Error('Failed to record feedback');
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

    // Build combined records
    const data: FeedbackRecord[] = [];
    for (const [qaId, fb] of Object.entries(feedbackRecords)) {
      const qa = qaData[qaId];

      data.push({
        qa_id: qaId,
        question: qa?.question || 'Unknown',
        answer: qa?.answer || 'Unknown',
        feedback: {
          signal: fb.signal,
          reason: fb.reason || undefined,
          timestamp: fb.timestamp,
          user_id: fb.metadata?.user_id,
        },
        qa_metadata: {
          confidence: qa?.confidence || 0,
          tier: (qa as Record<string, unknown>)?.tier || 0,
          sources: (qa?.sources as string[])?.map((s: { type: string }) => s.type) || [],
          llm_model: fb.metadata?.llm_model,
          kb_version: '1.0.0',
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
  } {
    const projectDir = this.getProjectDir(projectName);
    const feedbackPath = this.getFeedbackFile(projectDir);

    if (!existsSync(feedbackPath)) {
      return { total: 0, helpful: 0, not_helpful: 0, neutral: 0 };
    }

    const content = readFileSync(feedbackPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    let helpful = 0;
    let notHelpful = 0;
    let neutral = 0;

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
    };
  }
}

export const feedbackService = new FeedbackService();
