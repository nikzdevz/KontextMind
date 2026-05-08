import { OptionValues } from 'commander';
import chalk from 'chalk';
import { scanForSecrets } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  critical: chalk.bgRed.white,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
  info: chalk.gray,
};

export async function secretsScanCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    console.log(`Run: ${chalk.cyan('kontextmind init')}`);
    process.exit(1);
  }

  const json = Boolean(options.json);
  const failOnCritical = Boolean(options.failOnCritical);

  if (!json) {
    console.log(chalk.bold('KontextMind Secret Scanner'));
    console.log(`Scanning: ${projectRoot}\n`);
    console.log(chalk.gray('Searching for secrets...'));
  }

  const result = await scanForSecrets(projectRoot, {
    json,
    failOnCritical,
  });

  if (json) {
    const safeResult = {
      ...result,
      secrets: result.secrets.map((s) => ({
        type: s.type,
        severity: s.severity,
        file: s.file,
        line: s.line,
        action: s.action,
        preview: s.preview,
      })),
    };
    console.log(JSON.stringify(safeResult, null, 2));
  } else {
    console.log(`\nScanned: ${result.scanned} files`);
    console.log(`Skipped: ${result.skipped} files`);

    if (result.secrets.length === 0) {
      console.log(chalk.green('\nNo secrets detected.\n'));
      return;
    }

    console.log(chalk.red(`\nDetected ${result.secrets.length} potential secret(s):\n`));

    const bySeverity: Record<string, typeof result.secrets> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    for (const secret of result.secrets) {
      bySeverity[secret.severity].push(secret);
    }

    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      const secrets = bySeverity[severity];
      if (secrets.length === 0) continue;

      console.log(chalk.bold(`\n${severity.toUpperCase()} SEVERITY (${secrets.length})`));
      console.log('-'.repeat(60));

      for (const secret of secrets) {
        const colorFn = SEVERITY_COLORS[severity] || chalk.white;
        console.log(colorFn(`  ${secret.type}`));
        console.log(`    File: ${secret.file}:${secret.line}`);
        console.log(`    Preview: ${secret.preview}`);
        console.log(`    Action: ${secret.action}`);
        console.log('');
      }
    }

    console.log('-'.repeat(60));
    console.log(`\nSummary:`);
    console.log(`  Critical: ${result.criticalCount}`);
    console.log(`  High: ${result.highCount}`);

    if (result.errors.length > 0) {
      console.log(chalk.yellow(`\nErrors:`));
      for (const error of result.errors) {
        console.log(`  ${error}`);
      }
    }

    console.log('');

    if (failOnCritical && result.criticalCount > 0) {
      console.log(chalk.bgRed.white('FAILED: Critical secrets detected'));
      process.exit(1);
    }
  }
}