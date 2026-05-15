// Prompt Instructions Service
// Manages custom system prompts and instructions per project

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

export interface PromptInstructions {
  systemPrompt: string;
  userInstructions: string[];
  responseStyle: {
    format: 'detailed' | 'concise' | 'bullet';
    includeCode: boolean;
    includeExamples: boolean;
  };
  updatedAt: string;
}

const DEFAULT_INSTRUCTIONS: PromptInstructions = {
  systemPrompt: 'You are a helpful assistant that answers questions about the project based on the provided context.',
  userInstructions: [],
  responseStyle: {
    format: 'detailed',
    includeCode: false,
    includeExamples: false,
  },
  updatedAt: new Date().toISOString(),
};

export class PromptInstructionsService {
  private getProjectDir(name: string): string {
    return join(PROJECTS_DIR, name);
  }

  private getPromptConfigPath(name: string): string {
    return join(this.getProjectDir(name), '.kontextmind', 'chatbot', 'prompt-instructions.json');
  }

  getInstructions(projectName: string): PromptInstructions {
    const configPath = this.getPromptConfigPath(projectName);

    if (!existsSync(configPath)) {
      // Return default instructions if no custom ones set
      return { ...DEFAULT_INSTRUCTIONS };
    }

    try {
      const data = readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { ...DEFAULT_INSTRUCTIONS };
    }
  }

  updateInstructions(projectName: string, instructions: Partial<PromptInstructions>): PromptInstructions {
    const configPath = this.getPromptConfigPath(projectName);
    const projectDir = this.getProjectDir(projectName);
    const chatbotDir = join(projectDir, '.kontextmind', 'chatbot');

    // Load existing or start with defaults
    const current = this.getInstructions(projectName);

    // Merge updates
    const updated: PromptInstructions = {
      ...current,
      ...instructions,
      responseStyle: {
        ...current.responseStyle,
        ...(instructions.responseStyle || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    // Ensure directory exists
    if (!existsSync(chatbotDir)) {
      mkdirSync(chatbotDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(updated, null, 2));

    return updated;
  }

  deleteInstructions(projectName: string): boolean {
    const configPath = this.getPromptConfigPath(projectName);

    if (!existsSync(configPath)) {
      return false;
    }

    try {
      unlinkSync(configPath);
      return true;
    } catch {
      return false;
    }
  }
}

export const promptInstructionsService = new PromptInstructionsService();
