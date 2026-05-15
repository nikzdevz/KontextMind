/**
 * Realtime Module
 *
 * Real-time context injection and monitoring.
 */

export {
  RealtimeContextInjector,
  getRealtimeContextInjector,
  type ContextEvent,
  type InjectionRule,
  type RuleCondition,
  type InjectionTarget,
  type InjectionResult,
  type MonitorState,
} from './realtime-context-injector.js';

export { REALTIME_DIR } from './realtime-context-injector.js';