/**
 * Integration Event Bus
 *
 * Event-driven communication between brain components.
 * Enables loose coupling and reactive system design.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const EVENTBUS_DIR = '.kontextmind/eventbus';

export type EventType =
  | 'memory.updated'
  | 'memory.recalled'
  | 'context.changed'
  | 'context.inject'
  | 'awareness.updated'
  | 'skill.executed'
  | 'skill.failed'
  | 'prediction.made'
  | 'handoff.generated'
  | 'sync.completed'
  | 'error.occurred'
  | 'custom';

export interface Event {
  id: string;
  type: EventType;
  source: string;
  payload: any;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface EventHandler {
  id: string;
  eventType: EventType;
  handler: (event: Event) => void | Promise<void>;
  filter?: (event: Event) => boolean;
  priority: number;
  enabled: boolean;
}

export interface Subscription {
  id: string;
  handlerId: string;
  eventType: EventType;
  createdAt: string;
}

export interface EventBusStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  activeHandlers: number;
  subscriptions: number;
}

export interface BusConfig {
  maxQueueSize: number;
  historySize: number;
  enableLogging: boolean;
  asyncHandlers: boolean;
}

/**
 * IntegrationEventBus - Event-driven communication hub
 */
export class IntegrationEventBus {
  private projectRoot: string;
  private statePath: string;
  private handlers: Map<string, EventHandler> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private eventQueue: Event[] = [];
  private eventHistory: Event[] = [];
  private config: BusConfig;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, EVENTBUS_DIR, 'bus.json');
    this.config = this.loadConfig();
    this.load();
  }

  /**
   * Register an event handler
   */
  register(handler: Omit<EventHandler, 'id'>): string {
    const id = this.generateId();
    const fullHandler: EventHandler = {
      ...handler,
      id,
    };

    this.handlers.set(id, fullHandler);
    this.save();
    return id;
  }

  /**
   * Subscribe to event type
   */
  subscribe(eventType: EventType, handlerId: string): string {
    const subscription: Subscription = {
      id: this.generateId(),
      handlerId,
      eventType,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscription.id, subscription);
    this.save();
    return subscription.id;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Emit an event
   */
  emit(type: EventType, source: string, payload: any, metadata?: Record<string, any>): Event {
    const event: Event = {
      id: this.generateId(),
      type,
      source,
      payload,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Add to queue
    this.eventQueue.push(event);
    if (this.eventQueue.length > this.config.maxQueueSize) {
      this.eventQueue = this.eventQueue.slice(-this.config.maxQueueSize);
    }

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.config.historySize) {
      this.eventHistory = this.eventHistory.slice(-this.config.historySize);
    }

    // Process immediately
    this.processEvent(event);

    return event;
  }

  /**
   * Process event through handlers
   */
  private processEvent(event: Event): void {
    // Get matching handlers
    const matchingHandlers = [...this.handlers.values()]
      .filter(h => h.enabled && (h.eventType === event.type || h.eventType === 'custom'))
      .filter(h => !h.filter || h.filter(event))
      .sort((a, b) => b.priority - a.priority);

    // Get matching subscriptions
    const matchingSubscriptions = [...this.subscriptions.values()]
      .filter(s => s.eventType === event.type || s.eventType === 'custom');

    // Execute handlers
    for (const handler of matchingHandlers) {
      try {
        const result = handler.handler(event);
        if (result instanceof Promise && this.config.asyncHandlers) {
          result.catch(err => console.error(`Handler ${handler.id} failed:`, err));
        }
      } catch (err) {
        console.error(`Handler ${handler.id} failed:`, err);
      }
    }
  }

  /**
   * Emit async (queued for later processing)
   */
  emitAsync(type: EventType, source: string, payload: any, metadata?: Record<string, any>): void {
    const event: Event = {
      id: this.generateId(),
      type,
      source,
      payload,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.eventQueue.push(event);
    if (this.eventQueue.length > this.config.maxQueueSize) {
      this.eventQueue.shift();
    }
  }

  /**
   * Process queued events
   */
  processQueue(): number {
    let processed = 0;
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        this.processEvent(event);
        processed++;
      }
    }
    return processed;
  }

  /**
   * Get event history
   */
  getHistory(type?: EventType, limit: number = 100): Event[] {
    let events = this.eventHistory;
    if (type) {
      events = events.filter(e => e.type === type);
    }
    return events.slice(-limit);
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 20): Event[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: EventType): Event[] {
    return this.eventHistory.filter(e => e.type === type);
  }

  /**
   * Enable/disable handler
   */
  setHandlerEnabled(handlerId: string, enabled: boolean): boolean {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      handler.enabled = enabled;
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get all handlers
   */
  getHandlers(): EventHandler[] {
    return [...this.handlers.values()];
  }

  /**
   * Get handlers for event type
   */
  getHandlersForType(type: EventType): EventHandler[] {
    return [...this.handlers.values()].filter(h => h.enabled && h.eventType === type);
  }

  /**
   * Get all subscriptions
   */
  getSubscriptions(): Subscription[] {
    return [...this.subscriptions.values()];
  }

  /**
   * Remove handler
   */
  removeHandler(handlerId: string): boolean {
    // Remove associated subscriptions
    for (const [subId, sub] of this.subscriptions.entries()) {
      if (sub.handlerId === handlerId) {
        this.subscriptions.delete(subId);
      }
    }
    return this.handlers.delete(handlerId);
  }

  /**
   * Get bus statistics
   */
  getStats(): EventBusStats {
    const eventsByType: Record<string, number> = {};
    let totalEvents = 0;

    for (const event of this.eventHistory) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      totalEvents++;
    }

    return {
      totalEvents,
      eventsByType,
      activeHandlers: [...this.handlers.values()].filter(h => h.enabled).length,
      subscriptions: this.subscriptions.size,
    };
  }

  /**
   * Set bus configuration
   */
  setConfig(config: Partial<BusConfig>): void {
    this.config = { ...this.config, ...config };
    this.save();
  }

  /**
   * Get bus configuration
   */
  getConfig(): BusConfig {
    return { ...this.config };
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.eventQueue = [];
    this.save();
  }

  /**
   * Clear all handlers and subscriptions
   */
  clear(): void {
    this.handlers.clear();
    this.subscriptions.clear();
    this.eventHistory = [];
    this.eventQueue = [];
    this.save();
  }

  // ============ Private Methods ============

  private generateId(): string {
    return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private getDefaultConfig(): BusConfig {
    return {
      maxQueueSize: 1000,
      historySize: 500,
      enableLogging: true,
      asyncHandlers: true,
    };
  }

  private loadConfig(): BusConfig {
    return this.getDefaultConfig();
  }

  private load(): void {
    ensureDir(join(this.projectRoot, EVENTBUS_DIR));

    if (existsSync(this.statePath)) {
      try {
        const content = readFileSync(this.statePath, 'utf-8');
        const data = JSON.parse(content);
        for (const h of data.handlers || []) {
          this.handlers.set(h.id, h);
        }
        for (const s of data.subscriptions || []) {
          this.subscriptions.set(s.id, s);
        }
        this.eventHistory = data.eventHistory || [];
        this.config = { ...this.getDefaultConfig(), ...(data.config || {}) };
      } catch (error) {
        console.error('Failed to load event bus state:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, EVENTBUS_DIR));

    writeFileSync(this.statePath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      handlers: [...this.handlers.values()],
      subscriptions: [...this.subscriptions.values()],
      eventHistory: this.eventHistory.slice(-this.config.historySize),
      config: this.config,
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, IntegrationEventBus> = new Map();

export function getIntegrationEventBus(projectRoot: string = process.cwd()): IntegrationEventBus {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new IntegrationEventBus(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { EVENTBUS_DIR };