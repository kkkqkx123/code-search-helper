import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { LSPSearchService } from '../lsp/LSPSearchService';
import { HybridSearchService, HybridSearchParams, HybridSearchResult } from './HybridSearchService';
import { CacheManager } from '../cache/CacheManager';
import { CacheInterface } from '../cache/CacheInterface';
import { TYPES } from '../../types';

export interface LSPEnhancedSearchParams extends HybridSearchParams {
  enableLSP?: boolean;
  lspSearchTypes?: ('symbol' | 'definition' | 'reference' | 'diagnostic')[];
  includeDiagnostics?: boolean;
  lspTimeout?: number;
}

export interface LSPEnhancedSearchResult extends HybridSearchResult {
  lspResults?: LSPSearchResult[];
  lspMetrics?: {
    searchTime: number;
    resultCount: number;
    cacheHit: boolean;
  };
}

export interface LSPSearchResult {
  id: string;
  type: 'symbol' | 'definition' | 'reference' | 'diagnostic';
  filePath: string;
  name: string;
  kind: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  detail?: string;
  score: number;
  content?: string;
  metadata?: Record<string, any>;
}

@injectable()
export class LSPEnhancedSearchService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private lspSearchService: LSPSearchService;
  private hybridSearchService: HybridSearchService;
  private cacheManager: CacheManager;
  private searchCache!: CacheInterface;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.LSPSearchService) lspSearchService: LSPSearchService,
    @inject(TYPES.HybridSearchService) hybridSearchService: HybridSearchService,
    @inject(TYPES.CacheManager) cacheManager: CacheManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.lspSearchService = lspSearchService;
    this.hybridSearchService = hybridSearchService;
    this.cacheManager = cacheManager;
  }

  private async getCache(): Promise<CacheInterface> {
    if (!this.searchCache) {
      this.searchCache = await this.cacheManager.getSearchCache();
    }
    return this.searchCache;
  }

  private getEnhancedSearchCacheKey(params: LSPEnhancedSearchParams): string {
    const keyParts = [
      params.query,
      params.projectId,
      params.enableLSP,
      JSON.stringify(params.lspSearchTypes || []),
      params.includeDiagnostics,
      params.limit,
      params.threshold,
      JSON.stringify(params.filters || {}),
    ];
    return `lsp_enhanced:${keyParts.join('|')}`;
  }

  async search(params: LSPEnhancedSearchParams): Promise<{
    results: LSPEnhancedSearchResult[];
    metrics: any;
  }> {
    const startTime = Date.now();
    const queryId = this.generateQueryId(params.query);

    this.logger.info('Starting LSP enhanced search', {
      queryId,
      query: params.query,
      projectId: params.projectId,
      enableLSP: params.enableLSP,
      lspSearchTypes: params.lspSearchTypes,
    });

    try {
      // 检查缓存
      if (params.enableLSP) {
        const cacheKey = this.getEnhancedSearchCacheKey(params);
        const cache = await this.getCache();
        const cachedResults = await cache.get<{
          results: LSPEnhancedSearchResult[];
          metrics: any;
        }>(cacheKey);

        if (cachedResults) {
          this.logger.debug('Cache hit for LSP enhanced search', {
            queryId,
            cacheKey,
            resultCount: cachedResults.results.length,
          });

          return {
            results: cachedResults.results,
            metrics: {
              ...cachedResults.metrics,
              executionTime: Date.now() - startTime,
              cached: true,
            },
          };
        }
      }

      // 执行混合搜索
      const hybridResults = await this.hybridSearchService.search(params);

      let enhancedResults: LSPEnhancedSearchResult[] = [];
      let lspResults: LSPSearchResult[] = [];
      let lspMetrics = {
        searchTime: 0,
        resultCount: 0,
        cacheHit: false,
      };

      // 如果启用LSP，执行LSP搜索
      if (params.enableLSP) {
        const lspStartTime = Date.now();

        try {
          const lspSearchResult = await this.lspSearchService.search({
            query: params.query,
            projectPath: params.projectId,
            searchTypes: params.lspSearchTypes || ['symbol', 'definition', 'reference'],
            includeDiagnostics: params.includeDiagnostics,
            limit: params.limit,
          });

          lspResults = lspSearchResult.results;
          lspMetrics = {
            searchTime: lspSearchResult.metrics.executionTime,
            resultCount: lspSearchResult.results.length,
            cacheHit: lspSearchResult.metrics.cacheHit,
          };

          this.logger.debug('LSP search completed', {
            queryId,
            lspResultCount: lspResults.length,
            lspSearchTime: lspMetrics.searchTime,
          });
        } catch (error) {
          this.logger.warn('LSP search failed, continuing with hybrid search only', {
            queryId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // 融合结果
      enhancedResults = this.fuseResults(hybridResults.results, lspResults, params);

      // 应用最终排序和过滤
      const finalResults = this.rankAndFilterResults(enhancedResults, params);

      const metrics = {
        ...hybridResults.metrics,
        lspMetrics,
        executionTime: Date.now() - startTime,
        totalResults: finalResults.length,
        cached: false,
      };

      // 缓存结果
      if (params.enableLSP) {
        const cacheKey = this.getEnhancedSearchCacheKey(params);
        const cache = await this.getCache();
        await cache.set(
          cacheKey,
          {
            results: finalResults,
            metrics,
          },
          { ttl: 1800 }
        ); // 30分钟缓存
      }

      this.logger.info('LSP enhanced search completed', {
        queryId,
        totalResults: finalResults.length,
        executionTime: metrics.executionTime,
        lspResultCount: lspResults.length,
      });

      return {
        results: finalResults,
        metrics,
      };
    } catch (error) {
      this.logger.error('LSP enhanced search failed', {
        queryId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.errorHandler.handleError(error as Error, {
        component: 'LSPEnhancedSearchService',
        operation: 'search',
        metadata: { queryId, params: JSON.stringify(params) },
      });

      // 降级到纯混合搜索
      const fallbackResults = await this.hybridSearchService.search(params);

      return {
        results: fallbackResults.results as LSPEnhancedSearchResult[],
        metrics: {
          ...fallbackResults.metrics,
          executionTime: Date.now() - startTime,
          fallback: true,
        },
      };
    }
  }

  private fuseResults(
    hybridResults: HybridSearchResult[],
    lspResults: LSPSearchResult[],
    params: LSPEnhancedSearchParams
  ): LSPEnhancedSearchResult[] {
    const enhancedResults: LSPEnhancedSearchResult[] = [];

    // 首先添加混合搜索结果
    enhancedResults.push(
      ...hybridResults.map(result => ({
        ...result,
        lspResults: [],
      }))
    );

    // 然后添加LSP结果，避免重复
    const existingLocations = new Set(
      hybridResults.map(r => `${r.filePath}:${r.startLine}:${r.endLine}`)
    );

    for (const lspResult of lspResults) {
      const locationKey = `${lspResult.filePath}:${lspResult.range.start.line}:${lspResult.range.end.line}`;

      if (!existingLocations.has(locationKey)) {
        // 创建新的增强结果
        const enhancedResult: LSPEnhancedSearchResult = {
          id: lspResult.id,
          score: lspResult.score * 0.8, // LSP结果权重稍低
          filePath: lspResult.filePath,
          content: lspResult.content || '',
          startLine: lspResult.range.start.line,
          endLine: lspResult.range.end.line,
          language: this.detectLanguage(lspResult.filePath),
          chunkType: lspResult.type,
          metadata: {
            ...lspResult.metadata,
            lspType: lspResult.type,
            lspKind: lspResult.kind,
            lspDetail: lspResult.detail,
          },
          searchScores: {
            semanticScore: 0,
            keywordScore: 0,
            fuzzyScore: 0,
            structuralScore: 0,
            combinedScore: lspResult.score * 0.8,
          },
          matchHighlights: [
            {
              type: 'semantic',
              text: lspResult.name,
              score: lspResult.score,
            },
          ],
          lspResults: [lspResult],
        };

        enhancedResults.push(enhancedResult);
      } else {
        // 增强现有结果
        const existingResult = enhancedResults.find(
          r => `${r.filePath}:${r.startLine}:${r.endLine}` === locationKey
        );

        if (existingResult) {
          if (!existingResult.lspResults) {
            existingResult.lspResults = [];
          }
          existingResult.lspResults.push(lspResult);

          // 提升分数
          existingResult.score = Math.min(1.0, existingResult.score + 0.1);
          existingResult.searchScores.combinedScore = existingResult.score;
        }
      }
    }

    return enhancedResults;
  }

  private rankAndFilterResults(
    results: LSPEnhancedSearchResult[],
    params: LSPEnhancedSearchParams
  ): LSPEnhancedSearchResult[] {
    // 按分数排序
    const sortedResults = results.sort((a, b) => b.score - a.score);

    // 应用阈值过滤
    const threshold = params.threshold || 0.1;
    const filteredResults = sortedResults.filter(r => r.score >= threshold);

    // 限制结果数量
    const limit = params.limit || 50;
    return filteredResults.slice(0, limit);
  }

  private generateQueryId(query: string): string {
    return `lsp_enhanced_${Date.now()}_${Buffer.from(query).toString('base64').slice(0, 8)}`;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
    };

    return languageMap[ext || ''] || 'unknown';
  }

  async getRealTimeSuggestions(query: string, projectPath: string): Promise<string[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const lspResults = await this.lspSearchService.search({
        query,
        projectPath,
        searchTypes: ['symbol'],
        limit: 10,
      });

      return lspResults.results
        .filter(r => r.type === 'symbol')
        .map(r => r.name)
        .filter(name => name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
    } catch (error) {
      this.logger.warn('Real-time suggestions failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
