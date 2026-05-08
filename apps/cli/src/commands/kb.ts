import { OptionValues } from 'commander';
import chalk from 'chalk';
import { buildChatbotKB, getKBStatus } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';
import { resolveInProject, FILES } from '../utils/paths.js';
import { readFileSync, existsSync } from 'fs';
import { type ProviderConfig } from '@kontextmind/core';

export async function kbBuildCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      console.log(`Run: ${chalk.cyan('kontextmind init')}`);
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

    console.log(chalk.bold('KontextMind KB Build'));
    console.log('Building knowledge base...\n');

    const result = await buildChatbotKB({
      projectRoot,
      projectName: project.name,
      providerConfig: provider,
      mode: 'chatbot',
      changedOnly: Boolean(options.changedOnly),
      mock: Boolean(options.mock),
      maxQuestions: options.maxQuestions ? parseInt(String(options.maxQuestions), 10) : 50,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.bold('KB Build Complete'));
    console.log(`  Files created: ${chalk.green(result.filesCreated.length)}`);
    console.log(`  Duration: ${result.durationMs}ms`);

    if (result.errors.length > 0) {
      console.log(chalk.yellow(`\nWarnings:`));
      result.errors.slice(0, 5).forEach(err => {
        console.log(`  ${chalk.yellow(err)}`);
      });
    }

    console.log();
  } catch (error) {
    console.error(chalk.red('KB build failed:'), error);
    process.exit(1);
  }
}