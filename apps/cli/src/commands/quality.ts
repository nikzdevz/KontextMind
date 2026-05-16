import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getQualityTrends, getPerformanceStats, generateQualityReport } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

/**
 * kontextmind quality trends - Get quality trends
 */
export async function qualityTrendsCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const days = parseInt(String(options.days || '7'), 10);
    const trends = await getQualityTrends(projectRoot, days);

    console.log(chalk.bold(`\n=== Quality Trends (${days} days) ===\n`));

    if (!trends.current) {
      console.log('No quality data available yet.');
      return;
    }

    // Current period
    console.log(chalk.bold('Current Period:'));
    const currentQuestions = trends.current.totalQuestions ?? 0;
    const currentCacheHitRate = trends.current.cacheHitRate ?? 0;
    const currentAvgQuality = trends.current.averageQuality ?? 0;
    console.log(`  Questions: ${chalk.cyan(currentQuestions)}`);
    console.log(`  Cache hit rate: ${chalk.green((currentCacheHitRate * 100).toFixed(1))}%`);
    console.log(`  Avg quality: ${chalk.cyan((currentAvgQuality * 100).toFixed(0))}%`);
    console.log();

    // Previous period
    if (trends.previous) {
      console.log(chalk.bold('Previous Period:'));
      const prevQuestions = trends.previous.totalQuestions ?? 0;
      const prevCacheHitRate = trends.previous.cacheHitRate ?? 0;
      const prevAvgQuality = trends.previous.averageQuality ?? 0;
      console.log(`  Questions: ${prevQuestions}`);
      console.log(`  Cache hit rate: ${(prevCacheHitRate * 100).toFixed(1)}%`);
      console.log(`  Avg quality: ${(prevAvgQuality * 100).toFixed(0)}%`);
      console.log();
    }

    // Trends
    console.log(chalk.bold('Trends:'));

    const trendsQuality = trends.trends.quality || 'unknown';
    const trendsVolume = trends.trends.volume || 'unknown';
    const qualityTrendColor = trendsQuality === 'improving' ? chalk.green :
                             trendsQuality === 'declining' ? chalk.red : chalk.gray;
    const volumeTrendColor = trendsVolume === 'increasing' ? chalk.green :
                            trendsVolume === 'decreasing' ? chalk.yellow : chalk.gray;

    console.log(`  Quality: ${qualityTrendColor(trendsQuality)}`);
    console.log(`  Volume: ${volumeTrendColor(trendsVolume)}`);

    if (options.json) {
      console.log('\n' + JSON.stringify(trends, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Quality trends failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind quality report - Generate quality report
 */
export async function qualityReportCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const period = options.period || 'daily';
    const report = await generateQualityReport(projectRoot, period);

    if (options.json) {
      console.log(JSON.stringify({ report }, null, 2));
      return;
    }

    console.log(chalk.bold(`\n=== Quality Report (${period}) ===\n`));
    console.log(report);
  } catch (error) {
    console.error(chalk.red('Quality report failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind quality performance - Get performance stats
 */
export async function qualityPerformanceCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const stats = await getPerformanceStats(projectRoot);

    console.log(chalk.bold('\n=== Performance Statistics ===\n'));

    console.log(chalk.bold('Response Times:'));
    console.log(`  Average: ${chalk.cyan(stats.averageResponseTime.toFixed(0))}ms`);
    console.log(`  P50: ${stats.p50.toFixed(0)}ms`);
    console.log(`  P95: ${chalk.yellow(stats.p95.toFixed(0))}ms`);
    console.log(`  P99: ${chalk.red(stats.p99.toFixed(0))}ms`);
    console.log();

    console.log(chalk.bold('Token Usage:'));
    if (stats.tokenUsage) {
      const promptTokens = stats.tokenUsage.promptTokens || 0;
      const completionTokens = stats.tokenUsage.completionTokens || 0;
      const totalTokens = stats.tokenUsage.totalTokens || 0;

      console.log(`  Prompt: ${chalk.cyan(promptTokens.toLocaleString())}`);
      console.log(`  Completion: ${chalk.cyan(completionTokens.toLocaleString())}`);
      console.log(`  Total: ${chalk.green(totalTokens.toLocaleString())}`);
    } else {
      console.log('  No token usage data available');
    }

    if (options.json) {
      console.log('\n' + JSON.stringify(stats, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Quality performance failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind quality score - Get overall quality score
 */
export async function qualityScoreCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const { calculateQualityMetrics } = await import('@kontextmind/core');
    const metrics = await calculateQualityMetrics(projectRoot);

    const overallScore = metrics.overallScore ?? 0;
    const accuracy = metrics.accuracy ?? 0;
    const completeness = metrics.completeness ?? 0;
    const relevance = metrics.relevance ?? 0;
    const freshness = metrics.freshness ?? 0;

    const scoreColor = overallScore >= 0.7 ? chalk.green :
                      overallScore >= 0.4 ? chalk.yellow : chalk.red;

    console.log(chalk.bold('\n=== Quality Score ===\n'));
    console.log(`${scoreColor('●')} Overall: ${scoreColor((overallScore * 100).toFixed(0))}%`);
    console.log();

    console.log(chalk.bold('Components:'));
    console.log(`  Accuracy: ${chalk.cyan((accuracy * 100).toFixed(0))}%`);
    console.log(`  Completeness: ${chalk.cyan((completeness * 100).toFixed(0))}%`);
    console.log(`  Relevance: ${chalk.cyan((relevance * 100).toFixed(0))}%`);
    console.log(`  Freshness: ${chalk.cyan((freshness * 100).toFixed(0))}%`);

    if (options.json) {
      console.log('\n' + JSON.stringify(metrics, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Quality score failed:'), error);
    process.exit(1);
  }
}