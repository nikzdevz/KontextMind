import { OptionValues } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { resolveInProject, FILES, LOGS_DIR, KG_DIR, SUMMARIES_DIR } from '../utils/paths.js';
import { printSection, printPass, printFail, printWarn } from '../utils/print.js';
import { getFileIndexStatus, validateFileIndex, getIndexStatus, getSummaryStatus, getKBStatus } from '@kontextmind/core';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

interface DoctorOutput {
  checks: CheckResult[];
  healthy: boolean;
  phase: number;
  errors: string[];
  warnings: string[];
}

export async function doctorCommand(options: OptionValues): Promise<void> {
  const checks: CheckResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const checkFiles = [
    { path: FILES.configJson, name: '.kontextmind/config.json' },
    { path: FILES.policyJson, name: '.kontextmind/policy.json' },
    { path: FILES.instructionsMaster, name: '.kontextmind/instructions.master.md' },
    { path: FILES.claudeMd, name: 'CLAUDE.md' },
    { path: FILES.agentsMd, name: 'AGENTS.md' },
    { path: FILES.readmeAiMd, name: 'README_AI.md' },
    { path: FILES.handoffMd, name: '.context/handoff.md' },
    { path: FILES.toolignore, name: '.toolignore' },
    { path: FILES.mcpServerJson, name: '.mcp/server.json' },
    { path: FILES.sessionLatestJson, name: '.sessions/latest.json' },
  ];

  const checkDirs = [
    { path: LOGS_DIR, name: '.logs folder' },
    { path: KG_DIR, name: '.kg folder' },
    { path: SUMMARIES_DIR, name: '.summaries folder' },
  ];

  // Check required files
  for (const file of checkFiles) {
    const exists = existsSync(resolveInProject(file.path));
    checks.push({
      name: file.name,
      status: exists ? 'pass' : 'fail',
      message: exists ? 'exists' : 'missing'
    });
    if (!exists) {
      errors.push(`${file.name} is missing`);
    }
  }

  // Check directories
  for (const dir of checkDirs) {
    const exists = existsSync(resolveInProject(dir.path));
    checks.push({
      name: dir.name,
      status: exists ? 'pass' : 'fail',
      message: exists ? 'exists' : 'missing'
    });
    if (!exists) {
      errors.push(`${dir.name} is missing`);
    }
  }

  // Phase 2 checks: File index
  const indexStatus = getFileIndexStatus(process.cwd());
  checks.push({
    name: 'File index',
    status: indexStatus.exists ? (indexStatus.valid ? 'pass' : 'fail') : 'warn',
    message: indexStatus.exists
      ? (indexStatus.valid ? `${indexStatus.fileCount} files indexed` : 'invalid format')
      : 'not created yet. Run scan to build.'
  });

  if (!indexStatus.exists) {
    warnings.push('File index not created. Run kontextmind scan');
  } else if (!indexStatus.valid) {
    errors.push('File index has invalid format');
  } else if (indexStatus.fileCount === 0) {
    warnings.push('File index has zero files');
  }

  // Phase 2 checks: .toolignore
  const toolignoreExists = existsSync(resolveInProject(FILES.toolignore));
  if (toolignoreExists) {
    checks.push({
      name: '.toolignore loaded',
      status: 'pass',
      message: 'ready for scanning'
    });
  }

  // Phase 3 checks: Symbol, Dependency, and Graph indexes
  const parsedIndexStatus = getIndexStatus(process.cwd());

  // Symbol index
  checks.push({
    name: 'Symbol index',
    status: parsedIndexStatus.hasSymbolIndex
      ? (parsedIndexStatus.symbolCount > 0 ? 'pass' : 'warn')
      : 'warn',
    message: parsedIndexStatus.hasSymbolIndex
      ? (parsedIndexStatus.symbolCount > 0 ? `${parsedIndexStatus.symbolCount} symbols indexed` : 'empty')
      : 'not created yet. Run index to build.'
  });

  if (!parsedIndexStatus.hasSymbolIndex) {
    warnings.push('Symbol index not created. Run kontextmind index');
  } else if (parsedIndexStatus.symbolCount === 0) {
    warnings.push('Symbol index is empty');
  }

  // Dependency index
  checks.push({
    name: 'Dependency index',
    status: parsedIndexStatus.hasDependencyIndex
      ? (parsedIndexStatus.dependencyCount > 0 ? 'pass' : 'warn')
      : 'warn',
    message: parsedIndexStatus.hasDependencyIndex
      ? (parsedIndexStatus.dependencyCount > 0 ? `${parsedIndexStatus.dependencyCount} dependencies indexed` : 'empty')
      : 'not created yet. Run index to build.'
  });

  // Knowledge graph
  checks.push({
    name: 'Knowledge graph',
    status: parsedIndexStatus.hasGraph
      ? (parsedIndexStatus.graphNodes > 0 ? 'pass' : 'warn')
      : 'warn',
    message: parsedIndexStatus.hasGraph
      ? (parsedIndexStatus.graphNodes > 0
          ? `${parsedIndexStatus.graphNodes} nodes, ${parsedIndexStatus.graphEdges} edges`
          : 'empty')
      : 'not created yet. Run index to build.'
  });

  if (!parsedIndexStatus.hasGraph) {
    warnings.push('Knowledge graph not created. Run kontextmind index');
  } else if (parsedIndexStatus.graphNodes === 0) {
    warnings.push('Knowledge graph is empty');
  }

  // Phase 4 checks: Summaries
  const summaryStatus = getSummaryStatus(process.cwd());

  // Summaries folder
  const summariesDir = resolveInProject('.summaries');
  checks.push({
    name: 'Summaries folder',
    status: existsSync(summariesDir) ? 'pass' : 'warn',
    message: existsSync(summariesDir) ? 'exists' : 'not created yet'
  });

  // File summaries
  checks.push({
    name: 'File summaries',
    status: summaryStatus.fileCount > 0 ? 'pass' : 'warn',
    message: summaryStatus.fileCount > 0
      ? `${summaryStatus.fileCount} summaries (${summaryStatus.stats.fresh} fresh, ${summaryStatus.stats.stale} stale)`
      : 'none generated. Run summarize to build.'
  });

  if (summaryStatus.fileCount === 0) {
    warnings.push('No summaries generated. Run kontextmind summarize --mock');
  }

  // Stale summaries warning
  if (summaryStatus.stats.stale > 0) {
    checks.push({
      name: 'Stale summaries',
      status: 'warn',
      message: `${summaryStatus.stats.stale} summaries are stale. Run summarize --changed-only to refresh.`
    });
    warnings.push(`${summaryStatus.stats.stale} summaries are stale`);
  }

  // Phase 5 checks: Chatbot KB
  const kbStatus = getKBStatus(process.cwd());
  const kbDir = resolveInProject('.kontextmind/chatbot');
  checks.push({
    name: 'Chatbot KB directory',
    status: existsSync(kbDir) ? 'pass' : 'warn',
    message: existsSync(kbDir) ? 'exists' : 'not created yet'
  });

  const requiredKBFiles = [
    { name: 'project-overview.md', path: '.kontextmind/chatbot/project-overview.md' },
    { name: 'architecture.md', path: '.kontextmind/chatbot/architecture.md' },
    { name: 'common-questions.json', path: '.kontextmind/chatbot/common-questions.json' },
    { name: 'response-policy.json', path: '.kontextmind/chatbot/response-policy.json' },
  ];

  for (const file of requiredKBFiles) {
    const exists = existsSync(resolveInProject(file.path));
    checks.push({
      name: file.name,
      status: exists ? 'pass' : 'warn',
      message: exists ? 'exists' : 'missing'
    });
    if (!exists) {
      warnings.push(`${file.name} not found. Run kontextmind kb build`);
    }
  }

  // Q&A log file
  const qnaLog = resolveInProject('.logs/qna-events.log');
  checks.push({
    name: 'Q&A events log',
    status: existsSync(qnaLog) ? 'pass' : 'warn',
    message: existsSync(qnaLog) ? 'exists' : 'not created yet'
  });

  // Phase 6 checks: API Server
  const apiLog = resolveInProject('.logs/api-events.log');
  checks.push({
    name: 'API events log',
    status: existsSync(apiLog) ? 'pass' : 'warn',
    message: existsSync(apiLog) ? 'exists' : 'not created yet'
  });

  // Server configuration
  checks.push({
    name: 'API Server',
    status: 'warn',
    message: 'Run "kontextmind serve" to start the server'
  });

  // Phase 7 checks: MCP Server
  const mcpToolsPath = resolveInProject('.mcp/tools.json');
  const mcpToolsExist = existsSync(mcpToolsPath);
  checks.push({
    name: 'MCP tools',
    status: mcpToolsExist ? 'pass' : 'warn',
    message: mcpToolsExist ? 'defined' : 'not found. Run kontextmind mcp'
  });

  const mcpResourcesPath = resolveInProject('.mcp/resources.json');
  const mcpResourcesExist = existsSync(mcpResourcesPath);
  checks.push({
    name: 'MCP resources',
    status: mcpResourcesExist ? 'pass' : 'warn',
    message: mcpResourcesExist ? 'defined' : 'not found. Run kontextmind mcp'
  });

  const mcpPromptsPath = resolveInProject('.mcp/prompts.json');
  const mcpPromptsExist = existsSync(mcpPromptsPath);
  checks.push({
    name: 'MCP prompts',
    status: mcpPromptsExist ? 'pass' : 'warn',
    message: mcpPromptsExist ? 'defined' : 'not found. Run kontextmind mcp'
  });

  const healthy = errors.length === 0;

  const output: DoctorOutput = {
    checks,
    healthy,
    phase: 6,
    errors,
    warnings
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  printSection('KontextMind Doctor');

  for (const check of checks) {
    if (check.status === 'pass') {
      printPass(`${check.name} ${check.message}`);
    } else if (check.status === 'fail') {
      printFail(`${check.name} ${check.message}`);
    } else {
      printWarn(`${check.name} ${check.message}`);
    }
  }

  console.log('');
  if (healthy) {
    console.log(`\x1b[32mResult: healthy for Phase 6\x1b[0m\n`);
  } else {
    console.log(`\x1b[31mResult: issues found\x1b[0m\n`);
    console.log('Run: \x1b[36mkontextmind init --force\x1b[0m or \x1b[36mkontextmind scan\x1b[0m or \x1b[36mkontextmind index\x1b[0m or \x1b[36mkontextmind summarize --mock\x1b[0m or \x1b[36mkontextmind kb build --mock\x1b[0m or \x1b[36mkontextmind serve\x1b[0m to fix\n');
  }
}
