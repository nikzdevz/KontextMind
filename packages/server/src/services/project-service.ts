// Project Management Service
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { execSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import type { Project, ProjectStatus, Job, SetupProjectResponse } from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';
const JOBS_FILE = join(PROJECTS_DIR, '.jobs.json');

interface ProjectMetadata {
  created_at?: string;
  project?: {
    git_url?: string;
  };
  git?: {
    branch?: string;
  };
}

export class ProjectService {
  private jobs: Map<string, Job> = new Map();

  constructor() {
    this.loadJobs();
  }

  private loadJobs(): void {
    if (existsSync(JOBS_FILE)) {
      try {
        const data = JSON.parse(readFileSync(JOBS_FILE, 'utf-8'));
        for (const job of data.jobs || []) {
          this.jobs.set(job.job_id, job);
        }
      } catch {
        // Start fresh
      }
    }
  }

  private saveJobs(): void {
    const data = { jobs: Array.from(this.jobs.values()) };
    const dir = join(PROJECTS_DIR);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2));
  }

  private getProjectDir(name: string): string {
    return join(PROJECTS_DIR, name);
  }

  private getProjectMetadata(name: string): ProjectMetadata | null {
    const configPath = join(this.getProjectDir(name), '.kontextmind', 'config.json');
    if (existsSync(configPath)) {
      try {
        return JSON.parse(readFileSync(configPath, 'utf-8')) as ProjectMetadata;
      } catch {
        return null;
      }
    }
    return null;
  }

  private getProjectStatus(name: string): ProjectStatus {
    const meta = this.getProjectMetadata(name);
    if (!meta) return 'error';

    const configPath = join(this.getProjectDir(name), '.kontextmind', 'config.json');
    if (!existsSync(configPath)) {
      return 'initializing';
    }

    // Check if KB is ready
    const kbReady = existsSync(join(this.getProjectDir(name), '.kontextmind', 'chatbot', 'project-overview.md'));
    return kbReady ? 'ready' : 'indexing';
  }

  private countQARecords(name: string): number {
    const historyPath = join(this.getProjectDir(name), '.kontextmind', 'chatbot', 'qa-history.jsonl');
    if (!existsSync(historyPath)) return 0;

    try {
      const content = readFileSync(historyPath, 'utf-8');
      return content.split('\n').filter(l => l.trim()).length;
    } catch {
      return 0;
    }
  }

  private updateJob(jobId: string, updates: Partial<Job>): void {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates, { updated_at: new Date().toISOString() });
      this.saveJobs();
    }
  }

  async setupProject(
    gitUrl: string,
    name: string,
    branch: string = 'main',
    callbackUrl?: string
  ): Promise<SetupProjectResponse> {
    const projectDir = this.getProjectDir(name);
    const jobId = `job_${randomUUID()}`;

    // Create initial job
    const job: Job = {
      job_id: jobId,
      project_name: name,
      type: 'setup',
      status: 'pending',
      progress_percent: 0,
      current_step: 'Queued for initialization',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);
    this.saveJobs();

    // Start async initialization
    this.runInitialization(jobId, gitUrl, name, branch, projectDir, callbackUrl);

    return {
      project_id: name,
      status: 'initializing',
      job_id: jobId,
    };
  }

  private async runInitialization(
    jobId: string,
    gitUrl: string,
    name: string,
    branch: string,
    projectDir: string,
    callbackUrl?: string
  ): Promise<void> {
    const steps = [
      { step: 'Cloning repository', action: () => this.cloneRepo(gitUrl, projectDir, branch) },
      { step: 'Running kontextmind init', action: () => this.runInit(projectDir) },
      { step: 'Scanning files', action: () => this.runScan(projectDir) },
      { step: 'Indexing project', action: () => this.runIndex(projectDir) },
      { step: 'Generating summaries', action: () => this.runSummarize(projectDir) },
      { step: 'Building knowledge base', action: () => this.runKbBuild(projectDir) },
    ];

    for (let i = 0; i < steps.length; i++) {
      const { step, action } = steps[i];
      this.updateJob(jobId, {
        status: 'running',
        progress_percent: Math.round((i / steps.length) * 100),
        current_step: step,
      });

      try {
        await action();
      } catch (error) {
        this.updateJob(jobId, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }

    // Complete
    this.updateJob(jobId, {
      status: 'completed',
      progress_percent: 100,
      current_step: 'Initialization complete',
      completed_at: new Date().toISOString(),
    });

    // Call callback if provided
    if (callbackUrl) {
      this.callCallback(callbackUrl, { project_id: name, status: 'ready', job_id: jobId });
    }
  }

  private cloneRepo(gitUrl: string, projectDir: string, branch: string): void {
    const token = process.env.GITHUB_TOKEN;
    let url = gitUrl;

    // Add token to URL if provided
    if (token && gitUrl.includes('github.com')) {
      url = gitUrl.replace('https://', `https://${token}@`);
    }

    // Create parent directory if needed
    const parentDir = join(projectDir, '..');
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // Clone if directory doesn't exist
    if (!existsSync(projectDir)) {
      execSync(`git clone --branch ${branch} --single-branch ${url} ${projectDir}`, {
        stdio: 'inherit',
        timeout: 300000, // 5 min timeout
      });
    }
  }

  private getEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      NODE_PATH: '/app/node_modules:/app/apps/cli/node_modules',
      PATH: '/app/node_modules/.bin:/usr/local/bin:' + process.env.PATH,
    };
  }

  private getLLMProvider(): string {
    return process.env.LLM_PROVIDER || 'openai-compatible';
  }

  private getSummarizeEnv(): NodeJS.ProcessEnv {
    return {
      ...this.getEnv(),
      LLM_API_KEY: process.env.LLM_API_KEY || '',
    };
  }

  private runCmd(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = this.getSummarizeEnv();
      console.log(`[ProjectService] Running: ${cmd} ${args.join(' ')}`);
      console.log(`[ProjectService] LLM_API_KEY set: ${!!env.LLM_API_KEY}`);
      console.log(`[ProjectService] LLM_MODEL: ${env.LLM_MODEL || 'not set'}`);
      console.log(`[ProjectService] LLM_BASE_URL: ${env.LLM_BASE_URL || 'not set'}`);

      const proc = spawn(cmd, args, { cwd, stdio: 'inherit', env });
      const timer = setTimeout(() => {
        proc.kill();
        console.log(`[ProjectService] Command timed out after ${timeoutMs}ms`);
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      proc.on('close', (code) => {
        clearTimeout(timer);
        console.log(`[ProjectService] Command exited with code: ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Exit ${code}`));
        }
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        console.log(`[ProjectService] Command error: ${err.message}`);
        reject(err);
      });
    });
  }

  private async runInit(projectDir: string): Promise<void> {
    await this.runCmd('node', ['/app/apps/cli/dist/index.js', 'init', '--force', '--provider', this.getLLMProvider()], projectDir, 60000);
  }

  private async runScan(projectDir: string): Promise<void> {
    await this.runCmd('node', ['/app/apps/cli/dist/index.js', 'scan'], projectDir, 120000);
  }

  private async runIndex(projectDir: string): Promise<void> {
    await this.runCmd('node', ['/app/apps/cli/dist/index.js', 'index'], projectDir, 300000);
  }

  private async runSummarize(projectDir: string): Promise<void> {
    const args = ['/app/apps/cli/dist/index.js', 'summarize', '--all', '--provider', this.getLLMProvider()];
    const model = process.env.LLM_MODEL;
    const baseUrl = process.env.LLM_BASE_URL;
    if (model) args.push('--model', model);
    if (baseUrl) args.push('--base-url', baseUrl);

    // Run summarization with progress tracking
    await this.runSummarizeWithProgress(args, projectDir, 1800000);
  }

  private runSummarizeWithProgress(args: string[], projectDir: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = this.getSummarizeEnv();
      console.log(`[ProjectService] Running: node ${args.join(' ')}`);
      console.log(`[ProjectService] LLM_API_KEY set: ${!!env.LLM_API_KEY}`);
      console.log(`[ProjectService] LLM_MODEL: ${env.LLM_MODEL || 'not set'}`);
      console.log(`[ProjectService] LLM_BASE_URL: ${env.LLM_BASE_URL || 'not set'}`);

      const proc = spawn('node', args, { cwd: projectDir, stdio: 'pipe', env });

      // Track output for progress
      let totalFiles = 0;
      let processedFiles = 0;
      let lineBuffer = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        process.stdout.write(chunk);
        lineBuffer += chunk;

        // Process complete lines
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          // Parse progress from CLI output
          const numericMatch = line.match(/\[PROGRESS\]\s+(\d+)\/(\d+|\?)\s+([\d.]+)%/);
          if (numericMatch) {
            processedFiles = parseInt(numericMatch[1], 10);
            totalFiles = numericMatch[2] === '?' ? 0 : parseInt(numericMatch[2], 10);
            this.updateSummarizeProgress(projectDir, processedFiles, totalFiles);
            continue;
          }

          if (line.includes('[PROGRESS] Starting summarization:')) {
            const match = line.match(/Starting summarization: (\d+|all) files/);
            if (match) {
              totalFiles = match[1] === 'all' ? 0 : parseInt(match[1], 10);
            }
          }
          if (line.includes('[PROGRESS] Generated summary:')) {
            processedFiles++;
            // Update job progress based on file progress
            this.updateSummarizeProgress(projectDir, processedFiles, totalFiles);
          }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString());
      });

      const timer = setTimeout(() => {
        proc.kill();
        console.log(`[ProjectService] Command timed out after ${timeoutMs}ms`);
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        console.log(`[ProjectService] Command exited with code: ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Exit ${code}`));
        }
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        console.log(`[ProjectService] Command error: ${err.message}`);
        reject(err);
      });
    });
  }

  private updateSummarizeProgress(projectDir: string, processed: number, total: number): void {
    // Find the job for this project
    const job = this.getProjectJob(basename(projectDir));
    if (job) {
      let progress_percent: number;
      let current_step: string;

      if (total > 0) {
        // Calculate progress: 67% (indexing) + up to 27% for summarization
        const summarizeProgress = Math.round((processed / total) * 27);
        progress_percent = Math.min(94, 67 + summarizeProgress);
        current_step = `Generating summaries (${processed}/${total})`;
      } else {
        // No total known - use absolute count (cap at 94%)
        // Assume 757 files is max, calculate percentage from processed
        const estimatedTotal = 757;
        progress_percent = Math.min(94, Math.round((processed / estimatedTotal) * 27) + 67);
        current_step = `Generating summaries (${processed}+ files)`;
      }

      this.updateJob(job.job_id, { progress_percent, current_step });
    }
  }

  private async runKbBuild(projectDir: string): Promise<void> {
    await this.runCmd('node', ['/app/apps/cli/dist/index.js', 'kb', 'build'], projectDir, 120000);
  }

  private callCallback(url: string, data: Record<string, unknown>): void {
    try {
      const payload = JSON.stringify(data);
      execSync(`curl -X POST ${url} -H "Content-Type: application/json" -d '${payload.replace(/'/g, "'\\''")}'`, {
        stdio: 'ignore',
        timeout: 10000,
      });
    } catch {
      // Silently fail callback
    }
  }

  listProjects(): Project[] {
    if (!existsSync(PROJECTS_DIR)) {
      return [];
    }

    const projects: Project[] = [];
    const entries = readdirSync(PROJECTS_DIR);

    for (const entry of entries) {
      if (entry.startsWith('.')) continue; // Skip hidden files

      const projectDir = join(PROJECTS_DIR, entry);
      if (!existsSync(join(projectDir, '.kontextmind', 'config.json'))) {
        continue;
      }

      const meta = this.getProjectMetadata(entry);
      const status = this.getProjectStatus(entry);
      const qaCount = this.countQARecords(entry);

      // Get last asked from qa-history
      let lastAsked: string | null = null;
      const historyPath = join(projectDir, '.kontextmind', 'chatbot', 'qa-history.jsonl');
      if (existsSync(historyPath)) {
        const content = readFileSync(historyPath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          try {
            const lastRecord = JSON.parse(lines[lines.length - 1]);
            lastAsked = lastRecord.timestamp;
          } catch {
            // ignore
          }
        }
      }

      projects.push({
        name: entry,
        git_url: meta?.project?.git_url || '',
        branch: meta?.git?.branch || 'main',
        status,
        created_at: meta?.created_at || new Date().toISOString(),
        last_asked: lastAsked,
        qa_count: qaCount,
        files_indexed: this.countFiles(projectDir),
        kb_version: '1.0.0',
      });
    }

    return projects;
  }

  private countFiles(projectDir: string): number {
    const fileIndexPath = join(projectDir, '.kg', 'file-index.json');
    if (existsSync(fileIndexPath)) {
      try {
        const data = JSON.parse(readFileSync(fileIndexPath, 'utf-8'));
        return data.files?.length || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  getProject(name: string): Project | null {
    const projectDir = this.getProjectDir(name);
    if (!existsSync(join(projectDir, '.kontextmind', 'config.json'))) {
      return null;
    }

    const meta = this.getProjectMetadata(name);
    const status = this.getProjectStatus(name);
    const qaCount = this.countQARecords(name);

    return {
      name,
      git_url: meta?.project?.git_url || '',
      branch: meta?.git?.branch || 'main',
      status,
      created_at: meta?.created_at || new Date().toISOString(),
      last_asked: null,
      qa_count: qaCount,
      files_indexed: this.countFiles(projectDir),
      kb_version: '1.0.0',
    };
  }

  async deleteProject(name: string): Promise<boolean> {
    const projectDir = this.getProjectDir(name);
    if (!existsSync(projectDir)) {
      return false;
    }

    try {
      rmSync(projectDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  async reindexProject(name: string, full: boolean = true, callbackUrl?: string): Promise<{ job_id: string }> {
    const projectDir = this.getProjectDir(name);
    if (!existsSync(join(projectDir, '.kontextmind'))) {
      throw new Error('Project not initialized');
    }

    const jobId = `job_${randomUUID()}`;
    const job: Job = {
      job_id: jobId,
      project_name: name,
      type: 'reindex',
      status: 'pending',
      progress_percent: 0,
      current_step: 'Queued for reindexing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);
    this.saveJobs();

    // Run reindex async
    this.runReindex(jobId, projectDir, name, full, callbackUrl);

    return { job_id: jobId };
  }

  private async runReindex(
    jobId: string,
    projectDir: string,
    name: string,
    full: boolean,
    callbackUrl?: string
  ): Promise<void> {
    const steps = full
      ? [
          { step: 'Scanning files', action: () => this.runScan(projectDir) },
          { step: 'Re-indexing project', action: () => this.runIndex(projectDir) },
          { step: 'Regenerating summaries', action: () => this.runSummarize(projectDir) },
          { step: 'Rebuilding knowledge base', action: () => this.runKbBuild(projectDir) },
        ]
      : [
          { step: 'Rebuilding knowledge base', action: () => this.runKbBuild(projectDir) },
        ];

    for (let i = 0; i < steps.length; i++) {
      const { step, action } = steps[i];
      this.updateJob(jobId, {
        status: 'running',
        progress_percent: Math.round((i / steps.length) * 100),
        current_step: step,
      });

      try {
        await action();
      } catch (error) {
        this.updateJob(jobId, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }

    this.updateJob(jobId, {
      status: 'completed',
      progress_percent: 100,
      current_step: 'Reindex complete',
      completed_at: new Date().toISOString(),
    });

    if (callbackUrl) {
      this.callCallback(callbackUrl, { project_id: name, status: 'ready', job_id: jobId });
    }
  }

  getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  getProjectJob(name: string): Job | null {
    for (const job of this.jobs.values()) {
      if (job.project_name === name && (job.status === 'pending' || job.status === 'running')) {
        return job;
      }
    }
    return null;
  }
}

export const projectService = new ProjectService();
