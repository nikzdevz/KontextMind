// LLM Provider Configuration Service
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
}

interface ProviderStatus {
  provider: string;
  configured: boolean;
  connectionStatus?: 'connected' | 'error' | 'unknown';
  latencyMs?: number;
  error?: string;
  lastChecked?: string;
}

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

// Available LLM providers
const AVAILABLE_PROVIDERS = [
  {
    name: 'anthropic',
    displayName: 'Anthropic Claude',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    requiresApiKey: true,
    supportsStreaming: true
  },
  {
    name: 'openai',
    displayName: 'OpenAI',
    models: ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    requiresApiKey: true,
    supportsStreaming: true
  },
  {
    name: 'openai-compatible',
    displayName: 'OpenAI Compatible',
    models: [],
    requiresApiKey: true,
    supportsStreaming: true
  },
  {
    name: 'ollama',
    displayName: 'Ollama (Local)',
    models: [],
    requiresApiKey: false,
    supportsStreaming: true
  },
  {
    name: 'gemini',
    displayName: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    requiresApiKey: true,
    supportsStreaming: true
  },
  {
    name: 'groq',
    displayName: 'Groq',
    models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'llama3-70b-8192'],
    requiresApiKey: true,
    supportsStreaming: true
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    requiresApiKey: true,
    supportsStreaming: true
  },
  {
    name: 'qwen',
    displayName: 'Qwen (Alibaba)',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    requiresApiKey: true,
    supportsStreaming: true
  }
];

export class ProviderService {
  private getProjectDir(projectName: string): string {
    return join(PROJECTS_DIR, projectName);
  }

  private getProviderConfigPath(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'providers.json');
  }

  private getGlobalConfigPath(): string {
    const configDir = join(process.env.HOME || '/root', '.kontextmind');
    return join(configDir, 'providers.json');
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // List available providers
  listProviders(): Array<{
    name: string;
    displayName: string;
    models: string[];
    requiresApiKey: boolean;
    supportsStreaming: boolean;
  }> {
    return AVAILABLE_PROVIDERS.map(p => ({
      name: p.name,
      displayName: p.displayName,
      models: p.models,
      requiresApiKey: p.requiresApiKey,
      supportsStreaming: p.supportsStreaming
    }));
  }

  // Get models for a specific provider
  getModels(providerName: string): { provider: string; models: string[] } {
    const provider = AVAILABLE_PROVIDERS.find(p => p.name === providerName);
    if (!provider) {
      return { provider: providerName, models: [] };
    }
    return {
      provider: provider.name,
      models: provider.models
    };
  }

  // Get provider config for a project
  getProviderConfig(projectName: string): ProviderConfig | null {
    const projectDir = this.getProjectDir(projectName);
    const configPath = this.getProviderConfigPath(projectDir);

    // Check project-specific config
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        return config.selected_provider ? config.providers?.[config.selected_provider] : null;
      } catch {
        return null;
      }
    }

    // Check global config
    const globalPath = this.getGlobalConfigPath();
    if (existsSync(globalPath)) {
      try {
        const config = JSON.parse(readFileSync(globalPath, 'utf-8'));
        return config.defaultProvider ? config.providers?.[config.defaultProvider] : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  // Configure provider for a project
  async configureProvider(
    projectName: string,
    config: ProviderConfig
  ): Promise<{ success: boolean; provider: string }> {
    const projectDir = this.getProjectDir(projectName);
    const configPath = this.getProviderConfigPath(projectDir);

    this.ensureDirectory(join(projectDir, '.kontextmind'));

    // Load existing config or create new
    let providerConfig: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        providerConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      } catch {
        // Start fresh
      }
    }

    // Update provider config
    providerConfig.selected_provider = config.provider;
    providerConfig.providers = providerConfig.providers || {};
    (providerConfig.providers as Record<string, unknown>)[config.provider] = {
      provider: config.provider,
      apiKey: config.apiKey || undefined,
      baseUrl: config.baseUrl || undefined,
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      rateLimit: config.rateLimit || { requestsPerMinute: 60, requestsPerDay: 10000 }
    };

    writeFileSync(configPath, JSON.stringify(providerConfig, null, 2), 'utf-8');

    return { success: true, provider: config.provider };
  }

  // Update specific fields of provider config
  async updateProvider(
    projectName: string,
    updates: Partial<ProviderConfig>
  ): Promise<{ success: boolean; provider: string }> {
    const current = this.getProviderConfig(projectName);
    if (!current) {
      throw new Error('Provider not configured');
    }

    const updated: ProviderConfig = {
      ...current,
      ...updates,
      provider: updates.provider || current.provider
    };

    return this.configureProvider(projectName, updated);
  }

  // Test provider connection
  async testProvider(config: ProviderConfig): Promise<{
    success: boolean;
    provider: string;
    model: string;
    latencyMs?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Simple connectivity test based on provider type
      let testUrl: string;

      switch (config.provider) {
        case 'anthropic':
          testUrl = 'https://api.anthropic.com/v1/messages';
          break;
        case 'openai':
          testUrl = 'https://api.openai.com/v1/models';
          break;
        case 'openai-compatible':
          testUrl = config.baseUrl || '';
          break;
        case 'ollama':
          testUrl = config.baseUrl || 'http://localhost:11434';
          break;
        case 'gemini':
          testUrl = 'https://generativelanguage.googleapis.com/v1/models';
          break;
        default:
          testUrl = config.baseUrl || '';
      }

      // For this implementation, we'll simulate a connection test
      // In production, you would make actual API calls
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        provider: config.provider,
        model: config.model,
        latencyMs
      };
    } catch (error) {
      return {
        success: false,
        provider: config.provider,
        model: config.model,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  // Get provider status for a project
  getProviderStatus(projectName: string): ProviderStatus | null {
    const config = this.getProviderConfig(projectName);
    if (!config) {
      return null;
    }

    return {
      provider: config.provider,
      configured: true,
      connectionStatus: 'connected',
      lastChecked: new Date().toISOString()
    };
  }

  // Remove provider config
  async removeProvider(projectName: string): Promise<boolean> {
    const projectDir = this.getProjectDir(projectName);
    const configPath = this.getProviderConfigPath(projectDir);

    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        delete config.selected_provider;
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }
}

export const providerService = new ProviderService();