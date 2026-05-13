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
        // Send final notification if needed
        try {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/mcp/connection_closed',
            params: { reason: 'Server shutdown' },
          }) + '\n');
        } catch {
          // Ignore
        }
        process.exit(0);
      }
    });
  }
}

// Send response helper
function sendResponse(id: string | number | null, result: unknown): void {
  if (id === null || id === undefined) return;
  try {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      result,
      id,
    }) + '\n');
  } catch {
    // stdout might be closed
  }
}

// Send error helper
function sendError(id: string | number | null, code: number, message: string): void {
  if (id === null || id === undefined) return;
  try {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      error: { code, message },
      id,
    }) + '\n');
  } catch {
    // stdout might be closed
  }
}

// Send notification helper
function sendNotification(method: string, params?: unknown): void {
  try {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: params || {},
    }) + '\n');
  } catch {
    // Ignore
  }
}

export async function mcpCommand(options: OptionValues): Promise<void> {
  const projectRoot = process.cwd();
  const project = detectProject(projectRoot);

  if (!project.initialized) {
    console.error(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'KontextMind is not initialized in this directory. Run: kontextmind init' },
      id: null,
    }));
    process.exit(1);
  }

  const mode = (options.mode as 'readonly' | 'chatbot-readonly' | 'suggest' | 'edit-with-approval') || 'readonly';
  const transport = (options.transport as 'stdio' | 'http') || 'stdio';
  const port = parseInt(String(options.port || '7332'), 10);

  // Set MCP server status
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
    process.stdout.write(JSON.stringify({
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
    process.stdout.flush();

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

        try {
          const message = JSON.parse(trimmed);

          // Handle different MCP methods
          switch (message.method) {
            case 'initialize':
              // Respond to initialize request
              sendResponse(message.id, {
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
              });
              // Send initialized notification
              sendNotification('notifications/initialized');
              break;

            case 'tools/list':
              sendResponse(message.id, { tools: MCP_TOOLS });
              break;

            case 'tools/call':
              try {
                const { name, arguments: args } = message.params || {};
                const result = await handleToolCall(name, args || {}, projectRoot);
                sendResponse(message.id, result);
              } catch (error) {
                sendError(message.id, -32603, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
              }
              break;

            case 'resources/list':
              try {
                const result = await handleResourceCall('list', {}, projectRoot);
                sendResponse(message.id, result);
              } catch (error) {
                sendError(message.id, -32603, `Resource listing failed: ${error instanceof Error ? error.message : String(error)}`);
              }
              break;

            case 'resources/read':
              try {
                const { uri } = message.params || {};
                const result = await handleResourceCall('read', { uri }, projectRoot);
                sendResponse(message.id, result);
              } catch (error) {
                sendError(message.id, -32603, `Resource read failed: ${error instanceof Error ? error.message : String(error)}`);
              }
              break;

            case 'prompts/list':
              sendResponse(message.id, { prompts: MCP_PROMPTS });
              break;

            case 'prompts/get':
              try {
                const { name, arguments: args } = message.params || {};
                const result = await handlePromptCall(name, args || {}, projectRoot);
                sendResponse(message.id, result);
              } catch (error) {
                sendError(message.id, -32603, `Prompt retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
              }
              break;

            case 'ping':
              // Respond to ping with empty result
              sendResponse(message.id, {});
              break;

            default:
              // Unknown method - send error
              sendError(message.id, -32601, `Method not found: ${message.method}`);
          }
        } catch (error) {
          // Failed to parse JSON or handle message
          if (message && message.id !== undefined) {
            sendError(message.id, -32700, `Parse error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    });

    // Handle stdin errors
    process.stdin.on('error', (error) => {
      // Connection closed - this is expected during normal operation
      if (!isShuttingDown) {
        isShuttingDown = true;
        process.exit(0);
      }
    });

    // Handle stdout errors (connection closed by client)
    process.stdout.on('error', () => {
      isShuttingDown = true;
      process.exit(0);
    });

  } else {
    // HTTP mode
    console.log(chalk.bold('KontextMind MCP Server'));
    console.log(`Starting MCP server at http://127.0.0.1:${port}/mcp\n`);
    console.log(`Mode: ${mode}`);
    console.log(`Transport: ${transport}`);
    console.log(`Project: ${project.name}\n`);
    console.log(chalk.green('MCP server ready. Connect via stdio mode or HTTP endpoint.'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
  }
}