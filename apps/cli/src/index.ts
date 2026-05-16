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
import { daemonCommand } from './commands/daemon.js';
import { setupCommand } from './commands/setup.js';
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
  datasetExportSummariesCommand,
  datasetStatsSummariesCommand,
} from './commands/dataset.js';
import {
  learnSyncCommand,
  learnStatsCommand,
  learnPatternsCommand,
  learnSuggestionsCommand,
  learnImportCommand,
  learnExportCommand,
} from './commands/learn.js';
import {
  agentStateCommand,
  agentCapabilitiesCommand,
  agentAntipatternsCommand,
  agentAssessCommand,
  agentUpdateStateCommand,
} from './commands/agent.js';
import {
  taskDetectCommand,
  taskCompleteCommand,
  taskUpdateCommand,
  taskListCommand,
  taskShowCommand,
  taskCreateCommand,
} from './commands/task.js';
import {
  analyticsStatsCommand,
  analyticsTopQuestionsCommand,
  analyticsQualityCommand,
  analyticsIntentDistributionCommand,
} from './commands/analytics.js';
import {
  qualityTrendsCommand,
  qualityReportCommand,
  qualityPerformanceCommand,
  qualityScoreCommand,
} from './commands/quality.js';
import {
  insightsSessionCommand,
  insightsContextCommand,
  insightsExportCommand,
  insightsTimelineCommand,
  insightsRecentCommand,
  insightsContinuityCommand,
} from './commands/insights.js';
import {
  searchCommand,
  searchMemoryCommand,
  searchEntitiesCommand,
  searchSessionsCommand,
  searchFileCommand,
} from './commands/search.js';

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
  .option('--agents <list>', 'Comma-separated agent list (claude,codex,roo,cursor,antigravity,continue,copilot,generic)')
  .option('--mode <mode>', 'Mode: readonly, suggest, edit-with-approval, full-agent')
  .option('--git <mode>', 'Git integration: auto, enabled, disabled')
  .option('--provider <provider>', 'LLM provider: none, openai, anthropic, ollama, bedrock, openai-compatible')
  .action(initCommand);

program
  .command('setup')
  .description('Interactive setup wizard for KontextMind')
  .option('--provider <provider>', 'LLM provider (openai/anthropic/openrouter/custom/opusmax/ollama)')
  .option('--api-key <key>', 'API key for the provider')
  .option('--mode <mode>', 'KontextMind mode (readonly/chatbot-readonly/suggest/edit-with-approval/full-agent)')
  .option('--auto-sync', 'Enable automatic sync', true)
  .option('--no-auto-sync', 'Disable automatic sync')
  .option('--configure-mcp', 'Configure MCP server', true)
  .option('--no-configure-mcp', 'Skip MCP configuration')
  .option('--run-scan', 'Run initial scan', true)
  .option('--no-run-scan', 'Skip initial scan')
  .option('--skip-summarize', 'Skip summary generation')
  .action(setupCommand);

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
  .option('--mode <mode>', 'Server mode: readonly, chatbot-readonly, suggest, edit-with-approval, full-agent')
  .option('--transport <transport>', 'Transport: stdio, http', 'stdio')
  .option('--port <port>', 'Port for HTTP transport', '7332')
  .action(mcpCommand);

program
  .command('daemon')
  .description('Start KontextMind as a background daemon')
  .option('--port <port>', 'MCP server port', '7332')
  .option('--api-port <port>', 'API server port', '7331')
  .option('--autostart', 'Register with system autostart')
  .option('--remove-autostart', 'Remove from system autostart')
  .action(daemonCommand);

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
  )
  .addCommand(
    new Command('export-summaries')
      .description('Export code summaries as training data')
      .option('--format <format>', 'Output format: jsonl, json, sharegpt', 'jsonl')
      .option('--output <path>', 'Output file path')
      .option('--min-confidence <n>', 'Minimum confidence threshold', '0.3')
      .option('--types <types>', 'Comma-separated types: file,function,module,api,decision')
      .option('--json', 'Output as JSON')
      .action((options) => datasetExportSummariesCommand(options))
  )
  .addCommand(
    new Command('stats-summaries')
      .description('Show summary dataset statistics')
      .option('--json', 'Output as JSON')
      .action((options) => datasetStatsSummariesCommand(options))
  );

// ====== NEW CLI COMMANDS (Phase 11) ======

// Learn subcommands
program
  .command('learn')
  .description('Learning and adaptation tools')
  .addCommand(
    new Command('sync')
      .description('Trigger manual learning sync')
      .action(learnSyncCommand)
  )
  .addCommand(
    new Command('stats')
      .description('Get learning statistics')
      .action(learnStatsCommand)
  )
  .addCommand(
    new Command('patterns')
      .description('Get success/failure patterns')
      .argument('[taskType]', 'Filter by task type (e.g., code_write, debug)')
      .option('--json', 'Output as JSON')
      .action((taskType, options) => learnPatternsCommand(taskType, options))
  )
  .addCommand(
    new Command('suggestions')
      .description('Get improvement suggestions')
      .option('--limit <n>', 'Maximum suggestions', '10')
      .option('--category <cat>', 'Filter by category')
      .option('--json', 'Output as JSON')
      .action((options) => learnSuggestionsCommand(options))
  )
  .addCommand(
    new Command('import')
      .description('Import learning from another project')
      .argument('<sourceProject>', 'Source project path')
      .option('--data-types <types>', 'Data types to import')
      .action((sourceProject, options) => learnImportCommand(sourceProject, options))
  )
  .addCommand(
    new Command('export')
      .description('Export learning data for training')
      .option('--task-type <type>', 'Filter by task type')
      .option('--min-confidence <n>', 'Minimum confidence', '0.5')
      .option('--output <path>', 'Output file path')
      .option('--json', 'Output as JSON')
      .action((options) => learnExportCommand(options))
  );

// Agent subcommands
program
  .command('agent')
  .description('Agent self-awareness tools')
  .addCommand(
    new Command('state')
      .description('Get current agent state')
      .action(agentStateCommand)
  )
  .addCommand(
    new Command('capabilities')
      .description('Get agent capability profile')
      .action(agentCapabilitiesCommand)
  )
  .addCommand(
    new Command('antipatterns')
      .description('Get anti-patterns to avoid')
      .action(agentAntipatternsCommand)
  )
  .addCommand(
    new Command('assess')
      .description('Self-assess current state')
      .argument('[taskDescription]', 'Task description')
      .option('--time <ms>', 'Time spent in milliseconds')
      .option('--recent-errors <errors>', 'Comma-separated recent errors')
      .action((taskDescription, options) => agentAssessCommand(taskDescription, options))
  )
  .addCommand(
    new Command('update-state')
      .description('Update agent state')
      .option('--task <task>', 'Set current task')
      .option('--mode <mode>', 'Set mode')
      .option('--energy <level>', 'Set energy level')
      .option('--add-goal <goal>', 'Add a goal')
      .option('--add-blocker <blocker>', 'Add a blocker')
      .option('--clear-blockers', 'Clear all blockers')
      .action((options) => agentUpdateStateCommand(options))
  );

// Task subcommands
program
  .command('task')
  .description('Task management tools')
  .addCommand(
    new Command('detect')
      .description('Detect current task boundaries')
      .action(taskDetectCommand)
  )
  .addCommand(
    new Command('complete')
      .description('Mark task as complete')
      .argument('[taskId]', 'Task ID')
      .action((taskId, options) => taskCompleteCommand(taskId, options))
  )
  .addCommand(
    new Command('update')
      .description('Update pending work for a task')
      .argument('[taskId]', 'Task ID')
      .option('--pending <work>', 'Pending work description')
      .action((taskId, options) => taskUpdateCommand(taskId, options))
  )
  .addCommand(
    new Command('list')
      .description('List all tasks')
      .option('--limit <n>', 'Maximum tasks', '20')
      .option('--status <status>', 'Filter by status')
      .action((options) => taskListCommand(options))
  )
  .addCommand(
    new Command('show')
      .description('Show task details')
      .argument('[taskId]', 'Task ID')
      .action((taskId) => taskShowCommand(taskId))
  )
  .addCommand(
    new Command('create')
      .description('Create a new task')
      .argument('<title>', 'Task title')
      .option('--goal <goal>', 'Task goal')
      .action((title, options) => taskCreateCommand(title, options))
  );

// Analytics subcommands
program
  .command('analytics')
  .description('Q&A and analytics tools')
  .addCommand(
    new Command('stats')
      .description('Get Q&A statistics')
      .option('--weekly', 'Show weekly instead of daily')
      .option('--json', 'Output as JSON')
      .action((options) => analyticsStatsCommand(options))
  )
  .addCommand(
    new Command('top-questions')
      .description('List most asked questions')
      .option('--limit <n>', 'Maximum questions', '10')
      .option('--json', 'Output as JSON')
      .action((options) => analyticsTopQuestionsCommand(options))
  )
  .addCommand(
    new Command('quality')
      .description('Get answer quality metrics')
      .option('--json', 'Output as JSON')
      .action((options) => analyticsQualityCommand(options))
  )
  .addCommand(
    new Command('intent-distribution')
      .description('Get intent distribution')
      .option('--weekly', 'Show weekly instead of daily')
      .option('--json', 'Output as JSON')
      .action((options) => analyticsIntentDistributionCommand(options))
  );

// Quality subcommands
program
  .command('quality')
  .description('Quality tracking and reporting')
  .addCommand(
    new Command('trends')
      .description('Get quality trends')
      .option('--days <n>', 'Number of days', '7')
      .option('--json', 'Output as JSON')
      .action((options) => qualityTrendsCommand(options))
  )
  .addCommand(
    new Command('report')
      .description('Generate quality report')
      .option('--period <period>', 'Period: daily, weekly', 'daily')
      .option('--json', 'Output as JSON')
      .action((options) => qualityReportCommand(options))
  )
  .addCommand(
    new Command('performance')
      .description('Get performance statistics')
      .option('--json', 'Output as JSON')
      .action((options) => qualityPerformanceCommand(options))
  )
  .addCommand(
    new Command('score')
      .description('Get overall quality score')
      .option('--json', 'Output as JSON')
      .action((options) => qualityScoreCommand(options))
  );

// Insights subcommands
program
  .command('insights')
  .description('Context and session insights')
  .addCommand(
    new Command('session')
      .description('Get cross-session insights')
      .option('--days <n>', 'Number of days', '30')
      .option('--json', 'Output as JSON')
      .action((options) => insightsSessionCommand(options))
  )
  .addCommand(
    new Command('context')
      .description('Get context engine stats')
      .option('--json', 'Output as JSON')
      .action((options) => insightsContextCommand(options))
  )
  .addCommand(
    new Command('export')
      .description('Export current context')
      .option('--output <path>', 'Output file path')
      .option('--json', 'Output as JSON')
      .action((options) => insightsExportCommand(options))
  )
  .addCommand(
    new Command('timeline')
      .description('Get activity timeline')
      .option('--hours <n>', 'Number of hours', '72')
      .option('--format <fmt>', 'Format: summary, detailed', 'summary')
      .option('--json', 'Output as JSON')
      .action((options) => insightsTimelineCommand(options))
  )
  .addCommand(
    new Command('recent')
      .description('Get recent activity summary')
      .option('--days <n>', 'Number of days', '3')
      .option('--json', 'Output as JSON')
      .action((options) => insightsRecentCommand(options))
  )
  .addCommand(
    new Command('continuity')
      .description('Check for work to continue from previous sessions')
      .option('--json', 'Output as JSON')
      .action((options) => insightsContinuityCommand(options))
  );

// Search subcommands
const searchCmd = program
  .command('search')
  .description('Search files, symbols, and content')
  .argument('[query]', 'Search query')
  .option('--type <type>', 'Search type: file, symbol, content, all', 'all')
  .option('--limit <n>', 'Maximum results', '20')
  .option('--json', 'Output as JSON')
  .action((query, options) => searchCommand(query, options));

searchCmd
  .addCommand(
    new Command('memory')
      .description('Search sessions, tasks, handoffs')
      .argument('<query>', 'Search query')
      .option('--types <types>', 'Types to search')
      .option('--days <n>', 'Days to look back', '30')
      .option('--limit <n>', 'Maximum results', '20')
      .option('--json', 'Output as JSON')
      .action((query, options) => searchMemoryCommand(query, options))
  );
searchCmd
  .addCommand(
    new Command('entities')
      .description('Search files, functions, components')
      .argument('<name>', 'Entity name')
      .option('--type <type>', 'Entity type')
      .option('--limit <n>', 'Maximum results', '20')
      .option('--json', 'Output as JSON')
      .action((entity, options) => searchEntitiesCommand(entity, options))
  );
searchCmd
  .addCommand(
    new Command('sessions')
      .description('Search historical sessions')
      .argument('<query>', 'Search query')
      .option('--limit <n>', 'Maximum results', '10')
      .option('--json', 'Output as JSON')
      .action((query, options) => searchSessionsCommand(query, options))
  );
searchCmd
  .addCommand(
    new Command('file')
      .description('Get file content')
      .argument('[filename]', 'Filename')
      .option('--lines <n>', 'Number of lines', '100')
      .action((filename, options) => searchFileCommand(filename, options))
  );

// Ask stats command
import { askStatsCommand } from './commands/ask-stats.js';
program
  .command('ask-stats')
  .description('Q&A cache statistics')
  .argument('<action>', 'Action: stats, top-questions, coverage')
  .option('--weekly', 'Show weekly instead of daily')
  .option('--limit <n>', 'Maximum results', '10')
  .action((action, options) => askStatsCommand(action, options));

// Placeholder commands
const legacyFutureCommands = ['handoff'];
for (const cmd of legacyFutureCommands) {
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
