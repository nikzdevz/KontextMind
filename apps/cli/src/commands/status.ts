import { OptionValues } from 'commander';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { resolveInProject, FILES } from '../utils/paths.js';
import { printSection, printKeyValue, printWarning } from '../utils/print.js';
import { getFileIndexStatus, getLastScanTime, detectGitInfo, getIndexStatus, getLastIndexTime, getSummaryStatus, getLastSummarizeTime, getKBStatus, getLastAskTime } from '@kontextmind/core';

interface StatusOutput {
  initialized: boolean;
  project?: string;
  mode?: string;
  phase?: number;
  agents?: string[];
  gitMode?: string;
  gitAvailable?: boolean;
  gitBranch?: string | null;
  gitCommit?: string | null;
  provider?: string;
  claudeMd?: boolean;
  agentsMd?: boolean;
  toolignore?: boolean;
  fileIndexStatus?: {
    exists: boolean;
    fileCount: number;
    valid: boolean;
  };
  lastScanTime?: string | null;
  indexStatus?: {
    hasFileIndex: boolean;
    hasSymbolIndex: boolean;
    hasDependencyIndex: boolean;
    hasGraph: boolean;
    symbolCount: number;
    dependencyCount: number;
    graphNodes: number;
    graphEdges: number;
  };
  lastIndexTime?: string | null;
  summaryStatus?: {
    hasSummaries: boolean;
    fileCount: number;
    functionCount: number;
    stats: {
      total: number;
      fresh: number;
      stale: number;
      missing: number;
      failed: number;
    };
  };
  lastSummarizeTime?: string | null;
  kbStatus?: {
    ready: boolean;
    hasOverview: boolean;
    hasArchitecture: boolean;
    questionCount: number;
    lastBuildTime: string | null;
    files: string[];
  };
  lastAskTime?: string | null;
  errors: string[];
}

export async function statusCommand(options: OptionValues): Promise<void> {
  const errors: string[] = [];
  const projectRoot = process.cwd();
  const configPath = resolveInProject(FILES.configJson);

  const output: StatusOutput = {
    initialized: existsSync(configPath),
    errors
  };

  if (output.initialized) {
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      output.project = config.project?.name;
      output.mode = config.mode;
      output.phase = config.phase;
      output.agents = config.agents;
      output.gitMode = config.git?.enabled;
      output.gitAvailable = config.git?.available;
      output.provider = config.provider;
      output.claudeMd = existsSync(resolveInProject(FILES.claudeMd));
      output.agentsMd = existsSync(resolveInProject(FILES.agentsMd));
      output.toolignore = existsSync(resolveInProject(FILES.toolignore));

      // Get git info
      const gitInfo = detectGitInfo(projectRoot);
      output.gitBranch = gitInfo.branch;
      output.gitCommit = gitInfo.commit;

      // Get file index status
      const indexStatus = getFileIndexStatus(projectRoot);
      output.fileIndexStatus = indexStatus;

      // Get last scan time
      output.lastScanTime = getLastScanTime(projectRoot);

      // Get index status
      output.indexStatus = getIndexStatus(projectRoot);
      output.lastIndexTime = getLastIndexTime(projectRoot);

      // Get summary status (Phase 4)
      output.summaryStatus = getSummaryStatus(projectRoot);
      output.lastSummarizeTime = getLastSummarizeTime(projectRoot);

      // Get KB status (Phase 5)
      output.kbStatus = getKBStatus(projectRoot);
      output.lastAskTime = getLastAskTime(projectRoot);
    } catch (e) {
      errors.push('Failed to read config.json');
    }
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (!output.initialized) {
    printSection('KontextMind Status');
    console.log('\n\x1b[31mKontextMind is not initialized in this directory.\x1b[0m');
    console.log('Run: \x1b[36mkontextmind init\x1b[0m\n');
    return;
  }

  printSection('KontextMind Status');
  printKeyValue('Initialized', '\x1b[32myes\x1b[0m');
  printKeyValue('Project', output.project || 'unknown');
  printKeyValue('Mode', output.mode || 'unknown');
  printKeyValue('Phase', String(output.phase || 'unknown'));
  printKeyValue('Agents', (output.agents || []).join(', '));
  printKeyValue('Git mode', output.gitMode || 'unknown');
  printKeyValue('Git available', output.gitAvailable ? '\x1b[32myes\x1b[0m' : '\x1b[31mno\x1b[0m');

  if (output.gitBranch) {
    printKeyValue('Git branch', output.gitBranch);
  }
  if (output.gitCommit) {
    printKeyValue('Git commit', output.gitCommit);
  }

  printKeyValue('Provider', output.provider || 'none');

  // File index status
  if (output.fileIndexStatus) {
    if (output.fileIndexStatus.exists && output.fileIndexStatus.valid) {
      printKeyValue('Files indexed', `\x1b[32m${output.fileIndexStatus.fileCount}\x1b[0m`);
      printKeyValue('File index', '\x1b[32mvalid\x1b[0m');
    } else if (output.fileIndexStatus.exists) {
      printKeyValue('File index', '\x1b[33minvalid\x1b[0m');
    } else {
      printKeyValue('File index', '\x1b[33mnot built\x1b[0m - run scan');
    }

    if (output.lastScanTime) {
      printKeyValue('Last scan', new Date(output.lastScanTime).toLocaleString());
    }
  }

  printKeyValue('CLAUDE.md', output.claudeMd ? '\x1b[32mfound\x1b[0m' : '\x1b[31mmissing\x1b[0m');
  printKeyValue('AGENTS.md', output.agentsMd ? '\x1b[32mfound\x1b[0m' : '\x1b[31mmissing\x1b[0m');
  printKeyValue('.toolignore', output.toolignore ? '\x1b[32mfound\x1b[0m' : '\x1b[31mmissing\x1b[0m');

  // Phase readiness hint
  if (!output.fileIndexStatus?.exists) {
    console.log('\n\x1b[33mScanner ready: Run \x1b[36mkontextmind scan\x1b[33m to index files\x1b[0m');
  }

  // Index status (Phase 3)
  if (output.indexStatus) {
    console.log('');
    printKeyValue('Symbols indexed', output.indexStatus.symbolCount > 0
      ? `\x1b[32m${output.indexStatus.symbolCount}\x1b[0m`
      : '\x1b[33m0 - run index\x1b[0m');
    printKeyValue('Dependencies indexed', output.indexStatus.dependencyCount > 0
      ? `\x1b[32m${output.indexStatus.dependencyCount}\x1b[0m`
      : '\x1b[33m0\x1b[0m');
    printKeyValue('Graph nodes', output.indexStatus.graphNodes > 0
      ? `\x1b[32m${output.indexStatus.graphNodes}\x1b[0m`
      : '\x1b[33m0\x1b[0m');
    printKeyValue('Graph edges', output.indexStatus.graphEdges > 0
      ? `\x1b[32m${output.indexStatus.graphEdges}\x1b[0m`
      : '\x1b[33m0\x1b[0m');

    if (output.lastIndexTime) {
      printKeyValue('Last index', new Date(output.lastIndexTime).toLocaleString());
    }
  }

  // Summary status (Phase 4)
  if (output.summaryStatus) {
    console.log('');
    if (output.summaryStatus.hasSummaries) {
      printKeyValue('Summaries', `\x1b[32m${output.summaryStatus.fileCount}\x1b[0m files`);
      if (output.summaryStatus.stats.fresh > 0) {
        printKeyValue('  Fresh', `\x1b[32m${output.summaryStatus.stats.fresh}\x1b[0m`);
      }
      if (output.summaryStatus.stats.stale > 0) {
        printKeyValue('  Stale', `\x1b[33m${output.summaryStatus.stats.stale}\x1b[0m`);
      }
      if (output.summaryStatus.stats.failed > 0) {
        printKeyValue('  Failed', `\x1b[31m${output.summaryStatus.stats.failed}\x1b[0m`);
      }
    } else {
      printKeyValue('Summaries', '\x1b[33m0 - run summarize\x1b[0m');
    }

    if (output.lastSummarizeTime) {
      printKeyValue('Last summarize', new Date(output.lastSummarizeTime).toLocaleString());
    }
  }

  // Chatbot KB status (Phase 5)
  if (output.kbStatus) {
    console.log('');
    if (output.kbStatus.ready) {
      printKeyValue('Chatbot KB', `\x1b[32mready\x1b[0m`);
      printKeyValue('Questions', `${output.kbStatus.questionCount}`);
    } else {
      printKeyValue('Chatbot KB', '\x1b[33mnot ready\x1b[0m - run kb build');
    }

    if (output.kbStatus.lastBuildTime) {
      printKeyValue('Last KB build', new Date(output.kbStatus.lastBuildTime).toLocaleString());
    }
    if (output.kbStatus.lastAskTime) {
      printKeyValue('Last ask', new Date(output.kbStatus.lastAskTime).toLocaleString());
    }
  }

  // LLM Provider status
  const providerConfigured = checkLLMProviderConfigured(projectRoot);
  console.log('');
  if (providerConfigured.configured) {
    printKeyValue('LLM Provider', `\x1b[32m${providerConfigured.provider}\x1b[0m`);
    printKeyValue('LLM Ask', `\x1b[32menabled\x1b[0m (summaries + LLM enhancement)`);
  } else {
    printKeyValue('LLM Provider', '\x1b[33mnot configured\x1b[0m');
    printKeyValue('LLM Ask', '\x1b[33mKB only\x1b[0m - configure provider for LLM enhancement');
    console.log('\n\x1b[36m  Configure with:\x1b[0m');
    console.log('    kontextmind config add-provider --name ollama --type openai-compatible --baseUrl http://localhost:11434/v1');
    console.log('    kontextmind config set-default-provider --name ollama');
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const err of errors) {
      console.log(`  • ${err}`);
    }
  }
  console.log('');
}

// Helper to check if LLM provider is configured (same logic as summarize)
function checkLLMProviderConfigured(projectRoot: string): { configured: boolean; provider?: string; model?: string } {
  // Check global config first
  const globalConfigDir = process.env.APPDATA || process.env.HOME || '';
  const globalConfigPath = path.join(globalConfigDir, '.kontextmind', 'config.json');
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
      if (globalConfig.defaultProvider && globalConfig.providers?.[globalConfig.defaultProvider]) {
        const gp = globalConfig.providers[globalConfig.defaultProvider];
        return {
          configured: true,
          provider: globalConfig.defaultProvider,
          model: gp.model,
        };
      }
    } catch { /* ignore */ }
  }

  // Check project providers.json
  const projectConfigPath = path.join(projectRoot, '.kontextmind', 'providers.json');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      const selectedProvider = projectConfig.selected_provider;
      if (selectedProvider && selectedProvider !== 'none' && projectConfig.providers?.[selectedProvider]) {
        const pp = projectConfig.providers[selectedProvider];
        return {
          configured: true,
          provider: selectedProvider,
          model: pp.model,
        };
      }
    } catch { /* ignore */ }
  }

  return { configured: false };
}