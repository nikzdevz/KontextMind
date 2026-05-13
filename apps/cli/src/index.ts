#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { deinitCommand } from './commands/deinit.js';
import { statusCommand } from './commands/status.js';
import { doctorCommand } from './commands/doctor.js';
import { scanCommand } from './commands/scan.js';
import { indexCommand } from './commands/index.js';
import { summarizeCommand } from './commands/summarize.js';
import { kbBuildCommand } from './commands/kb.js';
import { askCommand } from './commands/ask.js';
import { serveCommand } from './commands/serve.js';
import { mcpCommand } from './commands/mcp.js';
import { secretsScanCommand } from './commands/secrets.js';
import { auditCommand } from './commands/audit.js';
import { obsidianExportCommand } from './commands/obsidian.js';
import { placeholderCommand } from './commands/placeholder.js';
import { configCommand } from './commands/config.js';
import {
  sessionCreateCommand,
  sessionListCommand,
  sessionShowCommand,
  sessionDeleteCommand,
  sessionChatCommand,
  sessionStatsCommand,
} from './commands/session.js';
import {
  datasetExportCommand,
  datasetStatsCommand,
  datasetVersionCommand,
  datasetValidateCommand,
} from './commands/dataset.js';

const program = new Command();

program
  .name('kontextmind')
  .description('KontextMind — the shared project brain for AI coding agents')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize KontextMind in the current project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('-f, --force', 'Overwrite existing KontextMind-generated files')
  .option('-r, --reset', 'Delete existing KontextMind data and reinitialize from scratch')
  .option('--agents <list>', 'Comma-separated agent list (claude,codex,cursor,continue,copilot,generic)')
  .option('--mode <mode>', 'Mode: readonly, suggest, edit-with-approval, full-agent')
  .option('--git <mode>', 'Git integration: auto, enabled, disabled')
  .option('--provider <provider>', 'LLM provider: none, openai, anthropic, ollama, bedrock, openai-compatible')
  .action(initCommand);

program
  .command('deinit')
  .description('Remove KontextMind completely from the current project')
  .action(deinitCommand);

program
  .command('status')
  .description('Show KontextMind status for the current project')
  .option('--json', 'Output as JSON')
  .action(statusCommand);

program
  .command('doctor')
  .description('Check KontextMind health and configuration')
  .option('--json', 'Output as JSON')
  .action(doctorCommand);

program
  .command('scan')
  .description('Scan project files and build file index')
  .option('--changed-only', 'Only reindex changed files')
  .option('--include <path>', 'Include specific path')
  .option('--exclude <path>', 'Exclude specific path')
  .option('--json', 'Output as JSON')
  .option('--max-size <size>', 'Max file size (e.g., 2m, 100k, 5000b)')
  .action(scanCommand);

program
  .command('index')
  .description('Index project: extract symbols, dependencies, and build knowledge graph')
  .option('--changed-only', 'Only re-index changed files since last scan')
  .option('--language <languages>', 'Comma-separated list of languages (typescript,javascript,python)', 'typescript,javascript,python')
  .option('--json', 'Output results as JSON')
  .action(indexCommand);

program
  .command('summarize')
  .description('Generate AI summaries for project files')
  .option('--changed-only', 'Only summarize changed/stale files')
  .option('--provider <provider>', 'LLM provider to use')
  .option('--model <model>', 'Model to use for summarization')
  .option('--dry-run', 'Show what would be summarized without writing')
  .option('--mock', 'Use mock provider (no API key required)')
  .option('--max-files <number>', 'Maximum files to summarize per run')
  .option('--json', 'Output results as JSON')
  .action(summarizeCommand);

program
  .command('kb')
  .description('Build chatbot knowledge base')
  .option('--mode <mode>', 'Build mode: chatbot')
  .option('--changed-only', 'Only rebuild changed content')
  .option('--mock', 'Use mock provider')
  .option('--max-questions <number>', 'Maximum questions to generate')
  .option('--json', 'Output results as JSON')
  .action(kbBuildCommand);

program
  .command('ask')
  .description('Ask a question about the project')
  .argument('<question>', 'The question to ask')
  .option('--mode <mode>', 'Response mode: readonly, chatbot-readonly')
  .option('--json', 'Output as JSON')
  .option('--no-code', 'Filter out code from response')
  .action(askCommand);

program
  .command('serve')
  .description('Start HTTP API server')
  .option('--port <port>', 'Port number', '7331')
  .option('--host <host>', 'Host address', '127.0.0.1')
  .option('--mode <mode>', 'Server mode: readonly, chatbot-readonly, suggest, edit-with-approval, full-agent')
  .action(serveCommand);

program
  .command('mcp')
  .description('Start MCP server for AI agent integration')
  .option('--mode <mode>', 'Server mode: readonly, chatbot-readonly, suggest, edit-with-approval')
  .option('--transport <transport>', 'Transport: stdio, http', 'stdio')
  .option('--port <port>', 'Port for HTTP transport', '7332')
  .action(mcpCommand);

program
  .command('secrets')
  .description('Scan for secrets in project files')
  .option('--json', 'Output as JSON')
  .option('--fail-on-critical', 'Exit with error code if critical secrets found')
  .action(secretsScanCommand);

program
  .command('audit')
  .description('Show audit summary and statistics')
  .option('--since <time>', 'Filter events since (e.g., 24h, 7d, 1h)')
  .option('--json', 'Output as JSON')
  .action(auditCommand);

program
  .command('obsidian')
  .description('Export project brain to Obsidian-compatible Markdown notes')
  .option('--output <path>', 'Output directory', '.obsidian-export')
  .option('--clean', 'Remove existing export before exporting')
  .option('--json', 'Output as JSON')
  .action(obsidianExportCommand);

// Session management commands
program
  .command('session')
  .description('Manage chat sessions for multi-turn conversations')
  .addCommand(
    new Command('create')
      .description('Create a new chat session')
      .option('--json', 'Output as JSON')
      .action(sessionCreateCommand)
  )
  .addCommand(
    new Command('list')
      .description('List all sessions for the project')
      .option('--json', 'Output as JSON')
      .action(sessionListCommand)
  )
  .addCommand(
    new Command('show')
      .description('Show session details')
      .argument('<session-id>', 'Session ID to show')
      .option('--json', 'Output as JSON')
      .action((sessionId, options) => sessionShowCommand(sessionId, options))
  )
  .addCommand(
    new Command('delete')
      .description('Delete a session')
      .argument('<session-id>', 'Session ID to delete')
      .action((sessionId) => sessionDeleteCommand(sessionId, {}))
  )
  .addCommand(
    new Command('chat')
      .description('Ask a question in a session')
      .argument('<session-id>', 'Session ID')
      .argument('<question>', 'Question to ask')
      .option('--mode <mode>', 'Response mode: readonly, chatbot-readonly')
      .option('--json', 'Output as JSON')
      .action((sessionId, question, options) => sessionChatCommand(sessionId, question, options))
  )
  .addCommand(
    new Command('stats')
      .description('Show session statistics')
      .argument('<session-id>', 'Session ID')
      .option('--json', 'Output as JSON')
      .action((sessionId, options) => sessionStatsCommand(sessionId, options))
  );

// Dataset management commands
program
  .command('dataset')
  .description('Dataset preparation and export')
  .addCommand(
    new Command('export')
      .description('Export training dataset')
      .option('--format <format>', 'Output format: jsonl, json, chatml, sharegpt', 'jsonl')
      .option('--output <path>', 'Output file path')
      .option('--min-confidence <n>', 'Minimum confidence threshold', '0.5')
      .option('--include-code', 'Include code request responses')
      .option('--api-only', 'Only include API-sourced data')
      .option('--json', 'Output as JSON')
      .action(datasetExportCommand)
  )
  .addCommand(
    new Command('stats')
      .description('Show dataset statistics')
      .option('--version <ver>', 'Show stats for specific version')
      .option('--json', 'Output as JSON')
      .action(datasetStatsCommand)
  )
  .addCommand(
    new Command('validate')
      .description('Validate dataset quality')
      .option('--strict', 'Fail on validation errors')
      .option('--min-quality <n>', 'Minimum quality score', '0.6')
      .option('--json', 'Output as JSON')
      .action(datasetValidateCommand)
  )
  .addCommand(
    new Command('version')
      .description('Manage dataset versions')
      .argument('<action>', 'Action: list, export')
      .option('--version <ver>', 'Version for export')
      .option('--format <format>', 'Export format: jsonl, json, chatml, sharegpt', 'jsonl')
      .option('--output <path>', 'Output file path')
      .option('--json', 'Output as JSON')
      .action((action, options) => datasetVersionCommand(action, options))
  );

// Placeholder for future commands
const futureCommands = ['handoff'];
for (const cmd of futureCommands) {
  program
    .command(cmd)
    .action(() => placeholderCommand(cmd));
}

program
  .command('config')
  .description('Manage KontextMind configuration and providers')
  .option('--action <action>', 'Action: show, add, remove, list, test, set-api-key')
  .option('--name <name>', 'Provider name')
  .option('--type <type>', 'Provider type (e.g., openai-compatible)')
  .option('--baseUrl <url>', 'API base URL')
  .option('--apiKey <key>', 'API key')
  .option('--model <model>', 'Model name')
  .option('--provider <name>', 'Set default provider')
  .option('--prompt <text>', 'Test prompt')
  .option('--global', 'Use global configuration')
  .action(configCommand);

program.parse();