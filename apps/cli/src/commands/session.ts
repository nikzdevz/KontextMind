// Session CLI Commands
import { OptionValues } from 'commander';
import chalk from 'chalk';
import { getSessionManager } from '@kontextmind/core';
import { detectProject } from '@kontextmind/core';

export async function sessionCreateCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      console.log(`Run: ${chalk.cyan('kontextmind init')}`);
      process.exit(1);
    }

    const manager = getSessionManager(projectRoot);
    const session = await manager.createSession(project.name);

    console.log(chalk.green('Session created successfully!'));
    console.log(`Session ID: ${chalk.cyan(session.id)}`);
    console.log(`Project: ${session.projectName}`);
    console.log(`Created at: ${session.createdAt}`);

    if (options.json) {
      console.log(JSON.stringify({
        id: session.id,
        projectName: session.projectName,
        createdAt: session.createdAt,
      }, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Failed to create session:'), error);
    process.exit(1);
  }
}

export async function sessionListCommand(options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    const manager = getSessionManager(projectRoot);
    const sessions = await manager.listSessions(project.name);

    if (sessions.length === 0) {
      console.log(chalk.yellow('No sessions found.'));
      return;
    }

    console.log(chalk.bold(`Sessions (${sessions.length}):\n`));

    for (const session of sessions) {
      console.log(`${chalk.cyan(session.id)}`);
      console.log(`  Project: ${session.projectName}`);
      console.log(`  Messages: ${session.messageCount}`);
      console.log(`  Topics: ${session.topics.join(', ') || 'none'}`);
      console.log(`  Last activity: ${new Date(session.lastActivityAt).toLocaleString()}`);
      console.log(`  Preview: ${session.preview}`);
      console.log();
    }

    if (options.json) {
      console.log(JSON.stringify({ sessions }, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Failed to list sessions:'), error);
    process.exit(1);
  }
}

export async function sessionShowCommand(sessionId: string, options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    const manager = getSessionManager(projectRoot);
    const session = await manager.getSession(sessionId);

    if (!session) {
      console.log(chalk.red(`Session not found: ${sessionId}`));
      process.exit(1);
    }

    console.log(chalk.bold(`Session: ${session.id}\n`));
    console.log(`Project: ${session.projectName}`);
    console.log(`Created: ${session.createdAt}`);
    console.log(`Updated: ${session.updatedAt}`);
    console.log(`Messages: ${session.messages.length}`);
    console.log(`Topics: ${session.context.topics.join(', ') || 'none'}`);
    console.log();

    // Show messages
    console.log(chalk.bold('Messages:'));
    for (const msg of session.messages) {
      const roleColor = msg.role === 'user' ? chalk.green : msg.role === 'assistant' ? chalk.blue : chalk.gray;
      console.log(`\n${roleColor(`[${msg.role.toUpperCase()}]`)} ${new Date(msg.timestamp).toLocaleString()}`);
      console.log(msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : ''));
    }

    if (options.json) {
      console.log(JSON.stringify(session, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Failed to show session:'), error);
    process.exit(1);
  }
}

export async function sessionDeleteCommand(sessionId: string, options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    const manager = getSessionManager(projectRoot);
    const deleted = await manager.deleteSession(sessionId);

    if (deleted) {
      console.log(chalk.green(`Session deleted: ${sessionId}`));
    } else {
      console.log(chalk.red(`Session not found: ${sessionId}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Failed to delete session:'), error);
    process.exit(1);
  }
}

export async function sessionChatCommand(sessionId: string, question: string, options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    const { sessionService } = await import('@kontextmind/server');

    const result = await sessionService.askWithSession(
      project.name,
      question,
      sessionId,
      options.mode || 'chatbot-readonly'
    );

    console.log();
    console.log(result.answer);
    console.log();

    const conf = result.confidence;
    let confEmoji = '';
    if (conf >= 0.7) confEmoji = chalk.green('●');
    else if (conf >= 0.4) confEmoji = chalk.yellow('●');
    else confEmoji = chalk.gray('●');

    console.log(`${confEmoji} Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`Turn: ${result.conversationTurn}`);
    console.log(`Session: ${result.sessionId}`);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Session chat failed:'), error);
    process.exit(1);
  }
}

export async function sessionStatsCommand(sessionId: string, options: OptionValues): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const project = detectProject(projectRoot);

    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      process.exit(1);
    }

    const manager = getSessionManager(projectRoot);
    const session = await manager.getSession(sessionId);

    if (!session) {
      console.log(chalk.red(`Session not found: ${sessionId}`));
      process.exit(1);
    }

    console.log(chalk.bold(`Session Statistics: ${sessionId}\n`));
    console.log(`Total messages: ${session.metadata.messageCount}`);
    console.log(`User messages: ${session.metadata.userMessageCount}`);
    console.log(`Assistant messages: ${session.metadata.assistantMessageCount}`);
    console.log(`Total tokens: ${session.metadata.totalTokens}`);
    console.log(`Average confidence: ${session.metadata.averageConfidence.toFixed(2)}`);
    console.log(`Sources used: ${session.metadata.sourcesUsed.join(', ') || 'none'}`);
    console.log(`Started: ${session.metadata.startedAt}`);
    console.log(`Last activity: ${session.metadata.lastActivityAt}`);

    if (options.json) {
      console.log(JSON.stringify(session.metadata, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Failed to get session stats:'), error);
    process.exit(1);
  }
}