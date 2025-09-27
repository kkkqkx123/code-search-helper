import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { TYPES } from '../../types';

export interface FusionInput {
  vectorResults: Array<{
    id: string;
    score: number;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    language: string;
    chunkType: string;
    metadata: Record<string, any>;
  }>;
  graphResults: Array<{
    id: string;
    score: number;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    language: string;
    chunkType: string;
    metadata: Record<string, any>;
    graphContext?: {
      dependencies: string[];
      relationships: Array<{
        type: string;
        target: string;
        strength: number;
      }>;
    };
  }>;
  query: string;
  options: {
    limit?: number;
    threshold?: number;
    includeGraph?: boolean;
    searchType?: 'semantic' | 'hybrid' | 'graph';
  };
}

export interface FusionResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
  graphContext?: {
    dependencies: string[];
    relationships: Array<{
      type: string;
      target: string;
      strength: number;
    }>;
  };
  fusionMetrics: {
    vectorScore: number;
    graphScore: number;
    contextualScore: number;
    finalScore: number;
    confidence: number;
  };
}

export interface FusionWeights {
  vector: number;
  graph: number;
  contextual: number;
  recency: number;
  popularity: number;
}

@injectable()
export class ResultFusionEngine {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  async fuse(input: FusionInput): Promise<FusionResult[]> {
    this.logger.info('Starting result fusion', {
      vectorResults: input.vectorResults.length,
      graphResults: input.graphResults.length,
      searchType: input.options.searchType,
    });

    try {
      // Get fusion weights based on query context
      const weights = await this.getFusionWeights(input.query, input.options);

      // Normalize scores
      const normalizedVector = this.normalizeScores(input.vectorResults);
      const normalizedGraph = this.normalizeScores(input.graphResults);

      // Combine and deduplicate results
      const combinedResults = this.combineResults(normalizedVector, normalizedGraph);

      // Apply fusion algorithms
      const fusedResults = await this.applyFusion(combinedResults, weights, input.query);

      // Sort and filter final results
      const finalResults = this.sortAndFilter(fusedResults, input.options);

      this.logger.info('Result fusion completed', {
        inputVectorCount: input.vectorResults.length,
        inputGraphCount: input.graphResults.length,
        outputCount: finalResults.length,
      });

      return finalResults;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Result fusion failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'ResultFusionEngine', operation: 'fuse' }
      );
      throw error;
    }
  }

  private async getFusionWeights(query: string, options: any): Promise<FusionWeights> {
    const config = this.configService.get('fusion') || {};

    // Analyze query to determine optimal weights
    const queryAnalysis = this.analyzeQuery(query);

    const baseWeights: FusionWeights = {
      vector: config.vectorWeight || 0.4,
      graph: config.graphWeight || 0.3,
      contextual: config.contextualWeight || 0.2,
      recency: config.recencyWeight || 0.05,
      popularity: config.popularityWeight || 0.05,
    };

    // Adjust weights based on query type
    if (queryAnalysis.isStructural) {
      baseWeights.graph += 0.2;
      baseWeights.vector -= 0.1;
    }

    if (queryAnalysis.isSemantic) {
      baseWeights.vector += 0.2;
      baseWeights.graph -= 0.1;
    }

    if (options.searchType === 'graph') {
      baseWeights.graph += 0.3;
      baseWeights.vector -= 0.2;
    }

    // Normalize weights to sum to 1
    const total = Object.values(baseWeights).reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights = Object.fromEntries(
      Object.entries(baseWeights).map(([key, value]) => [key, value / total])
    );

    return {
      vector: normalizedWeights.vector || 0,
      graph: normalizedWeights.graph || 0,
      contextual: normalizedWeights.contextual || 0,
      recency: normalizedWeights.recency || 0,
      popularity: normalizedWeights.popularity || 0,
    };
  }

  private analyzeQuery(query: string): {
    isStructural: boolean;
    isSemantic: boolean;
    keywords: string[];
  } {
    const structuralKeywords = [
      'dependency',
      'import',
      'class',
      'function',
      'interface',
      'extends',
      'implements',
      'inherits',
      'calls',
      'uses',
      'references',
    ];

    const semanticKeywords = [
      'what',
      'how',
      'why',
      'describe',
      'explain',
      'purpose',
      'meaning',
      'concept',
      'idea',
      'approach',
      'method',
      'technique',
    ];

    const lowerQuery = query.toLowerCase();
    const keywords = lowerQuery.split(/\s+/);

    return {
      isStructural: structuralKeywords.some(keyword => lowerQuery.includes(keyword)),
      isSemantic: semanticKeywords.some(keyword => lowerQuery.includes(keyword)),
      keywords,
    };
  }

  private normalizeScores(results: any[]): any[] {
    if (results.length === 0) return [];

    const maxScore = Math.max(...results.map(r => r.score));
    const minScore = Math.min(...results.map(r => r.score));
    const range = maxScore - minScore || 1;

    return results.map(result => ({
      ...result,
      normalizedScore: (result.score - minScore) / range,
    }));
  }

  private combineResults(vectorResults: any[], graphResults: any[]): any[] {
    const combinedMap = new Map<string, any>();

    // Add vector results
    vectorResults.forEach(result => {
      combinedMap.set(result.id, {
        ...result,
        vectorScore: result.normalizedScore,
        graphScore: 0,
      });
    });

    // Add or merge graph results
    graphResults.forEach(result => {
      const existing = combinedMap.get(result.id);
      if (existing) {
        existing.graphScore = result.normalizedScore;
        existing.graphContext = result.graphContext;
      } else {
        combinedMap.set(result.id, {
          ...result,
          vectorScore: 0,
          graphScore: result.normalizedScore,
        });
      }
    });

    return Array.from(combinedMap.values());
  }

  private async applyFusion(
    results: any[],
    weights: FusionWeights,
    query: string
  ): Promise<FusionResult[]> {
    return results.map(result => {
      const contextualScore = this.calculateContextualScore(result, query);
      const recencyScore = this.calculateRecencyScore(result);
      const popularityScore = this.calculatePopularityScore(result);

      const finalScore =
        result.vectorScore * weights.vector +
        result.graphScore * weights.graph +
        contextualScore * weights.contextual +
        recencyScore * weights.recency +
        popularityScore * weights.popularity;

      const confidence = this.calculateConfidence(result, finalScore);

      return {
        id: result.id,
        score: finalScore,
        filePath: result.filePath,
        content: result.content,
        startLine: result.startLine,
        endLine: result.endLine,
        language: result.language,
        chunkType: result.chunkType,
        metadata: result.metadata,
        graphContext: result.graphContext,
        fusionMetrics: {
          vectorScore: result.vectorScore,
          graphScore: result.graphScore,
          contextualScore,
          finalScore,
          confidence,
        },
      };
    });
  }

  private calculateContextualScore(result: any, query: string): number {
    // Calculate contextual relevance based on content and query match
    const content = result.content.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);

    let matchCount = 0;
    queryTerms.forEach(term => {
      if (content.includes(term)) {
        matchCount++;
      }
    });

    return Math.min(matchCount / queryTerms.length, 1);
  }

  private calculateRecencyScore(result: any): number {
    // Calculate recency based on metadata or file modification time
    const lastModified = result.metadata?.lastModified || 0;
    const now = Date.now();
    const ageInDays = (now - lastModified) / (1000 * 60 * 60 * 24);

    // Exponential decay for older files
    return Math.exp(-ageInDays / 365);
  }

  private calculatePopularityScore(result: any): number {
    // Calculate popularity based on usage metrics from metadata
    const usageCount = result.metadata?.usageCount || 0;
    const referenceCount = result.metadata?.referenceCount || 0;

    // Normalize to 0-1 range
    return Math.min((usageCount + referenceCount) / 100, 1);
  }

  private calculateConfidence(result: any, finalScore: number): number {
    // Calculate confidence based on score consistency and data quality
    const scoreVariance = Math.abs(result.vectorScore - result.graphScore);
    const hasGraphContext = !!result.graphContext;
    const metadataCompleteness = this.calculateMetadataCompleteness(result.metadata);

    let confidence = finalScore;

    // Reduce confidence if scores are inconsistent
    confidence -= scoreVariance * 0.2;

    // Increase confidence if graph context is available
    if (hasGraphContext) {
      confidence += 0.1;
    }

    // Adjust based on metadata completeness
    confidence *= 0.5 + metadataCompleteness * 0.5;

    return Math.max(0, Math.min(1, confidence));
  }

  private calculateMetadataCompleteness(metadata: Record<string, any>): number {
    if (!metadata) return 0;

    const importantFields = ['language', 'chunkType', 'functionName', 'className'];
    const presentFields = importantFields.filter(field => metadata[field] !== undefined);

    return presentFields.length / importantFields.length;
  }

  private sortAndFilter(results: FusionResult[], options: any): FusionResult[] {
    // Sort by final score descending
    const sorted = results.sort((a, b) => b.score - a.score);

    // Apply threshold
    const threshold = options.threshold || 0.3;
    const filtered = sorted.filter(result => result.score >= threshold);

    // Apply limit
    const limit = options.limit || 10;
    return filtered.slice(0, limit);
  }

  async getFusionStats(): Promise<{
    totalFusions: number;
    averageFusionTime: number;
    averageResultsPerQuery: number;
    weightDistribution: FusionWeights;
  }> {
    // Return statistics about fusion operations
    return {
      totalFusions: 0,
      averageFusionTime: 0,
      averageResultsPerQuery: 0,
      weightDistribution: {
        vector: 0.4,
        graph: 0.3,
        contextual: 0.2,
        recency: 0.05,
        popularity: 0.05,
      },
    };
  }
}
