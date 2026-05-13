// Dataset CLI Commands
import { OptionValues } from 'commander';
import chalk from 'chalk';
import { detectProject } from '@kontextmind/core';
import {
  collectData,
  mergeToTrainingRecords,
  filterRecords,
  deduplicateRecords,
  createVersion,
  getVersionHistory,
  getLatestVersion,
  computeStatistics,
  toJSONL,
  toChatML,
  toShareGPT,
} from '@kontextmind/core';

export async function datasetExportCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      console.log(`Run: ${chalk.cyan('kontextmind init')}`);
      process.exit(1);
    }

    const format = (options.format as string) || 'jsonl';
    const minConfidence = Number(options.minConfidence) || 0.5;
    const includeCode = Boolean(options.includeCode);
    const apiOnly = Boolean(options.apiOnly);
    const outputPath = options.output as string || undefined;

    console.log(chalk.cyan('Collecting dataset...'));

    const data = collectData(projectRoot, {
      sources: ['qna-events', 'feedback', 'qa-history', 'sessions'],
    });

    const filters = {
      minConfidence,
      maxAgeDays: 90,
      includeCodeRequests: includeCode,
      apiOnly,
      minQualityScore: 0.6,
    };

    console.log(chalk.cyan('Merging records...'));
    const merged = mergeToTrainingRecords(data, filters);

    console.log(chalk.cyan('Filtering records...'));
    const filterResult = filterRecords(merged, filters);

    console.log(chalk.cyan('Deduplicating...'));
    const dedupResult = deduplicateRecords(filterResult.passed);

    console.log(chalk.cyan('Creating version...'));
    const versionData = createVersion(projectRoot, dedupResult.records, {
      format: 'semver',
    });

    // Format output
    let content: string;
    switch (format) {
      case 'chatml':
        content = toChatML(dedupResult.records);
        break;
      case 'sharegpt':
        content = toShareGPT(dedupResult.records);
        break;
      case 'json':
        content = JSON.stringify(dedupResult.records, null, 2);
        break;
      default:
        content = toJSONL(dedupResult.records);
    }

    // Write output
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');

    const outPath = outputPath || join(projectRoot, '.kontextmind/dataset/current/training.jsonl');
    writeFileSync(outPath, content, 'utf-8');

    console.log(chalk.green(`\nDataset exported successfully!`));
    console.log(`Records: ${dedupResult.records.length}`);
    console.log(`Version: ${versionData.version}`);
    console.log(`Format: ${format}`);
    console.log(`Output: ${outPath}`);

    const stats = computeStatistics(dedupResult.records);
    console.log(`\nStatistics:`);
    console.log(`  By source: ${JSON.stringify(stats.bySource)}`);
    console.log(`  Average quality: ${stats.averageQuality.toFixed(2)}`);
    console.log(`  Session-based: ${stats.sessionBased}`);

    if (options.json) {
      console.log(JSON.stringify({
        recordCount: dedupResult.records.length,
        version: versionData.version,
        format,
        outputPath: outPath,
        statistics: stats,
      }, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Export failed:'), error);
    process.exit(1);
  }
}

export async function datasetStatsCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    const version = options.version as string | undefined;

    let records: any[] = [];
    if (version) {
      const { loadVersionRecords } = await import('@kontextmind/core');
      records = loadVersionRecords(projectRoot, version);
    } else {
      const latest = getLatestVersion(projectRoot);
      if (latest) {
        const { loadVersionRecords } = await import('@kontextmind/core');
        records = loadVersionRecords(projectRoot, latest);
      }
    }

    if (records.length === 0) {
      console.log(chalk.yellow('No dataset found. Run "kontextmind dataset export" first.'));
      return;
    }

    const stats = computeStatistics(records);
    const latestVersion = getLatestVersion(projectRoot);

    console.log(chalk.bold('\nDataset Statistics\n'));
    console.log(`Total records: ${records.length}`);
    console.log(`Version: ${latestVersion || 'unknown'}`);
    console.log(`Average quality: ${stats.averageQuality.toFixed(2)}`);
    console.log();

    console.log(chalk.bold('By Source:'));
    for (const [source, count] of Object.entries(stats.bySource)) {
      console.log(`  ${source}: ${count}`);
    }
    console.log();

    console.log(chalk.bold('By Feedback:'));
    for (const [feedback, count] of Object.entries(stats.byFeedback)) {
      console.log(`  ${feedback}: ${count}`);
    }
    console.log();

    console.log(chalk.bold('Quality Distribution:'));
    const distribution = getQualityDistribution(records);
    console.log(`  Excellent (>= 0.8): ${distribution.excellent}`);
    console.log(`  Good (0.6 - 0.8): ${distribution.good}`);
    console.log(`  Fair (0.4 - 0.6): ${distribution.fair}`);
    console.log(`  Poor (< 0.4): ${distribution.poor}`);
    console.log();

    console.log(chalk.bold('Session Data:'));
    console.log(`  Session-based records: ${stats.sessionBased}`);
    console.log(`  Code requests: ${stats.codeRequests}`);
    console.log(`  Code request dislikes: ${stats.codeRequestDislikes}`);

    if (options.json) {
      console.log(JSON.stringify({
        recordCount: records.length,
        version: latestVersion,
        statistics: stats,
      }, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Stats failed:'), error);
    process.exit(1);
  }
}

function getQualityDistribution(records: any[]): { excellent: number; good: number; fair: number; poor: number } {
  const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };

  for (const record of records) {
    const score = record.quality?.score || 0;
    if (score >= 0.8) distribution.excellent++;
    else if (score >= 0.6) distribution.good++;
    else if (score >= 0.4) distribution.fair++;
    else distribution.poor++;
  }

  return distribution;
}

export async function datasetVersionCommand(action: string, options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    switch (action) {
      case 'list': {
        const versions = getVersionHistory(projectRoot);

        if (versions.length === 0) {
          console.log(chalk.yellow('No dataset versions found.'));
          return;
        }

        console.log(chalk.bold(`\nDataset Versions (${versions.length}):\n`));
        for (const ver of versions) {
          console.log(`${chalk.cyan(ver.version)}`);
          console.log(`  Created: ${ver.createdAt}`);
          console.log(`  Records: ${ver.recordCount}`);
          console.log(`  Average quality: ${ver.statistics.averageQuality.toFixed(2)}`);
          console.log();
        }
        break;
      }

      case 'export': {
        const version = options.version as string;
        if (!version) {
          console.log(chalk.red('--version is required for export'));
          process.exit(1);
        }

        const { loadVersionRecords } = await import('@kontextmind/core');
        const records = loadVersionRecords(projectRoot, version);

        if (records.length === 0) {
          console.log(chalk.red(`Version not found: ${version}`));
          process.exit(1);
        }

        const format = (options.format as string) || 'jsonl';
        const output = options.output as string;

        let content: string;
        switch (format) {
          case 'chatml':
            content = toChatML(records);
            break;
          case 'sharegpt':
            content = toShareGPT(records);
            break;
          case 'json':
            content = JSON.stringify(records, null, 2);
            break;
          default:
            content = toJSONL(records);
        }

        const { writeFileSync } = await import('fs');
        const { join } = await import('path');

        const outPath = output || join(projectRoot, `.kontextmind/dataset/versions/${version}/export.${format === 'jsonl' ? 'jsonl' : format}`);
        writeFileSync(outPath, content, 'utf-8');

        console.log(chalk.green(`Version ${version} exported to ${outPath}`));
        break;
      }

      default:
        console.log(chalk.red(`Unknown version action: ${action}`));
        console.log('Available actions: list, export');
        process.exit(1);
    }

    if (options.json) {
      const versions = getVersionHistory(projectRoot);
      console.log(JSON.stringify({ versions }, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Version command failed:'), error);
    process.exit(1);
  }
}

export async function datasetValidateCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    const minQuality = Number(options.minQuality) || 0.6;
    const strict = Boolean(options.strict);

    const latestVersion = getLatestVersion(projectRoot);
    if (!latestVersion) {
      console.log(chalk.red('No dataset version found. Run "kontextmind dataset export" first.'));
      process.exit(1);
    }

    const { loadVersionRecords, computeStatistics } = await import('@kontextmind/core');
    const records = loadVersionRecords(projectRoot, latestVersion);
    const stats = computeStatistics(records);

    const issues: string[] = [];

    // Check record count
    if (records.length === 0) {
      issues.push('No records in dataset');
    }

    // Check average quality
    if (stats.averageQuality < minQuality) {
      issues.push(`Average quality (${stats.averageQuality.toFixed(2)}) below threshold (${minQuality})`);
    }

    // Check source distribution
    if (!stats.bySource['api'] && !stats.bySource['cli']) {
      issues.push('No API or CLI sourced records');
    }

    // Check code request ratio
    if (stats.codeRequests > 0) {
      const ratio = stats.codeRequestDislikes / stats.codeRequests;
      if (ratio > 0.8) {
        issues.push('High ratio of disliked code requests - consider filtering');
      }
    }

    console.log(chalk.bold('\nDataset Validation\n'));
    console.log(`Version: ${latestVersion}`);
    console.log(`Records: ${records.length}`);
    console.log(`Average quality: ${stats.averageQuality.toFixed(2)}`);
    console.log();

    if (issues.length === 0) {
      console.log(chalk.green('✓ Dataset is valid'));
    } else {
      console.log(chalk.red('✗ Dataset has issues:'));
      for (const issue of issues) {
        console.log(`  - ${issue}`);
      }
    }

    if (options.json) {
      console.log(JSON.stringify({
        valid: issues.length === 0,
        issues,
        statistics: stats,
      }, null, 2));
    }

    if (strict && issues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Validation failed:'), error);
    process.exit(1);
  }
}