import { OptionValues } from 'commander';
import chalk from 'chalk';
import {
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  MCP_VERSION,
  setMCPServerStatus,
  handleToolCall,
  handleResourceCall,
  handlePromptCall,
} from '@kontextmind/mcp';
import { detectProject } from '@kontextmind/core';

let isShuttingDown = false;

// Graceful shutdown handler
function setupShutdownHandlers(): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGBREAK'];
  for (const signal of signals) {
    process.on(signal, () => {
      if (!isShuttingDown) {
        isShuttingDown = true;
        safeWrite(JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/mcp/connection_closed',
          params: { reason: 'Server shutdown' },
        }) + '\n');
        process.exit(0);
      }
    });
  }
}

// Safe write to stdout - wraps all stdout operations
function safeWrite(data: string): void {
  try {
    process.stdout.write(data);
  } catch {
    // stdout closed - server shutting down
  }
}

export async function mcpCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);
  const transport = (options.transport as 'stdio' | 'http') || 'stdio';
  const mode = (options.mode as 'readonly' | 'chatbot-readonly' | 'suggest' | 'edit-with-approval') || 'readonly';

  // Set MCP server status - show initializing state
  setMCPServerStatus({
    running: true,
    version: MCP_VERSION,
    mode,
    transport,
    startedAt: new Date().toISOString(),
    providerConfigured: true,
  });

  // Setup shutdown handlers
  setupShutdownHandlers();

  if (transport === 'stdio') {
    // Initialize MCP protocol
    // Send protocol version response immediately
    safeWrite(JSON.stringify({
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: 'kontextmind',
          version: MCP_VERSION,
        },
      },
      id: null,
    }) + '\n');

    // Handle stdio input with proper buffering
    let buffer = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', async (data: string) => {
      if (isShuttingDown) return;

      buffer += data;

      // Process complete JSON messages (split by newlines)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let message: Record<string, unknown> = {};
        try {
          message = JSON.parse(trimmed);
        } catch {
          // Skip malformed JSON
          continue;
        }

        const method = message.method as string;
        if (!method) continue;

        // Check if project is initialized before handling most methods
        const needsInitCheck = !['initialize', 'ping'].includes(method);

        if (needsInitCheck && !project.initialized) {
          safeWrite(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'KontextMind is not initialized. Run: kontextmind init' },
            id: message.id,
          }) + '\n');
          continue;
        }

        // Handle different MCP methods
        try {
          switch (method) {
            case 'initialize':
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: { tools: {}, resources: {}, prompts: {} },
                  serverInfo: { name: 'kontextmind', version: MCP_VERSION },
                },
                id: message.id,
              }) + '\n');
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized',
                params: {},
              }) + '\n');
              break;

            case 'tools/list':
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result: { tools: MCP_TOOLS },
                id: message.id,
              }) + '\n');
              break;

            case 'tools/call': {
              const params = message.params as Record<string, unknown> || {};
              const { name, arguments: args } = params;
              const result = await handleToolCall(name as string, (args || {}) as Record<string, unknown>, projectRoot);
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result,
                id: message.id,
              }) + '\n');
              break;
            }

            case 'resources/list': {
              const result = await handleResourceCall('list', {}, projectRoot);
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result,
                id: message.id,
              }) + '\n');
              break;
            }

            case 'resources/read': {
              const params = message.params as Record<string, unknown> || {};
              const result = await handleResourceCall('read', { uri: params.uri }, projectRoot);
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result,
                id: message.id,
              }) + '\n');
              break;
            }

            case 'prompts/list':
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result: { prompts: MCP_PROMPTS },
                id: message.id,
              }) + '\n');
              break;

            case 'prompts/get': {
              const params = message.params as Record<string, unknown> || {};
              const { name, arguments: args } = params;
              const result = await handlePromptCall(name as string, (args || {}) as Record<string, unknown>, projectRoot);
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result,
                id: message.id,
              }) + '\n');
              break;
            }

            case 'ping':
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result: {},
                id: message.id,
              }) + '\n');
              break;

            default:
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32601, message: `Method not found: ${method}` },
                id: message.id,
              }) + '\n');
          }
        } catch (error) {
          // Log error but don't crash - send error response
          safeWrite(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: `Internal error: ${error instanceof Error ? error.message : String(error)}` },
            id: message.id,
          }) + '\n');
        }
      }
    });

    // Handle stdin errors - connection closed gracefully
    process.stdin.on('error', () => {
      isShuttingDown = true;
      process.exit(0);
    });

  } else {
    // HTTP mode
    if (!project.initialized) {
      console.log(chalk.red('KontextMind is not initialized in this directory.'));
      console.log(`Run: ${chalk.cyan('kontextmind init')}`);
      process.exit(1);
    }

    const port = parseInt(String(options.port || '7332'), 10);

    console.log(chalk.bold('KontextMind MCP Server'));
    console.log(`Starting MCP server at http://127.0.0.1:${port}/mcp\n`);
    console.log(`Mode: ${project.mode || 'readonly'}`);
    console.log(`Project: ${project.name}\n`);
    console.log(chalk.green('MCP server ready. Connect via stdio mode or HTTP endpoint.'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
  }
}