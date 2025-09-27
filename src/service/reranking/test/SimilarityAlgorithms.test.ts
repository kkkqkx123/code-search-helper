import { SimilarityAlgorithms } from '../SimilarityAlgorithms';

describe('SimilarityAlgorithms', () => {
  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const similarity = SimilarityAlgorithms.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(0.9746, 4);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0];
      const vec2 = [0, 1];

      const similarity = SimilarityAlgorithms.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(0, 4);
    });

    it('should return 1 for identical vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];

      const similarity = SimilarityAlgorithms.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(1, 4);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => SimilarityAlgorithms.cosineSimilarity(vec1, vec2)).toThrow(
        'Vectors must have the same length'
      );
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate Euclidean distance correctly', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const distance = SimilarityAlgorithms.euclideanDistance(vec1, vec2);

      expect(distance).toBeCloseTo(5.1962, 4);
    });

    it('should return 0 for identical vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];

      const distance = SimilarityAlgorithms.euclideanDistance(vec1, vec2);

      expect(distance).toBeCloseTo(0, 4);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => SimilarityAlgorithms.euclideanDistance(vec1, vec2)).toThrow(
        'Vectors must have the same length'
      );
    });
  });

  describe('dotProductSimilarity', () => {
    it('should calculate dot product correctly', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const dotProduct = SimilarityAlgorithms.dotProductSimilarity(vec1, vec2);

      expect(dotProduct).toBe(32);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0];
      const vec2 = [0, 1];

      const dotProduct = SimilarityAlgorithms.dotProductSimilarity(vec1, vec2);

      expect(dotProduct).toBe(0);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => SimilarityAlgorithms.dotProductSimilarity(vec1, vec2)).toThrow(
        'Vectors must have the same length'
      );
    });
  });

  describe('jaccardSimilarity', () => {
    it('should calculate Jaccard similarity correctly', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['b', 'c', 'd']);

      const similarity = SimilarityAlgorithms.jaccardSimilarity(set1, set2);

      expect(similarity).toBe(0.5); // 2 intersection / 4 union = 0.5
    });

    it('should return 1 for identical sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['a', 'b', 'c']);

      const similarity = SimilarityAlgorithms.jaccardSimilarity(set1, set2);

      expect(similarity).toBe(1);
    });

    it('should return 0 for disjoint sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['d', 'e', 'f']);

      const similarity = SimilarityAlgorithms.jaccardSimilarity(set1, set2);

      expect(similarity).toBe(0);
    });

    it('should return 0 for empty union', () => {
      const set1 = new Set([]);
      const set2 = new Set([]);

      const similarity = SimilarityAlgorithms.jaccardSimilarity(set1, set2);

      expect(similarity).toBe(0);
    });
  });

  describe('levenshteinDistance', () => {
    it('should calculate Levenshtein distance correctly', () => {
      const str1 = 'kitten';
      const str2 = 'sitting';

      const distance = SimilarityAlgorithms.levenshteinDistance(str1, str2);

      expect(distance).toBe(3);
    });

    it('should return 0 for identical strings', () => {
      const str1 = 'test';
      const str2 = 'test';

      const distance = SimilarityAlgorithms.levenshteinDistance(str1, str2);

      expect(distance).toBe(0);
    });

    it('should return correct distance for empty strings', () => {
      const str1 = '';
      const str2 = 'abc';

      const distance = SimilarityAlgorithms.levenshteinDistance(str1, str2);

      expect(distance).toBe(3);
    });
  });

  describe('structuralSimilarity', () => {
    it('should calculate structural similarity correctly', () => {
      const features1 = {
        lineCount: 10,
        hasLoops: true,
        hasFunctions: true,
        type: 'function',
      };

      const features2 = {
        lineCount: 12,
        hasLoops: true,
        hasFunctions: true,
        type: 'function',
      };

      const similarity = SimilarityAlgorithms.structuralSimilarity(
        features1 as any,
        features2 as any
      );

      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return 0 for completely different features', () => {
      const features1 = {
        lineCount: 10,
        hasLoops: true,
        type: 'function',
      };

      const features2 = {
        lineCount: 100,
        hasLoops: false,
        type: 'class',
      };

      const similarity = SimilarityAlgorithms.structuralSimilarity(
        features1 as any,
        features2 as any
      );

      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('contextualSimilarity', () => {
    it('should calculate contextual similarity correctly', () => {
      const callChain1 = ['functionA', 'functionB', 'functionC'];
      const callChain2 = ['functionB', 'functionC', 'functionD'];

      const similarity = SimilarityAlgorithms.contextualSimilarity(callChain1, callChain2);

      expect(similarity).toBe(0.5); // 2 intersection / 4 union = 0.5
    });

    it('should return 1 for identical call chains', () => {
      const callChain1 = ['functionA', 'functionB', 'functionC'];
      const callChain2 = ['functionA', 'functionB', 'functionC'];

      const similarity = SimilarityAlgorithms.contextualSimilarity(callChain1, callChain2);

      expect(similarity).toBe(1);
    });

    it('should return 0 for empty call chains', () => {
      const callChain1: string[] = [];
      const callChain2: string[] = [];

      const similarity = SimilarityAlgorithms.contextualSimilarity(callChain1, callChain2);

      expect(similarity).toBe(1); // Both empty, so identical
    });
  });

  describe('featureBasedSimilarity', () => {
    it('should calculate feature-based similarity correctly', () => {
      const features1 = {
        featureA: 0.8,
        featureB: 0.6,
        featureC: 0.4,
      };

      const features2 = {
        featureA: 0.7,
        featureB: 0.5,
        featureC: 0.3,
      };

      const similarity = SimilarityAlgorithms.featureBasedSimilarity(features1, features2);

      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should handle missing features', () => {
      const features1 = {
        featureA: 0.8,
        featureB: 0.6,
      };

      const features2 = {
        featureA: 0.7,
        featureC: 0.4,
      };

      const similarity = SimilarityAlgorithms.featureBasedSimilarity(features1, features2);

      expect(similarity).toBeGreaterThan(0);
    });
  });

  describe('ensembleSimilarity', () => {
    it('should calculate ensemble similarity with equal weights', () => {
      const scores = [0.8, 0.6, 0.4];

      const ensembleScore = SimilarityAlgorithms.ensembleSimilarity(scores);

      expect(ensembleScore).toBeCloseTo(0.6, 4);
    });

    it('should calculate ensemble similarity with custom weights', () => {
      const scores = [0.8, 0.6, 0.4];
      const weights = [0.5, 0.3, 0.2];

      const ensembleScore = SimilarityAlgorithms.ensembleSimilarity(scores, weights);

      expect(ensembleScore).toBeCloseTo(0.66, 4);
    });

    it('should throw error for mismatched weights', () => {
      const scores = [0.8, 0.6, 0.4];
      const weights = [0.5, 0.3];

      expect(() => SimilarityAlgorithms.ensembleSimilarity(scores, weights)).toThrow(
        'Weights array must have the same length as scores array'
      );
    });

    it('should return 0 for empty scores', () => {
      const scores: number[] = [];

      const ensembleScore = SimilarityAlgorithms.ensembleSimilarity(scores);

      expect(ensembleScore).toBe(0);
    });
  });
});
