import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { detectProject } from '@kontextmind/core';

interface SetupOptions {
  provider?: string;
  apiKey?: string;
  autoSync?: boolean;
  configureMcp?: boolean;
  runScan?: boolean;
  skipSummarize?: boolean;
  mode?: string;
}

export async function setupCommand(options: SetupOptions): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  // Banner
  console.log(chalk.magenta(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ██╗    ██╗███████╗██╗  ██╗██╗   ██╗ ██████╗        ║
    ║   ██║    ██║██╔════╝██║  ██║██║   ██║██╔════╝        ║
    ║   ██║ █╗ ██║█████╗  ███████║██║   ██║██║  ███╗       ║
    ║   ██║███╗██║██╔══╝  ██╔══██║██║   ██║██║   ██║       ║
    ║   ╚███╔███╔╝███████╗██║  ██║╚██████╔╝╚██████╔╝       ║
    ║    ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝        ║
    ║                                                       ║
    ║   Interactive Setup Wizard                            ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
  `));

  console.log(chalk.cyan(`[INFO] Project: ${project.name}`));
  if (project.initialized) {
    console.log(chalk.yellow('[WARN] KontextMind already initialized. Running in update mode.'));
  }

  // ============================================================
  // Helper function for simple prompts
  // ============================================================
  const readline = await import('readline');

  function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(chalk.cyan(question), (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  function promptPassword(question: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(chalk.cyan(question), (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  function confirm(question: string, default_yes = true): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const suffix = default_yes ? ' [Y/n]' : ' [y/N]';
      rl.question(chalk.cyan(question + suffix + ': '), (answer) => {
        rl.close();
        if (!answer) {
          resolve(default_yes);
        } else {
          resolve(answer.toLowerCase() === 'y');
        }
      });
    });
  }

  function selectOption(question: string, options: string[]): Promise<string> {
    return new Promise((resolve) => {
      console.log(chalk.cyan(question));
      options.forEach((opt, i) => {
        console.log(`  ${chalk.green(`${i + 1})`)} ${opt}`);
      });
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(chalk.cyan('Enter choice (number): '), (answer) => {
        rl.close();
        const num = parseInt(answer) - 1;
        if (num >= 0 && num < options.length) {
          resolve(options[num]);
        } else {
          resolve(options[0]);
        }
      });
    });
  }

  // ============================================================
  // STEP 1: LLM Provider Selection
  // ============================================================
  console.log('\n' + chalk.blue('[STEP 1/6] Configure LLM Provider'));
  console.log(chalk.gray('━'.repeat(48)));

  let selectedProvider = options.provider;
  if (!selectedProvider) {
    const providers = [
      'OpenAI (GPT-4)',
      'Anthropic (Claude 3)',
      'OpenRouter (Multiple providers)',
      'OpusMax (Custom endpoint)',
      'Ollama (Local)',
      'Custom / Self-hosted',
    ];
    selectedProvider = await selectOption('Select LLM provider:', providers);

    // Map to provider key
    const providerMap: Record<string, string> = {
      'OpenAI (GPT-4)': 'openai',
      'Anthropic (Claude 3)': 'anthropic',
      'OpenRouter (Multiple providers)': 'openrouter',
      'OpusMax (Custom endpoint)': 'opusmax',
      'Ollama (Local)': 'ollama',
      'Custom / Self-hosted': 'custom',
    };
    selectedProvider = providerMap[selectedProvider] || 'openai';
  }

  // ============================================================
  // STEP 2: API Key
  // ============================================================
  console.log('\n' + chalk.blue('[STEP 2/6] Enter API Key'));
  console.log(chalk.gray('━'.repeat(48)));

  let apiKey = options.apiKey;
  if (!apiKey) {
    const providerDisplay: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      opusmax: 'OPUSMAX_API_KEY',
      ollama: 'OLLAMA_API_KEY',
      custom: 'CUSTOM_API_KEY',
    };
    const displayName = providerDisplay[selectedProvider] || 'API_KEY';

    const keyPrompt = selectedProvider === 'ollama'
      ? `Enter API key (optional for local Ollama): `
      : `Enter your ${displayName} API key: `;

    apiKey = await promptPassword(keyPrompt);
  }

  // ============================================================
  // STEP 3: Project Configuration
  // ============================================================
  console.log('\n' + chalk.blue('[STEP 3/6] Project Configuration'));
  console.log(chalk.gray('━'.repeat(48)));

  let projectName = project.name;
  let selectedMode = options.mode || 'readonly';

  const modeOptions = [
    'readonly - Read-only access',
    'chatbot-readonly - Chatbot mode',
    'suggest - Suggest changes',
    'edit-with-approval - Edit with approval',
    'full-agent - Full agent capabilities',
  ];

  const modeMap: Record<string, string> = {
    'readonly - Read-only access': 'readonly',
    'chatbot-readonly - Chatbot mode': 'chatbot-readonly',
    'suggest - Suggest changes': 'suggest',
    'edit-with-approval - Edit with approval': 'edit-with-approval',
    'full-agent - Full agent capabilities': 'full-agent',
  };

  if (!options.mode) {
    const modeSelection = await selectOption('Select KontextMind mode:', modeOptions);
    selectedMode = modeMap[modeSelection] || 'readonly';
  }

  // ============================================================
  // STEP 4: Auto-Sync Configuration
  // ============================================================
  console.log('\n' + chalk.blue('[STEP 4/6] Learning Configuration'));
  console.log(chalk.gray('━'.repeat(48)));

  const enableAutoSync = options.autoSync ?? true;
  if (options.autoSync === undefined) {
    const syncAnswer = await confirm('Enable automatic sync from summaries and Q&A?', true);
  }

  // ============================================================
  // STEP 5: MCP Server Configuration
  // ============================================================
  console.log('\n' + chalk.blue('[STEP 5/6] MCP Server Configuration'));
  console.log(chalk.gray('━'.repeat(48)));

  const configureMcp = options.configureMcp ?? true;
  if (options.configureMcp === undefined) {
    configureMcp; // Will be prompted below if needed
  }

  const mcpTools = await confirm('Configure MCP server for Claude Code?', true);

  // ============================================================
  // STEP 6: Initial Scan
  // ============================================================
  console.log('\n' + chalk.blue('[STEP 6/6] Initial Setup'));
  console.log(chalk.gray('━'.repeat(48)));

  const runScan = options.runScan ?? true;
  if (options.runScan === undefined) {
    runScan; // Will be prompted below
  }

  const doScan = await confirm('Run initial scan and generate summaries? (Recommended)', true);

  // ============================================================
  // WRITE CONFIGURATION
  // ============================================================
  console.log('\n' + chalk.blue('[WRITING CONFIGURATION]'));
  console.log(chalk.gray('━'.repeat(48)));

  // Provider configuration map
  const providerConfig: Record<string, { envVar: string; type: string; baseURL?: string; model: string }> = {
    openai: { envVar: 'OPENAI_API_KEY', type: 'openai', model: 'gpt-4' },
    anthropic: { envVar: 'ANTHROPIC_API_KEY', type: 'anthropic', model: 'claude-3-sonnet-20240229' },
    openrouter: { envVar: 'OPENROUTER_API_KEY', type: 'openai-compatible', baseURL: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4' },
    opusmax: { envVar: 'OPUSMAX_API_KEY', type: 'openai-compatible', baseURL: 'https://api.opusmax.pro/v1', model: 'claude-opus-4-7' },
    ollama: { envVar: 'OLLAMA_API_KEY', type: 'openai-compatible', baseURL: 'http://localhost:11434/v1', model: 'llama3' },
    custom: { envVar: 'CUSTOM_API_KEY', type: 'openai-compatible', baseURL: 'http://localhost:8000/v1', model: 'gpt-4' },
  };

  const config = providerConfig[selectedProvider] || providerConfig.custom;

  // Create/update .env file
  const envPath = join(projectRoot, '.env');
  let envContent = '';

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8');
  }

  // Update or add API key
  if (apiKey && apiKey.trim()) {
    const envPattern = new RegExp(`^${config.envVar}=.*`, 'm');
    if (envPattern.test(envContent)) {
      envContent = envContent.replace(envPattern, `${config.envVar}=${apiKey}`);
    } else {
      envContent += `\n${config.envVar}=${apiKey}`;
    }
    writeFileSync(envPath, envContent, 'utf-8');
    console.log(chalk.green(`[OK] API key saved to .env`));
  } else {
    console.log(chalk.yellow('[INFO] No API key provided. Set it via environment variable.'));
  }

  // Create providers.json
  const providersPath = join(projectRoot, '.kontextmind', 'providers.json');
  const providerData: any = {
    type: config.type,
    apiKeyEnv: config.envVar,
    model: config.model,
  };
  if (config.baseURL) {
    providerData.baseURL = config.baseURL;
  }
  const providersContent = JSON.stringify({ [selectedProvider]: providerData }, null, 2);
  writeFileSync(providersPath, providersContent, 'utf-8');
  console.log(chalk.green(`[OK] Provider configured: ${selectedProvider}`));

  // Create MCP configuration
  if (mcpTools) {
    const mcpConfig = {
      mcpServers: {
        kontextmind: {
          command: 'kontextmind',
          args: ['mcp', '--mode', selectedMode],
          cwd: projectRoot,
          env: {
            DATA_DIR: '.kontextmind',
          },
        },
      },
    };

    const mcpJsonPath = join(projectRoot, '.mcp.json');
    writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    console.log(chalk.green('[OK] Created .mcp.json for Claude Code'));
  }

  // ============================================================
  // RUN SETUP COMMANDS
  // ============================================================
  console.log('\n' + chalk.blue('[RUNNING SETUP]'));
  console.log(chalk.gray('━'.repeat(48)));

  // Initialize if not already
  if (!project.initialized) {
    console.log(chalk.cyan('[INFO] Initializing KontextMind...'));
    const { execSync } = await import('child_process');
    try {
      execSync('pnpm kontextmind init --mode full-agent --yes', {
        cwd: projectRoot,
        stdio: 'inherit',
      });
      console.log(chalk.green('[OK] KontextMind initialized'));
    } catch {
      console.log(chalk.yellow('[WARN] Init may have failed or already done'));
    }
  }

  // Run scan if requested
  if (doScan) {
    console.log(chalk.cyan('[INFO] Running initial scan...'));
    const { execSync } = await import('child_process');
    try {
      execSync('pnpm kontextmind scan', { cwd: projectRoot, stdio: 'inherit' });
      console.log(chalk.green('[OK] Files scanned'));

      console.log(chalk.cyan('[INFO] Indexing symbols...'));
      execSync('pnpm kontextmind index', { cwd: projectRoot, stdio: 'inherit' });
      console.log(chalk.green('[OK] Symbols indexed'));

      if (!options.skipSummarize) {
        console.log(chalk.cyan('[INFO] Generating summaries (this may take several minutes)...'));
        console.log(chalk.yellow('[WARN] This uses LLM API and may incur costs'));
        try {
          execSync('pnpm kontextmind summarize', { cwd: projectRoot, stdio: 'inherit' });
          console.log(chalk.green('[OK] Summaries generated'));

          execSync('pnpm kontextmind kb build', { cwd: projectRoot, stdio: 'inherit' });
          console.log(chalk.green('[OK] Knowledge base built'));
        } catch {
          console.log(chalk.yellow('[WARN] Summarization skipped or failed'));
        }
      }
    } catch {
      console.log(chalk.yellow('[WARN] Some setup steps may have failed'));
    }
  }

  // ============================================================
  // COMPLETION
  // ============================================================
  console.log(chalk.green(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ✓ Setup Complete!                                  ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
  `));

  console.log(chalk.cyan('Next Steps:'));
  console.log(`  1. Start MCP server: kontextmind mcp --mode ${selectedMode}`);
  console.log('  2. Ask a question: kontextmind ask "what does this project do?"');
  console.log('  3. Read CLAUDE.md for usage instructions');
  console.log('');

  if (mcpTools) {
    console.log(chalk.cyan('MCP Server:'));
    console.log('  Restart Claude Code or your IDE to use KontextMind MCP tools');
    console.log('');
  }

  console.log(chalk.gray('For help: kontextmind --help'));
}

// Create the setup command
export function createSetupCommand(): Command {
  const setup = new Command('setup');

  setup
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
    .action(async (opts) => {
      await setupCommand({
        provider: opts.provider,
        apiKey: opts.apiKey,
        mode: opts.mode,
        autoSync: opts.autoSync,
        configureMcp: opts.configureMcp,
        runScan: opts.runScan,
        skipSummarize: opts.skipSummarize,
      } as SetupOptions);
    });

  return setup;
}

export default createSetupCommand;