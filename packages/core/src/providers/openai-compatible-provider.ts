import type { ModelProvider, GenerateTextInput, GenerateTextResult, ProviderConfig } from './provider-types.js';

/**
 * OpenAI-compatible API provider.
 * Works with any API that implements the OpenAI chat completions format.
 *
 * Examples:
 * - LM Studio
 * - Ollama (with /v1/chat/completions endpoint)
 * - LocalAI
 * - Any custom OpenAI-compatible server
 * - Together AI, Anyscale, etc.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || 'not-needed';
    this.baseUrl = config.baseUrl || 'http://localhost:8080/v1';
    this.model = config.model || 'gpt-3.5-turbo';
  }

  getName(): string {
    return 'openai-compatible';
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: input.system ? [
            { role: 'system', content: input.system },
            { role: 'user', content: input.prompt },
          ] : [
            { role: 'user', content: input.prompt },
          ],
          max_tokens: input.maxTokens || 1024,
          temperature: input.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI-compatible API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const text = data.choices[0]?.message?.content || '';
      const duration = Date.now() - startTime;

      return {
        text,
        usage: data.usage ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : {
          inputTokens: Math.ceil((input.prompt.length + (input.system?.length || 0)) / 4),
          outputTokens: Math.ceil(text.length / 4),
          totalTokens: Math.ceil((input.prompt.length + text.length) / 4),
        },
        durationMs: duration,
        cost: this.estimateCost(
          input.prompt.length + (input.system?.length || 0),
          text.length
        ),
        model: this.model,
        provider: 'openai-compatible',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        text: '',
        usage: {
          inputTokens: Math.ceil((input.prompt.length + (input.system?.length || 0)) / 4),
          outputTokens: 0,
          totalTokens: Math.ceil((input.prompt.length + (input.system?.length || 0)) / 4),
        },
        durationMs: duration,
        cost: 0,
        model: this.model,
        provider: 'openai-compatible',
        error: errorMessage,
      };
    }
  }

  private estimateCost(inputLength: number, outputLength: number): number {
    // Estimate based on gpt-3.5-turbo pricing ($0.5/1M input, $1.5/1M output)
    const inputTokens = inputLength / 4;
    const outputTokens = outputLength / 4;
    return (inputTokens / 1_000_000) * 0.5 + (outputTokens / 1_000_000) * 1.5;
  }
}