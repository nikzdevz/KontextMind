import type { ModelProvider, GenerateTextInput, GenerateTextResult } from './provider-types.js';

export class MockProvider implements ModelProvider {
  getName(): string {
    return 'mock';
  }

  private mockResponses: Map<string, string> = new Map();

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const prompt = input.prompt;
    const model = input.model || 'mock-summary';

    // Generate a mock summary based on the prompt content
    const summary = this.generateMockSummary(prompt);
    const startTime = Date.now();

    // Simulate token counts (rough estimate)
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(summary.length / 4);

    return {
      text: summary,
      model,
      provider: 'mock',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      cost: 0,
      durationMs: Date.now() - startTime,
      finishReason: 'stop',
    };
  }

  private generateMockSummary(prompt: string): string {
    // Extract meaningful content from the prompt
    const lines = prompt.split('\n').filter(l => l.trim());

    // Find function/class names mentioned
    const functionMatches = prompt.match(/function\s+(\w+)|const\s+(\w+)\s*=|def\s+(\w+)/g);
    const functions = functionMatches
      ? functionMatches.map(m => {
          const match = m.match(/function\s+(\w+)|const\s+(\w+)\s*=|def\s+(\w+)/);
          return match ? match[1] || match[2] || match[3] : null;
        }).filter(Boolean)
      : [];

    // Find imports
    const importMatches = prompt.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    const imports = importMatches
      ? importMatches.map(m => {
          const match = m.match(/from\s+['"]([^'"]+)['"]/);
          return match ? match[1] : m;
        })
      : [];

    // Build a descriptive summary
    const parts: string[] = [];

    if (functions.length > 0) {
      parts.push(`This module contains ${functions.length} function(s): ${functions.slice(0, 5).join(', ')}${functions.length > 5 ? ', and more' : ''}.`);
    }

    if (imports.length > 0) {
      parts.push(`Dependencies: ${imports.slice(0, 3).join(', ')}${imports.length > 3 ? ', and more' : ''}.`);
    }

    if (parts.length === 0) {
      parts.push('This module provides utility functions for the project.');
    }

    return parts.join(' ');
  }

  setMockResponse(prompt: string, response: string): void {
    this.mockResponses.set(prompt, response);
  }

  clearMockResponses(): void {
    this.mockResponses.clear();
  }
}

export function createMockProvider(): MockProvider {
  return new MockProvider();
}
