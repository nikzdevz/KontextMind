// Ask Service - Wraps CLI ask command
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type { AskResponse, Source } from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

export class AskService {
  private getProjectDir(name: string): string {
    return join(PROJECTS_DIR, name);
  }

  private isProjectReady(name: string): boolean {
    const projectDir = this.getProjectDir(name);
    return existsSync(join(projectDir, '.kontextmind', 'chatbot', 'project-overview.md'));
  }

  async ask(projectName: string, question: string, mode: string = 'chatbot-readonly'): Promise<AskResponse> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(join(projectDir, '.kontextmind'))) {
      throw new Error('Project not initialized');
    }

    if (!this.isProjectReady(projectName)) {
      throw new Error('Project KB not ready. Please wait for initialization to complete.');
    }

    const qaId = `qa_${uuidv4()}`;

    try {
      // Run ask command via CLI
      const escapedQuestion = question.replace(/"/g, '\\"');
      const output = execSync(
        `cd "${projectDir}" && kontextmind ask "${escapedQuestion}" --mode ${mode} --json`,
        {
          encoding: 'utf-8',
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        }
      );

      const result = JSON.parse(output);

      // Record to history
      this.recordToHistory(projectDir, {
        id: qaId,
        question,
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources,
        timestamp: new Date().toISOString(),
      });

      return {
        qa_id: qaId,
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources || [],
        tier: this.detectTier(result),
        cached: false, // Will be updated by CLI with actual cache status
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error('kontextmind CLI not found. Ensure it is installed.');
      }
      throw error;
    }
  }

  private detectTier(result: Record<string, unknown>): number {
    // Try to detect tier from sources
    const sources = result.sources as Array<{ type: string }> || [];
    if (sources.length === 0) return 5;

    for (const source of sources) {
      if (source.type === 'qa' || source.type === 'precomputed') return 3;
      if (source.type === 'file_summary') return 4;
      if (source.type === 'llm-synthesis') return 5;
    }

    return 5; // Default to LLM synthesis
  }

  private recordToHistory(projectDir: string, record: {
    id: string;
    question: string;
    answer: string;
    confidence: number;
    sources: Source[];
    timestamp: string;
  }): void {
    const historyPath = join(projectDir, '.kontextmind', 'chatbot', 'qa-history.jsonl');
    const line = JSON.stringify(record) + '\n';

    try {
      appendFileSync(historyPath, line, 'utf-8');
    } catch {
      // Silently fail - history is not critical
    }
  }
}

export const askService = new AskService();
