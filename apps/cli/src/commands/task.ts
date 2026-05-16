import { OptionValues } from 'commander';
import chalk from 'chalk';
import { detectProject } from '@kontextmind/core';
import {
  loadTaskIndex,
  getAllTasks,
  getCurrentTask,
  searchTasks,
  detectTask,
  autoCompleteTask,
  updateTaskPending,
} from '@kontextmind/core';

/**
 * kontextmind task detect - Detect current task boundaries
 */
export async function taskDetectCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const task = await detectTask(projectRoot);

    console.log(chalk.bold('\n=== Detected Task ===\n'));

    if (!task) {
      console.log('No task detected. Use "kontextmind task create" to create a task manually.');
      return;
    }

    console.log(`ID: ${chalk.cyan(task.taskId)}`);
    console.log(`Title: ${chalk.bold(task.title || 'Untitled')}`);
    console.log();
    console.log(chalk.bold('Goal:'));
    console.log(`  ${task.goal}`);
    console.log();

    if (task.progress) {
      console.log(chalk.bold('Progress:'));
      console.log(`  ${task.progress}`);
      console.log();
    }

    if (task.pending && task.pending.length > 0) {
      console.log(chalk.bold('Pending:'));
      for (const p of task.pending) {
        console.log(`  • ${p}`);
      }
      console.log();
    }

    if (task.filesTouched && task.filesTouched.length > 0) {
      console.log(chalk.bold('Files Modified:'));
      for (const file of task.filesTouched.slice(0, 5)) {
        console.log(`  • ${file}`);
      }
      if (task.filesTouched.length > 5) {
        console.log(`  ${chalk.gray(`... and ${task.filesTouched.length - 5} more`)}`);
      }
      console.log();
    }
  } catch (error) {
    console.error(chalk.red('Task detect failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind task complete - Mark task as complete
 */
export async function taskCompleteCommand(taskId: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    // If no taskId provided, try to get current task
    if (!taskId) {
      const currentTask = getCurrentTask(projectRoot);
      if (currentTask) {
        taskId = currentTask.id;
      } else {
        console.log(chalk.red('No task ID provided and no current task found.'));
        console.log('Use: kontextmind task complete <task-id>');
        process.exit(1);
      }
    }

    await autoCompleteTask(projectRoot, taskId);

    console.log(chalk.green(`✓ Task ${taskId} marked as complete`));
    console.log(`  Completed at: ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error(chalk.red('Task complete failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind task update - Update pending work for a task
 */
export async function taskUpdateCommand(taskId: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    // If no taskId provided, try to get current task
    if (!taskId) {
      const currentTask = getCurrentTask(projectRoot);
      if (currentTask) {
        taskId = currentTask.id;
      } else {
        console.log(chalk.red('No task ID provided and no current task found.'));
        console.log('Use: kontextmind task update <task-id> --pending "work to do"');
        process.exit(1);
      }
    }

    if (!options.pending) {
      console.log(chalk.red('--pending is required'));
      console.log('Use: kontextmind task update <task-id> --pending "work to do"');
      process.exit(1);
    }

    await updateTaskPending(projectRoot, taskId, options.pending);

    console.log(chalk.green(`✓ Task ${taskId} updated`));
    console.log(`  Pending work: ${options.pending}`);
  } catch (error) {
    console.error(chalk.red('Task update failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind task list - List all tasks
 */
export async function taskListCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const limit = parseInt(String(options.limit || '20'), 10);
    const status = options.status;

    let tasks = getAllTasks(projectRoot);

    // Filter by status
    if (status === 'active') {
      tasks = tasks.filter(t => t.status === 'in_progress');
    } else if (status === 'completed') {
      tasks = tasks.filter(t => t.status === 'completed');
    } else if (status === 'detected') {
      tasks = tasks.filter(t => t.status === 'detected');
    }

    // Sort by startDate (most recent first)
    tasks.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const tasksToShow = tasks.slice(0, limit);

    console.log(chalk.bold('\n=== Tasks ===\n'));

    if (tasksToShow.length === 0) {
      console.log('No tasks found.');
      return;
    }

    for (const task of tasksToShow) {
      const statusColor = task.status === 'in_progress' ? chalk.green :
                         task.status === 'completed' ? chalk.cyan :
                         task.status === 'detected' ? chalk.yellow : chalk.gray;

      console.log(`${statusColor('●')} ${chalk.bold(task.title || task.id)}`);
      console.log(`  ID: ${chalk.gray(task.id)}`);
      console.log(`  Status: ${statusColor(task.status)}`);

      if (task.goal) {
        console.log(`  Goal: ${task.goal.substring(0, 60)}${task.goal.length > 60 ? '...' : ''}`);
      }

      if (task.pending) {
        console.log(`  Pending: ${task.pending.substring(0, 50)}...`);
      }

      console.log(`  Started: ${new Date(task.startDate).toLocaleString()}`);
      console.log();
    }

    if (tasks.length > limit) {
      console.log(chalk.gray(`... showing ${limit} of ${tasks.length} tasks`));
    }
  } catch (error) {
    console.error(chalk.red('Task list failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind task show - Show task details
 */
export async function taskShowCommand(taskId: string | undefined): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    if (!taskId) {
      // Show current task
      const currentTask = getCurrentTask(projectRoot);
      if (currentTask) {
        taskId = currentTask.id;
      } else {
        console.log('No current task and no task ID provided.');
        console.log('Use: kontextmind task show <task-id>');
        process.exit(1);
      }
    }

    const tasks = getAllTasks(projectRoot);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      process.exit(1);
    }

    const statusColor = task.status === 'in_progress' ? chalk.green :
                       task.status === 'completed' ? chalk.cyan :
                       task.status === 'detected' ? chalk.yellow : chalk.gray;

    console.log(chalk.bold('\n=== Task Details ===\n'));

    console.log(`ID: ${chalk.cyan(task.id)}`);
    console.log(`Title: ${chalk.bold(task.title || 'N/A')}`);
    console.log(`Status: ${statusColor(task.status)}`);
    console.log();

    if (task.goal) {
      console.log(chalk.bold('Goal:'));
      console.log(`  ${task.goal}`);
      console.log();
    }

    if (task.progress) {
      console.log(chalk.bold('Progress:'));
      console.log(`  ${task.progress}`);
      console.log();
    }

    if (task.pending) {
      console.log(chalk.bold('Pending Work:'));
      console.log(`  ${task.pending}`);
      console.log();
    }

    if (task.filesTouched && task.filesTouched.length > 0) {
      console.log(chalk.bold('Files Touched:'));
      for (const file of task.filesTouched) {
        console.log(`  • ${file}`);
      }
      console.log();
    }

    if (task.dependsOn && task.dependsOn.length > 0) {
      console.log(chalk.bold('Depends On:'));
      for (const dep of task.dependsOn) {
        console.log(`  • ${dep}`);
      }
      console.log();
    }

    console.log(`Started: ${new Date(task.startDate).toLocaleString()}`);
    if (task.endDate) {
      console.log(`Ended: ${new Date(task.endDate).toLocaleString()}`);
    }
  } catch (error) {
    console.error(chalk.red('Task show failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind task create - Create a new task
 */
export async function taskCreateCommand(title: string, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  try {
    const task = await createOrUpdateTask(projectRoot, {
      title,
      goal: options.goal,
      status: 'in_progress',
    });

    console.log(chalk.green('\n✓ Task created'));
    console.log(`  ID: ${chalk.cyan(task.id)}`);
    console.log(`  Title: ${chalk.bold(title)}`);
  } catch (error) {
    console.error(chalk.red('Task create failed:'), error);
    process.exit(1);
  }
}

async function createOrUpdateTask(
  projectRoot: string,
  task: { title: string; goal?: string; status: string }
): Promise<{ id: string }> {
  const index = loadTaskIndex(projectRoot);
  const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const newTask = {
    id,
    title: task.title,
    goal: task.goal || '',
    status: task.status as 'detected' | 'in_progress' | 'completed' | 'cancelled',
    startDate: new Date().toISOString(),
    sessionIds: [],
    filesTouched: [],
    decisions: [],
    pending: '',
    nextSteps: [],
    linkedTaskIds: [],
    dependsOn: [],
    confidence: 1.0,
  };

  index.tasks.push(newTask);

  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join(projectRoot, '.kontextmind');
  const file = path.join(dir, 'task-index.json');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(file, JSON.stringify(index, null, 2));

  return { id };
}