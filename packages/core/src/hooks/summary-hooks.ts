/**
 * Summary Hooks
 *
 * Provides hooks/callbacks when summaries are generated.
 * Enables event-based sync in the learning bridge.
 *
 * Usage:
 * After saving a summary, call triggerSummaryHook() to notify
 * the learning bridge for immediate sync.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const HOOKS_DIR = '.kontextmind/hooks';
const HOOKS_FILE = 'pending-hooks.json';

export type SummaryType = 'file' | 'function' | 'module' | 'api' | 'decision' | 'blocker';

export interface SummaryHookEvent {
  type: SummaryType;
  path: string;
  timestamp: string;
  projectRoot: string;
}

export type HookCallback = (event: SummaryHookEvent) => void | Promise<void>;

interface HookRegistry {
  callbacks: HookCallback[];
  pendingEvents: SummaryHookEvent[];
}

/**
 * SummaryHookManager - Manages hooks for summary events
 *
 * When a summary is generated:
 * 1. Summarizer calls triggerSummaryHook()
 * 2. Hook is stored in pending-hooks.json
 * 3. LearningBridge picks it up during next sync
 */
export class SummaryHookManager {
  private projectRoot: string;
  private hooksPath: string;
  private callbacks: HookCallback[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.hooksPath = join(projectRoot, HOOKS_DIR, HOOKS_FILE);
  }

  /**
   * Register a callback to be called when summaries are generated
   */
  registerCallback(callback: HookCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Unregister a callback
   */
  unregisterCallback(callback: HookCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index >= 0) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Trigger hook - called by summarizer when summary is saved
   * This is the main entry point for event-based sync
   */
  trigger(event: SummaryHookEvent): void {
    // Store the event for persistence
    this.storePendingHook(event);

    // Execute callbacks immediately
    for (const callback of this.callbacks) {
      try {
        const result = callback(event);
        if (result instanceof Promise) {
          result.catch(err => console.error('Hook callback failed:', err));
        }
      } catch (err) {
        console.error('Hook callback error:', err);
      }
    }
  }

  /**
   * Get all pending hooks (for learning bridge to process)
   */
  getPendingHooks(): SummaryHookEvent[] {
    if (!existsSync(this.hooksPath)) {
      return [];
    }

    try {
      const content = readFileSync(this.hooksPath, 'utf-8');
      const data = JSON.parse(content);
      return data.events || [];
    } catch {
      return [];
    }
  }

  /**
   * Clear processed hooks (called after learning bridge processes them)
   */
  clearProcessedHooks(): void {
    writeFileSync(this.hooksPath, JSON.stringify({ events: [], lastCleared: new Date().toISOString() }, null, 2), 'utf-8');
  }

  /**
   * Mark specific hooks as processed
   */
  markProcessed(hookPaths: string[]): void {
    const pending = this.getPendingHooks();
    const remaining = pending.filter(h => !hookPaths.includes(h.path));

    writeFileSync(this.hooksPath, JSON.stringify({
      events: remaining,
      lastCleared: new Date().toISOString()
    }, null, 2), 'utf-8');
  }

  /**
   * Store pending hook for persistence
   */
  private storePendingHook(event: SummaryHookEvent): void {
    const dir = join(this.projectRoot, HOOKS_DIR);
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }

    const existing = this.getPendingHooks();

    // Avoid duplicates
    const alreadyPending = existing.some(e => e.path === event.path && e.type === event.type);
    if (!alreadyPending) {
      existing.push(event);
    }

    // Keep only last 50 events
    const toStore = existing.slice(-50);

    writeFileSync(this.hooksPath, JSON.stringify({ events: toStore }, null, 2), 'utf-8');
  }
}

// Singleton
const hookManagers: Map<string, SummaryHookManager> = new Map();

export function getSummaryHookManager(projectRoot: string = process.cwd()): SummaryHookManager {
  if (!hookManagers.has(projectRoot)) {
    hookManagers.set(projectRoot, new SummaryHookManager(projectRoot));
  }
  return hookManagers.get(projectRoot)!;
}

/**
 * Convenience function to trigger hook from anywhere
 */
export function triggerSummaryHook(
  projectRoot: string,
  type: SummaryType,
  path: string
): void {
  const manager = getSummaryHookManager(projectRoot);
  manager.trigger({
    type,
    path,
    timestamp: new Date().toISOString(),
    projectRoot,
  });
}

export { HOOKS_DIR };