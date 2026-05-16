import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getLearningBridge, getOutcomeTracker, getAnalyticsReport } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

/**
 * kontextmind learn sync - Trigger manual learning sync
 */
export async function learnSyncCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    console.log(chalk.bold('Running learning sync...\n'));

    const learningBridge = getLearningBridge(projectRoot);
    const result = await learningBridge.syncNow();

    console.log(chalk.green('✓ Learning sync complete'));
    console.log(`  Summaries: ${result.summariesProcessed}`);
    console.log(`  Q&A events: ${result.qnaEventsProcessed}`);
    console.log(`  Memories: ${result.memoriesCreated}`);
    if (result.errors.length > 0) {
      console.log(`  ${chalk.yellow('Warnings:')} ${result.errors.length}`);
    }
  } catch (error) {
    console.error(chalk.red('Learn sync failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind learn stats - Get learning statistics
 */
export async function learnStatsCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const outcomeTracker = getOutcomeTracker(projectRoot);
    const stats = outcomeTracker.getStats();

    console.log(chalk.bold('\n=== Learning Statistics ===\n'));

    console.log(chalk.bold('Outcomes:'));
    console.log(`  Total: ${stats.totalOutcomes}`);
    console.log(`  Successful: ${chalk.green(stats.successfulOutcomes)}`);
    console.log(`  Failed: ${chalk.red(stats.failedOutcomes)}`);
    console.log(`  Success rate: ${chalk.cyan(((stats.successRate ?? 0) * 100).toFixed(1))}%`);
    console.log();

    console.log(chalk.bold('Patterns:'));
    console.log(`  Learned: ${stats.patternsLearned ?? 0}`);
    console.log(`  Categories: ${(stats.patternCategories ?? []).length}`);
    if ((stats.patternCategories ?? []).length > 0) {
      console.log(`  Types: ${(stats.patternCategories ?? []).join(', ')}`);
    }
    console.log();

    console.log(chalk.bold('Timing:'));
    console.log(`  Last sync: ${stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}`);
    console.log(`  Tracking since: ${stats.trackingSince ? new Date(stats.trackingSince).toLocaleString() : 'N/A'}`);
  } catch (error) {
    console.error(chalk.red('Learn stats failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind learn patterns - Get success/failure patterns
 */
export async function learnPatternsCommand(taskType: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const outcomeTracker = getOutcomeTracker(projectRoot);
    const patterns = outcomeTracker.getPatterns(taskType);

    console.log(chalk.bold('\n=== Learned Patterns ==='));
    if (taskType) {
      console.log(`Filter: ${chalk.cyan(taskType)}`);
    }
    console.log();

    if (patterns.length === 0) {
      console.log('No patterns learned yet. Keep working to build patterns!');
      return;
    }

    // Group by type
    const successPatterns = patterns.filter(p => p.type === 'success');
    const failurePatterns = patterns.filter(p => p.type === 'failure');

    if (successPatterns.length > 0) {
      console.log(chalk.green('✓ Success Patterns:'));
      for (const pattern of successPatterns) {
        const confStars = '★'.repeat(Math.round(pattern.confidence * 5));
        console.log(`  ${chalk.green('●')} ${pattern.description}`);
        console.log(`    Frequency: ${pattern.frequency}x ${chalk.gray(confStars)}`);
      }
      console.log();
    }

    if (failurePatterns.length > 0) {
      console.log(chalk.red('✗ Failure Patterns:'));
      for (const pattern of failurePatterns) {
        const confStars = '★'.repeat(Math.round(pattern.confidence * 5));
        console.log(`  ${chalk.red('●')} ${pattern.description}`);
        console.log(`    Frequency: ${pattern.frequency}x ${chalk.gray(confStars)}`);
      }
      console.log();
    }
  } catch (error) {
    console.error(chalk.red('Learn patterns failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind learn suggestions - Get improvement suggestions
 */
export async function learnSuggestionsCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const outcomeTracker = getOutcomeTracker(projectRoot);
    const limit = parseInt(String(options.limit || '10'), 10);
    const category = options.category;

    const suggestions = outcomeTracker.getSuggestions({ limit, category });

    console.log(chalk.bold('\n=== Improvement Suggestions ===\n'));

    if (suggestions.length === 0) {
      console.log('No suggestions yet. Keep working to get personalized suggestions!');
      return;
    }

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const priorityColor = s.priority === 'high' ? chalk.red :
                           s.priority === 'medium' ? chalk.yellow : chalk.gray;

      console.log(`${i + 1}. ${priorityColor(`[${s.priority?.toUpperCase() || 'MEDIUM'}]`)} ${chalk.bold(s.title || 'Improvement')}`);
      console.log(`   ${s.description}`);
      console.log(`   Category: ${chalk.cyan(s.category)}`);
      console.log();
    }
  } catch (error) {
    console.error(chalk.red('Learn suggestions failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind learn import - Import learning from another project
 */
export async function learnImportCommand(sourceProject: string, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const dataTypes = options.dataTypes ?
      String(options.dataTypes).split(',').map((d: string) => d.trim()) :
      ['summaries', 'decisions', 'patterns'];

    console.log(chalk.bold('Importing learning data...\n'));
    console.log(`  Source: ${chalk.cyan(sourceProject)}`);
    console.log(`  Data types: ${chalk.cyan(dataTypes.join(', '))}`);

    const learningBridge = getLearningBridge(projectRoot);
    const result = await learningBridge.importFrom(sourceProject, dataTypes);

    console.log(chalk.green('\n✓ Import complete'));
    console.log(`  Summaries: ${result.imported.summaries}`);
    console.log(`  Decisions: ${result.imported.decisions}`);
    console.log(`  Patterns: ${result.imported.patterns}`);
  } catch (error) {
    console.error(chalk.red('Learn import failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind learn export - Export learning data
 */
export async function learnExportCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const outcomeTracker = getOutcomeTracker(projectRoot);
    const taskType = options.taskType;
    const minConfidence = parseFloat(String(options.minConfidence || '0.5'));
    const outputPath = options.output;

    const exportData = outcomeTracker.exportForTraining(taskType, minConfidence);

    console.log(chalk.bold('\n=== Learning Export ===\n'));
    console.log(`  Records: ${exportData.length}`);
    console.log(`  Min confidence: ${minConfidence}`);
    if (taskType) {
      console.log(`  Task type: ${taskType}`);
    }

    if (outputPath) {
      const fs = await import('fs');
      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      console.log(chalk.green(`\n✓ Exported to ${outputPath}`));
    } else {
      console.log('\n' + JSON.stringify(exportData, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Learn export failed:'), error);
    process.exit(1);
  }
}