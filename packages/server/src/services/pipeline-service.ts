// Pipeline Service - Progress Tracking with SSE Support
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import type {
  PipelineStatus,
  PipelineStep,
  ReadinessCheck
} from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

// Event emitter for SSE
class PipelineEventEmitter extends EventEmitter {}
const pipelineEvents = new PipelineEventEmitter();

export class PipelineService {
  private getProjectDir(projectName: string): string {
    return join(PROJECTS_DIR, projectName);
  }

  private getPipelineStatusPath(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'pipeline-status.json');
  }

  private getReadinessPath(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'readiness.json');
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Get pipeline status
  async getPipelineStatus(projectName: string): Promise<PipelineStatus | null> {
    const projectDir = this.getProjectDir(projectName);
    const statusPath = this.getPipelineStatusPath(projectDir);

    if (!existsSync(statusPath)) {
      return null;
    }

    try {
      const status = JSON.parse(readFileSync(statusPath, 'utf-8')) as PipelineStatus;
      return status;
    } catch {
      return null;
    }
  }

  // Get pipeline steps
  async getPipelineSteps(projectName: string): Promise<PipelineStep[] | null> {
    const status = await this.getPipelineStatus(projectName);
    return status?.steps || null;
  }

  // Get readiness check
  async getReadinessCheck(projectName: string): Promise<ReadinessCheck> {
    const projectDir = this.getProjectDir(projectName);

    // Check all stages
    const cloneComplete = existsSync(join(projectDir, '.git'));
    const scanComplete = existsSync(join(projectDir, '.kg', 'file-index.json'));
    const indexComplete = existsSync(join(projectDir, '.kg', 'graph.json'));
    const summarizeComplete = existsSync(join(projectDir, '.summaries', 'files'));
    const kbComplete = existsSync(join(projectDir, '.kontextmind', 'chatbot', 'project-overview.md'));

    // Count files/summaries
    let totalFiles = 0;
    let totalSummaries = 0;

    const fileIndexPath = join(projectDir, '.kg', 'file-index.json');
    if (existsSync(fileIndexPath)) {
      try {
        const data = JSON.parse(readFileSync(fileIndexPath, 'utf-8'));
        totalFiles = data.files?.length || 0;
      } catch {}
    }

    const summariesDir = join(projectDir, '.summaries', 'files');
    if (existsSync(summariesDir)) {
      const files = require('fs').readdirSync(summariesDir) || [];
      totalSummaries = files.filter((f: string) => f.endsWith('.json')).length;
    }

    // Count symbols
    let totalSymbols = 0;
    const functionsDir = join(projectDir, '.summaries', 'functions');
    if (existsSync(functionsDir)) {
      const files = require('fs').readdirSync(functionsDir) || [];
      totalSymbols = files.filter((f: string) => f.endsWith('.json')).length * 5; // Estimate
    }

    const allComplete = cloneComplete && scanComplete && indexComplete && summarizeComplete && kbComplete;

    // Calculate KB size
    let knowledgeBaseSize = '0mb';
    const kbDir = join(projectDir, '.kontextmind', 'chatbot');
    if (existsSync(kbDir)) {
      const overviewPath = join(kbDir, 'project-overview.md');
      if (existsSync(overviewPath)) {
        const stat = require('fs').statSync(overviewPath);
        const sizeMb = Math.round(stat.size / (1024 * 1024) * 100) / 100;
        knowledgeBaseSize = `${sizeMb}mb`;
      }
    }

    return {
      ready: allComplete,
      canAnswerQuestions: allComplete,
      stages: {
        clone: { complete: cloneComplete },
        scan: { complete: scanComplete },
        index: { complete: indexComplete },
        summarize: { complete: summarizeComplete, files: totalSummaries },
        kb_build: { complete: kbComplete }
      },
      stats: {
        totalFiles,
        totalSymbols,
        totalSummaries,
        knowledgeBaseSize
      }
    };
  }

  // Update pipeline status
  async updatePipelineStatus(
    projectName: string,
    status: Partial<PipelineStatus>
  ): Promise<void> {
    const projectDir = this.getProjectDir(projectName);
    const statusPath = this.getPipelineStatusPath(projectDir);

    this.ensureDirectory(join(projectDir, '.kontextmind'));

    // Load existing or create new
    let current: PipelineStatus = {
      projectId: projectName,
      overallStatus: 'pending',
      percentComplete: 0,
      steps: [
        { name: 'clone', status: 'pending' },
        { name: 'scan', status: 'pending' },
        { name: 'index', status: 'pending' },
        { name: 'summarize', status: 'pending' },
        { name: 'kb_build', status: 'pending' }
      ],
      canAnswerQuestions: false
    };

    if (existsSync(statusPath)) {
      try {
        current = JSON.parse(readFileSync(statusPath, 'utf-8'));
      } catch {}
    }

    // Merge updates
    const updated: PipelineStatus = {
      ...current,
      ...status,
      projectId: projectName
    };

    writeFileSync(statusPath, JSON.stringify(updated, null, 2), 'utf-8');

    // Emit SSE event
    this.emitProgress(projectName, updated);
  }

  // Emit SSE event for real-time updates
  private emitProgress(projectName: string, status: PipelineStatus): void {
    const step = status.steps.find(s => s.status === 'running');
    const event = {
      step: step?.name || 'unknown',
      percent: status.percentComplete,
      currentFile: step?.currentFile
    };

    pipelineEvents.emit(`pipeline:${projectName}`, event);

    // Also emit general event
    if (status.overallStatus === 'completed') {
      pipelineEvents.emit(`pipeline:${projectName}:completed`, { message: 'Project ready for questions!' });
    }
  }

  // Subscribe to pipeline events (for SSE)
  subscribeToPipeline(projectName: string, callback: (event: string, data: unknown) => void): () => void {
    const handler = (data: unknown) => {
      const step = data as PipelineStatus;
      callback('progress', data);

      if (step.overallStatus === 'completed') {
        callback('pipeline_completed', { message: 'Project ready for questions!' });
      }
    };

    pipelineEvents.on(`pipeline:${projectName}`, handler);

    // Return unsubscribe function
    return () => {
      pipelineEvents.off(`pipeline:${projectName}`, handler);
    };
  }

  // Start pipeline (trigger setup/reindex)
  async triggerPipeline(
    projectName: string,
    action: 'setup' | 'reindex' | 'pause' | 'resume'
  ): Promise<{ job_id: string; status: string }> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.updatePipelineStatus(projectName, {
      overallStatus: action === 'pause' ? 'paused' : 'in_progress',
      percentComplete: 0,
      steps: [
        { name: 'clone', status: action === 'pause' ? 'pending' : 'running' },
        { name: 'scan', status: 'pending' },
        { name: 'index', status: 'pending' },
        { name: 'summarize', status: 'pending' },
        { name: 'kb_build', status: 'pending' }
      ]
    });

    return {
      job_id: jobId,
      status: action === 'pause' ? 'paused' : 'running'
    };
  }

  // Complete a pipeline step
  async completeStep(
    projectName: string,
    stepName: string,
    details?: {
      totalFiles?: number;
      completedFiles?: number;
      failedFiles?: number;
      currentFile?: string;
    }
  ): Promise<void> {
    const status = await this.getPipelineStatus(projectName);
    if (!status) return;

    const stepIndex = status.steps.findIndex(s => s.name === stepName);
    if (stepIndex === -1) return;

    // Update step status
    status.steps[stepIndex].status = 'completed';
    delete status.steps[stepIndex].currentFile;

    // Calculate progress
    const completedSteps = status.steps.filter(s => s.status === 'completed').length;
    status.percentComplete = Math.round((completedSteps / status.steps.length) * 100);

    // Mark next step as running
    if (stepIndex + 1 < status.steps.length) {
      status.steps[stepIndex + 1].status = 'running';
    }

    // Check if all complete
    if (completedSteps === status.steps.length) {
      status.overallStatus = 'completed';
      status.canAnswerQuestions = true;
      status.readinessMessage = 'Project ready for questions!';
    }

    await this.updatePipelineStatus(projectName, status);

    // Emit file completed event for summarize step
    if (stepName === 'summarize' && details?.currentFile) {
      pipelineEvents.emit(`pipeline:${projectName}:file_completed`, {
        file: details.currentFile,
        status: 'success'
      });
    }
  }

  // Get SSE stream handler
  getSSEStreamHandler(projectName: string): (res: { write: (data: string) => void; end: () => void; setHeader: (k: string, v: string) => void; flush: () => void }) => () => void {
    let unsubscribe: () => void;

    return (res: { write: (data: string) => void; end: () => void; setHeader: (k: string, v: string) => void; flush: () => void }) => {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Subscribe to pipeline events
      unsubscribe = this.subscribeToPipeline(projectName, (event, data) => {
        const sseData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        res.write(sseData);
        res.flush();
      });

      // Send initial connection event
      res.write('event: connected\ndata: {"status": "connected"}\n\n');
      res.flush();

      // Return cleanup function
      return unsubscribe;
    };
  }
}

export const pipelineService = new PipelineService();