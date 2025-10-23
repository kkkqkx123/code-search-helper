import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { QueryResultNormalizer } from './QueryResultNormalizer';
import { UniversalTextSplitter } from '../../universal/UniversalTextSplitter';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { UnifiedCacheManager } from '../../../../infrastructure/caching/UnifiedCacheManager';
import { ErrorHandlingManager, ErrorType } from '../../../../infrastructure/error-handling/ErrorHandlingManager';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { StandardizedQueryResult } from './types';
import { CodeChunk } from '../../splitting';

/**
 * 集成服务配置
 */
export interface IntegrationServiceConfig {
  enableCaching: boolean;
  enablePerformanceMonitoring: boolean;
  enableErrorHandling: boolean;
  cacheConfig?: {
    maxSize: number;
    ttl: number;
  };
  errorHandlingConfig?: {
    maxRetries: number;
    enableFallback: boolean;
  };
}

/**
 * 处理结果
 */
export interface ProcessingResult {
  success: boolean;
  chunks?: CodeChunk[];
  normalizedResults?: StandardizedQueryResult[];
  error?: string;
  metrics?: {
    processingTime: number;
    cacheHit: boolean;
    fallbackUsed: boolean;
  };
}

/**
 * 标准化集成服务
 * 整合QueryResultNormalizer、UniversalTextSplitter、缓存、性能监控和错误处理
 */
@injectable()
export class NormalizationIntegrationService {
  private logger: LoggerService;
  private queryNormalizer: QueryResultNormalizer;
  private universalTextSplitter: UniversalTextSplitter;
  private performanceMonitor?: PerformanceMonitor;
  private cacheManager?: UnifiedCacheManager;
  private errorHandlingManager?: ErrorHandlingManager;
  private treeSitterService?: TreeSitterCoreService;
  private config: IntegrationServiceConfig;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.QueryResultNormalizer) queryNormalizer: QueryResultNormalizer,
    @inject(TYPES.UniversalTextSplitter) universalTextSplitter: UniversalTextSplitter,
    @inject(TYPES.PerformanceMonitor) performanceMonitor?: PerformanceMonitor,
    @inject(TYPES.UnifiedCacheManager) cacheManager?: UnifiedCacheManager,
    @inject(TYPES.ErrorHandlingManager) errorHandlingManager?: ErrorHandlingManager,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterCoreService
  ) {
    this.logger = logger;
    this.queryNormalizer = queryNormalizer;
    this.universalTextSplitter = universalTextSplitter;
    this.performanceMonitor = performanceMonitor;
    this.cacheManager = cacheManager;
    this.errorHandlingManager = errorHandlingManager;
    this.treeSitterService = treeSitterService;
    
    this.config = {
      enableCaching: true,
      enablePerformanceMonitoring: true,
      enableErrorHandling: true,
      cacheConfig: {
        maxSize: 1000,
        ttl: 300000 // 5分钟
      },
      errorHandlingConfig: {
        maxRetries: 3,
        enableFallback: true
      }
    };

    this.initializeServices();
  }

  /**
   * 初始化服务
   */
  private initializeServices(): void {
    // 设置服务间的依赖关系
    if (this.treeSitterService) {
      this.queryNormalizer.setTreeSitterService(this.treeSitterService);
      this.universalTextSplitter.setTreeSitterService(this.treeSitterService);
    }

    if (this.performanceMonitor) {
      this.queryNormalizer.setPerformanceMonitor(this.performanceMonitor);
    }

    this.universalTextSplitter.setQueryNormalizer(this.queryNormalizer);

    this.logger.info('Normalization integration service initialized');
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IntegrationServiceConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 更新子服务配置
    if (config.cacheConfig && this.cacheManager) {
      // 更新缓存配置
    }
    
    if (config.errorHandlingConfig && this.errorHandlingManager) {
      this.errorHandlingManager.updateConfig({
        maxRetries: config.errorHandlingConfig.maxRetries,
        enableFallback: config.errorHandlingConfig.enableFallback
      });
    }
    
    this.logger.debug('Integration service config updated', config);
  }

  /**
   * 处理文本内容 - 主要入口点
   */
  async processContent(
    content: string,
    language: string,
    filePath?: string,
    options?: {
      queryTypes?: string[];
      chunkingStrategy?: 'semantic' | 'bracket' | 'line';
      enableNormalization?: boolean;
    }
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const operationId = this.performanceMonitor?.startOperation('process_content', {
      language,
      filePath,
      contentLength: content.length
    });

    try {
      // 检查缓存
      if (this.config.enableCaching && this.cacheManager) {
        const cacheKey = this.generateCacheKey(content, language, filePath, options);
        const cachedResult = this.cacheManager.get<ProcessingResult>('processing', cacheKey);
        
        if (cachedResult) {
          this.performanceMonitor?.endOperation(operationId, { 
            cacheHit: true,
            success: true 
          });
          
          this.logger.debug('Processing result retrieved from cache', { 
            language, 
            filePath 
          });
          
          return {
            ...cachedResult,
            metrics: {
              ...cachedResult.metrics,
              cacheHit: true
            }
          };
        }
      }

      // 执行处理
      const result = await this.executeProcessing(content, language, filePath, options);
      
      // 缓存结果
      if (this.config.enableCaching && this.cacheManager && result.success) {
        const cacheKey = this.generateCacheKey(content, language, filePath, options);
        this.cacheManager.set('processing', cacheKey, result, this.config.cacheConfig?.ttl);
      }

      const processingTime = Date.now() - startTime;
      
      this.performanceMonitor?.endOperation(operationId, { 
        success: result.success,
        processingTime,
        cacheHit: false,
        fallbackUsed: result.metrics?.fallbackUsed || false
      });

      return {
        ...result,
        metrics: {
          processingTime,
          cacheHit: false,
          fallbackUsed: result.metrics?.fallbackUsed || false
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.performanceMonitor?.endOperation(operationId, { 
        success: false,
        error: String(error),
        processingTime
      });

      this.logger.error('Content processing failed', {
        language,
        filePath,
        error: String(error),
        processingTime
      });

      return {
        success: false,
        error: String(error),
        metrics: {
          processingTime,
          cacheHit: false,
          fallbackUsed: false
        }
      };
    }
  }

  /**
   * 执行处理逻辑
   */
  private async executeProcessing(
    content: string,
    language: string,
    filePath?: string,
    options?: {
      queryTypes?: string[];
      chunkingStrategy?: 'semantic' | 'bracket' | 'line';
      enableNormalization?: boolean;
    }
  ): Promise<ProcessingResult> {
    const enableNormalization = options?.enableNormalization !== false;
    const chunkingStrategy = options?.chunkingStrategy || 'semantic';

    // 如果启用了错误处理，使用错误处理管理器
    if (this.config.enableErrorHandling && this.errorHandlingManager) {
      return await this.errorHandlingManager.executeWithFallback(
        'process_content',
        () => this.executeProcessingInternal(content, language, filePath, options),
        { content, language, filePath, options }
      );
    }

    // 直接执行处理
    return await this.executeProcessingInternal(content, language, filePath, options);
  }

  /**
   * 内部处理逻辑
   */
  private async executeProcessingInternal(
    content: string,
    language: string,
    filePath?: string,
    options?: {
      queryTypes?: string[];
      chunkingStrategy?: 'semantic' | 'bracket' | 'line';
      enableNormalization?: boolean;
    }
  ): Promise<ProcessingResult> {
    const enableNormalization = options?.enableNormalization !== false;
    const chunkingStrategy = options?.chunkingStrategy || 'semantic';

    try {
      // 第一步：分段
      let chunks: CodeChunk[];
      
      switch (chunkingStrategy) {
        case 'semantic':
          chunks = await this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, language);
          break;
        case 'bracket':
          chunks = await this.universalTextSplitter.chunkByBracketsAndLines(content, filePath, language);
          break;
        case 'line':
          chunks = await this.universalTextSplitter.chunkByLines(content, filePath, language);
          break;
        default:
          throw new Error(`Unknown chunking strategy: ${chunkingStrategy}`);
      }

      // 第二步：标准化（如果启用）
      let normalizedResults: StandardizedQueryResult[] = [];
      
      if (enableNormalization && this.treeSitterService) {
        try {
          const parseResult = await this.treeSitterService.parseCode(content, language);
          if (parseResult.success && parseResult.ast) {
            normalizedResults = await this.queryNormalizer.normalize(
              parseResult.ast, 
              language, 
              options?.queryTypes
            );
          }
        } catch (error) {
          this.logger.warn('Normalization failed, continuing with chunks only', {
            language,
            filePath,
            error: String(error)
          });
        }
      }

      return {
        success: true,
        chunks,
        normalizedResults,
        metrics: {
          processingTime: 0, // 将在上层设置
          cacheHit: false,
          fallbackUsed: false
        }
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        metrics: {
          processingTime: 0,
          cacheHit: false,
          fallbackUsed: false
        }
      };
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    content: string,
    language: string,
    filePath?: string,
    options?: {
      queryTypes?: string[];
      chunkingStrategy?: 'semantic' | 'bracket' | 'line';
      enableNormalization?: boolean;
    }
  ): string {
    const contentHash = this.hashContent(content);
    const optionsHash = this.hashOptions(options);
    return `${language}:${filePath || 'no-file'}:${contentHash}:${optionsHash}`;
  }

  /**
   * 哈希内容
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 哈希选项
   */
  private hashOptions(options?: any): string {
    if (!options) return 'default';
    
    try {
      const optionsStr = JSON.stringify(options);
      let hash = 0;
      for (let i = 0; i < optionsStr.length; i++) {
        const char = optionsStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    } catch {
      return 'invalid';
    }
  }

  /**
   * 获取服务统计信息
   */
  getServiceStats(): {
    normalization?: any;
    chunking?: any;
    cache?: any;
    performance?: any;
    errorHandling?: any;
  } {
    const stats: any = {};

    // 标准化统计
    if (this.queryNormalizer) {
      stats.normalization = this.queryNormalizer.getPerformanceStats();
    }

    // 分段统计
    if (this.universalTextSplitter) {
      stats.chunking = this.universalTextSplitter.getStandardizationStats();
    }

    // 缓存统计
    if (this.cacheManager) {
      stats.cache = this.cacheManager.getGlobalStats();
    }

    // 性能统计
    if (this.performanceMonitor) {
      stats.performance = this.performanceMonitor.getOperationStats();
    }

    // 错误处理统计
    if (this.errorHandlingManager) {
      stats.errorHandling = this.errorHandlingManager.getErrorStats();
    }

    return stats;
  }

  /**
   * 重置所有统计信息
   */
  resetStats(): void {
    if (this.queryNormalizer) {
      this.queryNormalizer.resetStats();
    }

    if (this.universalTextSplitter) {
      this.universalTextSplitter.resetStandardizationStats();
    }

    if (this.cacheManager) {
      this.cacheManager.resetStats();
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.resetMetrics();
    }

    if (this.errorHandlingManager) {
      this.errorHandlingManager.resetErrorHistory();
    }

    this.logger.info('All service stats reset');
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    if (this.cacheManager) {
      this.cacheManager.clearAll();
      this.logger.info('All caches cleared');
    }
  }

  /**
   * 重置熔断器
   */
  resetCircuitBreakers(): void {
    if (this.errorHandlingManager) {
      this.errorHandlingManager.resetCircuitBreakers();
      this.logger.info('All circuit breakers reset');
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    issues: string[];
  }> {
    const services: Record<string, boolean> = {};
    const issues: string[] = [];

    // 检查各个服务
    try {
      // 检查Tree-sitter服务
      if (this.treeSitterService) {
        const supportedLanguages = this.treeSitterService.getSupportedLanguages();
        services.treeSitter = supportedLanguages.length > 0;
        if (!services.treeSitter) {
          issues.push('Tree-sitter service has no supported languages');
        }
      } else {
        services.treeSitter = false;
        issues.push('Tree-sitter service not available');
      }

      // 检查缓存服务
      if (this.cacheManager) {
        const cacheStats = this.cacheManager.getGlobalStats();
        services.cache = cacheStats.totalCaches >= 0;
        if (!services.cache) {
          issues.push('Cache service not responding');
        }
      } else {
        services.cache = false;
        issues.push('Cache service not available');
      }

      // 检查性能监控
      if (this.performanceMonitor) {
        const metrics = this.performanceMonitor.getMetrics();
        services.performanceMonitor = metrics.timestamp > 0;
        if (!services.performanceMonitor) {
          issues.push('Performance monitor not responding');
        }
      } else {
        services.performanceMonitor = false;
        issues.push('Performance monitor not available');
      }

      // 检查错误处理
      if (this.errorHandlingManager) {
        const errorStats = this.errorHandlingManager.getErrorStats();
        services.errorHandling = errorStats.totalErrors >= 0;
        if (!services.errorHandling) {
          issues.push('Error handling service not responding');
        }
      } else {
        services.errorHandling = false;
        issues.push('Error handling service not available');
      }

      // 检查熔断器状态
      if (this.errorHandlingManager) {
        const circuitBreakerStates = this.errorHandlingManager.getCircuitBreakerStates();
        const openBreakers = Object.entries(circuitBreakerStates)
          .filter(([_, state]) => state.state === 'open');
        
        if (openBreakers.length > 0) {
          issues.push(`${openBreakers.length} circuit breakers are open`);
        }
      }

    } catch (error) {
      issues.push(`Health check failed: ${String(error)}`);
    }

    // 确定整体状态
    const serviceCount = Object.keys(services).length;
    const healthyServiceCount = Object.values(services).filter(Boolean).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServiceCount === serviceCount && issues.length === 0) {
      status = 'healthy';
    } else if (healthyServiceCount > serviceCount / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services,
      issues
    };
  }
}