import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getAnalyticsReport, getTopQuestions, getCacheCoverage } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

/**
 * kontextmind analytics stats - Get Q&A statistics
 */
export async function analyticsStatsCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const period = options.weekly ? 'weekly' : 'daily';
    const report = await getAnalyticsReport(projectRoot, period);

    console.log(chalk.bold(`\n=== Q&A Analytics (${period}) ===\n`));
    console.log(`Period: ${report.startDate} to ${report.endDate}`);
    console.log();

    console.log(chalk.bold('Summary:'));
    console.log(`  Total questions: ${chalk.cyan(report.summary.totalQuestions)}`);
    console.log(`  Cache hits: ${chalk.green(report.summary.totalCacheHits)}`);
    console.log(`  Hit rate: ${chalk.green((report.summary.overallHitRate * 100).toFixed(1))}%`);
    console.log(`  Avg confidence: ${report.summary.averageConfidence.toFixed(2)}`);
    console.log(`  Avg response time: ${report.summary.averageResponseTimeMs.toFixed(0)}ms`);
    console.log();

    if (report.summary.totalCacheHits > 0) {
      console.log(chalk.bold('Tier Breakdown:'));
      const tierNames = ['Exact', 'Normalized', 'Semantic', 'Pre-computed', 'Keyword', 'LLM'];
      for (const [tier, count] of Object.entries(report.tierBreakdown)) {
        if (count > 0) {
          console.log(`  Tier ${tier} (${tierNames[parseInt(tier)] || 'Unknown'}): ${count}`);
        }
      }
      console.log();
    }

    if (report.trends.hitRateTrend !== 0) {
      const trendDir = report.trends.hitRateTrend > 0 ? 'up' : 'down';
      const trendColor = trendDir === 'up' ? chalk.green : chalk.yellow;
      console.log(`Hit rate trend: ${trendColor((report.trends.hitRateTrend * 100).toFixed(1))}%`);
    }

    if (options.json) {
      console.log('\n' + JSON.stringify(report, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Analytics stats failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind analytics top-questions - List most asked questions
 */
export async function analyticsTopQuestionsCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const limit = parseInt(String(options.limit || '10'), 10);
    const topQuestions = await getTopQuestions(projectRoot, limit);

    console.log(chalk.bold('\n=== Top Questions ===\n'));

    if (topQuestions.length === 0) {
      console.log('No questions asked yet.');
      return;
    }

    for (let i = 0; i < topQuestions.length; i++) {
      const q = topQuestions[i];
      console.log(`${i + 1}. "${chalk.bold(q.question)}"`);
      console.log(`   Asked ${chalk.cyan(q.count)} time(s)`);
      console.log(`   Avg confidence: ${q.averageConfidence.toFixed(2)}`);
      if (q.lastAsked) {
        console.log(`   Last asked: ${new Date(q.lastAsked).toLocaleString()}`);
      }
      console.log();
    }

    if (options.json) {
      console.log(JSON.stringify(topQuestions, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Analytics top-questions failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind analytics quality - Get answer quality metrics
 */
export async function analyticsQualityCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const coverage = getCacheCoverage(projectRoot);

    console.log(chalk.bold('\n=== Answer Quality ===\n'));

    console.log(chalk.bold('Cache Coverage:'));
    console.log(`  Total questions: ${coverage.totalQuestions}`);
    console.log(`  Cached: ${chalk.green(coverage.cachedQuestions)}`);
    console.log(`  Coverage: ${chalk.cyan(coverage.coveragePercent.toFixed(1))}%`);
    console.log();

    console.log(chalk.bold('Tier Distribution:'));
    const tierNames = ['Exact', 'Normalized', 'Semantic', 'Pre-computed', 'Keyword', 'LLM'];
    for (const [tier, count] of Object.entries(coverage.tierCoverage)) {
      const pct = coverage.totalQuestions > 0 ? ((count / coverage.totalQuestions) * 100).toFixed(1) : '0.0';
      const bar = '█'.repeat(Math.round(parseFloat(pct) / 5)) + '░'.repeat(20 - Math.round(parseFloat(pct) / 5));
      console.log(`  ${tierNames[parseInt(tier)] || 'Unknown'}: ${count.toString().padStart(4)} (${bar} ${pct}%)`);
    }

    if (options.json) {
      console.log('\n' + JSON.stringify(coverage, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Analytics quality failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind analytics intent-distribution - Get intent distribution
 */
export async function analyticsIntentDistributionCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    // Get the quality metrics module to get intent distribution
    const { getIntentDistribution } = await import('@kontextmind/core');

    const period = options.weekly ? 'weekly' : 'daily';
    const distribution = await getIntentDistribution(projectRoot, period);

    console.log(chalk.bold(`\n=== Intent Distribution (${period}) ===\n`));

    if (Object.keys(distribution).length === 0) {
      console.log('No intent data available yet.');
      return;
    }

    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    for (const [intent, count] of Object.entries(distribution)) {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      const bar = '█'.repeat(Math.round(parseFloat(pct) / 5)) + '░'.repeat(20 - Math.round(parseFloat(pct) / 5));
      console.log(`${intent.padEnd(20)} ${bar} ${count.toString().padStart(4)} (${pct}%)`);
    }

    console.log(`\n${chalk.gray('Total: ' + total)}`);

    if (options.json) {
      console.log('\n' + JSON.stringify(distribution, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Analytics intent-distribution failed:'), error);
    process.exit(1);
  }
}