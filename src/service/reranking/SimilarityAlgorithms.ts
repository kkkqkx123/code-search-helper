import { injectable } from 'inversify';

@injectable()
export class SimilarityAlgorithms {
  /**
   * Calculate cosine similarity between two vectors
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Cosine similarity score between 0 and 1
   */
  static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calculate Euclidean distance between two vectors
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Euclidean distance
   */
  static euclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    const sum = vec1.reduce((acc, val, i) => acc + Math.pow(val - vec2[i], 2), 0);
    return Math.sqrt(sum);
  }

  /**
   * Calculate dot product similarity between two vectors
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Dot product value
   */
  static dotProductSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  }

  /**
   * Calculate Jaccard similarity between two sets
   * @param set1 First set
   * @param set2 Second set
   * @returns Jaccard similarity score between 0 and 1
   */
  static jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...Array.from(set1)].filter(x => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param str1 First string
   * @param str2 Second string
   * @returns Levenshtein distance
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate structural similarity based on AST features
   * @param features1 First set of features
   * @param features2 Second set of features
   * @returns Structural similarity score between 0 and 1
   */
  static structuralSimilarity(
    features1: Record<string, any>,
    features2: Record<string, any>
  ): number {
    const similarities: number[] = [];

    // Compare numeric features
    const numericFeatures = [
      'lineCount',
      'avgLineLength',
      'bracketCount',
      'parenthesisCount',
      'semicolonCount',
      'complexity',
    ];
    for (const feature of numericFeatures) {
      if (features1[feature] !== undefined && features2[feature] !== undefined) {
        const val1 = features1[feature] as number;
        const val2 = features2[feature] as number;
        const maxVal = Math.max(val1, val2);
        const similarity = maxVal > 0 ? 1 - Math.abs(val1 - val2) / maxVal : 1;
        similarities.push(similarity);
      }
    }

    // Compare boolean features
    const booleanFeatures = [
      'hasLoops',
      'hasConditionals',
      'hasFunctions',
      'hasClasses',
      'hasReturns',
      'hasExceptions',
    ];
    for (const feature of booleanFeatures) {
      if (features1[feature] !== undefined && features2[feature] !== undefined) {
        const val1 = features1[feature] as boolean;
        const val2 = features2[feature] as boolean;
        const similarity = val1 === val2 ? 1 : 0;
        similarities.push(similarity);
      }
    }

    // Compare type
    if (features1.type !== undefined && features2.type !== undefined) {
      const typeSimilarity = features1.type === features2.type ? 1 : 0;
      similarities.push(typeSimilarity);
    }

    if (similarities.length === 0) {
      return 0;
    }

    return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
  }

  /**
   * Calculate contextual similarity based on call chain analysis
   * @param callChain1 First call chain
   * @param callChain2 Second call chain
   * @returns Contextual similarity score between 0 and 1
   */
  static contextualSimilarity(callChain1: string[], callChain2: string[]): number {
    if (callChain1.length === 0 && callChain2.length === 0) {
      return 1;
    }

    if (callChain1.length === 0 || callChain2.length === 0) {
      return 0;
    }

    // Convert to sets for Jaccard similarity
    const set1 = new Set(callChain1);
    const set2 = new Set(callChain2);

    return this.jaccardSimilarity(set1, set2);
  }

  /**
   * Calculate feature-based similarity
   * @param features1 First set of features
   * @param features2 Second set of features
   * @returns Feature-based similarity score between 0 and 1
   */
  static featureBasedSimilarity(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    const allKeys = new Set([...Object.keys(features1), ...Object.keys(features2)]);

    if (allKeys.size === 0) {
      return 1;
    }

    let similaritySum = 0;
    let weightSum = 0;

    for (const key of Array.from(allKeys)) {
      const val1 = features1[key] || 0;
      const val2 = features2[key] || 0;

      // Weight based on the magnitude of features
      const weight = Math.max(val1, val2);
      weightSum += weight;

      // Calculate similarity for this feature
      const maxVal = Math.max(val1, val2);
      const similarity = maxVal > 0 ? 1 - Math.abs(val1 - val2) / maxVal : 1;
      similaritySum += similarity * weight;
    }

    return weightSum > 0 ? similaritySum / weightSum : 0;
  }

  /**
   * Ensemble method combining multiple similarity scores
   * @param scores Array of similarity scores
   * @param weights Optional weights for each score
   * @returns Combined ensemble score
   */
  static ensembleSimilarity(scores: number[], weights?: number[]): number {
    if (scores.length === 0) {
      return 0;
    }

    if (weights && weights.length !== scores.length) {
      throw new Error('Weights array must have the same length as scores array');
    }

    // Default to equal weights if not provided
    const normalizedWeights = weights || scores.map(() => 1 / scores.length);

    // Normalize weights to sum to 1
    const weightSum = normalizedWeights.reduce((sum, w) => sum + w, 0);
    const finalWeights = normalizedWeights.map(w => w / weightSum);

    // Calculate weighted average
    const weightedSum = scores.reduce((sum, score, i) => sum + score * finalWeights[i], 0);

    return weightedSum;
  }
}
