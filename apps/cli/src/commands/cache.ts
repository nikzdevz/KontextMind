import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getCacheStatus, invalidateCache, clearCacheMetadata, clearEmbeddingIndex, clearQualityScores } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

export async function cacheCommand(action: string, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    console.log(`Run: ${chalk.cyan('kontextmind init')}`);
    process.exit(1);
  }

  try {
    switch (action) {
      case 'status': {
        const status = getCacheStatus(projectRoot);
        console.log(chalk.bold('Cache Status:'));
        console.log(`  Total entries: ${status.totalEntries}`);
        console.log(`  Fresh entries: ${chalk.green(status.freshEntries)}`);
        console.log(`  Stale entries: ${chalk.yellow(status.staleEntries)}`);
        console.log(`  Last full scan: ${status.lastFullScan || 'Never'}`);
        break;
      }

      case 'invalidate': {
        const trigger = options.refresh ? 'manual_refresh' : 'age_threshold';
        const result = invalidateCache(projectRoot, trigger as 'manual_refresh' | 'age_threshold');
        console.log(chalk.green(`Invalidated ${result.invalidatedIds.length} entries`));
        console.log(`  Reason: ${result.reason}`);
        console.log(`  Entries checked: ${result.entriesChecked}`);
        break;
      }

      case 'clear': {
        if (!options.force && !options.yes) {
          console.log(chalk.yellow('This will clear all cache data. Use --force to confirm.'));
          process.exit(1);
        }

        clearCacheMetadata(projectRoot);
        clearEmbeddingIndex(projectRoot);
        clearQualityScores(projectRoot);

        console.log(chalk.green('Cache cleared successfully.'));
        break;
      }

      default:
        console.log(chalk.yellow('Unknown action. Use: status, invalidate, clear'));
        console.log('\nUsage:');
        console.log('  kontextmind cache status      - Show cache statistics');
        console.log('  kontextmind cache invalidate  - Invalidate stale entries');
        console.log('  kontextmind cache clear       - Clear all cache data');
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Cache command failed:'), error);
    process.exit(1);
  }
}
