/**
 * Hooks Module
 *
 * Event hooks for automatic learning triggers.
 */

export {
  SummaryHookManager,
  getSummaryHookManager,
  triggerSummaryHook,
  type SummaryHookEvent,
  type HookCallback,
  type SummaryType,
} from './summary-hooks.js';

export { HOOKS_DIR } from './summary-hooks.js';