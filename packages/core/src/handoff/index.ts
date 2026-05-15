/**
 * Handoff Module
 *
 * Proactive session handoff system.
 */

export {
  ProactiveHandoff,
  getProactiveHandoff,
  type HandoffDocument,
  type HandoffValidation,
  type AgentSuggestion,
} from './proactive-handoff.js';

// Re-export Decision explicitly to avoid naming conflicts
export type { Decision as HandoffDecision } from './proactive-handoff.js';

export { HANDOFF_DIR } from './proactive-handoff.js';