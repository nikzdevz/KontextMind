import type { ModelProvider, ProviderConfig, GenerateTextInput, GenerateTextResult } from './provider-types.js';
import { MockProvider } from './mock-provider.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';

export type { ModelProvider } from './provider-types.js';

export interface ProviderRegistry {
  getProvider(name: string): ModelProvider | null;
  registerProvider(name: string, provider: ModelProvider): void;
  listProviders(): string[];
  getDefaultProvider(): ModelProvider;
}

class DefaultProviderRegistry implements ProviderRegistry {
  private providers: Map<string, ModelProvider> = new Map();

  constructor() {
    // Register mock provider by default
    this.providers.set('mock', new MockProvider());
  }

  getProvider(name: string): ModelProvider | null {
    return this.providers.get(name) || null;
  }

  registerProvider(name: string, provider: ModelProvider): void {
    this.providers.set(name, provider);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getDefaultProvider(): ModelProvider {
    return this.providers.get('mock')!;
  }
}

// Singleton registry
let registry: DefaultProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new DefaultProviderRegistry();
  }
  return registry;
}

export function createProviderFromConfig(config: ProviderConfig): ModelProvider | null {
  const registry = getProviderRegistry();

  // If already registered, return it
  const existing = registry.getProvider(config.provider);
  if (existing) {
    return existing;
  }

  // For mock provider, always return mock
  if (config.provider === 'mock') {
    return new MockProvider();
  }

  // For openai-compatible provider, create with config
  if (config.provider === 'openai-compatible') {
    const provider = new OpenAICompatibleProvider(config);
    registry.registerProvider('openai-compatible', provider);
    return provider;
  }

  // For other providers that need API key but aren't configured
  if (!config.apiKey || config.apiKey === 'mock' || config.apiKey === 'none') {
    console.warn(`Provider '${config.provider}' not configured, falling back to mock provider`);
    return new MockProvider();
  }

  // TODO: Implement other providers (anthropic, openai, ollama, bedrock)
  console.warn(`Provider '${config.provider}' is a placeholder, using mock provider`);
  return new MockProvider();
}

export function getConfiguredProviders(): string[] {
  return getProviderRegistry().listProviders();
}
