/**
 * KontextMind API Client
 *
 * TypeScript client for the KontextMind API server.
 *
 * Usage:
 * ```typescript
 * import { KontextMindClient } from '@kontextmind/client';
 *
 * const client = new KontextMindClient({
 *   baseUrl: 'http://localhost:7331',
 *   apiKey: 'your-api-key'
 * });
 *
 * // Setup a project
 * const job = await client.setupProject({
 *   gitUrl: 'https://github.com/org/repo',
 *   name: 'my-project'
 * });
 *
 * // Check job status
 * const status = await client.getJobStatus(job.job_id);
 * ```
 */

export interface KontextMindClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface SetupProjectRequest {
  gitUrl: string;
  name: string;
  branch?: string;
  callbackUrl?: string;
}

export interface SetupProjectResponse {
  project_id: string;
  status: string;
  job_id: string;
}

export interface Project {
  name: string;
  git_url: string;
  branch: string;
  status: 'initializing' | 'indexing' | 'ready' | 'error';
  created_at: string;
  last_asked: string | null;
  qa_count: number;
  files_indexed?: number;
  kb_version?: string;
  active_job?: Job | null;
}

export interface Job {
  job_id: string;
  project_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_percent: number;
  current_step: string;
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface AskRequest {
  question: string;
  mode?: 'chatbot-readonly' | 'readonly';
}

export interface AskResponse {
  qa_id: string;
  answer: string;
  confidence: number;
  sources: Array<{
    type: string;
    name: string;
    relevance: number;
  }>;
  tier: number;
  cached: boolean;
}

export interface FeedbackRequest {
  qa_id: string;
  project: string;
  signal: 'helpful' | 'not_helpful' | 'neutral';
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedbackResponse {
  qa_id: string;
  recorded: boolean;
}

export interface Settings {
  llm_provider: string;
  llm_model: string | null;
  llm_base_url: string | null;
  github_token_configured: boolean;
  projects_count: number;
}

export interface SettingsUpdate {
  llm_provider?: string;
  llm_model?: string;
  llm_api_key?: string;
  llm_base_url?: string;
}

export class KontextMindError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'KontextMindError';
  }
}

export class KontextMindClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(options: KontextMindClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { timeout?: number; signal?: AbortSignal } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };

    const controller = new AbortController();
    const timeout = options.timeout || this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new KontextMindError(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
          response.status
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof KontextMindError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new KontextMindError(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  // Project Management

  /**
   * Setup a project by cloning from GitHub and initializing
   */
  async setupProject(request: SetupProjectRequest): Promise<SetupProjectResponse> {
    return this.request<SetupProjectResponse>('POST', '/projects/setup-with-github', request);
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<{ projects: Project[] }> {
    return this.request<{ projects: Project[] }>('GET', '/projects');
  }

  /**
   * Get project details
   */
  async getProject(name: string): Promise<Project> {
    return this.request<Project>('GET', `/projects/${encodeURIComponent(name)}`);
  }

  /**
   * Delete a project
   */
  async deleteProject(name: string): Promise<{ name: string; deleted: boolean }> {
    return this.request<{ name: string; deleted: boolean }>(
      'DELETE',
      `/projects/${encodeURIComponent(name)}`
    );
  }

  /**
   * Trigger reindexing of a project
   */
  async reindexProject(
    name: string,
    full: boolean = true,
    callbackUrl?: string
  ): Promise<{ job_id: string }> {
    return this.request<{ job_id: string }>(
      'POST',
      `/projects/${encodeURIComponent(name)}/reindex`,
      { full, callbackUrl }
    );
  }

  // Ask Questions

  /**
   * Ask a question about a project
   */
  async ask(projectName: string, request: AskRequest): Promise<AskResponse> {
    return this.request<AskResponse>(
      'POST',
      `/projects/${encodeURIComponent(projectName)}/ask`,
      request
    );
  }

  // Job Status

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<Job> {
    return this.request<Job>('GET', `/jobs/${jobId}`);
  }

  /**
   * Wait for a job to complete (with polling)
   */
  async waitForJob(
    jobId: string,
    options: { interval?: number; timeout?: number } = {}
  ): Promise<Job> {
    const interval = options.interval || 2000;
    const timeout = options.timeout || 600000; // 10 min default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await this.getJobStatus(jobId);

      if (job.status === 'completed') return job;
      if (job.status === 'failed') {
        throw new KontextMindError(`Job failed: ${job.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new KontextMindError('Job wait timeout');
  }

  // Feedback

  /**
   * Submit feedback for a Q&A pair
   */
  async submitFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
    return this.request<FeedbackResponse>('POST', '/feedback', request);
  }

  /**
   * Export feedback dataset
   */
  async exportFeedback(
    projectName: string,
    options: { format?: 'json' | 'jsonl'; since?: string } = {}
  ): Promise<{
    project: string;
    exported_at: string;
    total_records: number;
    format: string;
    data: unknown[];
  }> {
    const params = new URLSearchParams();
    if (options.format) params.set('format', options.format);
    if (options.since) params.set('since', options.since);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(
      'GET',
      `/feedback/export/${encodeURIComponent(projectName)}${query}`
    );
  }

  // Settings

  /**
   * Get current settings
   */
  async getSettings(): Promise<Settings> {
    return this.request<Settings>('GET', '/settings');
  }

  /**
   * Update settings
   */
  async updateSettings(settings: SettingsUpdate): Promise<Settings> {
    return this.request<Settings>('PUT', '/settings', settings);
  }

  // Health

  /**
   * Check if the server is healthy
   */
  async health(): Promise<{ status: string; version: string; uptime_seconds: number }> {
    return this.request('GET', '/health/live');
  }

  /**
   * Event emitter for real-time progress updates (SSE)
   */
  subscribeToProgress(
    jobId: string,
    onProgress: (job: Job) => void,
    onError?: (error: Error) => void
  ): () => void {
    const url = `${this.baseUrl}/jobs/${jobId}/events`;

    const eventSource = new EventSource(url, {
      // @ts-expect-error - Headers not standard in EventSource
      headers: { 'X-API-Key': this.apiKey },
    });

    eventSource.onmessage = (event) => {
      try {
        const job = JSON.parse(event.data) as Job;
        onProgress(job);

        if (job.status === 'completed' || job.status === 'failed') {
          eventSource.close();
        }
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    eventSource.onerror = (error) => {
      onError?.(new Error('SSE connection error'));
      eventSource.close();
    };

    return () => eventSource.close();
  }
}

export default KontextMindClient;