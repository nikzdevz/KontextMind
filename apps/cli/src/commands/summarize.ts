import { OptionValues } from 'commander';
import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import { summarizeProject, getSummaryStatus, getLastSummarizeTime } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';
import { resolveInProject, FILES } from '../utils/paths.js';
import { type ProviderConfig } from '@kontextmind/core';
import { getGlobalConfig, type GlobalConfig } from '../utils/global-config.js';

function loadProviderConfig(globalConfig: GlobalConfig): ProviderConfig {
  // 1. Check global config for default provider first
  if (globalConfig.defaultProvider && globalConfig.providers[globalConfig.defaultProvider]) {
    const gp = globalConfig.providers[globalConfig.defaultProvider];
    return {
      name: globalConfig.defaultProvider,
      provider: gp.provider as ProviderConfig['provider'],
      apiKey: gp.apiKey,
      baseUrl: gp.baseUrl,
      model: gp.model,
    };
  }

  // 2. Check project providers.json for selected_provider
  const projectConfigPath = resolveInProject(FILES.providersJson);
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      const selectedProvider = projectConfig.selected_provider;
      if (selectedProvider && selectedProvider !== 'none' && projectConfig.providers?.[selectedProvider]) {
        const pp = projectConfig.providers[selectedProvider];
        return {
          name: selectedProvider,
          provider: pp.type as ProviderConfig['provider'],
          apiKey: pp.api_key || (pp.api_key_env ? `env:${pp.api_key_env}` : undefined),
          baseUrl: pp.base_url,
          model: pp.model,
        };
      }
    } catch {
      // Fall through to mock
    }
  }

  // 3. Default to mock
  return { name: 'mock', provider: 'mock' };
}

export async function summarizeCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      console.log(`Run: ${chalk.cyan('kontextmind init')}`);
      process.exit(1);
    }

    // Check if scan/index has been run
    const indexStatus = getSummaryStatus(projectRoot);
    if (!existsSync(resolveInProject('.kg', 'file-index.json'))) {
      console.log(chalk.red('No file index found. Run "kontextmind scan" first.'));
      console.log(`Run: ${chalk.cyan('kontextmind scan')}`);
      process.exit(1);
    }

    // Load provider config - checks global first, then project
    const globalConfig = getGlobalConfig();
    let provider = loadProviderConfig(globalConfig);

    // Override with CLI options
    if (options.mock) {
      provider = { name: 'mock', provider: 'mock' };
    } else if (options.provider) {
      // CLI option overrides - for explicit provider selection
      const explicitProvider = options.provider as string;
      if (globalConfig.providers[explicitProvider]) {
        const gp = globalConfig.providers[explicitProvider];
        provider = {
          name: explicitProvider,
          provider: gp.provider as ProviderConfig['provider'],
          apiKey: gp.apiKey,
          baseUrl: gp.baseUrl,
          model: gp.model,
        };
      } else {
        provider.provider = options.provider as ProviderConfig['provider'];
        provider.name = options.provider;
      }
    }

    const maxFiles = options.maxFiles ? parseInt(String(options.maxFiles), 10) : 50;
    const dryRun = Boolean(options.dryRun);

    console.log(chalk.bold('KontextMind Summarize'));
    if (dryRun) {
      console.log(chalk.yellow('[DRY RUN MODE]'));
    }
    console.log('Generating summaries...\n');

    const result = await summarizeProject({
      projectRoot,
      projectName: project.name,
      providerConfig: provider,
      model: options.model as string | undefined,
      maxFiles,
      changedOnly: Boolean(options.changedOnly),
      dryRun,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.bold('Summarization Complete'));
    if (dryRun) {
      console.log(`  Mode: ${chalk.yellow('dry run')}`);
    }
    console.log(`  Summaries generated: ${chalk.green(result.summariesGenerated)}`);
    console.log(`  Summaries failed: ${result.summariesFailed > 0 ? chalk.red(result.summariesFailed) : chalk.green('0')}`);
    console.log(`  Total cost: ${result.totalCost.toFixed(4)}`);
    console.log(`  Duration: ${result.durationMs}ms`);

    if (result.errors.length > 0) {
      console.log(chalk.yellow(`\nWarnings:`));
      result.errors.slice(0, 5).forEach(err => {
        console.log(`  ${chalk.yellow(err)}`);
      });
    }

    console.log();
  } catch (error) {
    console.error(chalk.red('Summarization failed:'), error);
    process.exit(1);
  }
}
