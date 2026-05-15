/**
 * Composable Tool Actions
 *
 * Enables composition of complex tool actions from simple primitives.
 * Provides a flexible system for building and executing tool workflows.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const TOOLS_DIR = '.kontextmind/tools';

export interface ToolAction {
  id: string;
  name: string;
  description: string;
  category: 'file' | 'search' | 'analysis' | 'transformation' | 'validation' | 'custom';
  parameters: ToolParameter[];
  returns: ToolReturn;
  execute: (params: Record<string, any>) => Promise<any>;
  metadata: Record<string, any>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
  validator?: (value: any) => boolean;
}

export interface ToolReturn {
  type: string;
  description: string;
}

export interface ToolChain {
  id: string;
  name: string;
  description: string;
  actions: ChainAction[];
  conditions?: ChainCondition[];
  onError: 'stop' | 'skip' | 'retry';
  maxRetries: number;
}

export interface ChainAction {
  actionId: string;
  parameters: Record<string, any>;
  condition?: string;
}

export interface ChainCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
  then: 'continue' | 'skip' | 'stop';
}

export interface ExecutionResult {
  chainId: string;
  status: 'success' | 'partial' | 'failed';
  executedActions: number;
  results: ActionResult[];
  errors: string[];
  duration: number;
}

export interface ActionResult {
  actionId: string;
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
}

export interface ToolStats {
  totalTools: number;
  totalChains: number;
  executions: number;
  successRate: number;
  averageDuration: number;
}

export interface ToolConfig {
  maxConcurrentExecutions: number;
  timeout: number;
  enableLogging: boolean;
}

/**
 * ComposableToolActions - Enables tool composition
 */
export class ComposableToolActions {
  private projectRoot: string;
  private statePath: string;
  private configPath: string;
  private tools: Map<string, ToolAction> = new Map();
  private chains: Map<string, ToolChain> = new Map();
  private executionHistory: ExecutionResult[] = [];
  private config: ToolConfig;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, TOOLS_DIR, 'state.json');
    this.configPath = join(projectRoot, TOOLS_DIR, 'config.json');
    this.config = this.loadConfig();
    this.load();
  }

  /**
   * Register a tool action
   */
  register(tool: Omit<ToolAction, 'id'>): ToolAction {
    const id = this.generateId();
    const fullTool: ToolAction = {
      ...tool,
      id,
    };

    this.tools.set(id, fullTool);
    this.save();
    return fullTool;
  }

  /**
   * Get tool by ID
   */
  getTool(id: string): ToolAction | null {
    return this.tools.get(id) || null;
  }

  /**
   * Get all tools
   */
  getAllTools(): ToolAction[] {
    return [...this.tools.values()];
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolAction['category']): ToolAction[] {
    return [...this.tools.values()].filter(t => t.category === category);
  }

  /**
   * Create a tool chain
   */
  createChain(chain: Omit<ToolChain, 'id'>): ToolChain {
    const id = this.generateId();
    const fullChain: ToolChain = {
      ...chain,
      id,
    };

    this.chains.set(id, fullChain);
    this.save();
    return fullChain;
  }

  /**
   * Get chain by ID
   */
  getChain(id: string): ToolChain | null {
    return this.chains.get(id) || null;
  }

  /**
   * Get all chains
   */
  getAllChains(): ToolChain[] {
    return [...this.chains.values()];
  }

  /**
   * Execute a single tool
   */
  async executeTool(toolId: string, params: Record<string, any>): Promise<ActionResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        actionId: toolId,
        success: false,
        error: `Tool ${toolId} not found`,
        duration: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Validate parameters
      for (const param of tool.parameters) {
        if (param.required && !(param.name in params)) {
          throw new Error(`Missing required parameter: ${param.name}`);
        }
        if (param.validator && param.name in params) {
          if (!param.validator(params[param.name])) {
            throw new Error(`Parameter validation failed: ${param.name}`);
          }
        }
      }

      // Apply defaults
      const mergedParams = { ...params };
      for (const param of tool.parameters) {
        if (param.default !== undefined && !(param.name in mergedParams)) {
          mergedParams[param.name] = param.default;
        }
      }

      const output = await tool.execute(mergedParams);

      return {
        actionId: toolId,
        success: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        actionId: toolId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a tool chain
   */
  async executeChain(chainId: string, initialContext: Record<string, any> = {}): Promise<ExecutionResult> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      return {
        chainId,
        status: 'failed',
        executedActions: 0,
        results: [],
        errors: [`Chain ${chainId} not found`],
        duration: 0,
      };
    }

    const startTime = Date.now();
    const results: ActionResult[] = [];
    const errors: string[] = [];
    let context = { ...initialContext };

    for (let i = 0; i < chain.actions.length; i++) {
      const chainAction = chain.actions[i];

      // Check conditions
      if (chain.conditions && chain.conditions.length > 0) {
        const shouldSkip = chain.conditions.some(c => this.evaluateCondition(c, context));
        if (shouldSkip) {
          continue;
        }
      }

      // Merge chain parameters with context
      const params = { ...chainAction.parameters };
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' && value.startsWith('$')) {
          const contextKey = value.slice(1);
          params[key] = context[contextKey];
        }
      }

      // Execute action
      const result = await this.executeTool(chainAction.actionId, params);
      results.push(result);

      // Update context with result
      if (result.success && result.output) {
        context[`result_${i}`] = result.output;
      }

      // Handle errors
      if (!result.success) {
        errors.push(result.error || 'Unknown error');

        if (chain.onError === 'stop') {
          break;
        } else if (chain.onError === 'retry') {
          let retries = 0;
          while (!result.success && retries < chain.maxRetries) {
            const retryResult = await this.executeTool(chainAction.actionId, params);
            results[results.length - 1] = retryResult;
            if (retryResult.success) break;
            retries++;
          }
        }
        // 'skip' continues to next action
      }
    }

    const successfulResults = results.filter(r => r.success);
    const status: ExecutionResult['status'] =
      successfulResults.length === results.length ? 'success' :
      successfulResults.length > 0 ? 'partial' : 'failed';

    const execution: ExecutionResult = {
      chainId,
      status,
      executedActions: results.length,
      results,
      errors,
      duration: Date.now() - startTime,
    };

    this.executionHistory.push(execution);
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }

    this.save();
    return execution;
  }

  /**
   * Evaluate chain condition
   */
  private evaluateCondition(condition: ChainCondition, context: Record<string, any>): boolean {
    const value = context[condition.field];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }

  /**
   * Get chain execution history
   */
  getExecutionHistory(chainId?: string): ExecutionResult[] {
    if (chainId) {
      return this.executionHistory.filter(e => e.chainId === chainId);
    }
    return [...this.executionHistory];
  }

  /**
   * Get tool statistics
   */
  getStats(): ToolStats {
    const recentExecutions = this.executionHistory.slice(-20);
    const successCount = recentExecutions.filter(e => e.status === 'success').length;
    const totalDuration = recentExecutions.reduce((sum, e) => sum + e.duration, 0);

    return {
      totalTools: this.tools.size,
      totalChains: this.chains.size,
      executions: this.executionHistory.length,
      successRate: recentExecutions.length > 0 ? successCount / recentExecutions.length : 0,
      averageDuration: recentExecutions.length > 0 ? totalDuration / recentExecutions.length : 0,
    };
  }

  /**
   * Remove tool
   */
  removeTool(id: string): boolean {
    // Check if tool is used in any chain
    for (const chain of this.chains.values()) {
      if (chain.actions.some(a => a.actionId === id)) {
        console.warn(`Cannot remove tool ${id}: used in chain ${chain.id}`);
        return false;
      }
    }

    return this.tools.delete(id);
  }

  /**
   * Remove chain
   */
  removeChain(id: string): boolean {
    return this.chains.delete(id);
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Get configuration
   */
  getConfig(): ToolConfig {
    return { ...this.config };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.save();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.tools.clear();
    this.chains.clear();
    this.executionHistory = [];
    this.save();
  }

  // ============ Private Methods ============

  private generateId(): string {
    return `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private getDefaultConfig(): ToolConfig {
    return {
      maxConcurrentExecutions: 5,
      timeout: 30000,
      enableLogging: true,
    };
  }

  private loadConfig(): ToolConfig {
    return this.getDefaultConfig();
  }

  private load(): void {
    ensureDir(join(this.projectRoot, TOOLS_DIR));

    if (existsSync(this.statePath)) {
      try {
        const content = readFileSync(this.statePath, 'utf-8');
        const data = JSON.parse(content);
        for (const t of data.tools || []) {
          this.tools.set(t.id, t);
        }
        for (const c of data.chains || []) {
          this.chains.set(c.id, c);
        }
        this.executionHistory = data.executionHistory || [];
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }

    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        this.config = { ...this.getDefaultConfig(), ...JSON.parse(content) };
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, TOOLS_DIR));

    writeFileSync(this.statePath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      tools: [...this.tools.values()],
      chains: [...this.chains.values()],
      executionHistory: this.executionHistory.slice(-100),
    }, null, 2), 'utf-8');
  }

  private saveConfig(): void {
    ensureDir(join(this.projectRoot, TOOLS_DIR));
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, ComposableToolActions> = new Map();

export function getComposableToolActions(projectRoot: string = process.cwd()): ComposableToolActions {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new ComposableToolActions(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { TOOLS_DIR };