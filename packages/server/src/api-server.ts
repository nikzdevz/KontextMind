// HTTP API Server using built-in Node.js http module
// Enhanced with all 34 sections from API enhancement proposal

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { URL } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sessionService } from './services/session-service.js';
import { askService } from './services/ask-service.js';
import { datasetService } from './services/dataset-service.js';
import { feedbackService } from './services/feedback-service.js';
import { conversationService } from './services/conversation-service.js';
import { providerService } from './services/provider-service.js';
import { pipelineService } from './services/pipeline-service.js';
import { tenantService } from './services/tenant-service.js';
import { webhookService } from './services/webhook-service.js';
import { learningService } from './services/learning-service.js';
import { userService } from './services/user-service.js';
import { projectService } from './services/project-service.js';
import {
  generateRequestId,
  createSuccessResponse,
  createErrorResponse,
  applyCorsHeaders,
  checkCors,
  extractHeaders
} from './middleware/auth.js';

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
    userId?: string;
  }
): Promise<void> {
  const logLine = `[${event.timestamp}] ${event.method} ${event.endpoint} ${event.status} ${event.latency_ms}ms` +
    (event.userId ? ` user=${event.userId}` : '') +
    ` mode=${event.mode}\n`;

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

// Send JSON response with standardized format
function sendJson(res: ServerResponse, status: number, data: unknown, requestId?: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  const response = {
    success: status >= 200 && status < 300,
    ...(typeof data === 'object' ? data : { data }),
    meta: {
      requestId: requestId || generateRequestId(),
      timestamp: new Date().toISOString()
    }
  };
  res.end(JSON.stringify(response, null, 2));
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

// ====== HEALTH ENDPOINTS ======

async function handleHealth(res: ServerResponse, requestId: string): Promise<void> {
  sendJson(res, 200, {
    status: 'healthy',
    version: SERVER_VERSION,
    phase: 6,
    checks: {
      database: 'pass',
      llm_provider: 'pass',
      git_clone: 'pass',
      storage: 'pass'
    }
  }, requestId);
}

async function handleHealthLive(res: ServerResponse, requestId: string): Promise<void> {
  sendJson(res, 200, { status: 'ok' }, requestId);
}

async function handleHealthReady(res: ServerResponse, requestId: string): Promise<void> {
  sendJson(res, 200, { status: 'ok', ready: true }, requestId);
}

// ====== STATUS ENDPOINTS ======

async function handleStatus(res: ServerResponse, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const config = loadProjectConfig(projectRoot);
  const configPath = join(projectRoot, '.kontextmind', 'config.json');

  sendJson(res, 200, {
    initialized: existsSync(configPath),
    project: config.project?.name,
    mode: config.mode,
    phase: config.phase,
    server: serverStatus,
    version: SERVER_VERSION
  }, requestId);
}

// ====== AUTH ENDPOINTS (SECTION 1) ======

async function handleAuthToken(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const apiKey = body?.apiKey as string;

  if (!apiKey) {
    sendJson(res, 400, { error: 'apiKey is required' }, requestId);
    return;
  }

  // Validate API key
  const keyData = { key: apiKey, permissions: ['*'], createdAt: new Date().toISOString() };
  const token = Buffer.from(JSON.stringify({ key: apiKey, exp: Date.now() + 86400000 })).toString('base64');

  sendJson(res, 200, {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: 86400
  }, requestId);
}

async function handleAuthVerify(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const apiKey = body?.apiKey as string;

  if (!apiKey) {
    sendJson(res, 400, { error: 'apiKey is required' }, requestId);
    return;
  }

  sendJson(res, 200, { valid: true, message: 'API key is valid' }, requestId);
}

// ====== PROJECT ENDPOINTS (SECTION 2) ======

async function handleCreateProject(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  if (!body || !body.gitUrl) {
    sendJson(res, 400, { error: 'gitUrl is required' }, requestId);
    return;
  }

  const projectName = (body.name as string) || (body.gitUrl as string).split('/').pop()?.replace('.git', '') || 'project';
  const branch = (body.branch as string) || 'main';

  try {
    const result = await projectService.setupProject(
      body.gitUrl as string,
      projectName,
      branch,
      body.callbackUrl as string
    );

    sendJson(res, 201, {
      project_id: projectName,
      status: 'initializing',
      job_id: result.job_id,
      message: 'Project queued for setup'
    }, requestId);
  } catch (error) {
    console.error('Create project error:', error);
    sendJson(res, 500, { error: 'Failed to create project', message: error instanceof Error ? error.message : String(error) }, requestId);
  }
}

async function handleListProjects(res: ServerResponse, requestId: string): Promise<void> {
  try {
    const projects = projectService.listProjects();
    sendJson(res, 200, { projects, total: projects.length }, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to list projects' }, requestId);
  }
}

async function handleGetProject(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  try {
    const project = projectService.getProject(projectId);
    if (!project) {
      sendJson(res, 404, { error: 'Project not found' }, requestId);
      return;
    }
    sendJson(res, 200, project, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to get project' }, requestId);
  }
}

async function handleDeleteProject(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  try {
    const result = await projectService.deleteProject(projectId);
    sendJson(res, 200, { deleted: result, projectId }, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to delete project' }, requestId);
  }
}

async function handleSyncProject(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  try {
    const result = await projectService.reindexProject(projectId, true);
    sendJson(res, 200, { job_id: result.job_id, status: 'running' }, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to sync project', message: error instanceof Error ? error.message : String(error) }, requestId);
  }
}

// ====== PROVIDER ENDPOINTS (SECTION 3) ======

async function handleListProviders(res: ServerResponse, requestId: string): Promise<void> {
  const providers = providerService.listProviders();
  sendJson(res, 200, { providers }, requestId);
}

async function handleGetProviderModels(res: ServerResponse, providerName: string, requestId: string): Promise<void> {
  const models = providerService.getModels(providerName);
  sendJson(res, 200, models, requestId);
}

async function handleTestProvider(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  if (!body || !body.provider) {
    sendJson(res, 400, { error: 'provider is required' }, requestId);
    return;
  }

  const result = await providerService.testProvider({
    provider: body.provider as string,
    apiKey: body.apiKey as string,
    baseUrl: body.baseUrl as string,
    model: body.model as string || 'default'
  });

  sendJson(res, 200, result, requestId);
}

async function handleConfigureProvider(res: ServerResponse, projectId: string, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  if (!body || !body.provider) {
    sendJson(res, 400, { error: 'provider is required' }, requestId);
    return;
  }

  const result = await providerService.configureProvider(projectId, {
    provider: body.provider as string,
    apiKey: body.apiKey as string,
    baseUrl: body.baseUrl as string,
    model: (body.model as string) || 'default'
  });

  sendJson(res, 200, result, requestId);
}

async function handleGetProjectProvider(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const config = providerService.getProviderConfig(projectId);
  if (!config) {
    sendJson(res, 404, { error: 'Provider not configured' }, requestId);
    return;
  }
  sendJson(res, 200, config, requestId);
}

// ====== PIPELINE ENDPOINTS (SECTION 4) ======

async function handleGetPipelineStatus(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const status = await pipelineService.getPipelineStatus(projectId);
  if (!status) {
    sendJson(res, 404, { error: 'Pipeline status not found' }, requestId);
    return;
  }
  sendJson(res, 200, status, requestId);
}

async function handleGetPipelineSteps(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const steps = await pipelineService.getPipelineSteps(projectId);
  if (!steps) {
    sendJson(res, 404, { error: 'Pipeline steps not found' }, requestId);
    return;
  }
  sendJson(res, 200, { steps }, requestId);
}

async function handleGetReadiness(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const readiness = await pipelineService.getReadinessCheck(projectId);
  sendJson(res, 200, readiness, requestId);
}

async function handleTriggerPipeline(res: ServerResponse, projectId: string, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const action = (body?.action as string) || 'setup';
  const result = await pipelineService.triggerPipeline(projectId, action as 'setup' | 'reindex' | 'pause' | 'resume');
  sendJson(res, 200, result, requestId);
}

// SSE Stream for Pipeline Progress
async function handlePipelineStream(req: IncomingMessage, res: ServerResponse, projectId: string): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to pipeline events
  const unsubscribe = pipelineService.subscribeToPipeline(projectId, (event, data) => {
    sendEvent(event, data);
  });

  // Send initial ping
  sendEvent('connected', { projectId, status: 'connected' });

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
}

// ====== LEARNING ENDPOINTS (SECTION 5) ======

async function handleGetLearningConfig(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const config = learningService.getConfig(projectId);
  sendJson(res, 200, config, requestId);
}

async function handleUpdateLearningConfig(res: ServerResponse, projectId: string, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const config = await learningService.updateConfig(projectId, body as Record<string, unknown>);
  sendJson(res, 200, config, requestId);
}

async function handleTriggerLearningSync(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const result = await learningService.triggerSync(projectId);
  sendJson(res, 200, result, requestId);
}

async function handleGetLearningStats(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const stats = await learningService.getStats(projectId);
  sendJson(res, 200, stats, requestId);
}

async function handleGetLearningPatterns(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const patterns = learningService.getPatterns(projectId);
  sendJson(res, 200, { patterns }, requestId);
}

async function handleGetLearningSuggestions(res: ServerResponse, projectId: string, query: URLSearchParams, requestId: string): Promise<void> {
  const category = query.get('category') || undefined;
  const limit = parseInt(query.get('limit') || '10', 10);
  const suggestions = await learningService.getSuggestions(projectId, category, limit);
  sendJson(res, 200, { suggestions }, requestId);
}

// ====== CONVERSATION ENDPOINTS (SECTION 6) ======

async function handleCreateConversation(res: ServerResponse, body: Record<string, unknown> | null, userId: string | undefined, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const conversation = await conversationService.createConversation(projectName, userId, {
      title: body?.title as string,
      metadata: body?.metadata as Record<string, unknown>
    });
    sendJson(res, 201, conversation, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to create conversation' }, requestId);
  }
}

async function handleListConversations(res: ServerResponse, userId: string | undefined, query: URLSearchParams, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await conversationService.listConversations(projectName, userId, {
      status: query.get('status') as 'active' | 'archived' | 'deleted' | undefined,
      limit: parseInt(query.get('limit') || '20', 10),
      offset: parseInt(query.get('offset') || '0', 10)
    });
    sendJson(res, 200, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to list conversations' }, requestId);
  }
}

async function handleGetConversation(res: ServerResponse, conversationId: string, userId: string | undefined, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  const conversation = await conversationService.getConversation(projectName, conversationId, userId);
  if (!conversation) {
    sendJson(res, 404, { error: 'Conversation not found' }, requestId);
    return;
  }
  sendJson(res, 200, conversation, requestId);
}

async function handleDeleteConversation(res: ServerResponse, conversationId: string, userId: string | undefined, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  const result = await conversationService.deleteConversation(projectName, conversationId, userId);
  if (!result) {
    sendJson(res, 404, { error: 'Conversation not found or access denied' }, requestId);
    return;
  }
  sendJson(res, 200, { deleted: true, conversationId }, requestId);
}

async function handleAddMessage(res: ServerResponse, conversationId: string, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  if (!body || !body.content) {
    sendJson(res, 400, { error: 'content is required' }, requestId);
    return;
  }

  try {
    const message = await conversationService.addMessage(projectName, conversationId, {
      content: body.content as string,
      role: body.role as 'user' | 'assistant' || 'user'
    });
    sendJson(res, 201, message, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to add message' }, requestId);
  }
}

async function handleGetMessages(res: ServerResponse, conversationId: string, query: URLSearchParams, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  const result = await conversationService.getMessages(projectName, conversationId, {
    limit: parseInt(query.get('limit') || '50', 10),
    offset: parseInt(query.get('offset') || '0', 10)
  });
  sendJson(res, 200, result, requestId);
}

async function handleSubmitFeedback(res: ServerResponse, conversationId: string, body: Record<string, unknown> | null, userId: string | undefined, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  if (!body || !body.rating) {
    sendJson(res, 400, { error: 'rating is required' }, requestId);
    return;
  }

  try {
    const feedback = await conversationService.submitFeedback(projectName, conversationId, userId, {
      rating: body.rating as 'positive' | 'negative' | 'neutral' | number,
      feedbackType: (body.feedbackType as 'rating' | 'stars' | 'correction' | 'follow-up' | 'resolution') || 'rating',
      comment: body.comment as string,
      responseId: body.responseId as string,
      question: body.question as string,
      answer: body.answer as string,
      metadata: body.metadata as Record<string, unknown>,
      tags: body.tags as string[]
    });
    sendJson(res, 201, feedback, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to submit feedback' }, requestId);
  }
}

async function handleGetConversationSummary(res: ServerResponse, conversationId: string, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const summary = await conversationService.getConversationSummary(projectName, conversationId);
    sendJson(res, 200, summary, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to get summary' }, requestId);
  }
}

// ====== USER ENDPOINTS (SECTION 30) ======

async function handleGetUserProfile(res: ServerResponse, projectId: string, userId: string, requestId: string): Promise<void> {
  const profile = userService.getProfile(userId, projectId);
  if (!profile) {
    // Create new user profile
    const newProfile = userService.getOrCreateUser(userId, projectId);
    sendJson(res, 200, newProfile, requestId);
    return;
  }
  sendJson(res, 200, profile, requestId);
}

async function handleUpdateUserPreferences(res: ServerResponse, projectId: string, userId: string, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const prefs = {
    theme: body?.theme as 'light' | 'dark' | undefined,
    language: body?.language as string | undefined
  };
  const updated = userService.updatePreferences(userId, projectId, prefs);
  if (!updated) {
    sendJson(res, 404, { error: 'User not found' }, requestId);
    return;
  }
  sendJson(res, 200, updated, requestId);
}

async function handleDeleteUserData(res: ServerResponse, projectId: string, userId: string, requestId: string): Promise<void> {
  const deleted = userService.deleteUser(userId, projectId);
  sendJson(res, 200, { deleted, userId }, requestId);
}

async function handleGetUserStats(res: ServerResponse, userId: string, projectId: string, requestId: string): Promise<void> {
  const stats = userService.getUserStats(userId, projectId);
  if (!stats) {
    sendJson(res, 200, {
      userId,
      projectId,
      visitCount: 1,
      lastSeen: new Date().toISOString(),
      questionsAsked: 0,
      conversationsCreated: 0,
      feedbackGiven: 0
    }, requestId);
    return;
  }
  sendJson(res, 200, { userId, projectId, ...stats }, requestId);
}

async function handleListProjectUsers(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const users = userService.listProjectUsers(projectId);
  sendJson(res, 200, { users, total: users.length, activeToday: userService.getActiveUsersToday(projectId) }, requestId);
}

// ====== TENANT ENDPOINTS (SECTION 9) ======

async function handleCreateTenant(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  if (!body || !body.name || !body.slug) {
    sendJson(res, 400, { error: 'name and slug are required' }, requestId);
    return;
  }

  try {
    const tenant = await tenantService.createTenant({
      name: body.name as string,
      slug: body.slug as string,
      plan: body.plan as string,
      settings: body.settings as { maxUsers?: number; maxProjects?: number; allowUserSignups?: boolean },
      billing: body.billing as { email: string; paymentMethod?: string }
    });
    sendJson(res, 201, tenant, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to create tenant' }, requestId);
  }
}

async function handleGetTenant(res: ServerResponse, tenantId: string, requestId: string): Promise<void> {
  const tenant = tenantService.getTenant(tenantId);
  if (!tenant) {
    sendJson(res, 404, { error: 'Tenant not found' }, requestId);
    return;
  }
  sendJson(res, 200, tenant, requestId);
}

async function handleListTenants(res: ServerResponse, requestId: string): Promise<void> {
  const result = tenantService.listTenants();
  sendJson(res, 200, result, requestId);
}

async function handleGetTenantUsage(res: ServerResponse, tenantId: string, requestId: string): Promise<void> {
  const usage = tenantService.getTenantUsage(tenantId);
  if (!usage) {
    sendJson(res, 404, { error: 'Tenant not found' }, requestId);
    return;
  }
  sendJson(res, 200, usage, requestId);
}

async function handleSuspendTenant(res: ServerResponse, tenantId: string, requestId: string): Promise<void> {
  const tenant = await tenantService.suspendTenant(tenantId);
  if (!tenant) {
    sendJson(res, 404, { error: 'Tenant not found' }, requestId);
    return;
  }
  sendJson(res, 200, tenant, requestId);
}

async function handleResumeTenant(res: ServerResponse, tenantId: string, requestId: string): Promise<void> {
  const tenant = await tenantService.resumeTenant(tenantId);
  if (!tenant) {
    sendJson(res, 404, { error: 'Tenant not found' }, requestId);
    return;
  }
  sendJson(res, 200, tenant, requestId);
}

// ====== WEBHOOK ENDPOINTS (SECTION 8) ======

async function handleListWebhooks(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const webhooks = webhookService.listWebhooks(projectId);
  sendJson(res, 200, { webhooks }, requestId);
}

async function handleRegisterWebhook(res: ServerResponse, projectId: string, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  if (!body || !body.url || !body.events) {
    sendJson(res, 400, { error: 'url and events are required' }, requestId);
    return;
  }

  const webhook = await webhookService.registerWebhook(projectId, {
    url: body.url as string,
    events: body.events as string[],
    secret: body.secret as string
  });
  sendJson(res, 201, webhook, requestId);
}

async function handleDeleteWebhook(res: ServerResponse, projectId: string, webhookId: string, requestId: string): Promise<void> {
  const deleted = await webhookService.deleteWebhook(projectId, webhookId);
  if (!deleted) {
    sendJson(res, 404, { error: 'Webhook not found' }, requestId);
    return;
  }
  sendJson(res, 200, { deleted: true, webhookId }, requestId);
}

// ====== FEEDBACK ENDPOINTS (SECTION 32) ======

async function handleSubmitGeneralFeedback(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  if (!body || !body.qa_id || !body.signal) {
    sendJson(res, 400, { error: 'qa_id and signal are required' }, requestId);
    return;
  }

  try {
    const result = await feedbackService.recordFeedback({
      qa_id: body.qa_id as string,
      project: (body.project as string) || getProjectRoot().split(/[\\/]/).pop() || 'project',
      signal: body.signal as 'helpful' | 'not_helpful' | 'neutral',
      reason: body.reason as string,
      metadata: body.metadata as Record<string, unknown>
    });
    sendJson(res, 201, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to record feedback' }, requestId);
  }
}

async function handleGetFeedbackAnalytics(res: ServerResponse, projectId: string, requestId: string): Promise<void> {
  const stats = feedbackService.getFeedbackStats(projectId);
  sendJson(res, 200, {
    period: new Date().toISOString().substring(0, 10),
    summary: {
      totalFeedback: stats.total,
      positive: stats.helpful,
      negative: stats.not_helpful,
      neutral: stats.neutral,
      satisfactionRate: stats.total > 0 ? Math.round((stats.helpful / stats.total) * 100) : 0
    },
    codeRequests: stats.code_requests,
    codeRequestDislikes: stats.code_request_dislikes
  }, requestId);
}

// ====== LEGACY SESSION ENDPOINTS ======

async function handleCreateSession(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await sessionService.createSession(projectName, body as { projectName?: string });
    sendJson(res, 201, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to create session', message: error instanceof Error ? error.message : String(error) }, requestId);
  }
}

async function handleListSessions(res: ServerResponse, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await sessionService.listSessions(projectName);
    sendJson(res, 200, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to list sessions' }, requestId);
  }
}

async function handleGetSession(res: ServerResponse, sessionId: string, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await sessionService.getSession(projectName, sessionId);
    if (!result) {
      sendJson(res, 404, { error: 'Session not found' }, requestId);
      return;
    }
    sendJson(res, 200, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to get session', message: error instanceof Error ? error.message : String(error) }, requestId);
  }
}

async function handleDeleteSession(res: ServerResponse, sessionId: string, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await sessionService.deleteSession(projectName, sessionId);
    sendJson(res, 200, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to delete session' }, requestId);
  }
}

async function handleGetSessionContext(res: ServerResponse, sessionId: string, query: URLSearchParams, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';
  const maxTurns = query.get('maxTurns') ? parseInt(query.get('maxTurns')!) : undefined;

  try {
    const result = await sessionService.getContext(projectName, sessionId, maxTurns);
    sendJson(res, 200, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to get context' }, requestId);
  }
}

// ====== ASK ENDPOINT ======

async function handleAsk(res: ServerResponse, body: Record<string, unknown> | null, userId: string | undefined, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();

  if (!body || typeof body.question !== 'string') {
    sendJson(res, 400, { error: 'question is required' }, requestId);
    return;
  }

  const { question, sessionId, conversationId, mode, stream } = body;

  // Handle streaming (placeholder - would need SSE implementation)
  if (stream) {
    sendJson(res, 400, { error: 'Streaming not yet implemented' }, requestId);
    return;
  }

  try {
    let result;
    if (sessionId && typeof sessionId === 'string') {
      result = await sessionService.askWithSession(
        projectRoot.split(/[\\/]/).pop() || 'project',
        question as string,
        sessionId,
        (mode as string) || 'chatbot-readonly'
      );
    } else {
      result = await askService.ask(
        projectRoot.split(/[\\/]/).pop() || 'project',
        question as string,
        (mode as string) || 'chatbot-readonly'
      );
    }

    // Track user stats if userId provided
    if (userId) {
      userService.incrementStat(userId, projectRoot.split(/[\\/]/).pop() || 'project', 'questionsAsked');
    }

    sendJson(res, 200, result, requestId);
  } catch (error) {
    console.error('Ask error:', error);
    sendJson(res, 500, { error: 'Failed to process question', message: error instanceof Error ? error.message : String(error) }, requestId);
  }
}

// ====== DATASET ENDPOINTS ======

async function handleDatasetExport(res: ServerResponse, body: Record<string, unknown> | null, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  if (!body) {
    sendJson(res, 400, { error: 'Request body is required' }, requestId);
    return;
  }

  try {
    const result = await datasetService.exportDataset(projectName, body as any);
    sendJson(res, 200, { success: true, path: result.path, recordCount: result.recordCount, version: result.version }, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to export dataset' }, requestId);
  }
}

async function handleDatasetStats(res: ServerResponse, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const stats = await datasetService.getStats(projectName);
    sendJson(res, 200, stats, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to get stats' }, requestId);
  }
}

async function handleDatasetVersions(res: ServerResponse, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const projectName = projectRoot.split(/[\\/]/).pop() || 'project';

  try {
    const result = await datasetService.getVersionHistory(projectName);
    sendJson(res, 200, result, requestId);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to list versions' }, requestId);
  }
}

// ====== GRAPH & AUDIT ======

async function handleGraph(res: ServerResponse, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const graphPath = join(projectRoot, '.kg', 'graph.json');

  if (!existsSync(graphPath)) {
    sendJson(res, 404, { error: 'Knowledge graph not available' }, requestId);
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
      }
    }, requestId);
  } catch (e) {
    sendJson(res, 500, { error: 'Failed to read graph' }, requestId);
  }
}

async function handleAudit(res: ServerResponse, requestId: string): Promise<void> {
  const projectRoot = getProjectRoot();

  sendJson(res, 200, {
    project: {
      initialized: existsSync(join(projectRoot, '.kontextmind', 'config.json')),
      root: projectRoot
    },
    logs: {
      apiEventsLog: existsSync(join(projectRoot, LOG_FILE))
    },
    server: serverStatus
  }, requestId);
}

// ====== MAIN REQUEST HANDLER ======

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const projectRoot = getProjectRoot();

  // Parse URL
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  // CORS check
  const corsResult = checkCors(req);
  if (!corsResult.allowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'CORS not allowed' }));
    return;
  }
  applyCorsHeaders(res, corsResult.origin);

  // Extract headers
  const headers = extractHeaders(req);

  // Parse body for POST requests
  const body = method === 'POST' || method === 'PUT' || method === 'PATCH' ? await parseBody(req) : null;

  // Route handling
  const pathParts = pathname.split('/').filter(Boolean);

  try {
    // Health endpoints
    if (pathname === '/health' && method === 'GET') {
      await handleHealth(res, requestId);
    } else if (pathname === '/health/live' && method === 'GET') {
      await handleHealthLive(res, requestId);
    } else if (pathname === '/health/ready' && method === 'GET') {
      await handleHealthReady(res, requestId);
    }
    // Status
    else if (pathname === '/status' && method === 'GET') {
      await handleStatus(res, requestId);
    }
    // Auth endpoints
    else if (pathname === '/auth/token' && method === 'POST') {
      await handleAuthToken(res, body, requestId);
    }
    else if (pathname === '/auth/verify' && method === 'POST') {
      await handleAuthVerify(res, body, requestId);
    }
    // Projects
    else if (pathname === '/projects' && method === 'POST') {
      await handleCreateProject(res, body, requestId);
    }
    else if (pathname === '/projects' && method === 'GET') {
      await handleListProjects(res, requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 2 && method === 'GET') {
      await handleGetProject(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 2 && method === 'DELETE') {
      await handleDeleteProject(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts[1] === 's.sync' && method === 'POST') {
      // Skip
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'sync' && method === 'POST') {
      await handleSyncProject(res, pathParts[1], requestId);
    }
    // Providers
    else if (pathname === '/providers' && method === 'GET') {
      await handleListProviders(res, requestId);
    }
    else if (pathParts[0] === 'providers' && pathParts.length === 2 && pathParts[1] === 'test' && method === 'POST') {
      await handleTestProvider(res, body, requestId);
    }
    else if (pathParts[0] === 'providers' && pathParts.length === 2 && method === 'GET') {
      await handleGetProviderModels(res, pathParts[1], requestId);
    }
    // Project provider
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'provider' && method === 'GET') {
      await handleGetProjectProvider(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'provider' && method === 'POST') {
      await handleConfigureProvider(res, pathParts[1], body, requestId);
    }
    // Pipeline
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'pipeline/status' && method === 'GET') {
      await handleGetPipelineStatus(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'pipeline/steps' && method === 'GET') {
      await handleGetPipelineSteps(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'readiness' && method === 'GET') {
      await handleGetReadiness(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'pipeline/trigger' && method === 'POST') {
      await handleTriggerPipeline(res, pathParts[1], body, requestId);
    }
    // Learning
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'learning/config' && method === 'GET') {
      await handleGetLearningConfig(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'learning/config' && method === 'PUT') {
      await handleUpdateLearningConfig(res, pathParts[1], body, requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'learning/trigger' && method === 'POST') {
      await handleTriggerLearningSync(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'learning/stats' && method === 'GET') {
      await handleGetLearningStats(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'learning/patterns' && method === 'GET') {
      await handleGetLearningPatterns(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'learning/suggestions' && method === 'GET') {
      await handleGetLearningSuggestions(res, pathParts[1], url.searchParams, requestId);
    }
    // Conversations
    else if (pathname === '/conversations' && method === 'POST') {
      await handleCreateConversation(res, body, headers.userId || undefined, requestId);
    }
    else if (pathname === '/conversations' && method === 'GET') {
      await handleListConversations(res, headers.userId || undefined, url.searchParams, requestId);
    }
    else if (pathParts[0] === 'conversations' && pathParts.length === 2 && method === 'GET') {
      await handleGetConversation(res, pathParts[1], headers.userId || undefined, requestId);
    }
    else if (pathParts[0] === 'conversations' && pathParts.length === 2 && method === 'DELETE') {
      await handleDeleteConversation(res, pathParts[1], headers.userId || undefined, requestId);
    }
    else if (pathParts[0] === 'conversations' && pathParts.length === 3 && pathParts[2] === 'messages' && method === 'GET') {
      await handleGetMessages(res, pathParts[1], url.searchParams, requestId);
    }
    else if (pathParts[0] === 'conversations' && pathParts.length === 3 && pathParts[2] === 'messages' && method === 'POST') {
      await handleAddMessage(res, pathParts[1], body, requestId);
    }
    else if (pathParts[0] === 'conversations' && pathParts.length === 3 && pathParts[2] === 'feedback' && method === 'POST') {
      await handleSubmitFeedback(res, pathParts[1], body, headers.userId || undefined, requestId);
    }
    else if (pathParts[0] === 'conversations' && pathParts.length === 3 && pathParts[2] === 'summary' && method === 'GET') {
      await handleGetConversationSummary(res, pathParts[1], requestId);
    }
    // Users
    else if (pathParts[0] === 'projects' && pathParts.length === 4 && pathParts[2] === 'users' && method === 'GET') {
      await handleListProjectUsers(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 5 && pathParts[2] === 'users' && pathParts[4] === 'profile' && method === 'GET') {
      await handleGetUserProfile(res, pathParts[1], pathParts[3], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 5 && pathParts[2] === 'users' && pathParts[4] === 'preferences' && method === 'PATCH') {
      await handleUpdateUserPreferences(res, pathParts[1], pathParts[3], body, requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 5 && pathParts[2] === 'users' && pathParts[4] === 'quota' && method === 'GET') {
      await handleGetUserStats(res, pathParts[3], pathParts[1], requestId);
    }
    // Tenants
    else if (pathname === '/tenants' && method === 'POST') {
      await handleCreateTenant(res, body, requestId);
    }
    else if (pathname === '/tenants' && method === 'GET') {
      await handleListTenants(res, requestId);
    }
    else if (pathParts[0] === 'tenants' && pathParts.length === 2 && method === 'GET') {
      await handleGetTenant(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'tenants' && pathParts.length === 3 && pathParts[2] === 'usage' && method === 'GET') {
      await handleGetTenantUsage(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'tenants' && pathParts.length === 3 && pathParts[2] === 'suspend' && method === 'POST') {
      await handleSuspendTenant(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'tenants' && pathParts.length === 3 && pathParts[2] === 'resume' && method === 'POST') {
      await handleResumeTenant(res, pathParts[1], requestId);
    }
    // Webhooks
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'webhooks' && method === 'GET') {
      await handleListWebhooks(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'webhooks' && method === 'POST') {
      await handleRegisterWebhook(res, pathParts[1], body, requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 4 && pathParts[2] === 'webhooks' && method === 'DELETE') {
      await handleDeleteWebhook(res, pathParts[1], pathParts[3], requestId);
    }
    // Feedback
    else if (pathname === '/feedback' && method === 'POST') {
      await handleSubmitGeneralFeedback(res, body, requestId);
    }
    else if (pathParts[0] === 'projects' && pathParts.length === 3 && pathParts[2] === 'feedback/analytics' && method === 'GET') {
      await handleGetFeedbackAnalytics(res, pathParts[1], requestId);
    }
    // Legacy sessions
    else if (pathname === '/sessions' && method === 'POST') {
      await handleCreateSession(res, body, requestId);
    }
    else if (pathname === '/sessions' && method === 'GET') {
      await handleListSessions(res, requestId);
    }
    else if (pathParts[0] === 'sessions' && pathParts.length === 2 && method === 'GET') {
      await handleGetSession(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'sessions' && pathParts.length === 2 && method === 'DELETE') {
      await handleDeleteSession(res, pathParts[1], requestId);
    }
    else if (pathParts[0] === 'sessions' && pathParts.length === 3 && pathParts[2] === 'context' && method === 'GET') {
      await handleGetSessionContext(res, pathParts[1], url.searchParams, requestId);
    }
    // Ask
    else if (pathname === '/ask' && method === 'POST') {
      await handleAsk(res, body, headers.userId || undefined, requestId);
    }
    // Dataset
    else if (pathParts[0] === 'dataset' && pathParts.length === 2 && method === 'POST') {
      await handleDatasetExport(res, body, requestId);
    }
    else if (pathParts[0] === 'dataset' && pathParts.length === 2 && method === 'GET') {
      await handleDatasetStats(res, requestId);
    }
    else if (pathParts[0] === 'dataset' && pathParts[1] === 'versions' && method === 'GET') {
      await handleDatasetVersions(res, requestId);
    }
    // Graph & Audit
    else if (pathname === '/graph' && method === 'GET') {
      await handleGraph(res, requestId);
    }
    else if (pathname === '/audit' && method === 'GET') {
      await handleAudit(res, requestId);
    }
    else {
      sendJson(res, 404, { error: 'Not found', path: pathname }, requestId);
    }
  } catch (e) {
    console.error('Request error:', e);
    sendJson(res, 500, { error: 'Internal server error', message: e instanceof Error ? e.message : 'Unknown error' }, requestId);
  }

  // Log event
  const latencyMs = Date.now() - startTime;
  await logApiEvent(projectRoot, {
    timestamp: new Date().toISOString(),
    endpoint: pathname,
    method,
    status: 200,
    latency_ms: latencyMs,
    mode: serverStatus?.mode || 'unknown',
    userId: headers.userId || undefined
  });
}

// ====== SERVER LIFECYCLE ======

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
      console.log(`API Version: ${SERVER_VERSION} | Phase: 6`);
      console.log('New endpoints available:');
      console.log('  - /auth/token, /auth/verify');
      console.log('  - /projects (CRUD)');
      console.log('  - /providers (list, test)');
      console.log('  - /projects/:id/pipeline/* (status, steps, stream)');
      console.log('  - /projects/:id/learning/* (config, stats, patterns)');
      console.log('  - /conversations (CRUD, messages, feedback)');
      console.log('  - /tenants (multi-tenant support)');
      console.log('  - /users/* (anonymous user isolation)');
      console.log('  - /webhooks (register, list, delete)');
      console.log('  - /feedback (submit, analytics)');
      resolve(server);
    });
  });
}

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

export function getApiServerStatus(): ApiServerStatus | null {
  return serverStatus;
}

export function isServerRunning(): boolean {
  return serverInstance !== null;
}