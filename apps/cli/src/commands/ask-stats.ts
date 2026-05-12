import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getAnalyticsReport, getTopQuestions, getCacheCoverage } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

export async function askStatsCommand(action: string, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    console.log(`Run: ${chalk.cyan('kontextmind init')}`);
    process.exit(1);
  }

  try {
    switch (action) {
      case 'stats': {
        const report = await getAnalyticsReport(projectRoot, options.weekly ? 'weekly' : 'daily');

        console.log(chalk.bold('\n=== Q&A Cache Statistics ==='));
        console.log(`Period: ${report.period} (${report.startDate} to ${report.endDate})`);
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
          console.log(`Hit rate trend: ${chalk[trendDir === 'up' ? 'green' : 'yellow']((report.trends.hitRateTrend * 100).toFixed(1))}%`);
        }
        break;
      }

      case 'top-questions': {
        const limit = parseInt(String(options.limit || '10'), 10);
        const topQuestions = await getTopQuestions(projectRoot, limit);

        console.log(chalk.bold('\n=== Top Questions ==='));
        if (topQuestions.length === 0) {
          console.log('No questions asked yet.');
        } else {
          for (let i = 0; i < topQuestions.length; i++) {
            const q = topQuestions[i];
            console.log(`${i + 1}. "${q.question}"`);
            console.log(`   Asked ${q.count} time(s), avg confidence: ${q.averageConfidence.toFixed(2)}`);
            console.log();
          }
        }
        break;
      }

      case 'coverage': {
        const coverage = getCacheCoverage(projectRoot);

        console.log(chalk.bold('\n=== Cache Coverage ==='));
        console.log(`Total questions: ${coverage.totalQuestions}`);
        console.log(`Cached questions: ${chalk.green(coverage.cachedQuestions)}`);
        console.log(`Coverage: ${chalk.cyan(coverage.coveragePercent.toFixed(1))}%`);
        console.log();

        console.log(chalk.bold('Tier Distribution:'));
        const tierNames = ['Exact', 'Normalized', 'Semantic', 'Pre-computed', 'Keyword', 'LLM'];
        for (const [tier, count] of Object.entries(coverage.tierCoverage)) {
          const pct = coverage.totalQuestions > 0 ? ((count / coverage.totalQuestions) * 100).toFixed(1) : '0.0';
          console.log(`  Tier ${tier} (${tierNames[parseInt(tier)] || 'Unknown'}): ${count} (${pct}%)`);
        }
        break;
      }

      default:
        console.log(chalk.bold('Ask Stats Commands:'));
        console.log();
        console.log('  kontextmind ask stats           - Show cache performance statistics');
        console.log('  kontextmind ask top-questions  - List most asked questions');
        console.log('  kontextmind ask coverage       - Show cache coverage by tier');
        console.log();
        console.log('Options:');
        console.log('  --weekly    Show weekly stats instead of daily');
        console.log('  --limit N   Limit results (default: 10)');
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Ask stats failed:'), error);
    process.exit(1);
  }
}