import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getSelfAwareness } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

/**
 * kontextmind agent state - Get current agent state
 */
export async function agentStateCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const awareness = getSelfAwareness(projectRoot);
    const state = awareness.getState();

    console.log(chalk.bold('\n=== Agent State ===\n'));

    console.log(chalk.bold('Current Task:'));
    if (state.currentTask) {
      console.log(`  ${chalk.cyan(state.currentTask.description)}`);
      console.log(`  Type: ${state.currentTask.type}`);
      console.log(`  Progress: ${(state.currentTask.progress * 100).toFixed(0)}%`);
      console.log(`  Complexity: ${state.currentTask.complexity}`);
    } else {
      console.log(`  ${chalk.gray('None')}`);
    }
    console.log();

    console.log(chalk.bold('Mode:'));
    console.log(`  ${chalk.cyan(state.mode || 'idle')}`);
    console.log();

    console.log(chalk.bold('Energy Level:'));
    const energyLevel = state.energyLevel ?? 0;
    const energyPercent = (energyLevel * 100).toFixed(0);
    const energyColor = energyLevel >= 0.7 ? chalk.green :
                       energyLevel >= 0.4 ? chalk.yellow : chalk.red;
    console.log(`  ${energyColor(energyPercent)}% (${energyLevel.toFixed(2)})`);
    console.log();

    console.log(chalk.bold('Goals:'));
    const goals = state.activeGoals || [];
    if (goals.length > 0) {
      for (const goal of goals) {
        console.log(`  • ${goal.description}`);
      }
    } else {
      console.log(`  ${chalk.gray('None')}`);
    }
    console.log();

    console.log(chalk.bold('Blockers:'));
    const blockers = state.blockedBy || [];
    if (blockers.length > 0) {
      for (const blocker of blockers) {
        console.log(`  ⚠ ${chalk.yellow(blocker.reason)}`);
      }
    } else {
      console.log(`  ${chalk.gray('None')}`);
    }
    console.log();

    console.log(chalk.bold('Session Stats:'));
    console.log(`  Started: ${state.sessionStartTime ? new Date(state.sessionStartTime).toLocaleString() : 'N/A'}`);
    console.log(`  Actions: ${state.totalActionsThisSession || 0}`);
    console.log(`  Recent actions: ${(state.recentActions || []).length}`);
  } catch (error) {
    console.error(chalk.red('Agent state failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind agent capabilities - Get agent capability profile
 */
export async function agentCapabilitiesCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const awareness = getSelfAwareness(projectRoot);
    const capabilities = awareness.getCapabilities();

    console.log(chalk.bold('\n=== Agent Capabilities ===\n'));

    console.log(chalk.green('✓ Strengths:'));
    if (capabilities.strengths.length > 0) {
      for (const strength of capabilities.strengths) {
        console.log(`  • ${strength}`);
      }
    } else {
      console.log(`  ${chalk.gray('None recorded yet')}`);
    }
    console.log();

    console.log(chalk.yellow('⚠ Weak Areas:'));
    if (capabilities.weakAreas.length > 0) {
      for (const weak of capabilities.weakAreas) {
        console.log(`  • ${weak}`);
      }
    } else {
      console.log(`  ${chalk.gray('None recorded yet')}`);
    }
    console.log();

    console.log(chalk.bold('Success Rates:'));
    if (Object.keys(capabilities.successRates).length > 0) {
      for (const [taskType, rate] of Object.entries(capabilities.successRates)) {
        const ratePercent = (rate * 100).toFixed(0);
        const color = rate >= 0.7 ? chalk.green :
                     rate >= 0.4 ? chalk.yellow : chalk.red;
        console.log(`  ${taskType}: ${color(ratePercent)}%`);
      }
    } else {
      console.log(`  ${chalk.gray('No data yet')}`);
    }
    console.log();

    console.log(chalk.bold('Preferred Approaches:'));
    if (capabilities.preferredApproaches.length > 0) {
      for (const approach of capabilities.preferredApproaches) {
        console.log(`  • ${approach}`);
      }
    } else {
      console.log(`  ${chalk.gray('None recorded yet')}`);
    }
  } catch (error) {
    console.error(chalk.red('Agent capabilities failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind agent antipatterns - Get anti-patterns to avoid
 */
export async function agentAntipatternsCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const awareness = getSelfAwareness(projectRoot);
    const antiPatterns = awareness.getAntiPatterns();

    console.log(chalk.bold('\n=== Anti-Patterns to Avoid ===\n'));

    if (antiPatterns.length === 0) {
      console.log('No anti-patterns learned yet. Keep working to build patterns!');
      return;
    }

    for (const pattern of antiPatterns) {
      const impactColor = pattern.impact === 'high' ? chalk.red :
                         pattern.impact === 'medium' ? chalk.yellow : chalk.gray;
      console.log(`${chalk.red('✗')} ${chalk.bold(pattern.pattern)}`);
      console.log(`   ${pattern.description}`);
      console.log(`   Impact: ${impactColor(pattern.impact.toUpperCase())}`);
      console.log();
    }
  } catch (error) {
    console.error(chalk.red('Agent antipatterns failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind agent assess - Self-assess current state
 */
export async function agentAssessCommand(taskDescription: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const awareness = getSelfAwareness(projectRoot);

    const recentErrors = options.recentErrors ?
      String(options.recentErrors).split(',').map((e: string) => e.trim()) :
      [];
    const timeSpent = parseInt(String(options.time || '0'), 10);

    const assessment = awareness.assessSelf(taskDescription, recentErrors, timeSpent);

    console.log(chalk.bold('\n=== Self-Assessment ===\n'));

    if (taskDescription) {
      console.log(`Task: ${chalk.cyan(taskDescription)}`);
      console.log();
    }

    console.log(chalk.bold('Self Assessment:'));
    console.log(`  Efficiency: ${chalk.cyan((assessment.selfAssessment.efficiency * 100).toFixed(0))}%`);
    console.log(`  Quality: ${chalk.cyan((assessment.selfAssessment.quality * 100).toFixed(0))}%`);
    console.log();

    if (assessment.selfAssessment.blockers.length > 0) {
      console.log(chalk.bold('Blockers:'));
      for (const blocker of assessment.selfAssessment.blockers) {
        console.log(`  ⚠ ${chalk.yellow(blocker)}`);
      }
      console.log();
    }

    if (assessment.selfAssessment.suggestions.length > 0) {
      console.log(chalk.green('Suggestions:'));
      for (const suggestion of assessment.selfAssessment.suggestions) {
        console.log(`  • ${suggestion}`);
      }
      console.log();
    }

    console.log(chalk.bold('Overall:'));
    console.log(`  Confidence: ${chalk.cyan((assessment.confidence * 100).toFixed(0))}%`);
    if (assessment.estimatedTimeRemaining > 0) {
      const mins = Math.round(assessment.estimatedTimeRemaining / 60000);
      console.log(`  Est. time remaining: ${chalk.cyan(`${mins} min`)}`);
    }
  } catch (error) {
    console.error(chalk.red('Agent assess failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind agent update-state - Update agent state
 */
export async function agentUpdateStateCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const awareness = getSelfAwareness(projectRoot);

    const currentState = awareness.getState();

    if (options.task) {
      currentState.currentTask = options.task;
    }
    if (options.mode) {
      currentState.mode = options.mode as any;
    }
    if (options.energy) {
      currentState.energyLevel = options.energy as any;
    }
    if (options.addGoal) {
      currentState.goals.push(options.addGoal);
    }
    if (options.addBlocker) {
      currentState.blockers.push(options.addBlocker);
    }
    if (options.clearBlockers) {
      currentState.blockers = [];
    }

    awareness.updateState(currentState);

    console.log(chalk.green('✓ Agent state updated'));
  } catch (error) {
    console.error(chalk.red('Agent update-state failed:'), error);
    process.exit(1);
  }
}