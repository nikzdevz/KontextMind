import { OptionValues } from 'commander';
import chalk from 'chalk';
import { askQuestion, getKBStatus } from '@kontextmind/core';
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

    // Always use chatbot-readonly mode by default - no code, no file structures
    const mode = options.mode || 'chatbot-readonly';

    // CLI mode - no feedback expected
    const result = await askQuestion(question, {
      mode: mode as 'readonly' | 'chatbot-readonly',
      noCode: true,
      source: 'cli', // CLI doesn't expect feedback
    }, projectRoot);

    if (options.json) {
      console.log(JSON.stringify({
        response_id: result.responseId,
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources.map(s => ({
          type: s.type,
          name: s.name,
          relevance: s.relevanceScore,
        })),
        raw_code_access: result.rawCodeAccess,
        policy_applied: result.policyApplied,
        llm_enhanced: result.llmEnhanced,
        provider: result.provider,
        feedback_supported: result.feedbackSupported,
      }, null, 2));
      return;
    }

    // Format answer for terminal
    console.log();
    console.log(result.answer);
    console.log();

    // Show confidence with emoji indicator
    const conf = result.confidence;
    let confEmoji = '';
    if (conf >= 0.7) confEmoji = chalk.green('●');
    else if (conf >= 0.4) confEmoji = chalk.yellow('●');
    else confEmoji = chalk.gray('●');

    console.log(`${confEmoji} Confidence: ${result.confidence.toFixed(2)}`);

    if (result.llmEnhanced) {
      console.log(chalk.green(`  [Enhanced]`));
    }

    // Only show source types, not file paths (which might leak structure info)
    if (result.sources.length > 0 && mode === 'chatbot-readonly') {
      const sourceTypes = [...new Set(result.sources.map(s => s.type))];
      console.log(chalk.gray(`  Based on: ${sourceTypes.join(', ')}`));
    }

    console.log();
  } catch (error) {
    console.error(chalk.red('Ask failed:'), error);
    process.exit(1);
  }
}