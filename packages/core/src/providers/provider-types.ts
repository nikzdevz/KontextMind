// Provider types and interfaces for LLM integration

export interface GenerateTextInput {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost?: number;
  durationMs?: number;
  finishReason?: 'stop' | 'length' | 'error';
  error?: string;
}

export interface ModelProvider {
  getName(): string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

export interface ProviderConfig {
  name: string;
  provider: 'mock' | 'openai' | 'anthropic' | 'ollama' | 'bedrock' | 'openai-compatible';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CostEvent {
  timestamp: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  currency: string;
}

export interface SummaryConfig {
  provider: ProviderConfig;
  maxFilesPerRun?: number;
  maxRetries?: number;
  batchSize?: number;
  includeSymbols?: boolean;
  includeDependencies?: boolean;
}
