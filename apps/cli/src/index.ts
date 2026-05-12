#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
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
  .option('--agents <list>', 'Comma-separated agent list (claude,codex,cursor,continue,copilot,generic)')
  .option('--mode <mode>', 'Mode: readonly, suggest, edit-with-approval, full-agent')
  .option('--git <mode>', 'Git integration: auto, enabled, disabled')
  .option('--provider <provider>', 'LLM provider: none, openai, anthropic, ollama, bedrock, openai-compatible')
  .action(initCommand);

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

// Placeholder for future commands
const futureCommands = ['handoff', 'chat'];
for (const cmd of futureCommands) {
  program
    .command(cmd)
    .action(() => placeholderCommand(cmd));
}

program.parse();