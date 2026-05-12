export class TfidfEmbedder {
  private vocabulary: Map<string, number> = new Map();
  private idf: number[] = [];
  private documentCount = 0;

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  computeTf(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    for (const [token, count] of tf) {
      tf.set(token, count / tokens.length);
    }
    return tf;
  }

  buildVocabulary(documents: string[]): void {
    const docFreq = new Map<string, number>();
    this.documentCount = documents.length;

    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    let idx = 0;
    this.idf = [];
    for (const [token, freq] of docFreq) {
      this.vocabulary.set(token, idx);
      this.idf.push(Math.log(this.documentCount / freq));
      idx++;
    }
  }

  computeEmbedding(text: string): number[] {
    const tokens = this.tokenize(text);
    const tf = this.computeTf(tokens);
    const vector: number[] = new Array(this.vocabulary.size).fill(0);

    for (const [token, tfValue] of tf) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) {
        vector[idx] = tfValue * (this.idf[idx] || 0);
      }
    }

    return vector;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  findSimilar(
    query: string,
    candidates: Array<{ id: string; question: string; answer: string; embedding: number[] }>,
    threshold: number = 0.75
  ): Array<{ id: string; score: number; question: string; answer: string }> {
    const queryVector = this.computeEmbedding(query);

    return candidates
      .map(c => ({
        id: c.id,
        score: this.cosineSimilarity(queryVector, c.embedding),
        question: c.question,
        answer: c.answer,
      }))
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }

  getVocabularySize(): number {
    return this.vocabulary.size;
  }
}

export function createTfidfEmbedder(): TfidfEmbedder {
  return new TfidfEmbedder();
}