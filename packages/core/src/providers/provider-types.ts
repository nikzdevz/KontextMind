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
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: {
    input: number;
    output: number;
    total: number;
  };
  finishReason?: 'stop' | 'length' | 'error';
}

export interface ModelProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly supportedModels: string[];

  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;

  isConfigured(): boolean;
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
