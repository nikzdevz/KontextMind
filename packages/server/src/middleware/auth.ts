// Authentication & Security Middleware
// Uses native Node.js HTTP types (no Express dependency)

import { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import type {
  ApiResponse,
  ResponseMeta
} from '../types/index.js';

// API Key storage (in production, use database)
interface ApiKeyData {
  key: string;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string;
}

const apiKeys = new Map<string, ApiKeyData>();

// Configurable CORS origins
let allowedOrigins: string[] = ['localhost', '127.0.0.1'];

// Initialize API keys from environment
function initializeApiKeys(): void {
  const apiKeyEnv = process.env.KONtextmind_API_KEYS;
  if (apiKeyEnv) {
    try {
      const keys = JSON.parse(apiKeyEnv);
      for (const k of keys) {
        apiKeys.set(k.key, k);
      }
    } catch {
      // Single API key
      apiKeys.set(apiKeyEnv, {
        key: apiKeyEnv,
        permissions: ['*'],
        createdAt: new Date().toISOString()
      });
    }
  }

  // Also check single API_KEY
  const singleKey = process.env.API_KEY;
  if (singleKey && !apiKeys.has(singleKey)) {
    apiKeys.set(singleKey, {
      key: singleKey,
      permissions: ['*'],
      createdAt: new Date().toISOString()
    });
  }
}
initializeApiKeys();

// Generate request ID
export function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
}

// Set CORS origins
export function setAllowedOrigins(origins: string[]): void {
  allowedOrigins = origins;
}

// Extract headers from request
export function extractHeaders(req: IncomingMessage): {
  apiKey: string | null;
  userId: string | null;
  projectId: string | null;
  tenantId: string | null;
} {
  return {
    apiKey: req.headers['x-api-key'] as string || null,
    userId: req.headers['x-user-id'] as string || null,
    projectId: req.headers['x-project-id'] as string || null,
    tenantId: req.headers['x-tenant-id'] as string || null
  };
}

// Validate API key
export function validateApiKey(apiKey: string | null): { valid: boolean; keyData?: ApiKeyData; error?: string } {
  if (!apiKey) {
    return { valid: false, error: 'AUTH003' };
  }

  const keyData = apiKeys.get(apiKey);
  if (!keyData) {
    return { valid: false, error: 'AUTH001' };
  }

  // Check expiration
  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    return { valid: false, error: 'AUTH002' };
  }

  return { valid: true, keyData };
}

// CORS check
export function checkCors(req: IncomingMessage): { allowed: boolean; origin?: string } {
  const origin = req.headers.origin;

  if (!origin) {
    return { allowed: true };
  }

  // Allow if origin matches allowed list
  for (const allowed of allowedOrigins) {
    if (origin.includes(allowed)) {
      return { allowed: true, origin };
    }
  }

  return { allowed: false };
}

// Apply CORS headers
export function applyCorsHeaders(res: ServerResponse, origin?: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-User-ID, X-Project-ID, X-Tenant-ID');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Create standardized response
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  projectId?: string
): ApiResponse<T> {
  const meta: ResponseMeta = {
    requestId,
    projectId,
    timestamp: new Date().toISOString()
  };

  return {
    success: true,
    data,
    meta
  };
}

// Create error response
export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  field?: string,
  suggestion?: string
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      field: field || null,
      suggestion
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}

// Auth result interface for route handlers
export interface AuthResult {
  valid: boolean;
  requestId: string;
  apiKey?: string;
  userId?: string;
  projectId?: string;
  tenantId?: string;
}

// Middleware wrapper function - simplified, no rate limiting
export function authMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    requireAuth?: boolean;
    requireProjectId?: boolean;
    optionalUserId?: boolean;
  } = {}
): AuthResult {
  const requestId = generateRequestId();

  // CORS check
  const corsResult = checkCors(req);
  if (!corsResult.allowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(createErrorResponse('AUTH003', 'CORS not allowed', requestId)));
    return { valid: false, requestId };
  }
  applyCorsHeaders(res, corsResult.origin);

  // Auth check (if required)
  const headers = extractHeaders(req);

  if (options.requireAuth !== false) {
    const authResult = validateApiKey(headers.apiKey);
    if (!authResult.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(createErrorResponse(authResult.error!, authResult.error!, requestId)));
      return { valid: false, requestId };
    }
  }

  return {
    valid: true,
    requestId,
    apiKey: headers.apiKey || undefined,
    userId: headers.userId || undefined,
    projectId: headers.projectId || undefined,
    tenantId: headers.tenantId || undefined
  };
}

// Add API key (for setup)
export function addApiKey(config: {
  key: string;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  permissions?: string[];
  expiresAt?: string;
}): void {
  apiKeys.set(config.key, {
    ...config,
    permissions: config.permissions || ['*'],
    createdAt: new Date().toISOString()
  });
}

// Get API key info
export function getApiKeyInfo(key: string): { key: string; tenantId?: string; projectId?: string; userId?: string } | null {
  const data = apiKeys.get(key);
  if (!data) return null;
  return {
    key: data.key,
    tenantId: data.tenantId,
    projectId: data.projectId,
    userId: data.userId
  };
}

// Get rate limit info - always returns null (no rate limiting)
export function getRateLimitInfo(_identifier: string): null {
  return null;
}