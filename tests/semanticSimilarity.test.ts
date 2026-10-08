import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  evaluateSemanticMatch,
  SEMANTIC_MATCH_THRESHOLD
} from '../src/backend/utils/semanticSimilarity';

describe('Semantic Similarity & Vector Matching Engine (Gemini 768-dim Embeddings)', () => {
  describe('Fundamental Vector Properties', () => {
    it('returns exactly 1.0 for identical vectors', () => {
      const vecA = [0.2, 0.5, 0.8, -0.3];
      const vecB = [0.2, 0.5, 0.8, -0.3];
      const sim = cosineSimilarity(vecA, vecB);
      expect(sim).toBeCloseTo(1.0, 5);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const sim = cosineSimilarity(vecA, vecB);
      expect(sim).toBeCloseTo(0.0, 5);
    });

    it('returns -1.0 for diametrically opposite vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [-1, -2, -3];
      const sim = cosineSimilarity(vecA, vecB);
      expect(sim).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 when either vector is entirely zero', () => {
      const vecA = [0, 0, 0];
      const vecB = [1, 2, 3];
      expect(cosineSimilarity(vecA, vecB)).toBe(0);
      expect(cosineSimilarity(vecB, vecA)).toBe(0);
    });

    it('returns 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('throws error on vector dimension mismatch', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2];
      expect(() => cosineSimilarity(vecA, vecB)).toThrow('Vector dimension mismatch');
    });
  });

  describe('768-Dimensional Embedding Scale (text-embedding-004 compatibility)', () => {
    it('evaluates full 768-dimensional normalized embedding vectors', () => {
      // Construct two 768-dim normalized vectors with known alignment
      const dim = 768;
      const vecMaster: number[] = new Array(dim);
      const vecQuery: number[] = new Array(dim);

      // Populate pseudo-normalized embedding coordinates
      for (let i = 0; i < dim; i++) {
        const val = Math.sin(i * 0.1);
        vecMaster[i] = val;
        // Minor perturbation to simulate trade synonym variations
        vecQuery[i] = val + (i % 2 === 0 ? 0.02 : -0.02);
      }

      const similarity = cosineSimilarity(vecMaster, vecQuery);

      // Similarity should be very high (above 0.98) due to subtle perturbation
      expect(similarity).toBeGreaterThan(0.95);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Classification Threshold (0.82 Match / Discard Boundary)', () => {
    it('confirms match when similarity exceeds threshold (> 0.82)', () => {
      const evaluation = evaluateSemanticMatch(0.85);
      expect(evaluation.isMatch).toBe(true);
      expect(evaluation.confidenceScore).toBe(85);
      expect(evaluation.threshold).toBe(SEMANTIC_MATCH_THRESHOLD);
    });

    it('confirms match exactly on 0.82 threshold boundary', () => {
      const evaluation = evaluateSemanticMatch(0.82);
      expect(evaluation.isMatch).toBe(true);
      expect(evaluation.confidenceScore).toBe(82);
    });

    it('discards item when similarity falls below threshold (< 0.82)', () => {
      const evaluation = evaluateSemanticMatch(0.79);
      expect(evaluation.isMatch).toBe(false);
      expect(evaluation.confidenceScore).toBe(79);
    });

    it('discards low-confidence noise (e.g. 0.45 random match)', () => {
      const evaluation = evaluateSemanticMatch(0.45);
      expect(evaluation.isMatch).toBe(false);
      expect(evaluation.confidenceScore).toBe(45);
    });

    it('supports custom classification threshold when specified', () => {
      const customThreshold = 0.90;
      expect(evaluateSemanticMatch(0.88, customThreshold).isMatch).toBe(false);
      expect(evaluateSemanticMatch(0.92, customThreshold).isMatch).toBe(true);
    });
  });
});
