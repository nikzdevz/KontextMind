import { OptionValues } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { detectProject } from '@kontextmind/core';
import { searchMemory, searchEntities, searchSessions } from '@kontextmind/core';

/**
 * kontextmind search - Search files, symbols, or content
 */
export async function searchCommand(query: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  if (!query) {
    console.log(chalk.red('Query is required'));
    console.log('Use: kontextmind search <query> [--type file|symbol|content]');
    process.exit(1);
  }

  try {
    const type = options.type || 'all';
    const limit = parseInt(String(options.limit || '20'), 10);

    console.log(chalk.bold(`\n=== Search: "${query}" ===\n`));

    // Search memory/sessions/tasks
    if (type === 'all' || type === 'content') {
      const memoryResults = searchMemory(projectRoot, query, { limit });
      if (memoryResults.length > 0) {
        console.log(chalk.bold('Memory Results:'));
        for (const result of memoryResults.slice(0, 10)) {
          const typeColor = result.type === 'task' ? chalk.green :
                           result.type === 'session' ? chalk.cyan :
                           result.type === 'handoff' ? chalk.yellow : chalk.gray;
          console.log(`  ${typeColor('●')} [${result.type.toUpperCase()}] ${chalk.bold(result.title)}`);
          if (result.summary) {
            console.log(`    ${chalk.gray(result.summary.substring(0, 80))}...`);
          }
        }
        console.log();
      }
    }

    // Search entities
    if (type === 'all' || type === 'file' || type === 'symbol') {
      const entityResults = searchEntities(projectRoot, query, undefined, limit);
      if (entityResults.length > 0) {
        console.log(chalk.bold('Entities:'));
        for (const result of entityResults.slice(0, 10)) {
          const typeColor = result.type === 'file' ? chalk.cyan :
                           result.type === 'function' ? chalk.green :
                           result.type === 'component' ? chalk.yellow : chalk.gray;
          console.log(`  ${typeColor('●')} [${result.type}] ${chalk.bold(result.name)}`);
          if (result.file) {
            console.log(`    File: ${chalk.gray(result.file)}`);
          }
        }
        console.log();
      }
    }

    if (options.json) {
      const memoryResults = searchMemory(projectRoot, query, { limit });
      const entityResults = searchEntities(projectRoot, query, undefined, limit);
      console.log(JSON.stringify({ memory: memoryResults, entities: entityResults }, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Search failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind search memory - Search sessions, tasks, handoffs
 */
export async function searchMemoryCommand(query: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  if (!query) {
    console.log(chalk.red('Query is required'));
    console.log('Use: kontextmind search memory <query> [--types task,session,handoff]');
    process.exit(1);
  }

  try {
    const types = options.types ?
      String(options.types).split(',').map((t: string) => t.trim()) :
      ['task', 'session', 'handoff'];
    const days = parseInt(String(options.days || '30'), 10);
    const limit = parseInt(String(options.limit || '20'), 10);

    console.log(chalk.bold(`\n=== Memory Search: "${query}" ===\n`));

    const results = searchMemory(projectRoot, query, { types, days, limit });

    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    for (const result of results) {
      const typeColor = result.type === 'task' ? chalk.green :
                       result.type === 'session' ? chalk.cyan :
                       result.type === 'handoff' ? chalk.yellow : chalk.gray;

      console.log(`${typeColor('●')} [${result.type.toUpperCase()}] ${chalk.bold(result.title)}`);
      if (result.summary) {
        console.log(`  ${result.summary.substring(0, 100)}...`);
      }
      if (result.date) {
        console.log(`  ${chalk.gray(new Date(result.date).toLocaleString())}`);
      }
      console.log();
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Search memory failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind search entities - Search files, functions, components
 */
export async function searchEntitiesCommand(entity: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  if (!entity) {
    console.log(chalk.red('Entity name is required'));
    console.log('Use: kontextmind search entities <name> [--type file,function,component]');
    process.exit(1);
  }

  try {
    const type = options.type;
    const limit = parseInt(String(options.limit || '20'), 10);

    console.log(chalk.bold(`\n=== Entity Search: "${entity}" ===\n`));

    const results = searchEntities(projectRoot, entity, type as any, limit);

    if (results.length === 0) {
      console.log('No entities found.');
      return;
    }

    for (const result of results) {
      const typeColor = result.type === 'file' ? chalk.cyan :
                       result.type === 'function' ? chalk.green :
                       result.type === 'component' ? chalk.yellow : chalk.gray;

      console.log(`${typeColor('●')} [${result.type}] ${chalk.bold(result.name)}`);
      if (result.file) {
        console.log(`  File: ${chalk.gray(result.file)}`);
      }
      if (result.line) {
        console.log(`  Line: ${chalk.gray(result.line)}`);
      }
      if (result.summary) {
        console.log(`  ${result.summary.substring(0, 100)}...`);
      }
      console.log();
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Search entities failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind search sessions - Search historical sessions
 */
export async function searchSessionsCommand(query: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  if (!query) {
    console.log(chalk.red('Query is required'));
    console.log('Use: kontextmind search sessions <query> [--limit 10]');
    process.exit(1);
  }

  try {
    const limit = parseInt(String(options.limit || '10'), 10);

    console.log(chalk.bold(`\n=== Session Search: "${query}" ===\n`));

    const results = searchSessions(projectRoot, query, limit);

    if (results.length === 0) {
      console.log('No sessions found.');
      return;
    }

    for (const session of results) {
      console.log(`${chalk.cyan('●')} Session: ${chalk.bold(session.sessionId)}`);
      console.log(`  Date: ${new Date(session.date).toLocaleString()}`);
      if (session.topics && session.topics.length > 0) {
        console.log(`  Topics: ${session.topics.join(', ')}`);
      }
      if (session.summary) {
        console.log(`  Summary: ${session.summary.substring(0, 100)}...`);
      }
      if (session.messageCount) {
        console.log(`  Messages: ${session.messageCount}`);
      }
      console.log();
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (error) {
    console.error(chalk.red('Search sessions failed:'), error);
    process.exit(1);
  }
}

/**
 * kontextmind search file - Get file content
 */
export async function searchFileCommand(filename: string | undefined, options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    process.exit(1);
  }

  if (!filename) {
    console.log(chalk.red('Filename is required'));
    console.log('Use: kontextmind search file  [--lines 50]');
    process.exit(1);
  }

  try {
    const lines = parseInt(String(options.lines || '100'), 10);

    // Find the file in the project
    const filePath = join(projectRoot, filename);

    if (!existsSync(filePath)) {
      console.log(chalk.red(`File not found: ${filename}`));
      console.log(`Looked in: ${filePath}`);
      process.exit(1);
    }

    const content = readFileSync(filePath, 'utf-8');
    const linesToShow = content.split('\n').slice(0, lines).join('\n');

    console.log(chalk.bold(`\n=== ${filename} ===\n`));
    console.log(linesToShow);

    if (content.split('\n').length > lines) {
      console.log(chalk.gray(`\n... (${content.split('\n').length - lines} more lines)`));
    }
  } catch (error) {
    console.error(chalk.red('Search file failed:'), error);
    process.exit(1);
  }
}