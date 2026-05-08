import { OptionValues } from 'commander';
import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import { indexProject, getIndexStatus } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';
import { resolveInProject, FILES } from '../utils/paths.js';

export async function indexCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      console.log(`Run: ${chalk.cyan('kontextmind init')}`);
      process.exit(1);
    }

    // Load project config
    const configPath = resolveInProject(FILES.configJson);
    let projectName = project.name;
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        projectName = config.project?.name || project.name;
      } catch {
        // Use default
      }
    }

    // Check if file index exists
    const indexStatus = getIndexStatus(projectRoot);
    if (!indexStatus.hasFileIndex) {
      console.log(chalk.red('No file index found. Run "kontextmind scan" first.'));
      console.log(`Run: ${chalk.cyan('kontextmind scan')}`);
      process.exit(1);
    }

    const languages = String(options.language || 'typescript,javascript,python').split(',').map((l: string) => l.trim());

    console.log(chalk.bold('KontextMind Index'));
    console.log('Indexing project...\n');

    const result = await indexProject({
      projectRoot,
      projectName,
      languages,
      changedOnly: Boolean(options.changedOnly),
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.bold('Index Complete'));
    console.log(`  Files processed: ${chalk.green(result.filesProcessed)}`);
    console.log(`  Files skipped: ${result.filesSkipped}`);
    console.log(`  Symbols indexed: ${chalk.green(result.symbolsIndexed)}`);
    console.log(`  Dependencies indexed: ${chalk.green(result.dependenciesIndexed)}`);
    console.log(`  Graph nodes: ${chalk.green(result.graphNodes)}`);
    console.log(`  Graph edges: ${chalk.green(result.graphEdges)}`);
    console.log(`  Duration: ${result.duration_ms}ms`);

    if (result.errors.length > 0) {
      console.log(chalk.yellow(`\nWarnings:`));
      result.errors.slice(0, 5).forEach(err => {
        console.log(`  ${chalk.yellow(err)}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ${chalk.yellow(`... and ${result.errors.length - 5} more`)}`);
      }
    }

    console.log();
  } catch (error) {
    console.error(chalk.red('Index failed:'), error);
    process.exit(1);
  }
}
