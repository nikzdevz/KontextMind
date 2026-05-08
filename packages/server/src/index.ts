/**
 * KontextMind HTTP API Server
 *
 * Phase 6 implementation provides local HTTP API for:
 * - Health checks
 * - Project status queries
 * - File/symbol summaries
 * - Knowledge graph queries
 * - Chatbot Q&A
 * - KB building
 */

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

export { startApiServer, stopApiServer, getApiServerStatus, isServerRunning } from './api-server.js';

export const PHASE = 6;
export const SERVER_VERSION = '0.1.0';