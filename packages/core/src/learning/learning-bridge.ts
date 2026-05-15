/**
 * Learning Bridge
 *
 * Automatic learning from project knowledge.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSemanticMemory } from '../memory/semantic/semantic-memory.js';
import { getProjectMentalModel } from '../mental-model/project-mental-model.js';
import { ensureDir } from '../filesystem/ensure-dir.js';

const LEARNING_SUMMARIES_DIR = '.summaries';
const QNA_LOG_FILE = '.logs/qna-events.jsonl';
const LEARNING_DIR = '.kontextmind/learning';
const SYNC_STATE_FILE = 'sync-state.json';
const IMPORT_HISTORY_FILE = 'import-history.json';

export interface BridgeConfig {
  syncOnStartup: boolean;
  enablePeriodicSync: boolean;
  syncIntervalMs: number;
  learnFromSummaries: boolean;
  learnFromQnA: boolean;
}

export interface SyncResult {
  summariesProcessed: number;
  qnaEventsProcessed: number;
  memoriesCreated: number;
  errors: string[];
  timestamp: string;
  syncType: 'startup' | 'periodic' | 'on-demand' | 'event-based';
}

export interface ImportOptions {
  sourceProject: string;
  dataTypes?: ('summaries' | 'decisions')[];
}

export interface ImportResult {
  success: boolean;
  itemsImported: number;
  sourceProject: string;
  importedTypes: string[];
  errors: string[];
}

export interface LearnedInsight {
  source: 'summary' | 'qna';
  type: string;
  content: string;
  timestamp: string;
  importedFrom?: string;
}

export interface BrainStatus {
  lastSync: string;
  syncMode: string;
  importedProjects: string[];
}

export class LearningBridge {
  private projectRoot: string;
  private config: BridgeConfig;
  private lastSync: string = '';
  private periodicInterval: ReturnType<typeof setInterval> | null = null;

  constructor(projectRoot: string, config: Partial<BridgeConfig> = {}) {
    this.projectRoot = projectRoot;
    this.config = {
      syncOnStartup: true,
      enablePeriodicSync: false,
      syncIntervalMs: 300000,
      learnFromSummaries: true,
      learnFromQnA: true,
      ...config,
    };

    if (this.config.syncOnStartup) {
      this.syncNow().catch(err => console.error('Startup sync failed:', err));
    }

    if (this.config.enablePeriodicSync) {
      this.startPeriodicSync();
    }
  }

  async syncNow(): Promise<SyncResult> {
    return this.performSync('startup');
  }

  private async performSync(type: SyncResult['syncType']): Promise<SyncResult> {
    const result: SyncResult = {
      summariesProcessed: 0,
      qnaEventsProcessed: 0,
      memoriesCreated: 0,
      errors: [],
      timestamp: new Date().toISOString(),
      syncType: type,
    };

    if (this.config.learnFromSummaries) {
      try {
        const r = await this.syncFromSummaries();
        result.summariesProcessed = r.processed;
        result.memoriesCreated += r.memoriesCreated;
      } catch (err) {
        result.errors.push(`Summaries: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (this.config.learnFromQnA) {
      try {
        const r = await this.syncFromQnA();
        result.qnaEventsProcessed = r.processed;
        result.memoriesCreated += r.memoriesCreated;
      } catch (err) {
        result.errors.push(`Q&A: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.lastSync = result.timestamp;
    this.saveState();
    return result;
  }

  private startPeriodicSync(): void {
    if (this.periodicInterval) return;
    this.periodicInterval = setInterval(() => {
      this.performSync('periodic').catch(err => console.error('Periodic sync failed:', err));
    }, this.config.syncIntervalMs);
  }

  async importFrom(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      itemsImported: 0,
      sourceProject: options.sourceProject,
      importedTypes: [],
      errors: [],
    };

    if (!existsSync(options.sourceProject)) {
      result.errors.push(`Source project not found: ${options.sourceProject}`);
      return result;
    }

    const semanticMemory = getSemanticMemory(this.projectRoot);
    const mentalModel = getProjectMentalModel(this.projectRoot);

    if (options.dataTypes?.includes('summaries') ?? true) {
      try {
        const count = await this.importSummaries(options.sourceProject, semanticMemory, mentalModel);
        result.itemsImported += count;
        result.importedTypes.push('summaries');
      } catch (err) {
        result.errors.push(`Summary import: ${err}`);
      }
    }

    result.success = result.itemsImported > 0;
    if (result.success) {
      this.saveImportHistory(options.sourceProject);
    }

    return result;
  }

  private async importSummaries(sourceRoot: string, semanticMemory: any, mentalModel: any): Promise<number> {
    let count = 0;
    const summariesDir = join(sourceRoot, LEARNING_SUMMARIES_DIR);

    if (!existsSync(summariesDir)) return 0;

    const filesDir = join(summariesDir, 'files');
    if (existsSync(filesDir)) {
      for (const file of readdirSync(filesDir).filter(f => f.endsWith('.json'))) {
        try {
          const summary = JSON.parse(readFileSync(join(filesDir, file), 'utf-8'));
          const content = summary.purpose || summary.summary || file;
          await semanticMemory.store(summary.filePath || file, content, { source: 'insight', tags: ['imported-summary'] });
          mentalModel.addEntity({
            id: `import-file-${count}`,
            name: summary.filePath?.split('/').pop() || file,
            type: 'file',
            filePath: summary.filePath || '',
            description: content,
            properties: { importedFrom: sourceRoot },
            relationships: [],
            importance: 0.7,
          });
          count++;
        } catch { /* skip */ }
      }
    }

    const decisionsDir = join(summariesDir, 'decisions');
    if (existsSync(decisionsDir)) {
      for (const file of readdirSync(decisionsDir).filter(f => f.endsWith('.json'))) {
        try {
          const summary = JSON.parse(readFileSync(join(decisionsDir, file), 'utf-8'));
          const content = `Decision: ${summary.title || file}\n${summary.context || ''}\n${summary.rationale || ''}`;
          await semanticMemory.store(`decision-${file}`, content, { source: 'decision', tags: ['imported-decision'] });
          mentalModel.addEntity({
            id: `import-decision-${count}`,
            name: summary.title || file,
            type: 'type',
            filePath: summary.filePath || '',
            description: content,
            properties: { importedFrom: sourceRoot },
            relationships: [],
            importance: 0.85,
          });
          count++;
        } catch { /* skip */ }
      }
    }

    return count;
  }

  private async syncFromSummaries(): Promise<{ processed: number; memoriesCreated: number }> {
    const semanticMemory = getSemanticMemory(this.projectRoot);
    const mentalModel = getProjectMentalModel(this.projectRoot);
    let processed = 0, memoriesCreated = 0;

    const filesDir = join(this.projectRoot, LEARNING_SUMMARIES_DIR, 'files');
    if (existsSync(filesDir)) {
      for (const file of readdirSync(filesDir).filter(f => f.endsWith('.json'))) {
        try {
          const summary = JSON.parse(readFileSync(join(filesDir, file), 'utf-8'));
          const content = summary.purpose || summary.summary || '';
          await semanticMemory.store(summary.filePath || file, content, { source: 'code_analysis', tags: ['file-summary'] });
          mentalModel.addEntity({
            id: `file-${file}`,
            name: summary.filePath?.split('/').pop() || file,
            type: 'file',
            filePath: summary.filePath || '',
            description: content,
            properties: {},
            relationships: [],
            importance: 0.7,
          });
          processed++;
          memoriesCreated++;
        } catch { /* skip */ }
      }
    }

    const decisionsDir = join(this.projectRoot, LEARNING_SUMMARIES_DIR, 'decisions');
    if (existsSync(decisionsDir)) {
      for (const file of readdirSync(decisionsDir).filter(f => f.endsWith('.json'))) {
        try {
          const summary = JSON.parse(readFileSync(join(decisionsDir, file), 'utf-8'));
          const content = `Decision: ${summary.title || file}\n${summary.context || ''}\n${summary.rationale || ''}`;
          await semanticMemory.store(`decision-${file}`, content, { source: 'decision', tags: ['decision'] });
          mentalModel.addEntity({
            id: `decision-${file}`,
            name: summary.title || file,
            type: 'type',
            filePath: summary.filePath || '',
            description: content,
            properties: {},
            relationships: [],
            importance: 0.9,
          });
          processed++;
          memoriesCreated++;
        } catch { /* skip */ }
      }
    }

    return { processed, memoriesCreated };
  }

  private async syncFromQnA(): Promise<{ processed: number; memoriesCreated: number }> {
    const semanticMemory = getSemanticMemory(this.projectRoot);
    let processed = 0, memoriesCreated = 0;

    if (!existsSync(QNA_LOG_FILE)) return { processed, memoriesCreated };

    try {
      const lines = readFileSync(QNA_LOG_FILE, 'utf-8').split('\n').filter(l => l.trim());
      for (const line of lines.slice(-50)) {
        try {
          const event = JSON.parse(line);
          if ((event.question || '').length > 10) {
            const content = `Q: ${event.question}\nA: ${(event.answer || '').slice(0, 300)}`;
            await semanticMemory.store(`qna-${processed}`, content, {
              source: 'conversation',
              tags: ['qna', event.feedbackReceived || 'neutral'],
            });
            processed++;
            memoriesCreated++;
          }
        } catch { /* skip */ }
      }
    } catch { /* file error */ }

    return { processed, memoriesCreated };
  }

  private saveState(): void {
    ensureDir(join(this.projectRoot, LEARNING_DIR));
    writeFileSync(join(this.projectRoot, LEARNING_DIR, SYNC_STATE_FILE), JSON.stringify({
      lastSync: this.lastSync,
      config: this.config,
    }, null, 2), 'utf-8');
  }

  private saveImportHistory(source: string): void {
    const path = join(this.projectRoot, LEARNING_DIR, IMPORT_HISTORY_FILE);
    let history: string[] = [];
    if (existsSync(path)) {
      try { history = JSON.parse(readFileSync(path, 'utf-8')); } catch { /* ignore */ }
    }
    if (!history.includes(source)) history.push(source);
    writeFileSync(path, JSON.stringify(history, null, 2), 'utf-8');
  }

  private getImportedProjects(): string[] {
    const path = join(this.projectRoot, LEARNING_DIR, IMPORT_HISTORY_FILE);
    if (!existsSync(path)) return [];
    try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return []; }
  }

  getStatus(): BrainStatus {
    return {
      lastSync: this.lastSync,
      syncMode: this.config.enablePeriodicSync ? 'periodic' : 'on-demand',
      importedProjects: this.getImportedProjects(),
    };
  }

  stopSync(): void {
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }
  }
}

const instances: Map<string, LearningBridge> = new Map();

export function getLearningBridge(projectRoot: string = process.cwd()): LearningBridge {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new LearningBridge(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export function createLearningBridge(
  projectRoot: string,
  config?: Partial<BridgeConfig>
): LearningBridge {
  return new LearningBridge(projectRoot, config);
}

export { LEARNING_SUMMARIES_DIR, QNA_LOG_FILE, LEARNING_DIR };