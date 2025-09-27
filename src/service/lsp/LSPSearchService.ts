import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { LSPManager } from './LSPManager';
import { TYPES } from '../../types';

export interface LSPSearchParams {
  query: string;
  filePath?: string;
  projectPath: string;
  searchTypes: ('symbol' | 'definition' | 'reference' | 'diagnostic')[];
  limit?: number;
  includeDiagnostics?: boolean;
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

export interface LSPSearchMetrics {
  queryId: string;
  executionTime: number;
  symbolSearchTime: number;
  definitionSearchTime: number;
  referenceSearchTime: number;
  diagnosticSearchTime: number;
  totalResults: number;
  cacheHit: boolean;
}

@injectable()
export class LSPSearchService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private lspManager: LSPManager;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.LSPManager) lspManager: LSPManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.lspManager = lspManager;
  }

  async search(params: LSPSearchParams): Promise<{
    results: LSPSearchResult[];
    metrics: LSPSearchMetrics;
  }> {
    const queryId = this.generateQueryId(params.query);
    const startTime = Date.now();

    this.logger.info('Starting LSP search', {
      queryId,
      query: params.query,
      projectPath: params.projectPath,
      searchTypes: params.searchTypes,
    });

    try {
      // 确保LSP已初始化
      const initialized = await this.lspManager.initialize(params.projectPath);
      if (!initialized) {
        this.logger.warn('LSP not initialized, returning empty results', {
          queryId,
          projectPath: params.projectPath,
        });
        return {
          results: [],
          metrics: {
            queryId,
            executionTime: Date.now() - startTime,
            symbolSearchTime: 0,
            definitionSearchTime: 0,
            referenceSearchTime: 0,
            diagnosticSearchTime: 0,
            totalResults: 0,
            cacheHit: false,
          },
        };
      }

      const results: LSPSearchResult[] = [];
      const metrics = {
        symbolSearchTime: 0,
        definitionSearchTime: 0,
        referenceSearchTime: 0,
        diagnosticSearchTime: 0,
      };

      // 并行执行不同类型的搜索
      const searchPromises: Promise<void>[] = [];

      if (params.searchTypes.includes('symbol')) {
        searchPromises.push(this.searchSymbols(params, results, metrics).then(() => {}));
      }

      if (params.searchTypes.includes('definition')) {
        searchPromises.push(this.searchDefinitions(params, results, metrics).then(() => {}));
      }

      if (params.searchTypes.includes('reference')) {
        searchPromises.push(this.searchReferences(params, results, metrics).then(() => {}));
      }

      if (params.includeDiagnostics && params.searchTypes.includes('diagnostic')) {
        searchPromises.push(this.searchDiagnostics(params, results, metrics).then(() => {}));
      }

      await Promise.all(searchPromises);

      // 去重和排序
      const uniqueResults = this.deduplicateResults(results);
      const sortedResults = this.sortResults(uniqueResults, params.query);

      // 限制结果数量
      const limitedResults = sortedResults.slice(0, params.limit || 50);

      const finalMetrics: LSPSearchMetrics = {
        queryId,
        executionTime: Date.now() - startTime,
        ...metrics,
        totalResults: limitedResults.length,
        cacheHit: false,
      };

      this.logger.info('LSP search completed', {
        queryId,
        totalResults: limitedResults.length,
        executionTime: finalMetrics.executionTime,
      });

      return {
        results: limitedResults,
        metrics: finalMetrics,
      };
    } catch (error) {
      this.logger.error('LSP search failed', {
        queryId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.errorHandler.handleError(error as Error, {
        component: 'LSPSearchService',
        operation: 'search',
        metadata: { queryId, params: JSON.stringify(params) },
      });

      return {
        results: [],
        metrics: {
          queryId,
          executionTime: Date.now() - startTime,
          symbolSearchTime: 0,
          definitionSearchTime: 0,
          referenceSearchTime: 0,
          diagnosticSearchTime: 0,
          totalResults: 0,
          cacheHit: false,
        },
      };
    }
  }

  private async searchSymbols(
    params: LSPSearchParams,
    results: LSPSearchResult[],
    metrics: any
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // 使用工作区符号搜索来搜索整个项目
      const symbols = await this.lspManager.getWorkspaceSymbols(
        params.query,
        params.projectPath || ''
      );

      if (symbols) {
        symbols.forEach(symbol => {
          // 对于工作区符号搜索，我们不需要额外的匹配，因为LSP服务器已经基于查询过滤了结果
          results.push({
            id: this.generateResultId('symbol', symbol.name, symbol.filePath),
            type: 'symbol',
            filePath: symbol.filePath,
            name: symbol.name,
            kind: symbol.kind,
            range: symbol.range,
            detail: symbol.detail,
            score: this.calculateSymbolScore(symbol.name, params.query),
            metadata: {
              containerName: symbol.detail,
            },
          });
        });
      }

      metrics.symbolSearchTime = Date.now() - startTime;
    } catch (error) {
      this.logger.warn('Symbol search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      metrics.symbolSearchTime = Date.now() - startTime;
    }
  }

  private async searchDefinitions(
    params: LSPSearchParams,
    results: LSPSearchResult[],
    metrics: any
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // 跳过定义搜索，因为LSPManager没有直接的定义搜索API
      // 可以基于符号搜索的结果来推断定义位置
      metrics.definitionSearchTime = Date.now() - startTime;
    } catch (error) {
      this.logger.warn('Definition search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      metrics.definitionSearchTime = Date.now() - startTime;
    }
  }

  private async searchReferences(
    params: LSPSearchParams,
    results: LSPSearchResult[],
    metrics: any
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // 跳过引用搜索，因为LSPManager没有直接的引用搜索API
      metrics.referenceSearchTime = Date.now() - startTime;
    } catch (error) {
      this.logger.warn('Reference search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      metrics.referenceSearchTime = Date.now() - startTime;
    }
  }

  private async searchDiagnostics(
    params: LSPSearchParams,
    results: LSPSearchResult[],
    metrics: any
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // 如果指定了文件路径，获取该文件的诊断信息
      if (params.filePath && params.filePath !== '') {
        const diagnostics = await this.lspManager.getDiagnostics(
          params.filePath,
          params.projectPath
        );

        if (diagnostics) {
          diagnostics.diagnostics.forEach(diagnostic => {
            if (this.matchesQuery(diagnostic.message, params.query)) {
              results.push({
                id: this.generateResultId(
                  'diagnostic',
                  params.filePath || 'unknown',
                  diagnostic.range.start.line
                ),
                type: 'diagnostic',
                filePath: diagnostics.filePath,
                name: 'Diagnostic',
                kind: 'diagnostic',
                range: diagnostic.range,
                detail: diagnostic.message,
                score: this.calculateDiagnosticScore(diagnostic.message, params.query),
                metadata: {
                  severity: diagnostic.severity,
                  source: diagnostic.source,
                },
              });
            }
          });
        }
      }

      metrics.diagnosticSearchTime = Date.now() - startTime;
    } catch (error) {
      this.logger.warn('Diagnostic search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      metrics.diagnosticSearchTime = Date.now() - startTime;
    }
  }

  private generateQueryId(query: string): string {
    return `lsp_${Date.now()}_${Buffer.from(query).toString('base64').slice(0, 8)}`;
  }

  private generateResultId(type: string, name: string, filePath: string | number): string {
    const hash = Buffer.from(`${type}:${name}:${filePath}`).toString('base64');
    return `${type}_${hash.slice(0, 16)}`;
  }

  private matchesQuery(text: string, query: string): boolean {
    if (!text || !query) return false;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    return lowerText.includes(lowerQuery);
  }

  private calculateSymbolScore(symbolName: string, query: string): number {
    const lowerSymbol = symbolName.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (lowerSymbol === lowerQuery) return 1.0;
    if (lowerSymbol.startsWith(lowerQuery)) return 0.9;
    if (lowerSymbol.includes(lowerQuery)) return 0.7;

    return 0.5;
  }

  private calculateDefinitionScore(query: string): number {
    return 0.8;
  }

  private calculateReferenceScore(query: string): number {
    return 0.6;
  }

  private calculateDiagnosticScore(message: string, query: string): number {
    return this.matchesQuery(message, query) ? 0.4 : 0.0;
  }

  private deduplicateResults(results: LSPSearchResult[]): LSPSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = `${result.filePath}:${result.range.start.line}:${result.range.start.character}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private sortResults(results: LSPSearchResult[], query: string): LSPSearchResult[] {
    return results.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      // 按文件路径排序
      if (a.filePath !== b.filePath) {
        return a.filePath.localeCompare(b.filePath);
      }

      // 按位置排序
      if (a.range.start.line !== b.range.start.line) {
        return a.range.start.line - b.range.start.line;
      }

      return a.range.start.character - b.range.start.character;
    });
  }
}
