/**
 * Learning Module
 *
 * Outcome tracking and learning from feedback.
 * Learning bridge for automatic sync from summaries and Q&A.
 */

export {
  OutcomeTracker,
  getOutcomeTracker,
  type FeedbackSources,
  type SelfAssessmentResult,
  type MCPSignals,
  type ExecutionResult,
  type LintIssue,
  type ImplicitBehaviorResult,
  type PatternMatchResult,
  type RecordedOutcome,
  type OutcomePattern,
  type LearningStats,
  type Improvement,
} from './outcome-tracker.js';

export {
  LearningBridge,
  getLearningBridge,
  createLearningBridge,
  type BridgeConfig,
  type SyncResult as LearningSyncResult,
  type LearnedInsight,
  type ImportOptions,
  type ImportResult,
  type BrainStatus,
} from './learning-bridge.js';

export { LEARNING_DIR } from './outcome-tracker.js';