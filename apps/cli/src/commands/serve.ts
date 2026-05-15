import { OptionValues } from 'commander';
import chalk from 'chalk';
import { startApiServer, stopApiServer, getApiServerStatus, type ApiServerConfig } from '@kontextmind/server';
import { detectProject } from '@kontextmind/core';

let serverRunning = false;

export async function serveCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.log(chalk.red('KontextMind is not initialized in this directory.'));
    console.log(`Run: ${chalk.cyan('kontextmind init')}`);
    process.exit(1);
  }

  const port = parseInt(String(options.port || '7331'), 10);
  const host = String(options.host || '127.0.0.1');
  const mode = (options.mode as ApiServerConfig['mode']) || 'readonly';

  console.log(chalk.bold('KontextMind API Server'));
  console.log(`Starting server at http://${host}:${port}\n`);
  console.log(`Mode: ${mode}`);
  console.log(`Project: ${project.name}\n`);

  console.log('Endpoints:');
  console.log(`  GET  /health        - Health check`);
  console.log(`  GET  /status        - Project status`);
  console.log(`  POST /ask           - Ask a question`);
  console.log(`  GET  /graph         - Knowledge graph`);
  console.log(`  GET  /file-summary  - Get file summary`);
  console.log(`  GET  /symbol        - Get symbol info`);
  console.log(`  POST /kb/build      - Build knowledge base`);
  console.log(`  GET  /audit         - Audit information`);
  console.log('');

  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down server...'));
    await stopApiServer();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\nShutting down server...'));
    await stopApiServer();
    process.exit(0);
  });

  try {
    const config: ApiServerConfig = {
      host,
      port,
      mode,
    };

    await startApiServer(config);
    serverRunning = true;

    const status = getApiServerStatus();
    console.log(chalk.green(`Server running at http://${status?.host}:${status?.port}`));
    console.log(chalk.gray('Press Ctrl+C to stop'));
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}