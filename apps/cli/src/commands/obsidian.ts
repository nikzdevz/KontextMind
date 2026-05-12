import { OptionValues } from 'commander';
import chalk from 'chalk';
import { obsidianExport } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

export async function obsidianExportCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    console.log(`Run: ${chalk.cyan('kontextmind init')}`);
    process.exit(1);
  }

  const output = options.output as string | undefined;
  const clean = Boolean(options.clean);
  const json = Boolean(options.json);

  if (!json) {
    console.log(chalk.bold('KontextMind Obsidian Export'));
    console.log(`Output: ${output || '.obsidian-export/'}`);
    if (clean) {
      console.log(chalk.yellow('Clean mode: removing existing export...'));
    }
    console.log('');
  }

  try {
    const stats = await obsidianExport(projectRoot, { output, clean });

    if (json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            output: output || '.obsidian-export/',
            stats,
          },
          null,
          2
        )
      );
    } else {
      console.log(chalk.green('Export complete!\n'));
      console.log('Statistics:');
      console.log(`  Files:        ${stats.files}`);
      console.log(`  Functions:    ${stats.functions}`);
      console.log(`  Modules:      ${stats.modules}`);
      console.log(`  Dependencies: ${stats.dependencies}`);
      console.log(`  Backlinks:   ${stats.backlinks}`);
      console.log(`\nOutput: ${chalk.cyan(output || '.obsidian-export/')}`);
      console.log("\nOpen in Obsidian to browse the project brain.");
    }
  } catch (error) {
    if (json) {
      console.log(
        JSON.stringify({
          success: false,
          error: String(error),
        })
      );
    } else {
      console.error(chalk.red('Export failed:'), error);
    }
    process.exit(1);
  }
}