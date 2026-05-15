import type { SourceReference } from '../chatbot-types.js';

export interface EmbeddedAnswer {
  id: string;
  question: string;
  answer: string;
  embedding: number[];
  sources: SourceReference[];
  qualityScore: number;
  createdAt: string;
}

export interface EmbeddingIndex {
  version: string;
  type: 'tfidf';
  dimensions: number;
  answers: EmbeddedAnswer[];
  lastUpdated: string;
}

export interface EmbeddingConfig {
  type: 'tfidf';
  threshold: number;
  maxResults: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  type: 'tfidf',
  threshold: 0.75,
  maxResults: 5,
};

export interface CosineSimilarityResult {
  answerId: string;
  score: number;
  answer: EmbeddedAnswer;
}