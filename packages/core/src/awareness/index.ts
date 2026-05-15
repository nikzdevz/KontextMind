/**
 * Self-Awareness Module
 *
 * Agent understands its own capabilities and state.
 * Tracks strengths, weaknesses, attempts, and anti-patterns.
 */

export {
  SelfAwareness,
  getSelfAwareness,
  type AgentState,
  type TaskContext,
  type TaskType,
  type ActionRecord,
  type ActionOutcome,
  type Goal,
  type Blocker,
  type CapabilityProfile,
  type Attempt,
  type AntiPattern,
  type SelfAssessment,
  type SessionSummary,
} from './self-awareness.js';