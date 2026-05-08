import { OptionValues } from 'commander';
import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import { summarizeProject, getSummaryStatus, getLastSummarizeTime } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';
import { resolveInProject, FILES } from '../utils/paths.js';
import { type ProviderConfig } from '@kontextmind/core';

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

    // Build provider config
    const configPath = resolveInProject(FILES.configJson);
    let provider: ProviderConfig = { name: 'mock', provider: 'mock' };

    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (config.provider && config.provider !== 'none') {
          provider = {
            name: config.provider,
            provider: config.provider as ProviderConfig['provider'],
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            model: config.model,
          };
        }
      } catch {
        // Use default mock
      }
    }

    // Override with CLI options
    if (options.mock) {
      provider = { name: 'mock', provider: 'mock' };
    } else if (options.provider) {
      provider.provider = options.provider as ProviderConfig['provider'];
      provider.name = options.provider;
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
