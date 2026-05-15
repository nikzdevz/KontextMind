import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';
import { TfidfEmbedder, createTfidfEmbedder } from './providers/tfidf-embedder.js';
import type { EmbeddedAnswer, EmbeddingIndex, EmbeddingConfig, CosineSimilarityResult } from './types/embedding-types.js';

const EMBEDDINGS_DIR = '.kontextmind/chatbot/embeddings';
const INDEX_FILE = 'index.json';
const CONFIG_FILE = 'config.json';

const DEFAULT_CONFIG: EmbeddingConfig = {
  type: 'tfidf',
  threshold: 0.75,
  maxResults: 5,
};

export function loadEmbeddingConfig(projectRoot: string): EmbeddingConfig {
  const path = join(projectRoot, EMBEDDINGS_DIR, CONFIG_FILE);
  if (!existsSync(path)) return DEFAULT_CONFIG;

  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(path, 'utf-8')) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveEmbeddingConfig(projectRoot: string, config: EmbeddingConfig): void {
  const dir = join(projectRoot, EMBEDDINGS_DIR);
  ensureDir(dir);
  writeFileSync(join(dir, CONFIG_FILE), JSON.stringify(config, null, 2), 'utf-8');
}

export function loadEmbeddingIndex(projectRoot: string): EmbeddingIndex | null {
  const path = join(projectRoot, EMBEDDINGS_DIR, INDEX_FILE);
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as EmbeddingIndex;
  } catch {
    return null;
  }
}

export function saveEmbeddingIndex(projectRoot: string, index: EmbeddingIndex): void {
  const dir = join(projectRoot, EMBEDDINGS_DIR);
  ensureDir(dir);
  writeFileSync(join(dir, INDEX_FILE), JSON.stringify(index, null, 2), 'utf-8');
}

export function indexAnswer(
  projectRoot: string,
  answer: {
    id: string;
    question: string;
    answer: string;
    sources: EmbeddedAnswer['sources'];
    qualityScore?: number;
  }
): void {
  const embedder = createTfidfEmbedder();
  const embedding = embedder.computeEmbedding(answer.question);

  const index = loadEmbeddingIndex(projectRoot) || {
    version: '1.0.0',
    type: 'tfidf' as const,
    dimensions: embedding.length,
    answers: [],
    lastUpdated: new Date().toISOString(),
  };

  // Remove existing entry with same id if exists
  index.answers = index.answers.filter(a => a.id !== answer.id);

  // Add new entry
  index.answers.push({
    id: answer.id,
    question: answer.question,
    answer: answer.answer,
    embedding,
    sources: answer.sources,
    qualityScore: answer.qualityScore || 0,
    createdAt: new Date().toISOString(),
  });

  index.dimensions = embedding.length;
  index.lastUpdated = new Date().toISOString();

  saveEmbeddingIndex(projectRoot, index);
}

export function findSimilarAnswers(
  projectRoot: string,
  question: string,
  options: { threshold?: number; maxResults?: number } = {}
): Array<{ id: string; score: number; question: string; answer: string; sources: EmbeddedAnswer['sources']; qualityScore: number }> {
  const config = loadEmbeddingConfig(projectRoot);
  const threshold = options.threshold ?? config.threshold;
  const maxResults = options.maxResults ?? config.maxResults;

  const index = loadEmbeddingIndex(projectRoot);
  if (!index || index.answers.length === 0) {
    return [];
  }

  const embedder = createTfidfEmbedder();
  embedder.buildVocabulary(index.answers.map(a => a.question));

  const results = embedder.findSimilar(
    question,
    index.answers.map(a => ({
      id: a.id,
      question: a.question,
      answer: a.answer,
      embedding: a.embedding,
    })),
    threshold
  );

  return results.slice(0, maxResults).map(r => {
    const original = index.answers.find(a => a.id === r.id)!;
    return {
      id: r.id,
      score: r.score,
      question: r.question,
      answer: r.answer,
      sources: original.sources,
      qualityScore: original.qualityScore,
    };
  });
}

export async function regenerateEmbeddingIndex(projectRoot: string): Promise<void> {
  const { loadHistory } = await import('./qa-history.js');

  const records = await loadHistory(projectRoot, { limit: 500 });
  if (records.length === 0) return;

  const embedder = createTfidfEmbedder();
  const questions = records.map(r => r.question);
  embedder.buildVocabulary(questions);

  const answers: EmbeddedAnswer[] = records.slice(0, 100).map(r => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    embedding: embedder.computeEmbedding(r.question),
    sources: r.sources,
    qualityScore: r.qualityScore || 0,
    createdAt: r.timestamp,
  }));

  const index: EmbeddingIndex = {
    version: '1.0.0',
    type: 'tfidf',
    dimensions: embedder.getVocabularySize(),
    answers,
    lastUpdated: new Date().toISOString(),
  };

  saveEmbeddingIndex(projectRoot, index);
}

export function clearEmbeddingIndex(projectRoot: string): void {
  const dir = join(projectRoot, EMBEDDINGS_DIR);
  const indexPath = join(dir, INDEX_FILE);

  if (existsSync(indexPath)) {
    writeFileSync(indexPath, JSON.stringify({
      version: '1.0.0',
      type: 'tfidf',
      dimensions: 0,
      answers: [],
      lastUpdated: new Date().toISOString(),
    }, null, 2), 'utf-8');
  }
}

export function getEmbeddingStats(projectRoot: string): {
  answerCount: number;
  dimensions: number;
  lastUpdated: string | null;
  type: string;
} {
  const index = loadEmbeddingIndex(projectRoot);
  if (!index) {
    return { answerCount: 0, dimensions: 0, lastUpdated: null, type: 'tfidf' };
  }

  return {
    answerCount: index.answers.length,
    dimensions: index.dimensions,
    lastUpdated: index.lastUpdated,
    type: index.type,
  };
}