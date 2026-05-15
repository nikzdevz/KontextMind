import { OptionValues } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { printInfo, printSuccess, printWarning, printSection, printError } from '../utils/print.js';
import { createProviderFromConfig } from '@kontextmind/core';

interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl: string;
  model?: string;
}

interface GlobalConfig {
  providers: Record<string, ProviderConfig>;
  defaultProvider?: string;
}

function getGlobalConfigDir(): string {
  const base = process.env.APPDATA || process.env.HOME || '';
  return join(base, '.kontextmind');
}

function ensureGlobalConfigDir(): void {
  const dir = getGlobalConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadGlobalConfig(): GlobalConfig {
  const configPath = join(getGlobalConfigDir(), 'config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return { providers: {} };
    }
  }
  return { providers: {} };
}

function saveGlobalConfig(config: GlobalConfig): void {
  ensureGlobalConfigDir();
  const configPath = join(getGlobalConfigDir(), 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function configCommand(options: OptionValues): Promise<void> {
  // Determine action: --action option OR first arg in args (for positional usage)
  const args = options.args as string[] || [];
  const action = (options.action as string) || (args[0] && ['show', 'set', 'add', 'remove', 'list', 'test', 'set-api-key'].includes(args[0]) ? args[0] : 'show');

  // Parse remaining args into options if positional usage
  const remainingArgs = (options.action && args[0] && ['show', 'set', 'add', 'remove', 'list', 'test'].includes(args[0]))
    ? args.slice(1)
    : args.slice(1); // Still skip first arg if it was the action

  // Build parsed options from remaining args
  const parsedOptions: Record<string, unknown> = { action };
  for (let i = 0; i < remainingArgs.length; i++) {
    const arg = remainingArgs[i];
    if (arg === '--name' && remainingArgs[i + 1]) parsedOptions.name = remainingArgs[++i];
    else if (arg === '--type' && remainingArgs[i + 1]) parsedOptions.type = remainingArgs[++i];
    else if (arg === '--baseUrl' && remainingArgs[i + 1]) parsedOptions.baseUrl = remainingArgs[++i];
    else if (arg === '--apiKey' && remainingArgs[i + 1]) parsedOptions.apiKey = remainingArgs[++i];
    else if (arg === '--model' && remainingArgs[i + 1]) parsedOptions.model = remainingArgs[++i];
    else if (arg === '--prompt' && remainingArgs[i + 1]) parsedOptions.prompt = remainingArgs[++i];
    else if (arg === '--provider' && remainingArgs[i + 1]) parsedOptions.provider = remainingArgs[++i];
    else if (arg === '--global') parsedOptions.global = true;
  }

  // Merge parsed options with provided options (provided options take precedence)
  const mergedOptions = {
    ...parsedOptions,
    name: (options.name as string) || (parsedOptions.name as string),
    type: (options.type as string) || (parsedOptions.type as string),
    baseUrl: (options.baseUrl as string) || (parsedOptions.baseUrl as string),
    apiKey: (options.apiKey as string) || (parsedOptions.apiKey as string),
    model: (options.model as string) || (parsedOptions.model as string),
    prompt: (options.prompt as string) || (parsedOptions.prompt as string),
    provider: (options.provider as string) || (parsedOptions.provider as string),
    global: (options.global as boolean) || (parsedOptions.global as boolean),
  } as OptionValues;

  if (mergedOptions.action === 'show') {
    await showConfig(mergedOptions);
  } else if (mergedOptions.action === 'set') {
    await setProvider(mergedOptions);
  } else if (mergedOptions.action === 'add') {
    await addProvider(mergedOptions);
  } else if (mergedOptions.action === 'remove') {
    await removeProvider(mergedOptions);
  } else if (mergedOptions.action === 'list') {
    await listProviders();
  } else if (mergedOptions.action === 'test') {
    await testProvider(mergedOptions);
  } else if (mergedOptions.action === 'set-api-key') {
    await setApiKey(mergedOptions);
  } else {
    printWarning(`Unknown action: ${mergedOptions.action}`);
    printInfo('Available actions: show, set, add, remove, list, test, set-api-key');
  }
}

async function setApiKey(options: OptionValues): Promise<void> {
  const name = options.name as string;
  const apiKey = options.apiKey as string;
  const global = Boolean(options.global);

  if (!name || !apiKey) {
    printWarning('Name and apiKey required.');
    printInfo('Usage: kontextmind config set-api-key --name <provider> --apiKey <key> [--global]');
    return;
  }

  // Get provider-specific defaults
  const providerDefaults = getProviderDefaults(name);

  if (global) {
    const config = loadGlobalConfig();
    if (config.providers[name]) {
      // Update existing provider's API key
      config.providers[name].apiKey = apiKey;
      printSuccess(`Updated API key for global provider: ${chalk.green(name)}`);
    } else {
      // Auto-create provider with provider-specific defaults
      config.providers[name] = {
        provider: 'openai-compatible',
        apiKey: apiKey,
        baseUrl: providerDefaults.baseUrl,
        model: providerDefaults.model,
      };
      printSuccess(`Created and set API key for global provider: ${chalk.green(name)}`);
      if (providerDefaults.baseUrl !== 'https://api.anthropic.com/v1') {
        printInfo(`  Base URL: ${chalk.dim(providerDefaults.baseUrl)}`);
      }
      if (providerDefaults.model) {
        printInfo(`  Model: ${chalk.dim(providerDefaults.model)}`);
      }
    }
    saveGlobalConfig(config);
  } else {
    const projectConfigPath = join(process.cwd(), '.kontextmind', 'providers.json');
    if (existsSync(projectConfigPath)) {
      const config = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      if (config.providers?.[name]) {
        // Update existing
        config.providers[name].api_key = apiKey;
        printSuccess(`Updated API key for project provider: ${chalk.green(name)}`);
      } else {
        // Auto-create in project config
        config.providers = config.providers || {};
        config.providers[name] = {
          type: 'openai-compatible',
          api_key: apiKey,
          base_url: providerDefaults.baseUrl,
          model: providerDefaults.model,
        };
        printSuccess(`Created and set API key for project provider: ${chalk.green(name)}`);
        if (providerDefaults.baseUrl !== 'https://api.anthropic.com/v1') {
          printInfo(`  Base URL: ${chalk.dim(providerDefaults.baseUrl)}`);
        }
        if (providerDefaults.model) {
          printInfo(`  Model: ${chalk.dim(providerDefaults.model)}`);
        }
      }
      writeFileSync(projectConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } else {
      printWarning('Project not initialized. Use --global or run: kontextmind init --yes');
    }
  }
}

/**
 * Get provider-specific default configuration
 */
function getProviderDefaults(providerName: string): { baseUrl: string; model: string } {
  switch (providerName.toLowerCase()) {
    case 'opusmax':
      return {
        baseUrl: 'https://api.opusmax.pro/v1',
        model: 'claude-opus-4-7',
      };
    case 'claude':
    case 'anthropic':
      return {
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-7',
      };
    default:
      return {
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-7',
      };
  }
}

async function showConfig(_options: OptionValues): Promise<void> {
  printSection('KontextMind Configuration');

  // Show global config
  printInfo(chalk.bold('Global Configuration:'));
  const globalConfig = loadGlobalConfig();

  if (Object.keys(globalConfig.providers).length > 0) {
    for (const [name, config] of Object.entries(globalConfig.providers)) {
      printInfo(`  ${chalk.cyan(name)}:`);
      printInfo(`    Provider: ${config.provider}`);
      printInfo(`    Base URL: ${config.baseUrl}`);
      printInfo(`    Model: ${config.model || 'not set'}`);
      printInfo(`    API Key: ${config.apiKey ? '****' + config.apiKey.slice(-4) : 'not set'}`);
    }
    printInfo(`  Default: ${chalk.green(globalConfig.defaultProvider || 'none')}`);
  } else {
    printWarning('  No providers configured globally');
  }

  // Show project config
  const projectConfigPath = join(process.cwd(), '.kontextmind', 'providers.json');
  if (existsSync(projectConfigPath)) {
    printInfo('\n' + chalk.bold('Project Configuration:'));
    const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
    printInfo(`  Selected Provider: ${chalk.green(projectConfig.selected_provider)}`);

    if (projectConfig.providers) {
      for (const [name, config] of Object.entries(projectConfig.providers)) {
        const c = config as Record<string, unknown>;
        printInfo(`  ${chalk.cyan(name)}:`);
        printInfo(`    Type: ${c.type}`);
        if (c.base_url) printInfo(`    Base URL: ${c.base_url}`);
        if (c.api_key_env) printInfo(`    API Key Env: ${c.api_key_env}`);
      }
    }
  }
}

async function setProvider(options: OptionValues): Promise<void> {
  const providerName = options.provider as string;
  const global = Boolean(options.global);

  if (!providerName) {
    printWarning('Provider name required. Usage: kontextmind config set <provider> [--global]');
    return;
  }

  if (global) {
    const config = loadGlobalConfig();
    config.defaultProvider = providerName;
    saveGlobalConfig(config);
    printSuccess(`Set default provider to: ${chalk.green(providerName)}`);
  } else {
    const projectConfigPath = join(process.cwd(), '.kontextmind', 'providers.json');
    if (existsSync(projectConfigPath)) {
      const config = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      config.selected_provider = providerName;
      writeFileSync(projectConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      printSuccess(`Set project default provider to: ${chalk.green(providerName)}`);
    } else {
      printWarning('Project not initialized. Run: kontextmind init --yes');
    }
  }
}

async function addProvider(options: OptionValues): Promise<void> {
  // Handle both positional arguments and options
  const positionalName = options.args?.[1] as string | undefined;
  const name = options.name as string || positionalName;
  const provider = options.type as string;
  const baseUrl = options.baseUrl as string;
  const apiKey = options.apiKey as string | undefined;
  const model = options.model as string | undefined;
  const global = Boolean(options.global);

  if (!name || !provider || !baseUrl) {
    printWarning('Name, type, and baseUrl required.');
    printInfo('Usage: kontextmind config add --name <name> --type <type> --baseUrl <url> [--apiKey <key>] [--model <model>] [--global]');
    return;
  }

  const providerConfig: ProviderConfig = {
    provider,
    baseUrl,
    model,
    apiKey,
  };

  if (global) {
    const config = loadGlobalConfig();
    config.providers[name] = providerConfig;
    if (!config.defaultProvider) {
      config.defaultProvider = name;
    }
    saveGlobalConfig(config);
    printSuccess(`Added global provider: ${chalk.green(name)}`);
  } else {
    const projectConfigPath = join(process.cwd(), '.kontextmind', 'providers.json');
    if (existsSync(projectConfigPath)) {
      const config = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      config.providers[name] = {
        type: provider,
        base_url: baseUrl,
        model,
        api_key: apiKey,
      };
      writeFileSync(projectConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      printSuccess(`Added project provider: ${chalk.green(name)}`);
    } else {
      printWarning('Project not initialized. Run: kontextmind init --yes');
    }
  }
}

async function removeProvider(options: OptionValues): Promise<void> {
  const name = options.name as string;
  const global = Boolean(options.global);

  if (!name) {
    printWarning('Provider name required. Usage: kontextmind config remove <name> [--global]');
    return;
  }

  if (global) {
    const config = loadGlobalConfig();
    if (config.providers[name]) {
      delete config.providers[name];
      if (config.defaultProvider === name) {
        config.defaultProvider = undefined;
      }
      saveGlobalConfig(config);
      printSuccess(`Removed global provider: ${chalk.green(name)}`);
    } else {
      printWarning(`Provider not found: ${name}`);
    }
  } else {
    const projectConfigPath = join(process.cwd(), '.kontextmind', 'providers.json');
    if (existsSync(projectConfigPath)) {
      const config = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      if (config.providers && config.providers[name]) {
        delete config.providers[name];
        writeFileSync(projectConfigPath, JSON.stringify(config, null, 2), 'utf-8');
        printSuccess(`Removed project provider: ${chalk.green(name)}`);
      } else {
        printWarning(`Provider not found: ${name}`);
      }
    }
  }
}

async function listProviders(): Promise<void> {
  printSection('Available Providers');

  // Predefined providers
  printInfo(chalk.bold('Predefined Providers:'));
  printInfo('  openai         - OpenAI API (requires OPENAI_API_KEY env var)');
  printInfo('  anthropic      - Anthropic Claude API (requires ANTHROPIC_API_KEY env var)');
  printInfo('  ollama         - Ollama local models (http://localhost:11434/v1)');
  printInfo('  bedrock        - AWS Bedrock (requires AWS credentials)');
  printInfo('  openai-compatible - Any OpenAI-compatible API');

  // Custom providers
  printInfo('\n' + chalk.bold('Custom Providers:'));
  const config = loadGlobalConfig();
  if (Object.keys(config.providers).length > 0) {
    for (const name of Object.keys(config.providers)) {
      const p = config.providers[name];
      printInfo(`  ${chalk.cyan(name)} - ${p.baseUrl}`);
    }
  } else {
    printInfo('  (none configured)');
  }

  printInfo('\nTo add a custom provider:');
  printInfo('  kontextmind config add --name <name> --type openai-compatible --baseUrl <url> [--apiKey <key>] [--model <model>] --global');
}

async function testProvider(options: OptionValues): Promise<void> {
  const name = options.name as string;
  const prompt = (options.prompt as string) || (options.args?.find((a: string) => !a.startsWith('--')) as string) || 'Say hello and confirm you are working.';
  const global = Boolean(options.global);

  if (!name) {
    printWarning('Provider name required for test.');
    printInfo('Usage: kontextmind config test --name <provider_name> [--prompt "your message"] [--global]');
    printInfo('Example: kontextmind config test --name opusmax --global');
    return;
  }

  // Find provider config
  let providerConfig: ProviderConfig | null = null;

  if (global) {
    const config = loadGlobalConfig();
    providerConfig = config.providers[name] || null;
    if (!providerConfig) {
      printWarning(`Global provider not found: ${name}`);
      printInfo('Available global providers: ' + Object.keys(config.providers).join(', ') || '(none)');
      return;
    }
  } else {
    const projectConfigPath = join(process.cwd(), '.kontextmind', 'providers.json');
    if (existsSync(projectConfigPath)) {
      const config = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      const projectProvider = config.providers?.[name];
      if (projectProvider) {
        providerConfig = {
          provider: projectProvider.type,
          baseUrl: projectProvider.base_url || '',
          model: projectProvider.model,
          apiKey: projectProvider.api_key || projectProvider.api_key_env ? `env:${projectProvider.api_key_env}` : undefined,
        };
      } else {
        printWarning(`Project provider not found: ${name}`);
        printInfo('Available project providers: ' + Object.keys(config.providers || {}).join(', '));
        return;
      }
    } else {
      printWarning('Project not initialized. Use --global or run: kontextmind init --yes');
      return;
    }
  }

  printSection(`Testing Provider: ${chalk.cyan(name)}`);
  printInfo(`Prompt: ${chalk.dim(prompt)}`);
  printInfo(`Model: ${providerConfig.model || 'default'}\n`);

  // Create provider
  const provider = createProviderFromConfig({
    name,
    provider: providerConfig.provider as 'openai' | 'anthropic' | 'ollama' | 'bedrock' | 'openai-compatible' | 'mock',
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
    model: providerConfig.model,
  });

  if (!provider) {
    printError('Failed to create provider');
    return;
  }

  // Test the provider
  const startTime = Date.now();
  try {
    const result = await provider.generateText({
      prompt,
      maxTokens: 200,
    });

    const duration = Date.now() - startTime;

    if (result.error) {
      printError(`Error: ${result.error}`);
      return;
    }

    printSuccess(`Response (${duration}ms):\n`);
    printInfo(result.text || '(empty response)');

    if (result.usage) {
      printInfo(`\n${chalk.dim(`Tokens: ${result.usage.totalTokens} | Model: ${result.model}`)}`);
    }
  } catch (error) {
    printError(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
