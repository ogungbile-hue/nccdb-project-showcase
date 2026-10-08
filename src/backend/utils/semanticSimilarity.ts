/**
 * 768-Dimensional Semantic Vector Similarity Engine
 * Architecture Showcase & Public API Contracts
 *
 * =============================================================================
 * ARCHITECTURAL SPECIFICATION & NOTICE
 * =============================================================================
 * Implements high-performance Euclidean vector normalization and cosine
 * similarity evaluation over 768-dimensional text-embedding-004 vectors.
 * Gates trade catalog matches against an acceptance threshold (default >= 0.82).
 * =============================================================================
 * @packageDocumentation
 */

export const SEMANTIC_MATCH_THRESHOLD = 0.82;

/**
 * Computes cosine similarity between two numeric vectors:
 * dotProduct(A, B) / (norm(A) * norm(B))
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector dimension mismatch: vecA has length ${vecA.length}, vecB has length ${vecB.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Evaluates whether a calculated cosine similarity score satisfies the
 * classification acceptance threshold (default >= 0.82).
 */
export function evaluateSemanticMatch(
  similarity: number,
  threshold: number = SEMANTIC_MATCH_THRESHOLD
): { isMatch: boolean; confidenceScore: number; threshold: number } {
  const boundedSimilarity = Math.max(-1, Math.min(1, similarity));
  const confidenceScore = Math.round(boundedSimilarity * 10000) / 100; // e.g. 85.42%

  return {
    isMatch: similarity >= threshold,
    confidenceScore,
    threshold
  };
}
