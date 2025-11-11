import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseType } from '../types';
import { IMemoryMonitorService } from '../../service/memory/interfaces/IMemoryMonitorService';
import { NebulaBatchStrategy } from './strategies/NebulaBatchStrategy';

// 导入相关类型
import {
  IBatchProcessingService,
  IBatchStrategy,
  BatchContext,
  BatchProcessingOptions,
  RetryOptions,
  PerformanceMetrics,
  PerformanceStats,
  DatabaseBatchOptions,
  EmbeddingOptions,
  BatchResult
} from './types';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult } from '../../service/similarity/types/SimilarityTypes';
import { EmbeddingInput, EmbeddingResult, Embedder } from '../../embedders/BaseEmbedder';
import { BatchStrategyFactory } from './strategies/BatchStrategyFactory';
import { SemanticBatchStrategy } from './strategies/SemanticBatchStrategy';
import { BatchProcessingConfig } from '../../config/service/BatchProcessingConfigService';

/**
 * 统一批处理服务
 * 整合所有批处理功能，包括数据库操作、相似度计算和嵌入器API调用
 */
@injectable()
export class BatchProcessingService implements IBatchProcessingService {
  private performanceMetrics: PerformanceMetrics[] = [];
  private config: BatchProcessingConfig;
  private currentBatchSizes: Map<string, number> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.MemoryMonitorService) private memoryMonitor: IMemoryMonitorService,
    @inject(BatchStrategyFactory) private strategyFactory: BatchStrategyFactory,
    @inject(SemanticBatchStrategy) private semanticStrategy: SemanticBatchStrategy
  ) {
    // 初始化配置
    this.config = this.initializeConfig();
    
    this.logger.info('BatchProcessingService initialized', {
      config: this.config
    });
  }

  /**
   * 通用批处理方法
   */
  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: BatchProcessingOptions
  ): Promise<R[]> {
    const context = options?.context || { domain: 'database' };
    const strategy = this.strategyFactory.getStrategy(context);
    const batchSize = options?.batchSize || strategy.calculateOptimalBatchSize(items.length, context);
    const maxConcurrency = options?.maxConcurrency || this.config.maxConcurrentOperations;
    
    this.logger.debug('Starting batch processing', {
      itemCount: items.length,
      batchSize,
      maxConcurrency,
      context
    });

    const results: R[] = [];
    const batches: T[][] = this.createBatches(items, batchSize);

    // 并发处理批次
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);
      
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        const operationName = `batch-${i + batchIndex}`;
        
        if (options?.enableRetry !== false) {
          return this.executeWithRetry(
            () => processor(batch),
            operationName,
            {
              maxAttempts: options?.maxRetries || this.config.retryAttempts,
              baseDelay: options?.retryDelay || this.config.retryDelay
            }
          );
        } else {
          return this.executeWithMonitoring(
            () => processor(batch),
            operationName
          );
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    // 调整批大小（如果启用监控）
    if (options?.enableMonitoring) {
      this.adjustBatchSizeBasedOnPerformance(context, strategy);
    }

    return results;
  }

  /**
   * 相似度批处理方法
   */
  async processSimilarityBatch(
    contents: string[],
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const context: BatchContext = {
      domain: 'similarity',
      subType: strategy.type,
      metadata: { strategy: strategy.type, options }
    };

    this.logger.debug('Processing similarity batch', {
      contentCount: contents.length,
      strategy: strategy.type,
      context
    });

    // 如果是语义相似度且启用了优化，使用特殊处理
    if (strategy.type === 'semantic' && true) { // 默认启用语义优化
      return this.processSemanticSimilarityBatch(contents, strategy, options);
    }

    // 通用相似度批处理
    return this.processGenericSimilarityBatch(contents, strategy, context, options);
  }

  /**
   * 嵌入器批处理方法
   */
  async processEmbeddingBatch(
    inputs: EmbeddingInput[],
    embedder: Embedder,
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    const context: BatchContext = {
      domain: 'embedding',
      subType: 'api',
      metadata: { 
        model: embedder.getModelName(),
        dimensions: embedder.getDimensions(),
        provider: options?.embedderModel || 'default',
        avgTextLength: this.calculateAverageTextLength(inputs),
        options
      }
    };

    const strategy = this.strategyFactory.getStrategy(context);
    const batchSize = options?.batchSize || strategy.calculateOptimalBatchSize(inputs.length, context);
    
    this.logger.debug('Processing embedding batch', {
      inputCount: inputs.length,
      model: embedder.getModelName(),
      batchSize,
      context
    });

    // 使用嵌入器的批处理能力
    if (batchSize === inputs.length) {
      // 单次批处理
      return this.executeWithRetry(
        () => embedder.embed(inputs) as Promise<EmbeddingResult[]>,
        'embedding-batch',
        {
          maxAttempts: this.config.retryAttempts,
          baseDelay: this.config.retryDelay
        }
      );
    } else {
      // 分批处理
      return this.processBatches(inputs, (batch) => 
        embedder.embed(batch) as Promise<EmbeddingResult[]>,
        {
          batchSize,
          context,
          enableRetry: true,
          enableMonitoring: true
        }
      );
    }
  }

  /**
   * 数据库批处理方法
   */
  async processDatabaseBatch<T>(
    operations: T[],
    databaseType: DatabaseType,
    options?: DatabaseBatchOptions
  ): Promise<BatchResult> {
    const context: BatchContext = {
      domain: 'database',
      subType: databaseType,
      metadata: { 
        databaseType,
        operationType: options?.operationType || 'mixed',
        options
      }
    };

    const strategy = this.strategyFactory.getStrategy(context);
    const batchSize = options?.batchSize || strategy.calculateOptimalBatchSize(operations.length, context);
    
    this.logger.debug('Processing database batch', {
      operationCount: operations.length,
      databaseType,
      batchSize,
      context
    });

    const startTime = Date.now();
    const results: any[] = [];
    let successfulOperations = 0;
    let failedOperations = 0;

    try {
      // 如果是 Nebula 数据库，应用特定的配置
      let processingOptions: BatchProcessingOptions = {
        batchSize,
        context,
        enableRetry: true,
        enableMonitoring: true
      };

      if (databaseType === DatabaseType.NEBULA) {
        const nebulaStrategy = this.strategyFactory.getStrategy(context) as NebulaBatchStrategy;
        const nebulaConfig = nebulaStrategy.getNebulaSpecificConfig(context);
        
        // 应用 Nebula 特定配置
        processingOptions = {
          ...processingOptions,
          maxConcurrency: nebulaConfig.maxConcurrentTransactions,
          timeout: nebulaConfig.transactionTimeout
        };

        this.logger.debug('Applied Nebula-specific configuration', {
          databaseType,
          nebulaConfig,
          operationCount: operations.length
        });
      }

      const batchResults = await this.processBatches(
        operations,
        async (batch) => {
          // 这里应该调用具体的数据库操作
          // 为了简化，我们返回一个模拟结果
          const batchResult = await this.executeDatabaseOperation(batch, databaseType, options);
          successfulOperations += batch.length;
          return batchResult;
        },
        processingOptions
      );

      results.push(...batchResults.flat());
    } catch (error) {
      failedOperations = operations.length - successfulOperations;
      this.logger.error('Database batch processing failed', {
        error: error instanceof Error ? error.message : String(error),
        databaseType,
        failedOperations
      });
      throw error;
    }

    const totalDuration = Date.now() - startTime;

    return {
      totalOperations: operations.length,
      successfulOperations,
      failedOperations,
      totalDuration,
      results
    };
  }

  /**
   * 执行带有重试逻辑的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const retryConfig = {
      maxAttempts: this.config.retryAttempts,
      baseDelay: this.config.retryDelay,
      maxDelay: 30000, // 默认值
      backoffFactor: 2, // 默认值
      jitter: true, // 默认值
      ...options
    };

    let lastError: Error | null = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();

        // 记录成功的操作
        this.recordPerformanceMetric({
          operation: operationName,
          duration: Date.now() - startTime,
          success: true,
          timestamp: new Date(),
          metadata: { attempts: attempt }
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 记录失败的操作
        this.recordPerformanceMetric({
          operation: operationName,
          duration: Date.now() - startTime,
          success: false,
          timestamp: new Date(),
          metadata: { attempts: attempt, error: lastError.message }
        });

        // 如果是最后一次尝试，抛出错误
        if (attempt === retryConfig.maxAttempts) {
          break;
        }

        // 计算延迟
        const delay = this.calculateDelay(attempt, retryConfig);

        this.logger.warn(`Operation failed, retrying in ${delay}ms`, {
          operation: operationName,
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          error: lastError.message,
          nextRetryIn: delay
        });

        // 等待后重试
        await this.sleep(delay);
      }
    }

    // 所有尝试都失败了
    throw lastError;
  }

  /**
   * 执行带有性能监控的操作
   */
  async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let success = false;
    let error: Error | null = null;

    try {
      result = await operation();
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      success = false;
      throw error;
    } finally {
      // 记录性能指标
      this.recordPerformanceMetric({
        operation: operationName,
        duration: Date.now() - startTime,
        success,
        timestamp: new Date(),
        metadata: error ? { error: error.message } : undefined
      });
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Batch processing configuration updated', { config });
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(operationName?: string): PerformanceStats {
    let metrics = this.performanceMetrics;

    // 按操作名称过滤
    if (operationName) {
      metrics = metrics.filter(m => m.operation === operationName);
    }

    if (metrics.length === 0) {
      return {
        count: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const successCount = metrics.filter(m => m.success).length;

    return {
      count: metrics.length,
      successRate: successCount / metrics.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)]
    };
  }

  /**
   * 获取当前批大小
   */
  getCurrentBatchSize(context?: BatchContext): number {
    if (!context) {
      return this.config.defaultBatchSize;
    }

    const key = `${context.domain}:${context.subType || 'default'}`;
    return this.currentBatchSizes.get(key) || this.config.defaultBatchSize;
  }

  /**
   * 优化内存使用
   */
  optimizeMemory(): void {
    try {
      // 使用内存监控服务进行垃圾回收
      this.memoryMonitor.forceGarbageCollection();

      // 清理旧的性能指标
      if (this.performanceMetrics.length > 1000) { // 默认值
        this.performanceMetrics = this.performanceMetrics.slice(-1000);
        this.logger.debug('Cleared old performance metrics');
      }

      // 检查内存使用情况
      const memoryStats = this.memoryMonitor.getMemoryStats();
      if (memoryStats.current.heapUsedPercent > this.config.memoryThreshold) {
        // 减少所有批大小
        for (const [key, size] of this.currentBatchSizes.entries()) {
          const newSize = Math.max(
            1, // 默认最小批大小
            Math.floor(size * 0.8)
          );
          this.currentBatchSizes.set(key, newSize);
        }

        this.logger.info('Reduced batch sizes due to high memory usage', {
          memoryUsage: Math.round(memoryStats.current.heapUsedPercent * 100) / 10,
          threshold: this.config.memoryThreshold
        });
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to optimize memory: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'BatchProcessingService', operation: 'optimizeMemory' }
      );
    }
  }

  // 私有方法

  /**
   * 初始化配置
   */
  private initializeConfig(): BatchProcessingConfig {
    const batchConfig = this.configService.get('batchProcessing');
    
    return {
      enabled: batchConfig?.enabled ?? true,
      defaultBatchSize: batchConfig?.defaultBatchSize || 50,
      maxBatchSize: batchConfig?.maxBatchSize || 500,
      maxConcurrentOperations: batchConfig?.maxConcurrentOperations || 5,
      memoryThreshold: batchConfig?.memoryThreshold || 0.80,
      processingTimeout: batchConfig?.processingTimeout || 300000,
      retryAttempts: batchConfig?.retryAttempts || 3,
      retryDelay: batchConfig?.retryDelay || 1000,
      continueOnError: batchConfig?.continueOnError ?? true,
      monitoring: batchConfig?.monitoring
    };
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 计算重试延迟
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    let delay = options.baseDelay * Math.pow(options.backoffFactor || 2, attempt - 1);
    
    // 限制最大延迟
    delay = Math.min(delay, options.maxDelay || 30000);
    
    // 添加抖动
    if (options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    
    // 保持指标数量在限制内
    if (this.performanceMetrics.length > 1000) { // 默认值
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }
  }

  /**
   * 根据性能调整批大小
   */
  private adjustBatchSizeBasedOnPerformance(context: BatchContext, strategy: IBatchStrategy): void {
    const key = `${context.domain}:${context.subType || 'default'}`;
    const stats = this.getPerformanceStats(`batch-${key}`);
    
    if (stats.count === 0) return;
    
    const currentBatchSize = this.currentBatchSizes.get(key) || this.config.defaultBatchSize;
    const newBatchSize = strategy.adjustBatchSizeBasedOnPerformance(stats.averageDuration, currentBatchSize, context);
    
    if (newBatchSize !== currentBatchSize) {
      this.currentBatchSizes.set(key, newBatchSize);
      this.logger.debug('Adjusted batch size based on performance', {
        context: key,
        oldSize: currentBatchSize,
        newSize: newBatchSize,
        averageDuration: stats.averageDuration,
        successRate: stats.successRate
      });
    }
  }

  /**
   * 处理语义相似度批处理（特殊优化）
   */
  private async processSemanticSimilarityBatch(
    contents: string[],
    strategy: ISimilarityStrategy,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    const startTime = Date.now();
    
    try {
      // 使用语义批处理策略进行优化
      const { embeddings, cacheHits, apiCalls } = await this.semanticStrategy.batchGenerateEmbeddings(
        contents,
        strategy,
        options
      );

      // 本地计算相似度矩阵
      const { matrix, pairs } = this.semanticStrategy.calculateSimilarityMatrix(
        embeddings,
        contents,
        options
      );

      const executionTime = Date.now() - startTime;

      this.logger.info('Semantic similarity batch processing completed', {
        contentCount: contents.length,
        calculatedPairs: pairs.length,
        apiCalls,
        cacheHits,
        executionTime,
        efficiency: pairs.length > 0 ? apiCalls / pairs.length : 0
      });

      return {
        matrix,
        pairs,
        executionTime,
        cacheHits
      };
    } catch (error) {
      this.logger.error('Error in semantic similarity batch processing:', error);
      throw error;
    }
  }

  /**
   * 处理通用相似度批处理
   */
  private async processGenericSimilarityBatch(
    contents: string[],
    strategy: ISimilarityStrategy,
    context: BatchContext,
    options?: SimilarityOptions
  ): Promise<BatchSimilarityResult> {
    // 这里实现通用相似度批处理逻辑
    // 为了简化，我们返回一个模拟结果
    const startTime = Date.now();
    const n = contents.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const pairs: Array<{
      index1: number;
      index2: number;
      similarity: number;
      isSimilar: boolean;
    }> = [];

    const threshold = options?.threshold || 0.8;

    // 模拟相似度计算
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      
      for (let j = i + 1; j < n; j++) {
        const similarity = Math.random(); // 模拟相似度计算
        matrix[i][j] = similarity;
        matrix[j][i] = similarity;

        pairs.push({
          index1: i,
          index2: j,
          similarity,
          isSimilar: similarity >= threshold
        });
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      matrix,
      pairs,
      executionTime,
      cacheHits: 0
    };
  }

  /**
   * 执行数据库操作
   */
  private async executeDatabaseOperation<T>(
    operations: T[],
    databaseType: DatabaseType,
    options?: DatabaseBatchOptions
  ): Promise<any[]> {
    // 这里应该调用具体的数据库操作
    // 为了简化，我们返回一个模拟结果
    this.logger.debug('Executing database operation', {
      operationCount: operations.length,
      databaseType,
      operationType: options?.operationType
    });
    
    return operations.map((_, index) => ({
      success: true,
      index,
      result: `mock_result_${index}`
    }));
  }

  /**
   * 计算平均文本长度
   */
  private calculateAverageTextLength(inputs: EmbeddingInput[]): number {
    if (inputs.length === 0) return 0;
    
    const totalLength = inputs.reduce((sum, input) => sum + input.text.length, 0);
    return totalLength / inputs.length;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}