import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getDynamicContextEngine, getSessionManager } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';
import { getCrossSessionInsights, buildTimeline, getRecentActivity, getContinuitySuggestions, shouldContinueFromLastSession } from '@kontextmind/core';

/**
 * kontextmind insights session - Get cross-session insights
 */
export async function insightsSessionCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const days = parseInt(String(options.days || '30'), 10);
    const insights = await getCrossSessionInsights(projectRoot, days);

    console.log(chalk.bold(`\n=== Cross-Session Insights (${days} days) ===\n`));

    console.log(chalk.bold('Session Summary:'));
    console.log(`  Total sessions: ${chalk.cyan(insights.totalSessions)}`);
    console.log(`  Total messages: ${chalk.cyan(insights.totalMessages)}`);
    console.log();

    if (insights.commonTopics && insights.commonTopics.length > 0) {
      console.log(chalk.bold('Common Topics:'));
      for (const topic of insights.commonTopics.slice(0, 10)) {
        console.log(`  • ${topic}`);
      }
      console.log();
    }

    if (insights.patterns && insights.patterns.length > 0) {
      console.log(chalk.bold('Patterns:'));
      for (const pattern of insights.patterns.slice(0, 5)) {
        console.log(`  ${chalk.cyan('●')} ${pattern.pattern}`);
        console.log(`    Frequency: ${pattern.frequency} times`);
      }
      console.log();
    }

    if (insights.productivity) {
      console.log(chalk.bold('Productivity:'));
      console.log(`  Tasks completed: ${chalk.green(insights.productivity.tasksCompleted)}`);
      console.log(`  Files modified: ${chalk.cyan(insights.productivity.filesModified)}`);
      console.log();
    }

    if (options.json) {
      console.log(JSON.stringify(insights, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Insights session failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind insights context - Get context engine stats
 */
export async function insightsContextCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const contextEngine = getDynamicContextEngine(projectRoot);
    const stats = contextEngine.getStats();

    console.log(chalk.bold('\n=== Context Engine Stats ===\n'));

    console.log(chalk.bold('Token Budget:'));
    console.log(`  Used: ${chalk.cyan(stats.tokensUsed.toLocaleString())}`);
    console.log(`  Budget: ${chalk.cyan(stats.budget.toLocaleString())}`);
    const utilization = (stats.tokensUsed / stats.budget * 100).toFixed(1);
    const utilColor = parseFloat(utilization) > 80 ? chalk.red :
                     parseFloat(utilization) > 60 ? chalk.yellow : chalk.green;
    console.log(`  Utilization: ${utilColor(utilization)}%`);
    console.log();

    if (stats.compressionRatio) {
      console.log(chalk.bold('Compression:'));
      console.log(`  Ratio: ${chalk.cyan(stats.compressionRatio.toFixed(2))}:1`);
      console.log();
    }

    if (stats.lastCompress) {
      console.log(chalk.bold('Last Compression:'));
      console.log(`  ${new Date(stats.lastCompress).toLocaleString()}`);
      console.log();
    }

    // Session context if available
    const sessionManager = getSessionManager();
    if (sessionManager) {
      const context = sessionManager.getCurrentContext();
      if (context) {
        console.log(chalk.bold('Current Session:'));
        console.log(`  Messages: ${chalk.cyan(context.messages?.length || 0)}`);
        console.log(`  Turn: ${chalk.cyan(context.currentTurn || 0)}`);
      }
    }

    if (options.json) {
      console.log('\n' + JSON.stringify(stats, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Insights context failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind insights export - Export current context
 */
export async function insightsExportCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const contextEngine = getDynamicContextEngine(projectRoot);
    const exported = contextEngine.export();

    console.log(chalk.bold('\n=== Context Export ===\n'));

    console.log(`Export ID: ${chalk.cyan(exported.exportId)}`);
    console.log(`Timestamp: ${new Date(exported.timestamp).toLocaleString()}`);
    console.log(`Messages: ${chalk.cyan(exported.messageCount)}`);
    console.log(`Tokens: ${chalk.cyan(exported.tokenCount)}`);
    console.log();

    if (exported.summary) {
      console.log(chalk.bold('Summary:'));
      console.log(`  ${exported.summary}`);
    }

    const outputPath = options.output;
    if (outputPath) {
      const fs = await import('fs');
      fs.writeFileSync(outputPath, JSON.stringify(exported, null, 2));
      console.log(chalk.green(`\n✓ Exported to ${outputPath}`));
    } else if (!options.json) {
      console.log('\n' + JSON.stringify(exported, null, 2));
    }

    if (options.json) {
      console.log(JSON.stringify(exported, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Insights export failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind insights timeline - Get activity timeline
 */
export async function insightsTimelineCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const { buildTimeline } = await import('@kontextmind/core');

    const hours = parseInt(String(options.hours || '72'), 10);
    const format = options.format || 'summary';

    const timeline = buildTimeline(projectRoot, hours);

    console.log(chalk.bold(`\n=== Activity Timeline (${hours}h) ===\n`));

    if (timeline.events && timeline.events.length > 0) {
      for (const event of timeline.events.slice(0, 20)) {
        const time = new Date(event.timestamp).toLocaleString();
        const typeColor = event.type === 'task' ? chalk.green :
                         event.type === 'session' ? chalk.cyan :
                         event.type === 'search' ? chalk.yellow : chalk.gray;

        console.log(`${chalk.gray(time)} ${typeColor('●')} ${event.description || event.type}`);
      }
    } else if (timeline.summary) {
      console.log(timeline.summary);
    } else {
      console.log('No activity in this period.');
    }

    if (options.json) {
      console.log('\n' + JSON.stringify(timeline, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Insights timeline failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind insights recent - Get recent activity summary
 */
export async function insightsRecentCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const days = parseInt(String(options.days || '3'), 10);
    const activity = getRecentActivity(projectRoot, days);

    console.log(chalk.bold(`\n=== Recent Activity (${days} days) ===\n`));

    if (activity.filesModified && activity.filesModified.length > 0) {
      console.log(chalk.bold('Recently Modified Files:'));
      for (const file of activity.filesModified.slice(0, 10)) {
        console.log(`  • ${file}`);
      }
      console.log();
    }

    if (activity.sessions && activity.sessions.length > 0) {
      console.log(chalk.bold('Recent Sessions:'));
      for (const session of activity.sessions.slice(0, 5)) {
        console.log(`  • ${session}`);
      }
      console.log();
    }

    if (activity.tasksCompleted && activity.tasksCompleted.length > 0) {
      console.log(chalk.bold('Completed Tasks:'));
      for (const task of activity.tasksCompleted.slice(0, 5)) {
        console.log(`  • ${task}`);
      }
      console.log();
    }

    if (activity.decisions && activity.decisions.length > 0) {
      console.log(chalk.bold('Recent Decisions:'));
      for (const decision of activity.decisions.slice(0, 5)) {
        console.log(`  • ${decision}`);
      }
      console.log();
    }

    if (!activity.filesModified?.length && !activity.sessions?.length && !activity.tasksCompleted?.length) {
      console.log('No recent activity to report.');
    }

    if (options.json) {
      console.log(JSON.stringify(activity, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Insights recent failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind insights continuity - Get continuity suggestions
 */
export async function insightsContinuityCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    // Check if there's work to continue
    const shouldContinue = shouldContinueFromLastSession(projectRoot);

    console.log(chalk.bold('\n=== Continuity Check ===\n'));

    if (shouldContinue.shouldContinue) {
      console.log(chalk.green('✓ Should continue from previous session'));
      console.log(`  Reason: ${shouldContinue.reason}`);
      if (shouldContinue.suggestion) {
        console.log(`  Suggestion: ${chalk.cyan(shouldContinue.suggestion)}`);
      }
    } else {
      console.log(chalk.gray('○ No work to continue from previous session'));
      console.log(`  Reason: ${shouldContinue.reason}`);
    }
    console.log();

    // Get continuity suggestions
    const suggestions = getContinuitySuggestions(projectRoot);

    if (suggestions.length > 0) {
      console.log(chalk.bold('Continuity Suggestions:'));
      for (const suggestion of suggestions) {
        const priorityColor = suggestion.priority === 'high' ? chalk.red :
                             suggestion.priority === 'medium' ? chalk.yellow : chalk.gray;
        console.log(`  ${priorityColor('[' + suggestion.priority.toUpperCase() + ']')} ${suggestion.type}: ${suggestion.description}`);
        if (suggestion.action) {
          console.log(`    Action: ${suggestion.action}`);
        }
      }
    } else {
      console.log(chalk.gray('No continuity suggestions available.'));
    }

    if (options.json) {
      console.log(JSON.stringify({ shouldContinue, suggestions }, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Insights continuity failed:'), error);
    process.exit(1);
  }
}