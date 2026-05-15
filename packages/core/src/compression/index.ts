/**
 * Compression Module
 *
 * Compresses conversations while preserving meaning.
 */

export {
  ConversationCompressor,
  getConversationCompressor,
  type KeyPoint,
  type ConversationSummary,
  type CompressedConversation,
  type CompressionOptions,
} from './conversation-compressor.js';

// Re-export Decision with alias to avoid conflicts
export type { Decision as CompressionDecision } from './conversation-compressor.js';

export { COMPRESSION_DIR } from './conversation-compressor.js';
