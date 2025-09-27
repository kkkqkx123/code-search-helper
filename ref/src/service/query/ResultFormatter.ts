import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { PrometheusMetricsService } from '../../services/monitoring/PrometheusMetricsService';
import { QueryResult } from './QueryCoordinationService';
import { GraphAnalysisResult } from '../graph/GraphService';
import { ResultFormatterCache } from './ResultFormatterCache';
import { ResultFormatterConfigLoader } from './ResultFormatterConfigLoader';

export interface ResultFormatterConfig {
  provider: 'openai' | 'claude' | 'anthropic' | 'custom';
  format: 'json' | 'text' | 'markdown';
  includeMetadata: boolean;
  maxTokens: number;
  structuredOutput: boolean;
}

export interface ResultFormatterConfigProfile {
  format: 'json' | 'text' | 'markdown';
  includeMetadata: boolean;
  maxTokens: number;
  structuredOutput: boolean;
}

export interface ResultFormatterFullConfig {
  profiles: {
    openai: ResultFormatterConfigProfile;
    claude: ResultFormatterConfigProfile;
    anthropic: ResultFormatterConfigProfile;
    custom: ResultFormatterConfigProfile;
  };
  defaults: ResultFormatterConfig;
  formatting: {
    entityExtraction: {
      confidenceThreshold: number;
      maxEntities: number;
      includeRelationships: boolean;
    };
    summaryGeneration: {
      maxLength: number;
      includeStatistics: boolean;
      includeRecommendations: boolean;
    };
    suggestionGeneration: {
      maxSuggestions: number;
      includeCodeSmells: boolean;
      includeRefactoringTips: boolean;
    };
  };
  performance: {
    caching: {
      enabled: boolean;
      ttl: number;
      maxCacheSize: number;
    };
    memory: {
      maxResultSize: number;
      streamResults: boolean;
    };
    rateLimiting: {
      maxRequestsPerSecond: number;
      burstLimit: number;
    };
  };
}

export interface LLMFormattedResult {
  status: 'success' | 'error';
  data: {
    structured?: StructuredData;
    summary?: SummaryData;
    suggestions?: string[];
    [key: string]: any;
  };
  meta: {
    tool: string;
    duration_ms: number;
    cached?: boolean;
    provider?: string;
    [key: string]: any;
  };
}

export interface StructuredData {
  entities: Array<{
    id: string;
    type: string;
    properties: Record<string, any>;
    relationships: Array<{
      type: string;
      target: string;
      properties: Record<string, any>;
    }>;
  }>;
  metadata: {
    extractionTime: number;
    confidence: number;
    source: string;
  };
}

export interface SummaryData {
  executiveSummary: string;
  keyFindings: string[];
  statistics: Record<string, number>;
  recommendations: string[];
  confidenceScore: number;
}

export interface ErrorResponse {
  status: 'error';
  data: {
    errorType: string;
    message: string;
    recoverable: boolean;
    suggestions?: string[];
  };
  meta: {
    tool: string;
    duration_ms: number;
  };
}

@injectable()
export class ResultFormatter {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private cache: ResultFormatterCache;
  private configLoader: ResultFormatterConfigLoader;
  private metricsService?: PrometheusMetricsService;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ResultFormatterCache) cache: ResultFormatterCache,
    @inject(TYPES.ResultFormatterConfigLoader) configLoader: ResultFormatterConfigLoader,
    @inject(TYPES.PrometheusMetricsService) metricsService?: PrometheusMetricsService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.cache = cache;
    this.configLoader = configLoader;
    this.metricsService = metricsService;
  }

  private getConfig(): ResultFormatterFullConfig {
    return this.configLoader.loadConfig();
  }

  async formatForLLM(
    result: QueryResult | GraphAnalysisResult | any,
    options: ResultFormatterConfig = {
      provider: 'openai',
      format: 'json',
      includeMetadata: true,
      maxTokens: 4000,
      structuredOutput: true,
    }
  ): Promise<LLMFormattedResult> {
    const startTime = Date.now();

    // Simple logging for now - metrics integration can be added later
    this.logger.info('Formatting request', {
      provider: options.provider,
      format: options.format,
    });

    // Generate cache key based on result and options
    const cacheKey = this.generateCacheKey(result, options);

    // Check cache first
    const cachedResult = this.cache.get<LLMFormattedResult>(cacheKey);
    if (cachedResult) {
      this.logger.info('Returning cached formatted result', { cacheKey });
      return {
        ...cachedResult,
        meta: {
          ...cachedResult.meta,
          cached: true,
        },
      };
    }

    try {
      this.logger.info('Formatting result for LLM', {
        provider: options.provider,
        format: options.format,
      });

      // Extract structured data
      const structuredData = this.extractStructuredData(result);

      // Generate summary
      const summaryData = this.generateSummary(result);

      // Generate suggestions
      const suggestions = this.provideSuggestions(result);

      // Format according to provider
      const formattedResult = this.formatResult(structuredData, summaryData, suggestions);

      const processingTime = Date.now() - startTime;

      // Log performance metrics
      this.logger.info('Formatting completed', {
        processingTime,
        entityCount: structuredData.entities.length,
        provider: options.provider,
        format: options.format,
      });

      const resultToCache: LLMFormattedResult = {
        status: 'success',
        data: formattedResult,
        meta: {
          tool: this.determineToolType(result),
          duration_ms: processingTime,
          provider: options.provider,
          cached: false,
        },
      };

      // Cache the result
      this.cache.set(cacheKey, resultToCache);

      return resultToCache;
    } catch (error) {
      const errorContext = {
        component: 'ResultFormatter',
        operation: 'formatForLLM',
        duration: Date.now() - startTime,
      };

      this.logger.error('Formatting failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: options.provider,
        duration: errorContext.duration,
      });

      const errorResult = this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      return {
        status: 'error',
        data: {
          errorType: errorResult.type,
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
          suggestions: [],
        },
        meta: {
          tool: this.determineToolType(result),
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  private extractStructuredData(result: any): StructuredData {
    const startTime = Date.now();
    const entities: Array<any> = [];
    const relationships: Array<any> = [];

    try {
      // Handle GraphAnalysisResult
      if ('nodes' in result && 'edges' in result) {
        const graphResult = result as GraphAnalysisResult;

        // Extract nodes as entities
        if (graphResult.nodes) {
          graphResult.nodes.forEach(node => {
            entities.push({
              id: node.id,
              type: node.type,
              properties: node.properties,
              relationships: [],
            });
          });
        }

        // Extract edges as relationships
        if (graphResult.edges) {
          graphResult.edges.forEach(edge => {
            relationships.push({
              type: edge.type,
              source: edge.source,
              target: edge.target,
              properties: edge.properties,
            });
          });
        }
      }

      // Handle QueryResult
      else if (Array.isArray(result)) {
        result.forEach((item: any) => {
          if (item.filePath && item.content) {
            entities.push({
              id: item.id || item.filePath,
              type: 'code_chunk',
              properties: {
                filePath: item.filePath,
                content: item.content,
                startLine: item.startLine,
                endLine: item.endLine,
                language: item.language,
                chunkType: item.chunkType,
              },
              relationships: [],
            });
          }
        });
      }

      // Handle single QueryResult item
      else if (result.filePath && result.content) {
        entities.push({
          id: result.id || result.filePath,
          type: 'code_chunk',
          properties: {
            filePath: result.filePath,
            content: result.content,
            startLine: result.startLine,
            endLine: result.endLine,
            language: result.language,
            chunkType: result.chunkType,
          },
          relationships: [],
        });
      }

      return {
        entities,
        metadata: {
          extractionTime: Date.now() - startTime,
          confidence: 0.8,
          source: 'result_formatter',
        },
      };
    } catch (error) {
      this.logger.error('Failed to extract structured data', { error });
      return {
        entities: [],
        metadata: {
          extractionTime: Date.now() - startTime,
          confidence: 0,
          source: 'result_formatter',
        },
      };
    }
  }

  private generateSummary(result: any): SummaryData {
    try {
      let executiveSummary = '';
      const keyFindings: string[] = [];
      const statistics: Record<string, number> = {};
      const recommendations: string[] = [];

      // Generate executive summary based on result type
      if ('metrics' in result && 'nodes' in result) {
        // GraphAnalysisResult
        const graphResult = result as GraphAnalysisResult;
        executiveSummary = this.generateGraphSummary(graphResult);

        statistics.totalNodes = graphResult.nodes.length;
        statistics.totalEdges = graphResult.edges.length;
        statistics.averageDegree = graphResult.metrics.averageDegree;
        statistics.maxDepth = graphResult.metrics.maxDepth;

        keyFindings.push(`Found ${graphResult.nodes.length} code entities`);
        keyFindings.push(`Identified ${graphResult.edges.length} relationships`);

        if (graphResult.metrics.componentCount > 1) {
          recommendations.push(
            `Project has ${graphResult.metrics.componentCount} disconnected components, consider reviewing module boundaries`
          );
        }
      } else if (Array.isArray(result)) {
        // QueryResult array
        executiveSummary = this.generateQuerySummary(result);

        statistics.resultCount = result.length;
        statistics.averageScore =
          result.reduce((sum, r) => sum + (r.score || 0), 0) / (result.length || 1);

        keyFindings.push(`Returned ${result.length} relevant code segments`);

        const languages = [...new Set(result.map(r => r.language).filter(Boolean))] as string[];
        if (languages.length > 0) {
          keyFindings.push(
            `Results span ${languages.length} programming languages: ${languages.join(', ')}`
          );
        }
      } else {
        // Single result or other type
        executiveSummary = 'Processed query result';
        statistics.resultCount = 1;
      }

      return {
        executiveSummary,
        keyFindings,
        statistics,
        recommendations,
        confidenceScore: 0.9,
      };
    } catch (error) {
      this.logger.error('Failed to generate summary', { error });
      return {
        executiveSummary: 'Unable to generate summary',
        keyFindings: [],
        statistics: {},
        recommendations: [],
        confidenceScore: 0,
      };
    }
  }

  private generateGraphSummary(result: GraphAnalysisResult): string {
    return (
      `Analyzed codebase structure with ${result.nodes.length} entities and ${result.edges.length} relationships. ` +
      `The codebase has an average node degree of ${result.metrics.averageDegree.toFixed(2)} ` +
      `across ${result.metrics.componentCount} connected components.`
    );
  }

  private generateQuerySummary(results: QueryResult[]): string {
    const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / (results.length || 1);
    return (
      `Found ${results.length} relevant code segments with an average relevance score of ${avgScore.toFixed(2)}. ` +
      `Results include code from ${[...new Set(results.map(r => r.language).filter(Boolean))].join(', ')}.`
    );
  }

  private provideSuggestions(result: any): string[] {
    const suggestions: string[] = [];

    try {
      if ('metrics' in result && 'nodes' in result) {
        // GraphAnalysisResult
        const graphResult = result as GraphAnalysisResult;

        const cyclicDependencies = this.getCyclicDependencyCount(graphResult);
        if (cyclicDependencies > 0) {
          suggestions.push('Consider refactoring to reduce cyclic dependencies');
        }

        if (graphResult.metrics.averageDegree > 5) {
          suggestions.push('Highly connected components detected, consider modularization');
        }

        // Check if externalDependencies exists in summary
        if (graphResult.summary && graphResult.summary.externalDependencies > 10) {
          suggestions.push(
            'Large number of external dependencies, review for security and maintenance'
          );
        }
      } else if (Array.isArray(result)) {
        // QueryResult array
        const languages = [...new Set(result.map(r => r.language).filter(Boolean))] as string[];
        if (languages.length > 1) {
          suggestions.push('Results span multiple languages, ensure cross-language consistency');
        }

        const avgScore = result.reduce((sum, r) => sum + (r.score || 0), 0) / (result.length || 1);
        if (avgScore < 0.5) {
          suggestions.push('Low average relevance score, consider refining your query');
        }
      }
    } catch (error) {
      this.logger.error('Failed to generate suggestions', { error });
    }

    return suggestions;
  }

  private formatResult(
    structuredData: StructuredData,
    summaryData: SummaryData,
    suggestions: string[]
  ): any {
    // For now, we'll return a simplified format
    // In a full implementation, this would format according to the specific provider
    return {
      structured: structuredData,
      summary: summaryData,
      suggestions: suggestions,
    };
  }

  private determineToolType(result: any): string {
    if ('metrics' in result && 'nodes' in result) {
      return 'graph_analysis';
    } else if (Array.isArray(result)) {
      return 'query_search';
    } else {
      return 'generic_tool';
    }
  }

  private getCyclicDependencyCount(graphResult: GraphAnalysisResult): number {
    // This is a placeholder implementation
    // In a real implementation, this would calculate actual cyclic dependencies
    return graphResult.metrics.totalEdges > graphResult.metrics.totalNodes
      ? Math.floor((graphResult.metrics.totalEdges - graphResult.metrics.totalNodes) / 2)
      : 0;
  }

  private generateCacheKey(result: any, options: ResultFormatterConfig): string {
    // Create a simple hash of the result and options
    const resultString = JSON.stringify(result);
    const optionsString = JSON.stringify(options);
    const combinedString = resultString + optionsString;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combinedString.length; i++) {
      const char = combinedString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `llm_format_${Math.abs(hash)}`;
  }

  // Health check methods
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      cache: { status: string; size: number; maxSize: number };
      config: { status: string; loaded: boolean };
      metrics: { status: string; available: boolean };
    };
    timestamp: number;
  }> {
    try {
      const cacheStatus = this.cache.size() < this.cache['maxSize'] ? 'healthy' : 'warning';
      const configStatus = this.configLoader.loadConfig() ? 'loaded' : 'failed';
      const metricsStatus = this.metricsService ? 'available' : 'unavailable';

      const overallStatus =
        cacheStatus === 'healthy' && configStatus === 'loaded' && metricsStatus === 'available'
          ? 'healthy'
          : 'unhealthy';

      return {
        status: overallStatus,
        details: {
          cache: {
            status: cacheStatus,
            size: this.cache.size(),
            maxSize: this.cache['maxSize'],
          },
          config: {
            status: configStatus,
            loaded: configStatus === 'loaded',
          },
          metrics: {
            status: metricsStatus,
            available: metricsStatus === 'available',
          },
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          cache: { status: 'error', size: 0, maxSize: 0 },
          config: { status: 'error', loaded: false },
          metrics: { status: 'error', available: false },
        },
        timestamp: Date.now(),
      };
    }
  }

  getMetrics(): {
    cacheSize: number;
    cacheHitRate: number;
    averageProcessingTime: number;
    errorRate: number;
    uptime: number;
  } {
    // This would typically aggregate metrics from the metrics service
    // For now, we'll return basic statistics
    return {
      cacheSize: this.cache.size(),
      cacheHitRate: 0.8, // Placeholder - would be calculated from actual metrics
      averageProcessingTime: 50, // Placeholder - would be calculated from actual metrics
      errorRate: 0.01, // Placeholder - would be calculated from actual metrics
      uptime: process.uptime() * 1000,
    };
  }
}
