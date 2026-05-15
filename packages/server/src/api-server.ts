// HTTP API Server using built-in Node.js http module
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { URL } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sessionService } from './services/session-service.js';
import { askService } from './services/ask-service.js';
import { datasetService } from './services/dataset-service.js';

const LOG_FILE = '.logs/api-events.log';
const SERVER_VERSION = '0.1.0';

export interface ApiServerConfig {
  host: string;
  port: number;
  mode: 'readonly' | 'chatbot-readonly' | 'suggest' | 'edit-with-approval' | 'full-agent';
}

export interface ApiServerStatus {
  running: boolean;
  version: string;
  host: string;
  port: number;
  mode: string;
  startedAt: string;
}

// Store server instance
let serverInstance: Server | null = null;
let serverStatus: ApiServerStatus | null = null;

// Get project root
function getProjectRoot(): string {
  return process.cwd();
}

// Log API event
async function logApiEvent(
  projectRoot: string,
  event: {
    timestamp: string;
    endpoint: string;
    method: string;
    status: number;
    latency_ms: number;
    mode: string;
  }
): Promise<void> {
  const logLine = `[${event.timestamp}] ${event.method} ${event.endpoint} ${event.status} ${event.latency_ms}ms mode=${event.mode}\n`;

  try {
    const dirPath = join(projectRoot, '.logs');
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    const logPath = join(projectRoot, LOG_FILE);
    if (existsSync(logPath)) {
      const existing = readFileSync(logPath, 'utf-8');
      writeFileSync(logPath, existing + logLine, 'utf-8');
    } else {
      writeFileSync(logPath, logLine, 'utf-8');
    }
  } catch {
    // Silently ignore logging errors
  }
}

// Parse JSON body from request
async function parseBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
  });
}

// Send JSON response
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

// Helper to load project config
function loadProjectConfig(projectRoot: string): { project?: { name?: string }; mode?: string; phase?: number } {
  const configPath = join(projectRoot, '.kontextmind', 'config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch { /* ignore */ }
  }
  return {};
}

// Route: GET /health
async function handleHealth(res: ServerResponse): Promise<void> {
  sendJson(res, 200, {
    ok: true,
    service: 'kontextmind',
    phase: 6,
    version: SERVER_VERSION,
  });
}

// Route: GET /status
async function handleStatus(res: ServerResponse): Promise<void> {
  const projectRoot = getProjectRoot();
  const config = loadProjectConfig(projectRoot);
  const configPath = join(projectRoot, '.kontextmind', 'config.json');

  const output: { initialized: boolean; errors: string[]; serverMode?: string; project?: string; mode?: string; phase?: number; server?: object } = {
    initialized: existsSync(configPath),
    errors: [],
    serverMode: serverStatus?.mode,
  };

  if (output.initialized) {
    output.project = config.project?.name;
    output.mode = config.mode;
    output.phase = config.phase;

    if (serverStatus) {
      output.server = {
        running: serverStatus.running,
        host: serverStatus.host,
        port: serverStatus.port,
        startedAt: serverStatus.startedAt,
      };
    }
  }

  sendJson(res, 200, output);
}

// Route: POST /ask (with optional session support)
async function handleAsk(res: ServerResponse, body: Record<string, unknown> | null): Promise<void> {
  const projectRoot = getProjectRoot();

  if (!body || typeof body.question !== 'string') {
    sendJson(res, 400, { error: 'question is required' });
    return;
  }

  const { question, sessionId, mode } = body;

  try {
    // If sessionId provided, use session-aware ask
    if (sessionId && typeof sessionId === 'string') {
      const result = await sessionService.askWithSession(
        projectRoot.split(/[\\/]/).pop() || 'project',
        question as string,
        sessionId,
        (mode as string) || 'chatbot-readonly'
      );
      sendJson(res, 200, result);
      return;
    }

    // Otherwise, use regular ask
    const result = await askService.ask(
      projectRoot.split(/[\\/]/).pop() || 'project',
      question as string,
      (mode as string) || 'chatbot-readonly'
    );
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Ask error:', error);
    sendJson(res, 500, { error: 'Failed to process question', message: error instanceof Error ? error.message : String(error) });
  }
}

// Route: POST /sessions - Create a new session
async function handleCreateSession(res: ServerResponse, body: Record<string, unknown> | null): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  if (!body || !body.projectName) {
    sendJson(res, 400, { error: 'projectName is required' });
    return;
  }

  try {
    const result = await sessionService.createSession(projectName, body as { projectName?: string });
    sendJson(res, 201, result);
  } catch (error) {
    console.error('Create session error:', error);
    sendJson(res, 500, { error: 'Failed to create session', message: error instanceof Error ? error.message : String(error) });
  }
}

// Route: GET /sessions - List all sessions for current project
async function handleListSessions(res: ServerResponse): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await sessionService.listSessions(projectName);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('List sessions error:', error);
    sendJson(res, 500, { error: 'Failed to list sessions', message: error instanceof Error ? error.message : String(error) });
  }
}

// Route: GET /sessions/:sessionId - Get a specific session
async function handleGetSession(res: ServerResponse, sessionId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await sessionService.getSession(projectName, sessionId);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Get session error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found')) {
      sendJson(res, 404, { error: 'Session not found' });
    } else {
      sendJson(res, 500, { error: 'Failed to get session', message });
    }
  }
}

// Route: DELETE /sessions/:sessionId - Delete a session
async function handleDeleteSession(res: ServerResponse, sessionId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await sessionService.deleteSession(projectName, sessionId);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Delete session error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found')) {
      sendJson(res, 404, { error: 'Session not found' });
    } else {
      sendJson(res, 500, { error: 'Failed to delete session', message });
    }
  }
}

// Route: GET /sessions/:sessionId/context - Get conversation context
async function handleGetSessionContext(res: ServerResponse, sessionId: string, query: URLSearchParams): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';
  const maxTurns = query.get('maxTurns') ? parseInt(query.get('maxTurns')!) : undefined;

  try {
    const result = await sessionService.getContext(projectName, sessionId, maxTurns);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Get session context error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found')) {
      sendJson(res, 404, { error: 'Session not found' });
    } else {
      sendJson(res, 500, { error: 'Failed to get context', message });
    }
  }
}

// Route: GET /graph
async function handleGraph(res: ServerResponse): Promise<void> {
  const projectRoot = getProjectRoot();
  const graphPath = join(projectRoot, '.kg', 'graph.json');

  if (!existsSync(graphPath)) {
    sendJson(res, 404, { error: 'Knowledge graph not available. Run "kontextmind index" first.' });
    return;
  }

  try {
    const content = readFileSync(graphPath, 'utf-8');
    const graph = JSON.parse(content);

    sendJson(res, 200, {
      nodes: graph.nodes?.length || 0,
      edges: graph.edges?.length || 0,
      nodes_by_type: {
        file: graph.nodes?.filter((n: { type: string }) => n.type === 'file').length || 0,
        symbol: graph.nodes?.filter((n: { type: string }) => n.type === 'symbol').length || 0,
        dependency: graph.nodes?.filter((n: { type: string }) => n.type === 'dependency').length || 0,
      },
    });
  } catch (e) {
    sendJson(res, 500, { error: 'Failed to read graph' });
  }
}

// Route: GET /file-summary?path=...
async function handleFileSummary(res: ServerResponse, query: URLSearchParams): Promise<void> {
  const projectRoot = getProjectRoot();
  const path = query.get('path');

  if (!path) {
    sendJson(res, 400, { error: 'path query parameter is required' });
    return;
  }

  sendJson(res, 200, {
    filePath: path,
    purpose: 'Summary not available. Run "kontextmind summarize" first.',
    status: 'missing',
    note: 'Full summary requires @kontextmind/core'
  });
}

// Route: GET /symbol?name=...
async function handleSymbol(res: ServerResponse, query: URLSearchParams): Promise<void> {
  const name = query.get('name');

  if (!name) {
    sendJson(res, 400, { error: 'name query parameter is required' });
    return;
  }

  sendJson(res, 200, {
    name,
    note: 'Full symbol search requires @kontextmind/core. Run "kontextmind index" first.'
  });
}

// Route: POST /kb/build
async function handleKbBuild(res: ServerResponse, body: Record<string, unknown> | null): Promise<void> {
  sendJson(res, 200, {
    success: true,
    filesCreated: [],
    note: 'Full KB build requires @kontextmind/core. Use CLI: kontextmind kb build'
  });
}

// Route: GET /audit
async function handleAudit(res: ServerResponse): Promise<void> {
  const projectRoot = getProjectRoot();

  const audit = {
    project: {
      initialized: existsSync(join(projectRoot, '.kontextmind', 'config.json')),
      root: projectRoot,
    },
    logs: {
      apiEventsLog: existsSync(join(projectRoot, LOG_FILE)),
      summaryLog: existsSync(join(projectRoot, '.logs', 'summary-generation.log')),
      qnaLog: existsSync(join(projectRoot, '.logs', 'qna-events.log')),
    },
    server: serverStatus,
    timestamp: new Date().toISOString(),
  };

  sendJson(res, 200, audit);
}

// Route: POST /dataset/export - Export dataset
async function handleDatasetExport(res: ServerResponse, body: Record<string, unknown> | null): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  if (!body) {
    sendJson(res, 400, { error: 'Request body is required' });
    return;
  }

  try {
    const options: {
      format?: string;
      minConfidence?: number;
      includeCodeRequests?: boolean;
      apiOnly?: boolean;
      since?: string;
      outputPath?: string;
    } = {
      format: body.format as string || 'jsonl',
      minConfidence: body.minConfidence as number | undefined,
      includeCodeRequests: body.includeCodeRequests as boolean | undefined,
      apiOnly: body.apiOnly as boolean | undefined,
      since: body.since as string | undefined,
      outputPath: body.outputPath as string | undefined,
    };

    const result = await datasetService.exportDataset(projectName, options as any);
    sendJson(res, 200, {
      success: true,
      path: result.path,
      recordCount: result.recordCount,
      version: result.version,
    });
  } catch (error) {
    console.error('Dataset export error:', error);
    sendJson(res, 500, { error: 'Failed to export dataset', message: error instanceof Error ? error.message : String(error) });
  }
}

// Route: GET /dataset/stats - Get dataset statistics
async function handleDatasetStats(res: ServerResponse): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const stats = await datasetService.getStats(projectName);
    sendJson(res, 200, stats);
  } catch (error) {
    console.error('Dataset stats error:', error);
    sendJson(res, 500, { error: 'Failed to get stats', message: error instanceof Error ? error.message : String(error) });
  }
}

// Route: GET /dataset/versions - List dataset versions
async function handleDatasetVersions(res: ServerResponse): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await datasetService.getVersionHistory(projectName);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Dataset versions error:', error);
    sendJson(res, 500, { error: 'Failed to list versions', message: error instanceof Error ? error.message : String(error) });
  }
}

// Main request handler
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startTime = Date.now();
  const projectRoot = getProjectRoot();

  // Parse URL
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  // CORS check
  const origin = req.headers.origin;
  if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'CORS not allowed' }));
    return;
  }

  // Parse body for POST requests
  const body = method === 'POST' ? await parseBody(req) : null;

  // Route handling
  let status = 200;

  // Extract path segments for session routes
  const pathParts = pathname.split('/').filter(Boolean);
  const basePath = pathParts[0] || '';

  try {
    if (pathname === '/health' && method === 'GET') {
      await handleHealth(res);
    } else if (pathname === '/health/live' && method === 'GET') {
      // Health check for liveness - same as /health
      await handleHealth(res);
    } else if (pathname === '/health/ready' && method === 'GET') {
      // Health check for readiness - same as /health
      await handleHealth(res);
    } else if (pathname === '/status' && method === 'GET') {
      await handleStatus(res);
    } else if (pathname === '/ask' && method === 'POST') {
      await handleAsk(res, body);
    } else if (pathname === '/sessions' && method === 'POST') {
      await handleCreateSession(res, body);
    } else if (pathname === '/sessions' && method === 'GET') {
      await handleListSessions(res);
    } else if (pathParts[0] === 'sessions' && pathParts.length === 2 && method === 'GET') {
      // GET /sessions/:sessionId
      await handleGetSession(res, pathParts[1]);
    } else if (pathParts[0] === 'sessions' && pathParts.length === 2 && method === 'DELETE') {
      // DELETE /sessions/:sessionId
      await handleDeleteSession(res, pathParts[1]);
    } else if (pathParts[0] === 'sessions' && pathParts.length === 3 && pathParts[2] === 'context' && method === 'GET') {
      // GET /sessions/:sessionId/context
      await handleGetSessionContext(res, pathParts[1], url.searchParams);
    } else if (pathname === '/graph' && method === 'GET') {
      await handleGraph(res);
    } else if (pathname === '/file-summary' && method === 'GET') {
      await handleFileSummary(res, url.searchParams);
    } else if (pathname === '/symbol' && method === 'GET') {
      await handleSymbol(res, url.searchParams);
    } else if (pathname === '/kb/build' && method === 'POST') {
      await handleKbBuild(res, body);
    } else if (pathname === '/audit' && method === 'GET') {
      await handleAudit(res);
    } else if (pathParts[0] === 'dataset' && pathParts.length === 2 && method === 'POST') {
      // POST /dataset/export
      await handleDatasetExport(res, body);
    } else if (pathParts[0] === 'dataset' && pathParts.length === 2 && method === 'GET') {
      // GET /dataset/stats
      await handleDatasetStats(res);
    } else if (pathParts[0] === 'dataset' && pathParts[1] === 'versions' && method === 'GET') {
      // GET /dataset/versions
      await handleDatasetVersions(res);
    } else {
      status = 404;
      sendJson(res, 404, { error: 'Not found', path: pathname });
      return;
    }
  } catch (e) {
    status = 500;
    sendJson(res, 500, { error: 'Internal server error', message: e instanceof Error ? e.message : 'Unknown error' });
    return;
  }

  // Log event
  const latencyMs = Date.now() - startTime;
  await logApiEvent(projectRoot, {
    timestamp: new Date().toISOString(),
    endpoint: pathname,
    method,
    status,
    latency_ms: latencyMs,
    mode: serverStatus?.mode || 'unknown',
  });
}

// Start server
export async function startApiServer(config: ApiServerConfig): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(config.port, config.host, () => {
      serverStatus = {
        running: true,
        version: SERVER_VERSION,
        host: config.host,
        port: config.port,
        mode: config.mode,
        startedAt: new Date().toISOString(),
      };

      serverInstance = server;
      console.log(`KontextMind API server running at http://${config.host}:${config.port}`);
      resolve(server);
    });
  });
}

// Stop server
export async function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        serverInstance = null;
        serverStatus = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Get server status
export function getApiServerStatus(): ApiServerStatus | null {
  return serverStatus;
}

// Check if server is running
export function isServerRunning(): boolean {
  return serverInstance !== null;
}
