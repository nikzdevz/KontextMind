import type { ModelProvider, ProviderConfig, GenerateTextInput, GenerateTextResult } from './provider-types.js';
import { MockProvider } from './mock-provider.js';

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

  // Placeholder for real providers (Phase 5+)
  // For now, fall back to mock if not configured
  if (!config.apiKey || config.apiKey === 'mock') {
    console.warn(`Provider '${config.provider}' not configured, falling back to mock provider`);
    return new MockProvider();
  }

  // TODO: Implement real providers in Phase 5+
  console.warn(`Provider '${config.provider}' is a placeholder, using mock provider`);
  return new MockProvider();
}

export function getConfiguredProviders(): string[] {
  return getProviderRegistry().listProviders();
}
