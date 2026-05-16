import { OptionValues } from 'commander';
import chalk from 'chalk';
import { detectProject } from '@kontextmind/core';
import { createHandoffDocument } from '@kontextmind/core';

/**
 * kontextmind handoff - Create a handoff document
 */
export async function handoffCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const summary = options.summary || '';
    const nextSteps = options.nextSteps || '';
    const outputPath = options.output;

    const handoff = await createHandoffDocument(projectRoot, {
      summary,
      nextSteps,
    });

    if (options.json) {
      console.log(JSON.stringify(handoff, null, 2));
      return;
    }

    console.log(chalk.bold('\n=== Handoff Document ===\n'));
    console.log(`Created: ${new Date(handoff.createdAt).toLocaleString()}`);
    console.log(`Session: ${chalk.cyan(handoff.sessionId)}`);
    console.log();

    if (handoff.summary) {
      console.log(chalk.bold('Summary:'));
      console.log(`  ${handoff.summary}`);
      console.log();
    }

    if (handoff.currentTask) {
      console.log(chalk.bold('Current Task:'));
      console.log(`  ${handoff.currentTask}`);
      console.log();
    }

    if (handoff.completedWork && handoff.completedWork.length > 0) {
      console.log(chalk.bold('Completed:'));
      for (const work of handoff.completedWork) {
        console.log(`  ✓ ${work}`);
      }
      console.log();
    }

    if (handoff.pendingWork && handoff.pendingWork.length > 0) {
      console.log(chalk.bold('Pending:'));
      for (const work of handoff.pendingWork) {
        console.log(`  ○ ${work}`);
      }
      console.log();
    }

    if (handoff.keyDecisions && handoff.keyDecisions.length > 0) {
      console.log(chalk.bold('Key Decisions:'));
      for (const decision of handoff.keyDecisions) {
        console.log(`  • ${decision}`);
      }
      console.log();
    }

    if (handoff.nextSteps) {
      console.log(chalk.bold('Next Steps:'));
      console.log(`  ${handoff.nextSteps}`);
      console.log();
    }

    if (handoff.recentFiles && handoff.recentFiles.length > 0) {
      console.log(chalk.bold('Recent Files:'));
      for (const file of handoff.recentFiles.slice(0, 10)) {
        console.log(`  • ${file}`);
      }
      console.log();
    }

    if (outputPath) {
      const fs = await import('fs');
      fs.writeFileSync(outputPath, JSON.stringify(handoff, null, 2));
      console.log(chalk.green(`✓ Handoff saved to ${outputPath}`));
    }
  } catch (error) {
    console.error(chalk.red('Handoff failed:'), error);
    process.exit(1);
  }
}