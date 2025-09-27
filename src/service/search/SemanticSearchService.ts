import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { VectorStorageService } from '../storage/vector/VectorStorageService';
import { SearchResult } from '../../database/qdrant/QdrantClientWrapper';
import { CacheManager } from '../cache/CacheManager';
import { CacheInterface } from '../cache/CacheInterface';

export interface SemanticSearchParams {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
    snippetType?: string[];
  };
  boostFactors?: {
    recency?: number;
    popularity?: number;
    relevance?: number;
  };
}

export interface SemanticSearchResult {
  id: string;
  score: number;
  similarity: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  snippetMetadata?: any;
  metadata: Record<string, any>;
  rankingFactors: {
    semanticScore: number;
    contextualScore: number;
    recencyScore: number;
    popularityScore: number;
    finalScore: number;
  };
}

export interface SemanticSearchMetrics {
  queryId: string;
  executionTime: number;
  embeddingTime: number;
  searchTime: number;
  rankingTime: number;
  totalResults: number;
  averageSimilarity: number;
  searchStrategy: string;
}

@injectable()
export class SemanticSearchService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private embedderFactory: EmbedderFactory;
  private vectorStorage: VectorStorageService;
  private cacheManager: CacheManager;
  private searchCache!: CacheInterface;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.EmbedderFactory) embedderFactory: EmbedderFactory,
    @inject(TYPES.VectorStorageService) vectorStorage: VectorStorageService,
    @inject(TYPES.CacheManager) cacheManager: CacheManager
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.embedderFactory = embedderFactory;
    this.vectorStorage = vectorStorage;
    this.cacheManager = cacheManager;
  }

  private async getCache(): Promise<CacheInterface> {
    if (!this.searchCache) {
      this.searchCache = await this.cacheManager.getSearchCache();
    }
    return this.searchCache;
  }

  async search(params: SemanticSearchParams): Promise<{
    results: SemanticSearchResult[];
    metrics: SemanticSearchMetrics;
  }> {
    const queryId = this.generateQueryId(params.query);
    const startTime = Date.now();

    this.logger.info('Starting semantic search', {
      queryId,
      query: params.query,
      projectId: params.projectId,
      limit: params.limit,
    });

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(params);
      const cache = await this.getCache();
      const cachedResults = await cache.get<SemanticSearchResult[]>(cacheKey);

      if (cachedResults) {
        this.logger.debug('Cache hit for semantic search', {
          queryId,
          cacheKey,
          resultCount: cachedResults.length,
        });

        const metrics: SemanticSearchMetrics = {
          queryId,
          executionTime: Date.now() - startTime,
          embeddingTime: 0,
          searchTime: 0,
          rankingTime: 0,
          totalResults: cachedResults.length,
          averageSimilarity: this.calculateAverageSimilarity(cachedResults),
          searchStrategy: 'semantic_vector_cache',
        };

        return {
          results: cachedResults,
          metrics,
        };
      }

      // Generate query embedding
      const embeddingStartTime = Date.now();
      const queryEmbedding = await this.generateQueryEmbedding(params.query);
      const embeddingTime = Date.now() - embeddingStartTime;

      // Perform vector search
      const searchStartTime = Date.now();
      const vectorResults = await this.vectorStorage.searchVectors(queryEmbedding.vector, {
        limit: params.limit || 10,
        withPayload: true,
        scoreThreshold: params.threshold || 0.7,
        filter: params.filters ? this.normalizeFilters(params.filters) : undefined,
      });
      const searchTime = Date.now() - searchStartTime;

      // Rank and enhance results
      const rankingStartTime = Date.now();
      const enhancedResults = await this.enhanceResults(vectorResults, params);
      const rankingTime = Date.now() - rankingStartTime;

      const finalResults = this.sortAndFilterResults(enhancedResults, params);

      // Cache the results
      await cache.set(cacheKey, finalResults);

      const metrics: SemanticSearchMetrics = {
        queryId,
        executionTime: Date.now() - startTime,
        embeddingTime,
        searchTime,
        rankingTime,
        totalResults: finalResults.length,
        averageSimilarity: this.calculateAverageSimilarity(finalResults),
        searchStrategy: 'semantic_vector',
      };

      this.logger.info('Semantic search completed', {
        queryId,
        resultCount: finalResults.length,
        executionTime: metrics.executionTime,
        averageSimilarity: metrics.averageSimilarity,
        cached: false,
      });

      return {
        results: finalResults,
        metrics,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Semantic search failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'SemanticSearchService', operation: 'search' }
      );
      throw error;
    }
  }

  async searchSimilar(
    content: string,
    params: {
      projectId: string;
      limit?: number;
      threshold?: number;
      excludeIds?: string[];
    }
  ): Promise<SemanticSearchResult[]> {
    this.logger.info('Searching similar content', {
      projectId: params.projectId,
      contentLength: content.length,
      limit: params.limit,
    });

    try {
      // Generate content embedding
      const contentEmbedding = await this.generateQueryEmbedding(content);

      // Search for similar content
      const vectorResults = await this.vectorStorage.searchVectors(contentEmbedding.vector, {
        limit: params.limit || 10,
        withPayload: true,
        scoreThreshold: params.threshold || 0.8,
        filter: { projectId: params.projectId },
      });

      // Filter out excluded IDs
      const filteredResults = params.excludeIds
        ? vectorResults.filter((result: SearchResult) => !params.excludeIds!.includes(result.id))
        : vectorResults;

      // Enhance results
      const enhancedResults = await this.enhanceResults(filteredResults, {
        query: content,
        projectId: params.projectId,
        limit: params.limit,
        threshold: params.threshold,
      });

      return this.sortAndFilterResults(enhancedResults, {
        query: content,
        projectId: params.projectId,
        limit: params.limit,
        threshold: params.threshold,
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Similar content search failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'SemanticSearchService', operation: 'searchSimilar' }
      );
      throw error;
    }
  }

  async searchByConcept(
    concept: string,
    params: {
      projectId: string;
      limit?: number;
      context?: string;
    }
  ): Promise<SemanticSearchResult[]> {
    this.logger.info('Searching by concept', {
      concept,
      projectId: params.projectId,
      limit: params.limit,
    });

    try {
      // Expand concept with related terms
      const expandedQuery = await this.expandConcept(concept, params.context);

      // Perform semantic search with expanded query
      const searchResults = await this.search({
        query: expandedQuery,
        projectId: params.projectId,
        limit: params.limit || 10,
        threshold: 0.6,
      });

      return searchResults.results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Concept search failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'SemanticSearchService', operation: 'searchByConcept' }
      );
      throw error;
    }
  }

  async searchSnippets(params: {
    query: string;
    projectId: string;
    limit?: number;
    threshold?: number;
    snippetType?: string[];
  }): Promise<SemanticSearchResult[]> {
    this.logger.info('Searching snippets', {
      query: params.query,
      projectId: params.projectId,
      limit: params.limit,
      snippetType: params.snippetType,
    });

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(params.query);

      // Prepare filters
      const filters: any = {
        chunkType: ['snippet'],
        projectId: params.projectId,
      };

      if (params.snippetType && params.snippetType.length > 0) {
        filters.snippetType = params.snippetType;
      }

      // Perform vector search
      const vectorResults = await this.vectorStorage.searchVectors(queryEmbedding.vector, {
        limit: params.limit || 10,
        withPayload: true,
        scoreThreshold: params.threshold || 0.7,
        filter: filters,
      });

      // Enhance results
      const enhancedResults = await this.enhanceResults(vectorResults, {
        query: params.query,
        projectId: params.projectId,
        limit: params.limit,
        threshold: params.threshold,
      });

      return this.sortAndFilterResults(enhancedResults, {
        query: params.query,
        projectId: params.projectId,
        limit: params.limit,
        threshold: params.threshold,
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Snippet search failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'SemanticSearchService', operation: 'searchSnippets' }
      );
      throw error;
    }
  }

  async getSearchSuggestions(
    query: string,
    params: {
      projectId: string;
      limit?: number;
    }
  ): Promise<
    Array<{
      suggestion: string;
      confidence: number;
      category: 'term' | 'concept' | 'pattern' | 'code';
    }>
  > {
    this.logger.info('Generating search suggestions', {
      query,
      projectId: params.projectId,
    });

    try {
      // Analyze query to generate suggestions
      const suggestions = await this.generateSuggestions(query, params.projectId);

      // Limit and sort by confidence
      const limitedSuggestions = suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, params.limit || 5);

      return limitedSuggestions;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Search suggestion generation failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'SemanticSearchService', operation: 'getSearchSuggestions' }
      );
      throw error;
    }
  }

  private async generateQueryEmbedding(query: string): Promise<{
    vector: number[];
    dimensions: number;
    model: string;
  }> {
    const embedder = await this.embedderFactory.getEmbedder();
    const embeddingResult = await embedder.embed({ text: query });

    // Handle case where embeddingResult might be an array
    const result = Array.isArray(embeddingResult) ? embeddingResult[0] : embeddingResult;

    return {
      vector: result.vector,
      dimensions: result.dimensions,
      model: result.model,
    };
  }

  private async enhanceResults(
    vectorResults: any[],
    params: SemanticSearchParams
  ): Promise<SemanticSearchResult[]> {
    const enhancedResults: SemanticSearchResult[] = [];

    for (const result of vectorResults) {
      const enhanced = await this.enhanceSingleResult(result, params);
      enhancedResults.push(enhanced);
    }

    return enhancedResults;
  }

  private async enhanceSingleResult(
    result: any,
    params: SemanticSearchParams
  ): Promise<SemanticSearchResult> {
    // Calculate semantic score
    const semanticScore = this.calculateSemanticScore(result, params.query);

    // Calculate contextual score
    const contextualScore = this.calculateContextualScore(result, params.query);

    // Calculate recency score
    const recencyScore = this.calculateRecencyScore(result);

    // Calculate popularity score
    const popularityScore = this.calculatePopularityScore(result);

    // Calculate final score with boost factors
    const boostFactors = params.boostFactors || {};
    const finalScore = this.calculateFinalScore(
      {
        semantic: semanticScore,
        contextual: contextualScore,
        recency: recencyScore,
        popularity: popularityScore,
      },
      boostFactors
    );

    return {
      id: result.id,
      score: finalScore,
      similarity: result.score || semanticScore,
      filePath: result.filePath,
      content: result.content,
      startLine: result.startLine,
      endLine: result.endLine,
      language: result.language,
      chunkType: result.chunkType,
      snippetMetadata: result.snippetMetadata,
      metadata: result.metadata || {},
      rankingFactors: {
        semanticScore,
        contextualScore,
        recencyScore,
        popularityScore,
        finalScore,
      },
    };
  }

  private calculateSemanticScore(result: any, query: string): number {
    // Base similarity score from vector search
    const baseScore = result.score || 0.5;

    // If this is a snippet, use the specialized snippet scoring
    if (result.chunkType === 'snippet' && result.snippetMetadata) {
      return this.calculateSnippetScore(result, query);
    }

    // Boost for exact keyword matches
    const queryTerms = query.toLowerCase().split(/\s+/);
    const content = result.content.toLowerCase();
    let keywordBonus = 0;

    queryTerms.forEach(term => {
      if (content.includes(term)) {
        keywordBonus += 0.1;
      }
    });

    return Math.min(baseScore + keywordBonus, 1);
  }

  private calculateContextualScore(result: any, query: string): number {
    // Calculate contextual relevance based on content structure
    const content = result.content.toLowerCase();
    const queryLower = query.toLowerCase();

    let score = 0;

    // Check for function/class definitions
    if (content.includes('function') || content.includes('class')) {
      score += 0.2;
    }

    // Check for imports/exports
    if (content.includes('import') || content.includes('export')) {
      score += 0.1;
    }

    // Check for comments and documentation
    if (content.includes('//') || content.includes('/*') || content.includes('*')) {
      score += 0.15;
    }

    // Boost based on content type
    if (result.chunkType === 'function' || result.chunkType === 'class') {
      score += 0.25;
    }

    return Math.min(score, 1);
  }

  private calculateRecencyScore(result: any): number {
    // Calculate recency based on metadata
    const lastModified = result.metadata?.lastModified || 0;
    const now = Date.now();
    const ageInDays = (now - lastModified) / (1000 * 60 * 60 * 24);

    // Exponential decay for older files
    return Math.exp(-ageInDays / 365);
  }

  private calculatePopularityScore(result: any): number {
    // Calculate popularity based on usage metrics
    const usageCount = result.metadata?.usageCount || 0;
    const referenceCount = result.metadata?.referenceCount || 0;

    // Normalize to 0-1 range
    return Math.min((usageCount + referenceCount) / 50, 1);
  }

  private calculateFinalScore(
    scores: {
      semantic: number;
      contextual: number;
      recency: number;
      popularity: number;
    },
    boostFactors: any
  ): number {
    const weights = {
      semantic: (boostFactors.relevance || 1.0) * 0.5,
      contextual: 0.25,
      recency: (boostFactors.recency || 1.0) * 0.15,
      popularity: (boostFactors.popularity || 1.0) * 0.1,
    };

    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights = Object.fromEntries(
      Object.entries(weights).map(([key, value]) => [key, value / totalWeight])
    );

    return (
      scores.semantic * normalizedWeights.semantic +
      scores.contextual * normalizedWeights.contextual +
      scores.recency * normalizedWeights.recency +
      scores.popularity * normalizedWeights.popularity
    );
  }

  private calculateSnippetScore(result: any, query: string): number {
    // Start with the base semantic score
    let score = result.score || 0.5;

    // Boost based on snippet type relevance
    if (result.snippetMetadata?.snippetType) {
      const snippetType = result.snippetMetadata.snippetType;
      const queryLower = query.toLowerCase();

      // Boost for specific snippet types based on query keywords
      if (
        snippetType === 'control_structure' &&
        (queryLower.includes('if') || queryLower.includes('loop') || queryLower.includes('switch'))
      ) {
        score += 0.2;
      } else if (
        snippetType === 'error_handling' &&
        (queryLower.includes('error') ||
          queryLower.includes('exception') ||
          queryLower.includes('try'))
      ) {
        score += 0.2;
      } else if (
        snippetType === 'function_call_chain' &&
        (queryLower.includes('function') ||
          queryLower.includes('call') ||
          queryLower.includes('method'))
      ) {
        score += 0.15;
      } else if (snippetType === 'comment_marked' && queryLower.includes('example')) {
        score += 0.25;
      } else if (snippetType === 'logic_block' && queryLower.includes('block')) {
        score += 0.15;
      }
    }

    // Boost based on snippet complexity for certain queries
    if (result.snippetMetadata?.complexity) {
      const complexity = result.snippetMetadata.complexity;
      const queryLower = query.toLowerCase();

      // For "complex" queries, boost complex snippets
      if (queryLower.includes('complex') && complexity > 5) {
        score += 0.1 * (complexity / 10); // Normalize complexity boost
      }

      // For "simple" queries, boost simple snippets
      if (queryLower.includes('simple') && complexity <= 3) {
        score += 0.15;
      }
    }

    // Boost based on language features
    if (result.snippetMetadata?.languageFeatures) {
      const features = result.snippetMetadata.languageFeatures;
      let featureBonus = 0;

      if (features.usesAsync) featureBonus += 0.1;
      if (features.usesGenerators) featureBonus += 0.1;
      if (features.usesDestructuring) featureBonus += 0.05;
      if (features.usesSpread) featureBonus += 0.05;
      if (features.usesTemplateLiterals) featureBonus += 0.05;

      score += featureBonus;
    }

    // Ensure score is between 0 and 1
    return Math.min(score, 1);
  }

  private sortAndFilterResults(
    results: SemanticSearchResult[],
    params: SemanticSearchParams
  ): SemanticSearchResult[] {
    // Sort by final score descending
    const sorted = results.sort((a, b) => b.score - a.score);

    // Apply threshold
    const threshold = params.threshold || 0.3;
    const filtered = sorted.filter(result => result.score >= threshold);

    // Apply limit
    const limit = params.limit || 10;
    return filtered.slice(0, limit);
  }

  private normalizeFilters(filters?: any): any {
    if (!filters) return {};

    const normalized: any = {};

    if (filters.language) {
      normalized.language = Array.isArray(filters.language) ? filters.language : [filters.language];
    }

    if (filters.fileType) {
      normalized.fileType = Array.isArray(filters.fileType) ? filters.fileType : [filters.fileType];
    }

    if (filters.path) {
      normalized.path = Array.isArray(filters.path) ? filters.path : [filters.path];
    }

    if (filters.chunkType) {
      normalized.chunkType = Array.isArray(filters.chunkType)
        ? filters.chunkType
        : [filters.chunkType];
    }

    if (filters.snippetType) {
      normalized.snippetType = Array.isArray(filters.snippetType)
        ? filters.snippetType
        : [filters.snippetType];
    }

    return normalized;
  }

  private async expandConcept(concept: string, context?: string): Promise<string> {
    // Mock concept expansion - in real implementation, this would use knowledge graphs
    const expansions: Record<string, string[]> = {
      authentication: ['login', 'security', 'authorization', 'user', 'password'],
      database: ['sql', 'query', 'table', 'schema', 'connection'],
      api: ['endpoint', 'request', 'response', 'http', 'service'],
      ui: ['interface', 'component', 'view', 'render', 'element'],
    };

    const expandedTerms = expansions[concept.toLowerCase()] || [concept];
    if (context) {
      expandedTerms.push(context);
    }

    return expandedTerms.join(' ');
  }

  private async generateSuggestions(
    query: string,
    projectId: string
  ): Promise<
    Array<{
      suggestion: string;
      confidence: number;
      category: 'term' | 'concept' | 'pattern' | 'code';
    }>
  > {
    // Mock suggestion generation - in real implementation, this would analyze query patterns
    const suggestions: Array<{
      suggestion: string;
      confidence: number;
      category: 'term' | 'concept' | 'pattern' | 'code';
    }> = [];

    const terms = query.toLowerCase().split(/\s+/);

    // Generate term-based suggestions
    terms.forEach(term => {
      if (term.length > 2) {
        suggestions.push({
          suggestion: term,
          confidence: 0.8,
          category: 'term',
        });
      }
    });

    // Generate concept suggestions
    if (query.includes('how') || query.includes('what')) {
      suggestions.push({
        suggestion: 'implementation',
        confidence: 0.6,
        category: 'concept',
      });
    }

    // Generate pattern suggestions
    if (query.includes('error') || query.includes('bug')) {
      suggestions.push({
        suggestion: 'exception handling',
        confidence: 0.7,
        category: 'pattern',
      });
    }

    return suggestions;
  }

  private calculateAverageSimilarity(results: SemanticSearchResult[]): number {
    if (results.length === 0) return 0;

    const totalSimilarity = results.reduce((sum, result) => sum + result.similarity, 0);
    return totalSimilarity / results.length;
  }

  private generateQueryId(query: string): string {
    const timestamp = Date.now();
    const hash = this.hashString(query);
    return `semantic_${timestamp}_${hash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private getCacheKey(params: any): string {
    // Create a cache key based on the search parameters
    const keyParts = [
      params.query,
      params.projectId,
      params.limit,
      params.threshold,
      JSON.stringify(params.filters || {}),
    ];
    return keyParts.join('|');
  }

  async getSemanticSearchStats(): Promise<{
    totalSearches: number;
    averageLatency: number;
    averageResults: number;
    topConcepts: Array<{
      concept: string;
      searchCount: number;
    }>;
  }> {
    // Mock statistics - in real implementation, this would track actual usage
    return {
      totalSearches: 2850,
      averageLatency: 145,
      averageResults: 8.3,
      topConcepts: [
        { concept: 'authentication', searchCount: 145 },
        { concept: 'database', searchCount: 128 },
        { concept: 'api', searchCount: 112 },
        { concept: 'ui', searchCount: 98 },
        { concept: 'error handling', searchCount: 87 },
      ],
    };
  }
}
