/**
 * Multi-Agent Memory Sync
 *
 * Synchronizes memory state across multiple agents/instances.
 * Enables collaborative memory sharing and consistency.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const MULTIAGENT_DIR = '.kontextmind/multiagent';

export interface Agent {
  id: string;
  name: string;
  type: 'claude' | 'cursor' | 'github-copilot' | 'custom';
  status: 'active' | 'idle' | 'offline';
  lastSeen: string;
  capabilities: string[];
  memoryVersion: number;
}

export interface MemoryUpdate {
  id: string;
  agentId: string;
  timestamp: string;
  changes: MemoryChange[];
  version: number;
}

export interface MemoryChange {
  type: 'add' | 'update' | 'delete';
  memoryId: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface SyncConfig {
  syncInterval: number;
  conflictResolution: 'latest' | 'merge' | 'agent_priority';
  agentPriority: Record<string, number>;
  enabled: boolean;
}

export interface SyncResult {
  syncedAgents: number;
  memoriesUpdated: number;
  conflicts: number;
  timestamp: string;
}

export interface AgentMemory {
  agentId: string;
  memories: Array<{
    id: string;
    content: string;
    type: string;
    updatedAt: string;
  }>;
}

/**
 * MultiAgentMemorySync - Syncs memory across agents
 */
export class MultiAgentMemorySync {
  private projectRoot: string;
  private statePath: string;
  private configPath: string;
  private agents: Map<string, Agent> = new Map();
  private sharedMemory: Map<string, MemoryUpdate> = new Map();
  private config: SyncConfig;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, MULTIAGENT_DIR, 'state.json');
    this.configPath = join(projectRoot, MULTIAGENT_DIR, 'config.json');
    this.config = this.loadConfig();
    this.load();
  }

  /**
   * Register an agent
   */
  registerAgent(agent: Omit<Agent, 'lastSeen' | 'memoryVersion'>): Agent {
    const fullAgent: Agent = {
      ...agent,
      lastSeen: new Date().toISOString(),
      memoryVersion: 1,
    };

    this.agents.set(agent.id, fullAgent);
    this.save();
    return fullAgent;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return [...this.agents.values()];
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: Agent['status']): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastSeen = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Record memory update from an agent
   */
  recordUpdate(agentId: string, changes: MemoryChange[]): MemoryUpdate {
    const update: MemoryUpdate = {
      id: this.generateId(),
      agentId,
      timestamp: new Date().toISOString(),
      changes,
      version: this.getNextVersion(),
    };

    this.sharedMemory.set(update.id, update);
    this.save();

    // Update agent's memory version
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.memoryVersion = update.version;
      agent.lastSeen = update.timestamp;
    }

    return update;
  }

  /**
   * Sync memory from another agent
   */
  syncFromAgent(sourceAgentId: string, memories: AgentMemory['memories']): SyncResult {
    const sourceAgent = this.agents.get(sourceAgentId);
    if (!sourceAgent) {
      return { syncedAgents: 0, memoriesUpdated: 0, conflicts: 0, timestamp: new Date().toISOString() };
    }

    let memoriesUpdated = 0;
    let conflicts = 0;

    // Process incoming memories
    for (const memory of memories) {
      const existingUpdate = this.findMemoryUpdate(memory.id);

      if (existingUpdate) {
        // Check for conflict
        if (this.hasConflict(existingUpdate, memory)) {
          conflicts++;
          this.resolveConflict(existingUpdate, memory, sourceAgentId);
        }
        memoriesUpdated++;
      } else {
        // New memory - create update record
        this.recordUpdate(sourceAgentId, [{
          type: 'add',
          memoryId: memory.id,
          content: memory.content,
          metadata: { type: memory.type },
        }]);
        memoriesUpdated++;
      }
    }

    this.save();

    return {
      syncedAgents: 1,
      memoriesUpdated,
      conflicts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all memory updates
   */
  getAllUpdates(): MemoryUpdate[] {
    return [...this.sharedMemory.values()]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Get updates since a specific version
   */
  getUpdatesSince(version: number): MemoryUpdate[] {
    return [...this.sharedMemory.values()].filter(u => u.version > version);
  }

  /**
   * Check if memory exists
   */
  private findMemoryUpdate(memoryId: string): MemoryUpdate | undefined {
    for (const update of this.sharedMemory.values()) {
      if (update.changes.some(c => c.memoryId === memoryId)) {
        return update;
      }
    }
    return undefined;
  }

  /**
   * Check for conflict between updates
   */
  private hasConflict(existing: MemoryUpdate, incoming: { id: string; content: string }): boolean {
    const existingChange = existing.changes.find(c => c.memoryId === incoming.id);
    if (!existingChange || !existingChange.content) return false;

    return existingChange.content !== incoming.content;
  }

  /**
   * Resolve conflict between updates
   */
  private resolveConflict(existing: MemoryUpdate, incoming: { id: string; content: string }, sourceAgentId: string): void {
    switch (this.config.conflictResolution) {
      case 'latest':
        // Just add the new update - it will override
        break;

      case 'merge':
        // Add both as separate updates
        this.recordUpdate(sourceAgentId, [{
          type: 'update',
          memoryId: incoming.id,
          content: `Merged: ${incoming.content}`,
        }]);
        break;

      case 'agent_priority':
        const incomingPriority = this.config.agentPriority[sourceAgentId] || 0;
        const existingPriority = this.config.agentPriority[existing.agentId] || 0;
        if (incomingPriority > existingPriority) {
          // Incoming wins
          this.recordUpdate(sourceAgentId, [{
            type: 'update',
            memoryId: incoming.id,
            content: incoming.content,
          }]);
        }
        break;
    }
  }

  /**
   * Get memory for agent to pull
   */
  getMemoryForAgent(agentId: string): AgentMemory {
    const agent = this.agents.get(agentId);
    const memories: AgentMemory['memories'] = [];

    for (const update of this.sharedMemory.values()) {
      for (const change of update.changes) {
        if (change.type !== 'delete' && change.content) {
          memories.push({
            id: change.memoryId,
            content: change.content,
            type: change.metadata?.type || 'unknown',
            updatedAt: update.timestamp,
          });
        }
      }
    }

    return {
      agentId,
      memories: memories.slice(-100), // Last 100 memories
    };
  }

  /**
   * Set sync configuration
   */
  setConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.save();
  }

  /**
   * Get sync configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Set agent priority for conflict resolution
   */
  setAgentPriority(agentId: string, priority: number): void {
    this.config.agentPriority[agentId] = priority;
    this.save();
  }

  /**
   * Remove agent
   */
  removeAgent(agentId: string): boolean {
    this.updateAgentStatus(agentId, 'offline');
    return this.agents.delete(agentId);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.agents.clear();
    this.sharedMemory.clear();
    this.save();
  }

  // ============ Private Methods ============

  private generateId(): string {
    return `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private getNextVersion(): number {
    let maxVersion = 0;
    for (const update of this.sharedMemory.values()) {
      if (update.version > maxVersion) {
        maxVersion = update.version;
      }
    }
    return maxVersion + 1;
  }

  private getDefaultConfig(): SyncConfig {
    return {
      syncInterval: 30000, // 30 seconds
      conflictResolution: 'latest',
      agentPriority: {},
      enabled: true,
    };
  }

  private loadConfig(): SyncConfig {
    ensureDir(join(this.projectRoot, MULTIAGENT_DIR));

    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        return { ...this.getDefaultConfig(), ...JSON.parse(content) };
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }

    return this.getDefaultConfig();
  }

  private load(): void {
    ensureDir(join(this.projectRoot, MULTIAGENT_DIR));

    if (existsSync(this.statePath)) {
      try {
        const content = readFileSync(this.statePath, 'utf-8');
        const data = JSON.parse(content);
        for (const a of data.agents || []) {
          this.agents.set(a.id, a);
        }
        for (const u of data.updates || []) {
          this.sharedMemory.set(u.id, u);
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, MULTIAGENT_DIR));

    writeFileSync(this.statePath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      agents: [...this.agents.values()],
      updates: [...this.sharedMemory.values()].slice(-200), // Keep last 200 updates
    }, null, 2), 'utf-8');

    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, MultiAgentMemorySync> = new Map();

export function getMultiAgentMemorySync(projectRoot: string = process.cwd()): MultiAgentMemorySync {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new MultiAgentMemorySync(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { MULTIAGENT_DIR };