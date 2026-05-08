import { OptionValues } from 'commander';
import chalk from 'chalk';
import { askQuestion, getKBStatus, getLastAskTime } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

export async function askCommand(question: string, options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      console.log(`Run: ${chalk.cyan('kontextmind init')}`);
      process.exit(1);
    }

    // Check KB exists
    const kbStatus = getKBStatus(projectRoot);
    if (!kbStatus.ready) {
      console.log(chalk.yellow('Knowledge base not ready. Run: kontextmind kb build'));
      console.log(`Run: ${chalk.cyan('kontextmind kb build --mock')}`);
      process.exit(1);
    }

    const mode = options.mode || 'chatbot-readonly';

    const result = await askQuestion(question, {
      mode: mode as 'readonly' | 'chatbot-readonly',
      json: Boolean(options.json),
      noCode: Boolean(options.noCode),
    }, projectRoot);

    if (options.json) {
      console.log(JSON.stringify({
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources.map(s => ({
          type: s.type,
          name: s.name,
          relevance: s.relevanceScore,
        })),
        raw_code_access: result.rawCodeAccess,
        policy_applied: result.policyApplied,
      }, null, 2));
      return;
    }

    // Format answer for terminal
    console.log(chalk.bold('Answer:'));
    console.log(result.answer);
    console.log();
    console.log(chalk.bold('Confidence:') + ` ${result.confidence.toFixed(2)}`);
    console.log();

    if (result.sources.length > 0) {
      console.log(chalk.bold('Based on:'));
      for (const source of result.sources.slice(0, 5)) {
        const typeLabel = `[${source.type}]`;
        const nameLabel = source.name || 'unknown';
        console.log(`  ${chalk.cyan(typeLabel)} ${nameLabel}`);
      }
    }

    if (result.rawCodeAccess) {
      console.log();
      console.log(chalk.yellow('[Note: Raw code access enabled]'));
    }

    console.log();
  } catch (error) {
    console.error(chalk.red('Ask failed:'), error);
    process.exit(1);
  }
}