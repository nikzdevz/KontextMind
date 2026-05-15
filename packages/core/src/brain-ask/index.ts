/**
 * Brain Ask Module
 *
 * Uses learned knowledge to answer questions.
 * Falls back to code reading + LLM when no learned knowledge found.
 */

export {
  BrainAsk,
  getBrainAsk,
  createBrainAsk,
  type BrainAskOptions,
  type BrainAskResult,
  type BrainSource,
  type LearnedSource,
  type BrainStatus,
} from './brain-ask.js';