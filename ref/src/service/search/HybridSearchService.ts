import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { SemanticSearchService } from './SemanticSearchService';
import { VectorStorageService } from '../storage/vector/VectorStorageService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { CacheManager } from '../cache/CacheManager';
import { CacheInterface } from '../cache/CacheInterface';
import { TYPES } from '../../types';

export interface HybridSearchParams {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
  };
  weights?: {
    semantic?: number;
    keyword?: number;
    fuzzy?: number;
    structural?: number;
  };
  searchStrategies?: ('semantic' | 'keyword' | 'fuzzy' | 'structural')[];
}

export interface HybridSearchResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
  searchScores: {
    semanticScore?: number;
    keywordScore?: number;
    fuzzyScore?: number;
    structuralScore?: number;
    combinedScore: number;
  };
  matchHighlights: Array<{
    type: 'keyword' | 'semantic' | 'fuzzy' | 'structural';
    text: string;
    score: number;
  }>;
}

export interface HybridSearchMetrics {
  queryId: string;
  executionTime: number;
  semanticTime: number;
  keywordTime: number;
  fuzzyTime: number;
  structuralTime: number;
  fusionTime: number;
  totalResults: number;
  strategyDistribution: {
    semantic: number;
    keyword: number;
    fuzzy: number;
    structural: number;
  };
}

@injectable()
export class HybridSearchService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private semanticSearch: SemanticSearchService;
  private vectorStorage: VectorStorageService;
  private embedderFactory: EmbedderFactory;
  private cacheManager: CacheManager;
  private searchCache!: CacheInterface;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.SemanticSearchService) semanticSearch: SemanticSearchService,
    @inject(TYPES.VectorStorageService) vectorStorage: VectorStorageService,
    @inject(TYPES.EmbedderFactory) embedderFactory: EmbedderFactory,
    @inject(TYPES.CacheManager) cacheManager: CacheManager
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.semanticSearch = semanticSearch;
    this.vectorStorage = vectorStorage;
    this.embedderFactory = embedderFactory;
    this.cacheManager = cacheManager;
  }

  private async getCache(): Promise<CacheInterface> {
    if (!this.searchCache) {
      this.searchCache = await this.cacheManager.getSearchCache();
    }
    return this.searchCache;
  }

  private getSearchCacheKey(params: HybridSearchParams): string {
    const keyParts = [
      params.query,
      params.projectId,
      params.limit,
      params.threshold,
      JSON.stringify(params.filters || {}),
      JSON.stringify(params.weights || {}),
      JSON.stringify(params.searchStrategies || ['semantic', 'keyword', 'fuzzy']),
    ];
    return `hybrid_search:${keyParts.join('|')}`;
  }

  private getExplanationCacheKey(resultId: string, query: string): string {
    return `hybrid_explanation:${resultId}:${this.hashString(query)}`;
  }

  private getFeedbackCacheKey(query: string, projectId: string): string {
    return `hybrid_feedback:${this.hashString(query)}:${projectId}`;
  }

  async search(params: HybridSearchParams): Promise<{
    results: HybridSearchResult[];
    metrics: HybridSearchMetrics;
  }> {
    const queryId = this.generateQueryId(params.query);
    const startTime = Date.now();

    this.logger.info('Starting hybrid search', {
      queryId,
      query: params.query,
      projectId: params.projectId,
      strategies: params.searchStrategies,
    });

    try {
      // Check cache first
      const cacheKey = this.getSearchCacheKey(params);
      const cache = await this.getCache();
      const cachedResults = await cache.get<{
        results: HybridSearchResult[];
        metrics: HybridSearchMetrics;
      }>(cacheKey);

      if (cachedResults) {
        this.logger.debug('Cache hit for hybrid search', {
          queryId,
          cacheKey,
          resultCount: cachedResults.results.length,
        });

        // Update execution time for cache hit
        const cachedMetrics = {
          ...cachedResults.metrics,
          executionTime: Date.now() - startTime,
          queryId,
        };

        this.logger.info('Hybrid search completed (cache hit)', {
          queryId,
          resultCount: cachedResults.results.length,
          executionTime: cachedMetrics.executionTime,
          cached: true,
        });

        return {
          results: cachedResults.results,
          metrics: cachedMetrics,
        };
      }

      // Determine search strategies
      const strategies = params.searchStrategies || ['semantic', 'keyword', 'fuzzy'];

      // Execute searches in parallel
      const searchResults = await this.executeParallelSearches(params, strategies);

      // Fuse results from different strategies
      const fusionStartTime = Date.now();
      const fusedResults = await this.fuseResults(searchResults, params);
      const fusionTime = Date.now() - fusionStartTime;

      // Apply final ranking and filtering
      const finalResults = this.rankAndFilterResults(fusedResults, params);

      const metrics: HybridSearchMetrics = {
        queryId,
        executionTime: Date.now() - startTime,
        semanticTime: searchResults.semantic?.time || 0,
        keywordTime: searchResults.keyword?.time || 0,
        fuzzyTime: searchResults.fuzzy?.time || 0,
        structuralTime: searchResults.structural?.time || 0,
        fusionTime,
        totalResults: finalResults.length,
        strategyDistribution: this.calculateStrategyDistribution(searchResults),
      };

      // Cache the results
      await cache.set(cacheKey, {
        results: finalResults,
        metrics,
      });

      this.logger.info('Hybrid search completed', {
        queryId,
        resultCount: finalResults.length,
        executionTime: metrics.executionTime,
        strategies: strategies.join(','),
        cached: false,
      });

      return {
        results: finalResults,
        metrics,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Hybrid search failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'HybridSearchService', operation: 'search' }
      );
      throw error;
    }
  }

  async searchWithFeedback(
    params: HybridSearchParams,
    feedback: {
      relevantResults: string[];
      irrelevantResults: string[];
    }
  ): Promise<{
    results: HybridSearchResult[];
    metrics: HybridSearchMetrics;
    learningUpdate: {
      weightsAdjusted: boolean;
      newWeights: Record<string, number>;
    };
  }> {
    this.logger.info('Starting hybrid search with feedback', {
      query: params.query,
      relevantCount: feedback.relevantResults.length,
      irrelevantCount: feedback.irrelevantResults.length,
    });

    try {
      // Check cache for feedback-based weight adjustments
      const cache = await this.getCache();
      const feedbackCacheKey = this.getFeedbackCacheKey(params.query, params.projectId);
      const cachedWeights = await cache.get<Record<string, number>>(feedbackCacheKey);

      // Use cached weights if available, otherwise calculate new ones
      let weightAdjustment = cachedWeights || this.adjustWeightsFromFeedback(feedback);

      // Cache the weight adjustment for future use
      if (!cachedWeights && Object.keys(weightAdjustment).length > 0) {
        await cache.set(feedbackCacheKey, weightAdjustment);
        this.logger.debug('Cached feedback-based weight adjustments', {
          query: params.query,
          projectId: params.projectId,
          adjustments: weightAdjustment,
        });
      }

      // Apply adjusted weights
      const adjustedParams = {
        ...params,
        weights: {
          ...params.weights,
          ...weightAdjustment,
        },
      };

      // Execute search with adjusted weights
      const searchResult = await this.search(adjustedParams);

      return {
        ...searchResult,
        learningUpdate: {
          weightsAdjusted: Object.keys(weightAdjustment).length > 0,
          newWeights: adjustedParams.weights || {},
        },
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Hybrid search with feedback failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'HybridSearchService', operation: 'searchWithFeedback' }
      );
      throw error;
    }
  }

  async getSearchExplanation(
    result: HybridSearchResult,
    query: string
  ): Promise<{
    resultId: string;
    query: string;
    finalScore: number;
    scoreBreakdown: {
      semantic: { score: number; contribution: string; factors: string[] };
      keyword: { score: number; contribution: string; factors: string[] };
      fuzzy: { score: number; contribution: string; factors: string[] };
      structural: { score: number; contribution: string; factors: string[] };
    };
    matchDetails: Array<{
      type: string;
      matchedText: string;
      relevance: number;
      context: string;
    }>;
    recommendations: string[];
  }> {
    this.logger.info('Generating search explanation', {
      resultId: result.id,
      query,
    });

    try {
      // Check cache for explanation
      const cache = await this.getCache();
      const explanationCacheKey = this.getExplanationCacheKey(result.id, query);
      const cachedExplanation = await cache.get<any>(explanationCacheKey);

      if (cachedExplanation) {
        this.logger.debug('Cache hit for search explanation', {
          resultId: result.id,
          query,
        });
        return cachedExplanation;
      }

      const scores = result.searchScores;
      const content = result.content.toLowerCase();
      const queryTerms = query.toLowerCase().split(/\s+/);

      const explanation = {
        resultId: result.id,
        query,
        finalScore: result.score,
        scoreBreakdown: {
          semantic: {
            score: scores.semanticScore || 0,
            contribution: this.calculateContribution(
              scores.semanticScore || 0,
              scores.combinedScore
            ),
            factors: this.getSemanticFactors(result, query),
          },
          keyword: {
            score: scores.keywordScore || 0,
            contribution: this.calculateContribution(
              scores.keywordScore || 0,
              scores.combinedScore
            ),
            factors: this.getKeywordFactors(content, queryTerms),
          },
          fuzzy: {
            score: scores.fuzzyScore || 0,
            contribution: this.calculateContribution(scores.fuzzyScore || 0, scores.combinedScore),
            factors: this.getFuzzyFactors(content, queryTerms),
          },
          structural: {
            score: scores.structuralScore || 0,
            contribution: this.calculateContribution(
              scores.structuralScore || 0,
              scores.combinedScore
            ),
            factors: this.getStructuralFactors(result),
          },
        },
        matchDetails: this.generateMatchDetails(result, queryTerms),
        recommendations: this.generateRecommendations(result, scores),
      };

      // Cache the explanation
      await cache.set(explanationCacheKey, explanation);
      this.logger.debug('Cached search explanation', {
        resultId: result.id,
        query,
      });

      return explanation;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Search explanation generation failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'HybridSearchService', operation: 'getSearchExplanation' }
      );
      throw error;
    }
  }

  private async executeParallelSearches(
    params: HybridSearchParams,
    strategies: string[]
  ): Promise<{
    semantic?: { results: any[]; time: number };
    keyword?: { results: any[]; time: number };
    fuzzy?: { results: any[]; time: number };
    structural?: { results: any[]; time: number };
  }> {
    const searchPromises: Array<Promise<any>> = [];
    const searchTypes: string[] = [];

    // Semantic search
    if (strategies.includes('semantic')) {
      searchPromises.push(this.executeSemanticSearch(params));
      searchTypes.push('semantic');
    }

    // Keyword search
    if (strategies.includes('keyword')) {
      searchPromises.push(this.executeKeywordSearch(params));
      searchTypes.push('keyword');
    }

    // Fuzzy search
    if (strategies.includes('fuzzy')) {
      searchPromises.push(this.executeFuzzySearch(params));
      searchTypes.push('fuzzy');
    }

    // Structural search
    if (strategies.includes('structural')) {
      searchPromises.push(this.executeStructuralSearch(params));
      searchTypes.push('structural');
    }

    // Execute all searches in parallel
    const results = await Promise.all(searchPromises);

    // Organize results by search type
    const organizedResults: any = {};
    results.forEach((result, index) => {
      organizedResults[searchTypes[index]] = result;
    });

    return organizedResults;
  }

  private async executeSemanticSearch(
    params: HybridSearchParams
  ): Promise<{ results: any[]; time: number }> {
    const startTime = Date.now();

    try {
      const semanticResults = await this.semanticSearch.search({
        query: params.query,
        projectId: params.projectId,
        limit: params.limit || 20,
        threshold: params.threshold || 0.5,
        filters: params.filters,
      });

      return {
        results: semanticResults.results,
        time: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.warn('Semantic search failed', { error });
      return { results: [], time: Date.now() - startTime };
    }
  }

  private async executeKeywordSearch(
    params: HybridSearchParams
  ): Promise<{ results: any[]; time: number }> {
    const startTime = Date.now();

    try {
      // Mock keyword search - in real implementation, this would use text search
      const keywordResults = this.mockKeywordSearch(params.query, params);

      return {
        results: keywordResults,
        time: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.warn('Keyword search failed', { error });
      return { results: [], time: Date.now() - startTime };
    }
  }

  private async executeFuzzySearch(
    params: HybridSearchParams
  ): Promise<{ results: any[]; time: number }> {
    const startTime = Date.now();

    try {
      // Mock fuzzy search - in real implementation, this would use fuzzy matching
      const fuzzyResults = this.mockFuzzySearch(params.query, params);

      return {
        results: fuzzyResults,
        time: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.warn('Fuzzy search failed', { error });
      return { results: [], time: Date.now() - startTime };
    }
  }

  private async executeStructuralSearch(
    params: HybridSearchParams
  ): Promise<{ results: any[]; time: number }> {
    const startTime = Date.now();

    try {
      // Mock structural search - in real implementation, this would use AST-based search
      const structuralResults = this.mockStructuralSearch(params.query, params);

      return {
        results: structuralResults,
        time: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.warn('Structural search failed', { error });
      return { results: [], time: Date.now() - startTime };
    }
  }

  private async fuseResults(
    searchResults: any,
    params: HybridSearchParams
  ): Promise<HybridSearchResult[]> {
    const fusedResults: Map<string, HybridSearchResult> = new Map();
    const weights = params.weights || {
      semantic: 0.4,
      keyword: 0.3,
      fuzzy: 0.2,
      structural: 0.1,
    };

    // Process semantic results
    if (searchResults.semantic) {
      searchResults.semantic.results.forEach((result: any) => {
        const existing = fusedResults.get(result.id) || this.createEmptyResult(result);
        existing.searchScores.semanticScore = result.score;
        existing.searchScores.combinedScore += result.score * (weights.semantic || 0);
        fusedResults.set(result.id, existing);
      });
    }

    // Process keyword results
    if (searchResults.keyword) {
      searchResults.keyword.results.forEach((result: any) => {
        const existing = fusedResults.get(result.id) || this.createEmptyResult(result);
        existing.searchScores.keywordScore = result.score;
        existing.searchScores.combinedScore += result.score * (weights.keyword || 0);
        fusedResults.set(result.id, existing);
      });
    }

    // Process fuzzy results
    if (searchResults.fuzzy) {
      searchResults.fuzzy.results.forEach((result: any) => {
        const existing = fusedResults.get(result.id) || this.createEmptyResult(result);
        existing.searchScores.fuzzyScore = result.score;
        existing.searchScores.combinedScore += result.score * (weights.fuzzy || 0);
        fusedResults.set(result.id, existing);
      });
    }

    // Process structural results
    if (searchResults.structural) {
      searchResults.structural.results.forEach((result: any) => {
        const existing = fusedResults.get(result.id) || this.createEmptyResult(result);
        existing.searchScores.structuralScore = result.score;
        existing.searchScores.combinedScore += result.score * (weights.structural || 0);
        fusedResults.set(result.id, existing);
      });
    }

    return Array.from(fusedResults.values());
  }

  private createEmptyResult(baseResult: any): HybridSearchResult {
    return {
      id: baseResult.id,
      score: 0,
      filePath: baseResult.filePath,
      content: baseResult.content,
      startLine: baseResult.startLine,
      endLine: baseResult.endLine,
      language: baseResult.language,
      chunkType: baseResult.chunkType,
      metadata: baseResult.metadata || {},
      searchScores: {
        combinedScore: 0,
      },
      matchHighlights: [],
    };
  }

  private rankAndFilterResults(
    results: HybridSearchResult[],
    params: HybridSearchParams
  ): HybridSearchResult[] {
    // Calculate final scores and add highlights
    const enhancedResults = results.map(result => {
      result.score = result.searchScores.combinedScore;
      result.matchHighlights = this.generateMatchHighlights(result, params.query);
      return result;
    });

    // Sort by score descending
    const sorted = enhancedResults.sort((a, b) => b.score - a.score);

    // Apply threshold
    const threshold = params.threshold || 0.3;
    const filtered = sorted.filter(result => result.score >= threshold);

    // Apply limit
    const limit = params.limit || 10;
    return filtered.slice(0, limit);
  }

  private generateMatchHighlights(
    result: HybridSearchResult,
    query: string
  ): Array<{
    type: 'keyword' | 'semantic' | 'fuzzy' | 'structural';
    text: string;
    score: number;
  }> {
    const highlights: Array<{
      type: 'keyword' | 'semantic' | 'fuzzy' | 'structural';
      text: string;
      score: number;
    }> = [];

    const queryTerms = query.toLowerCase().split(/\s+/);
    const content = result.content.toLowerCase();

    // Keyword highlights
    queryTerms.forEach(term => {
      if (content.includes(term)) {
        highlights.push({
          type: 'keyword',
          text: term,
          score: 0.8,
        });
      }
    });

    // Semantic highlights (mock)
    if (result.searchScores.semanticScore && result.searchScores.semanticScore > 0.5) {
      highlights.push({
        type: 'semantic',
        text: 'semantic match',
        score: result.searchScores.semanticScore,
      });
    }

    return highlights;
  }

  private calculateStrategyDistribution(searchResults: any): {
    semantic: number;
    keyword: number;
    fuzzy: number;
    structural: number;
  } {
    return {
      semantic: searchResults.semantic?.results.length || 0,
      keyword: searchResults.keyword?.results.length || 0,
      fuzzy: searchResults.fuzzy?.results.length || 0,
      structural: searchResults.structural?.results.length || 0,
    };
  }

  private adjustWeightsFromFeedback(feedback: {
    relevantResults: string[];
    irrelevantResults: string[];
  }): Record<string, number> {
    // Mock weight adjustment - in real implementation, this would use machine learning
    const adjustments: Record<string, number> = {};

    if (feedback.relevantResults.length > feedback.irrelevantResults.length) {
      // Boost semantic search if relevant results are found
      adjustments.semantic = 0.1;
    }

    return adjustments;
  }

  private calculateContribution(score: number, total: number): string {
    if (total === 0) return '0%';
    return `${Math.round((score / total) * 100)}%`;
  }

  private getSemanticFactors(result: HybridSearchResult, query: string): string[] {
    const factors: string[] = [];

    if (result.searchScores.semanticScore && result.searchScores.semanticScore > 0.7) {
      factors.push('High semantic similarity');
    }

    if (result.chunkType === 'function' || result.chunkType === 'class') {
      factors.push('Code structure match');
    }

    return factors;
  }

  private getKeywordFactors(content: string, queryTerms: string[]): string[] {
    const factors: string[] = [];
    let matchCount = 0;

    queryTerms.forEach(term => {
      if (content.includes(term)) {
        matchCount++;
      }
    });

    if (matchCount === queryTerms.length) {
      factors.push('All keywords matched');
    } else if (matchCount > 0) {
      factors.push(`${matchCount}/${queryTerms.length} keywords matched`);
    }

    return factors;
  }

  private getFuzzyFactors(content: string, queryTerms: string[]): string[] {
    const factors: string[] = [];

    // Mock fuzzy matching factors
    queryTerms.forEach(term => {
      const fuzzyMatches = this.findFuzzyMatches(content, term);
      if (fuzzyMatches.length > 0) {
        factors.push(`Fuzzy matches for "${term}"`);
      }
    });

    return factors;
  }

  private getStructuralFactors(result: HybridSearchResult): string[] {
    const factors: string[] = [];

    if (result.chunkType === 'function') {
      factors.push('Function definition');
    }

    if (result.chunkType === 'class') {
      factors.push('Class definition');
    }

    if (result.metadata?.isExported) {
      factors.push('Exported symbol');
    }

    return factors;
  }

  private generateMatchDetails(
    result: HybridSearchResult,
    queryTerms: string[]
  ): Array<{
    type: string;
    matchedText: string;
    relevance: number;
    context: string;
  }> {
    const details: Array<{
      type: string;
      matchedText: string;
      relevance: number;
      context: string;
    }> = [];

    const content = result.content;

    queryTerms.forEach(term => {
      const index = content.toLowerCase().indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 20);
        const end = Math.min(content.length, index + term.length + 20);
        const context = content.substring(start, end);

        details.push({
          type: 'keyword',
          matchedText: term,
          relevance: 0.8,
          context,
        });
      }
    });

    return details;
  }

  private generateRecommendations(result: HybridSearchResult, scores: any): string[] {
    const recommendations: string[] = [];

    if (scores.semanticScore && scores.semanticScore < 0.5) {
      recommendations.push('Try using more specific technical terms');
    }

    if (scores.keywordScore && scores.keywordScore < 0.3) {
      recommendations.push('Consider using exact keywords from the code');
    }

    if (scores.structuralScore && scores.structuralScore > 0.7) {
      recommendations.push('Good structural match - try similar code patterns');
    }

    return recommendations;
  }

  private findFuzzyMatches(content: string, term: string): string[] {
    // Mock fuzzy matching - in real implementation, this would use Levenshtein distance
    const matches: string[] = [];
    const terms = content.toLowerCase().split(/\s+/);

    terms.forEach(t => {
      if (this.calculateSimilarity(t, term) > 0.7) {
        matches.push(t);
      }
    });

    return matches;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private calculateEditDistance(str1: string, str2: string): number {
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
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Mock search methods
  private mockKeywordSearch(query: string, params: HybridSearchParams): any[] {
    // Mock keyword search results
    return [
      {
        id: 'keyword_1',
        score: 0.8,
        filePath: '/src/components/Button.tsx',
        content: 'export function Button({ onClick, children }: ButtonProps) {',
        startLine: 15,
        endLine: 25,
        language: 'typescript',
        chunkType: 'function',
        metadata: {},
      },
    ];
  }

  private mockFuzzySearch(query: string, params: HybridSearchParams): any[] {
    // Mock fuzzy search results
    return [
      {
        id: 'fuzzy_1',
        score: 0.6,
        filePath: '/src/components/Button.tsx',
        content: 'export function Button({ onClick, children }: ButtonProps) {',
        startLine: 15,
        endLine: 25,
        language: 'typescript',
        chunkType: 'function',
        metadata: {},
      },
    ];
  }

  private mockStructuralSearch(query: string, params: HybridSearchParams): any[] {
    // Mock structural search results
    return [
      {
        id: 'structural_1',
        score: 0.7,
        filePath: '/src/components/Button.tsx',
        content: 'export function Button({ onClick, children }: ButtonProps) {',
        startLine: 15,
        endLine: 25,
        language: 'typescript',
        chunkType: 'function',
        metadata: {},
      },
    ];
  }

  private generateQueryId(query: string): string {
    const timestamp = Date.now();
    const hash = this.hashString(query);
    return `hybrid_${timestamp}_${hash}`;
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

  async getHybridSearchStats(): Promise<{
    totalSearches: number;
    averageLatency: number;
    strategyUsage: {
      semantic: number;
      keyword: number;
      fuzzy: number;
      structural: number;
    };
    averageResults: number;
  }> {
    // Mock statistics
    return {
      totalSearches: 1520,
      averageLatency: 180,
      strategyUsage: {
        semantic: 1450,
        keyword: 1320,
        fuzzy: 890,
        structural: 650,
      },
      averageResults: 12.4,
    };
  }
}
