import { OptionValues } from 'commander';
import chalk from 'chalk';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  MCP_VERSION,
  type MCPMode,
  setMCPServerStatus,
  handleToolCall,
  handleResourceCall,
  handlePromptCall,
} from '@kontextmind/mcp';
import { detectProject } from '@kontextmind/core';

let isShuttingDown = false;

const UNINITIALIZED_TOOL_ALLOWLIST = new Set([
  'project.status',
  'project.check_provider',
]);

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
  const mode = (options.mode as MCPMode) || 'readonly';

  const isProjectInitialized = (): boolean => detectProject(projectRoot).initialized;

  const uninitializedError = (id: unknown): Record<string, unknown> => ({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'KontextMind is not initialized. Run: kontextmind init' },
    id,
  });

  const requiresInitializedProject = (method: string, params?: Record<string, unknown>): boolean => {
    if (method === 'tools/call') {
      const toolName = params?.name;
      return typeof toolName !== 'string' || !UNINITIALIZED_TOOL_ALLOWLIST.has(toolName);
    }

    return method === 'resources/read' || method === 'prompts/get';
  };

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

        const params = message.params as Record<string, unknown> | undefined;
        if (requiresInitializedProject(method, params) && !isProjectInitialized()) {
          safeWrite(JSON.stringify(uninitializedError(message.id)) + '\n');
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
                  capabilities: {
                    tools: { listChanged: true },
                    resources: { listChanged: true },
                    prompts: { listChanged: true },
                  },
                  serverInfo: { name: 'kontextmind', version: MCP_VERSION },
                },
                id: message.id,
              }) + '\n');
              break;

            case 'notifications/initialized':
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
              const result = await handleToolCall(name as string, (args || {}) as Record<string, unknown>, projectRoot, mode);
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result,
                id: message.id,
              }) + '\n');
              break;
            }

            case 'resources/list': {
              safeWrite(JSON.stringify({
                jsonrpc: '2.0',
                result: { resources: MCP_RESOURCES },
                id: message.id,
              }) + '\n');
              break;
            }

            case 'resources/read': {
              const params = message.params as Record<string, unknown> || {};
              const uri = params.uri;
              if (typeof uri !== 'string') {
                safeWrite(JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32602, message: 'resources/read requires params.uri' },
                  id: message.id,
                }) + '\n');
                break;
              }
              const result = await handleResourceCall(uri, {}, projectRoot);
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
    const port = parseInt(String(options.port || '7332'), 10);
    const host = '127.0.0.1';

    const readBody = (request: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', chunk => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          reject(new Error('Request body too large'));
          request.destroy();
        }
      });
      request.on('end', () => resolve(body));
      request.on('error', reject);
    });

    const sendJson = (response: ServerResponse, statusCode: number, payload: unknown): void => {
      response.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify(payload));
    };

    const handleJsonRpc = async (message: Record<string, unknown>): Promise<Record<string, unknown> | undefined> => {
      const method = message.method as string;
      if (!method) {
        return { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: message.id ?? null };
      }

      const params = message.params as Record<string, unknown> | undefined;
      if (requiresInitializedProject(method, params) && !isProjectInitialized()) {
        return uninitializedError(message.id);
      }

      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: true },
                resources: { listChanged: true },
                prompts: { listChanged: true },
              },
              serverInfo: { name: 'kontextmind', version: MCP_VERSION },
            },
            id: message.id,
          };
        case 'notifications/initialized':
          return undefined;
        case 'ping':
          return { jsonrpc: '2.0', result: {}, id: message.id };
        case 'tools/list':
          return { jsonrpc: '2.0', result: { tools: MCP_TOOLS }, id: message.id };
        case 'tools/call': {
          const params = message.params as Record<string, unknown> || {};
          const result = await handleToolCall(params.name as string, (params.arguments || {}) as Record<string, unknown>, projectRoot, mode);
          return { jsonrpc: '2.0', result, id: message.id };
        }
        case 'resources/list':
          return { jsonrpc: '2.0', result: { resources: MCP_RESOURCES }, id: message.id };
        case 'resources/read': {
          const params = message.params as Record<string, unknown> || {};
          if (typeof params.uri !== 'string') {
            return { jsonrpc: '2.0', error: { code: -32602, message: 'resources/read requires params.uri' }, id: message.id };
          }
          const result = await handleResourceCall(params.uri, {}, projectRoot);
          return { jsonrpc: '2.0', result, id: message.id };
        }
        case 'prompts/list':
          return { jsonrpc: '2.0', result: { prompts: MCP_PROMPTS }, id: message.id };
        case 'prompts/get': {
          const params = message.params as Record<string, unknown> || {};
          const result = await handlePromptCall(params.name as string, (params.arguments || {}) as Record<string, unknown>, projectRoot);
          return { jsonrpc: '2.0', result, id: message.id };
        }
        default:
          return { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${method}` }, id: message.id };
      }
    };

    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url || '/', `http://${host}:${port}`);

        if (request.method === 'GET' && url.pathname === '/health') {
          sendJson(response, 200, {
            ok: true,
            service: 'kontextmind-mcp',
            version: MCP_VERSION,
            mode,
            transport,
            initialized: isProjectInitialized(),
          });
          return;
        }

        if (url.pathname !== '/mcp') {
          sendJson(response, 404, { error: 'Not found' });
          return;
        }

        if (request.method === 'GET') {
          sendJson(response, 200, {
            name: 'kontextmind',
            version: MCP_VERSION,
            endpoint: '/mcp',
            transport: 'http',
          });
          return;
        }

        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed' });
          return;
        }

        const body = await readBody(request);
        const parsed = JSON.parse(body || '{}') as Record<string, unknown> | Record<string, unknown>[];
        const messages = Array.isArray(parsed) ? parsed : [parsed];
        const results = [];

        for (const message of messages) {
          const result = await handleJsonRpc(message);
          if (result) {
            results.push(result);
          }
        }

        if (Array.isArray(parsed)) {
          sendJson(response, 200, results);
        } else if (results[0]) {
          sendJson(response, 200, results[0]);
        } else {
          response.writeHead(202, { 'cache-control': 'no-store' });
          response.end();
        }
      } catch (error) {
        sendJson(response, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
          id: null,
        });
      }
    });

    server.listen(port, host, () => {
      console.log(chalk.bold('KontextMind MCP Server'));
      console.log(`MCP HTTP endpoint: http://${host}:${port}/mcp`);
      console.log(`Health endpoint: http://${host}:${port}/health\n`);
      console.log(`Mode: ${mode}`);
      console.log(`Project: ${project.name}\n`);
      console.log(chalk.green('MCP HTTP server ready.'));
      console.log(chalk.gray('Press Ctrl+C to stop'));
    });
  }
}
