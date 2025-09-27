import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { SemanticSearchService } from '../search/SemanticSearchService';
import { HybridSearchService } from '../search/HybridSearchService';
import {
  LSPEnhancedSearchService,
  LSPEnhancedSearchParams,
} from '../search/LSPEnhancedSearchService';
import { RerankingService } from '../reranking/RerankingService';
import { StorageCoordinator } from '../storage/StorageCoordinator';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { ConfigFactory } from '../../config/ConfigFactory';
import { SearchConfig } from '../../config/ConfigTypes';

export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  options?: SearchOptions;
}

export interface SearchFilters {
  projectId?: string;
  language?: string[];
  fileType?: string[];
  path?: string[];
  chunkType?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  includeGraph?: boolean;
  useHybrid?: boolean;
  useReranking?: boolean;
  useLSP?: boolean;
  searchType?: 'general' | 'snippet';
  lspSearchTypes?: ('symbol' | 'definition' | 'reference' | 'diagnostic')[];
  includeDiagnostics?: boolean;
  lspTimeout?: number;
  weights?: {
    semantic?: number;
    keyword?: number;
    graph?: number;
    lsp?: number;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  finalScore: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
  rankingFeatures?: {
    semanticScore?: number;
    keywordScore?: number;
    graphScore?: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  queryTime: number;
  searchStrategy: string;
  filters: SearchFilters;
  options: SearchOptions;
}

@injectable()
export class SearchCoordinator {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private configFactory: ConfigFactory;
  private semanticSearch: SemanticSearchService;
  private hybridSearch: HybridSearchService;
  private lspEnhancedSearch: LSPEnhancedSearchService;
  private rerankingService: RerankingService;
  private storageCoordinator: StorageCoordinator;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.ConfigFactory) configFactory: ConfigFactory,
    @inject(TYPES.SemanticSearchService) semanticSearch: SemanticSearchService,
    @inject(TYPES.HybridSearchService) hybridSearch: HybridSearchService,
    @inject(TYPES.LSPEnhancedSearchService) lspEnhancedSearch: LSPEnhancedSearchService,
    @inject(TYPES.RerankingService) rerankingService: RerankingService,
    @inject(TYPES.StorageCoordinator) storageCoordinator: StorageCoordinator
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.configFactory = configFactory;
    this.semanticSearch = semanticSearch;
    this.hybridSearch = hybridSearch;
    this.lspEnhancedSearch = lspEnhancedSearch;
    this.rerankingService = rerankingService;
    this.storageCoordinator = storageCoordinator;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    this.logger.info('Starting search', {
      query: query.text,
      filters: query.filters,
      options: query.options,
    });

    try {
      const options = this.normalizeSearchOptions(query.options);
      let results: SearchResult[] = [];
      let searchStrategy = 'semantic';

      // Choose search strategy based on options
      if (options.useLSP) {
        searchStrategy = 'lsp-enhanced';
        const searchResponse = await this.performLSPEnhancedSearch(
          query.text,
          options,
          query.filters
        );
        results = searchResponse.results;
      } else if (options.useHybrid) {
        searchStrategy = 'hybrid';
        const searchResponse = await this.performHybridSearch(query.text, options);
        results = searchResponse.results;
      } else {
        searchStrategy = 'semantic';
        const searchResponse = await this.performSemanticSearch(query.text, options);
        results = searchResponse.results;
      }

      // Apply reranking if enabled
      if (options.useReranking && results.length > 0) {
        results = await this.applyReranking(results, query.text);
        searchStrategy += '+reranking';
      }

      // Apply final filtering and sorting
      results = this.postProcessResults(results, options);

      const queryTime = Date.now() - startTime;

      this.logger.info('Search completed', {
        query: query.text,
        resultsCount: results.length,
        queryTime,
        searchStrategy,
      });

      return {
        results,
        totalResults: results.length,
        queryTime,
        searchStrategy,
        filters: query.filters || {},
        options,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const queryTime = Date.now() - startTime;

      this.logger.error('Search failed', {
        query: query.text,
        error: errorMessage,
        queryTime,
      });

      throw new Error(`Search failed: ${errorMessage}`);
    }
  }

  async performSemanticSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Call the semantic search service directly
      const searchParams = {
        query,
        projectId: 'default', // Default project ID for testing
        limit: options.limit,
        threshold: options.threshold,
      };

      const semanticResults = await this.semanticSearch.search(searchParams);

      // Convert SemanticSearchResult to SearchResult
      const results: SearchResult[] = semanticResults.results.map(result => ({
        id: result.id,
        score: result.score,
        finalScore: result.score,
        filePath: result.filePath,
        content: result.content,
        startLine: result.startLine,
        endLine: result.endLine,
        language: result.language,
        chunkType: result.chunkType,
        metadata: result.metadata,
        rankingFeatures: {
          semanticScore: result.rankingFactors.semanticScore,
          keywordScore: 0,
          graphScore: 0,
        },
      }));

      const queryTime = Date.now() - startTime;

      this.logger.info('Semantic search completed', {
        query,
        resultsCount: results.length,
        queryTime,
      });

      return {
        results,
        totalResults: results.length,
        queryTime,
        searchStrategy: 'semantic',
        filters: {},
        options,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const queryTime = Date.now() - startTime;

      this.logger.error('Semantic search failed', {
        query,
        error: errorMessage,
        queryTime,
      });

      throw new Error(`Semantic search failed: ${errorMessage}`);
    }
  }

  async performHybridSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Call the hybrid search service directly
      const searchParams: any = {
        query,
        projectId: 'default', // Default project ID for testing
        limit: options.limit,
        threshold: options.threshold,
      };

      const hybridResults = await this.hybridSearch.search(searchParams);

      // Convert HybridSearchResult to SearchResult
      const results: SearchResult[] = hybridResults.results.map(result => ({
        id: result.id,
        score: result.score,
        finalScore: result.score,
        filePath: result.filePath,
        content: result.content,
        startLine: result.startLine,
        endLine: result.endLine,
        language: result.language,
        chunkType: result.chunkType,
        metadata: result.metadata,
        rankingFeatures: {
          semanticScore: result.searchScores.semanticScore || 0,
          keywordScore: result.searchScores.keywordScore || 0,
          graphScore: result.searchScores.structuralScore || 0,
        },
      }));

      const queryTime = Date.now() - startTime;

      this.logger.info('Hybrid search completed', {
        query,
        resultsCount: results.length,
        queryTime,
      });

      return {
        results,
        totalResults: results.length,
        queryTime,
        searchStrategy: 'hybrid',
        filters: {},
        options,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const queryTime = Date.now() - startTime;

      this.logger.error('Hybrid search failed', {
        query,
        error: errorMessage,
        queryTime,
      });

      throw new Error(`Hybrid search failed: ${errorMessage}`);
    }
  }

  async graphSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = Date.now();

    this.logger.info('Starting graph search', { query, options });

    try {
      // Use storage coordinator to search graph
      const graphResults = await this.storageCoordinator.searchGraph(query, {});

      // Convert graph results to SearchResult format
      const results: SearchResult[] = graphResults.map((result: any) => ({
        id: result.id || `graph_${Date.now()}_${Math.random()}`,
        score: result.score || 0.5,
        finalScore: result.score || 0.5,
        filePath: result.filePath || '',
        content: result.content || '',
        startLine: result.startLine || 0,
        endLine: result.endLine || 0,
        language: result.language || 'unknown',
        chunkType: result.chunkType || 'unknown',
        metadata: result.metadata || {},
        rankingFeatures: {
          graphScore: result.score || 0.5,
        },
      }));

      const queryTime = Date.now() - startTime;

      this.logger.info('Graph search completed', {
        query,
        resultsCount: results.length,
        queryTime,
      });

      return {
        results,
        totalResults: results.length,
        queryTime,
        searchStrategy: 'graph',
        filters: {},
        options,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const queryTime = Date.now() - startTime;

      this.logger.error('Graph search failed', {
        query,
        error: errorMessage,
        queryTime,
      });

      throw new Error(`Graph search failed: ${errorMessage}`);
    }
  }

  private async applyReranking(results: SearchResult[], query: string): Promise<SearchResult[]> {
    try {
      // Prepare results for reranking
      const rerankInput = results.map(result => ({
        id: result.id,
        score: result.score,
        filePath: result.filePath,
        content: result.content,
        startLine: result.startLine,
        endLine: result.endLine,
        language: result.language,
        chunkType: result.chunkType,
        metadata: result.metadata,
      }));

      // Apply reranking
      const rerankedResults = await this.rerankingService.rerank(rerankInput, query);

      // Merge reranking results back
      return results.map(result => {
        const reranked = rerankedResults.find(r => r.id === result.id);
        if (reranked) {
          return {
            ...result,
            finalScore: reranked.score,
            rankingFeatures: {
              ...result.rankingFeatures,
              rerankingScore: reranked.score,
            },
          };
        }
        return result;
      });
    } catch (error) {
      this.logger.error('Reranking failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return original results if reranking fails
      return results;
    }
  }

  private postProcessResults(results: SearchResult[], options: SearchOptions): SearchResult[] {
    // Apply threshold
    if (options.threshold) {
      results = results.filter(r => r.finalScore >= options.threshold!);
    }

    // Sort by final score
    results.sort((a, b) => b.finalScore - a.finalScore);

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  private normalizeSearchOptions(options: SearchOptions = {}): SearchOptions {
    const config = this.configFactory.getConfig<SearchConfig>('services.search');

    return {
      limit: options.limit || config.defaultLimit || 10,
      threshold: options.threshold || config.defaultThreshold || 0.5,
      includeGraph: options.includeGraph ?? config.includeGraph ?? false,
      useHybrid: options.useHybrid ?? config.useHybrid ?? false,
      useLSP: options.useLSP ?? config.useLSP ?? false,
      useReranking: options.useReranking ?? config.useReranking ?? true,
      lspSearchTypes: options.lspSearchTypes || ['symbol', 'definition', 'reference'],
      includeDiagnostics: options.includeDiagnostics ?? false,
      lspTimeout: options.lspTimeout || 5000,
      weights: {
        semantic: options.weights?.semantic ?? config.weights?.semantic ?? 0.5,
        keyword: options.weights?.keyword ?? config.weights?.keyword ?? 0.2,
        graph: options.weights?.graph ?? config.weights?.graph ?? 0.1,
        lsp: options.weights?.lsp ?? config.weights?.lsp ?? 0.2,
      },
    };
  }

  async performLSPEnhancedSearch(
    query: string,
    options: SearchOptions = {},
    filters: SearchFilters = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    this.logger.info('Starting LSP enhanced search', { query, options, filters });

    try {
      const searchParams: LSPEnhancedSearchParams = {
        query,
        projectId: filters.projectId || 'default',
        limit: options.limit,
        threshold: options.threshold,
        enableLSP: true,
        lspSearchTypes: options.lspSearchTypes,
        includeDiagnostics: options.includeDiagnostics,
        lspTimeout: options.lspTimeout,
        filters: {
          language: filters.language,
          fileType: filters.fileType,
          path: filters.path,
          chunkType: filters.chunkType,
        },
      };

      const lspResults = await this.lspEnhancedSearch.search(searchParams);

      // Convert LSPEnhancedSearchResult to SearchResult
      const results: SearchResult[] = lspResults.results.map(result => {
        const lspWeight = options.weights?.lsp ?? 0.2;
        const semanticWeight = options.weights?.semantic ?? 0.5;
        const keywordWeight = options.weights?.keyword ?? 0.2;
        const graphWeight = options.weights?.graph ?? 0.1;

        let lspScore = 0;
        if (result.lspResults && result.lspResults.length > 0) {
          lspScore = Math.max(...result.lspResults.map(r => r.score)) * lspWeight;
        }

        return {
          id: result.id,
          score: result.score,
          finalScore: result.score,
          filePath: result.filePath,
          content: result.content,
          startLine: result.startLine,
          endLine: result.endLine,
          language: result.language,
          chunkType: result.chunkType,
          metadata: {
            ...result.metadata,
            lspResults: result.lspResults,
            lspMetrics: result.lspMetrics,
          },
          rankingFeatures: {
            semanticScore: result.searchScores?.semanticScore || 0,
            keywordScore: result.searchScores?.keywordScore || 0,
            graphScore: result.searchScores?.structuralScore || 0,
            lspScore: lspScore,
          },
        };
      });

      const queryTime = Date.now() - startTime;

      this.logger.info('LSP enhanced search completed', {
        query,
        resultsCount: results.length,
        queryTime,
        lspResultCount: lspResults.metrics.lspMetrics?.resultCount || 0,
        lspSearchTime: lspResults.metrics.lspMetrics?.searchTime || 0,
      });

      return {
        results,
        totalResults: results.length,
        queryTime,
        searchStrategy: 'lsp-enhanced',
        filters,
        options,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const queryTime = Date.now() - startTime;

      this.logger.error('LSP enhanced search failed', {
        query,
        error: errorMessage,
        queryTime,
      });

      // Fallback to hybrid search if LSP enhanced fails
      this.logger.info('Falling back to hybrid search', { query });
      return await this.performHybridSearch(query, options);
    }
  }

  async getRealTimeSuggestions(query: string, projectPath?: string): Promise<string[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      return await this.lspEnhancedSearch.getRealTimeSuggestions(query, projectPath || 'default');
    } catch (error) {
      this.logger.warn('Real-time suggestions failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
