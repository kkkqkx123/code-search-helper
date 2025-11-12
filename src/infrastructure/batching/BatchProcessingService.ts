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
    private config: BatchProcessingConfig | null = null;
    private currentBatchSizes: Map<string, number> = new Map();
    private batchSize: number = 50;

    constructor(
        @inject(TYPES.LoggerService) private logger: LoggerService,
        @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
        @inject(TYPES.ConfigService) private configService: ConfigService,
        @inject(TYPES.MemoryMonitorService) private memoryMonitor: IMemoryMonitorService,
        @inject(BatchStrategyFactory) private strategyFactory: BatchStrategyFactory,
        @inject(SemanticBatchStrategy) private semanticStrategy: SemanticBatchStrategy
    ) {
        // 不在构造函数中初始化配置，而是延迟到需要时再初始化
        this.logger.info('BatchProcessingService created (config will be initialized on first use)');
    }

    /**
     * 确保配置已初始化
     */
    private ensureConfigInitialized(): BatchProcessingConfig {
        if (!this.config) {
            this.config = this.initializeConfig();
            this.logger.info('BatchProcessingService config initialized', {
                config: this.config
            });
        }
        return this.config;
    }

    /**
     * 通用批处理方法
     */
    async processBatches<T, R>(
        items: T[],
        processor: (batch: T[]) => Promise<R[]>,
        options?: BatchProcessingOptions
    ): Promise<R[]> {
        const config = this.ensureConfigInitialized();
        const context = options?.context || { domain: 'database' };
        const strategy = this.strategyFactory.getStrategy(context);
        const batchSize = options?.batchSize || strategy.calculateOptimalBatchSize(items.length, context);
        const maxConcurrency = options?.maxConcurrency || config.maxConcurrentOperations;

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
                            maxAttempts: options?.maxRetries || config.retryAttempts,
                            baseDelay: options?.retryDelay || config.retryDelay
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

        this.logger.debug('Batch processing completed', {
            totalItems: items.length,
            totalResults: results.length,
            batchesProcessed: batches.length
        });

        return results;
    }

    /**
     * 数据库批处理
     */
    async processDatabaseBatches<T, R>(
        items: T[],
        processor: (batch: T[]) => Promise<R[]>,
        options?: DatabaseBatchOptions
    ): Promise<R[]> {
        const config = this.ensureConfigInitialized();
        return this.processBatches(items, processor, {
            ...options,
            context: { domain: 'database', subType: options?.databaseType || DatabaseType.QDRANT }
        });
    }

    /**
      * 嵌入器批处理
      */
    async processEmbeddingBatches(
        inputs: EmbeddingInput[],
        embedder: Embedder,
        options?: EmbeddingOptions
    ): Promise<EmbeddingResult[]> {
        const config = this.ensureConfigInitialized();
        return this.processBatches(inputs, async (batch) => {
            const result = await embedder.embed(batch);
            return Array.isArray(result) ? result : [result];
        }, {
            ...options,
            context: { domain: 'embedding' }
        });
    }

    /**
      * 相似度计算批处理
      */
    async processSimilarityBatches(
        items: any[],
        strategy: ISimilarityStrategy,
        options?: SimilarityOptions
    ): Promise<BatchSimilarityResult> {
        const config = this.ensureConfigInitialized();
        const defaultBatchSize = config.defaultBatchSize;

        this.logger.debug('Starting similarity batch processing', {
            itemCount: items.length,
            batchSize: defaultBatchSize
        });

        const startTime = Date.now();
        const matrix: number[][] = [];
        const pairs: Array<{
            index1: number;
            index2: number;
            similarity: number;
            isSimilar: boolean;
        }> = [];

        // Process similarity calculation for all pairs
        for (let i = 0; i < items.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < items.length; j++) {
                if (i === j) {
                    matrix[i][j] = 1.0;
                } else {
                    const similarity = await strategy.calculate(items[i], items[j], options);
                    matrix[i][j] = similarity;
                    if (i < j) {
                        pairs.push({
                            index1: i,
                            index2: j,
                            similarity,
                            isSimilar: similarity >= (options?.threshold || 0.5)
                        });
                    }
                }
            }
        }

        return {
            matrix,
            pairs,
            executionTime: Date.now() - startTime,
            cacheHits: 0
        };
    }

    /**
      * 添加缺失的接口方法：processSimilarityBatch
      */
    async processSimilarityBatch(
        contents: string[],
        strategy: ISimilarityStrategy,
        options?: SimilarityOptions
    ): Promise<BatchSimilarityResult> {
        return this.processSimilarityBatches(contents, strategy, options);
    }

    /**
      * 添加缺失的接口方法：processEmbeddingBatch
      */
    async processEmbeddingBatch(
        inputs: EmbeddingInput[],
        embedder: Embedder,
        options?: EmbeddingOptions
    ): Promise<EmbeddingResult[]> {
        return this.processEmbeddingBatches(inputs, embedder, options);
    }

    /**
      * 添加缺失的接口方法：processDatabaseBatch
      */
    async processDatabaseBatch<T>(
        operations: T[],
        databaseType: DatabaseType,
        options?: DatabaseBatchOptions
    ): Promise<BatchResult> {
        const result = await this.processDatabaseBatches(operations, async (batch) => batch, {
            ...options,
            databaseType
        });
        return {
            totalOperations: operations.length,
            successfulOperations: result.length,
            failedOperations: operations.length - result.length,
            totalDuration: 0,
            results: result
        };
    }

    /**
      * 添加缺失的接口方法：updateConfig
      */
    updateConfig(config: Partial<BatchProcessingConfig>): void {
        if (this.config) {
            this.config = { ...this.config, ...config };
            this.logger.info('BatchProcessingService config updated', { config: this.config });
        } else {
            const currentConfig = this.ensureConfigInitialized();
            this.config = { ...currentConfig, ...config };
        }
    }

    /**
      * 添加缺失的接口方法：getCurrentBatchSize
      */
    getCurrentBatchSize(context?: BatchContext): number {
        if (!context) {
            return this.batchSize;
        }
        const key = JSON.stringify(context);
        return this.currentBatchSizes.get(key) || this.batchSize;
    }



    /**
      * 获取性能统计
      */
    getPerformanceStats(operationName?: string): PerformanceStats {
        const config = this.ensureConfigInitialized();
        const metrics = operationName
            ? this.performanceMetrics.filter(m => m.operation === operationName)
            : this.performanceMetrics;

        const count = metrics.length;
        const successfulOperations = metrics.filter(m => m.success).length;
        const averageDuration = count > 0
            ? metrics.reduce((sum, m) => sum + m.duration, 0) / count
            : 0;

        const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
        const minDuration = durations.length > 0 ? durations[0] : 0;
        const maxDuration = durations.length > 0 ? durations[durations.length - 1] : 0;
        const p95Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
        const p99Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;

        return {
            count,
            successRate: count > 0 ? successfulOperations / count : 0,
            averageDuration,
            minDuration,
            maxDuration,
            p95Duration,
            p99Duration
        };
    }

    /**
     * 重置性能统计
     */
    resetPerformanceStats(): void {
        this.performanceMetrics = [];
        this.currentBatchSizes.clear();
        this.logger.info('Performance stats reset');
    }

    /**
     * 优化批处理大小
     */
    async optimizeBatchSize(context: BatchContext): Promise<number> {
        const config = this.ensureConfigInitialized();
        const strategy = this.strategyFactory.getStrategy(context);

        // 基于内存使用情况调整批处理大小
        const memoryCheck = this.memoryMonitor.checkMemoryUsage();
        let optimizedSize = strategy.calculateOptimalBatchSize(100, context); // 基础大小

        if (memoryCheck.usagePercent > config.memoryThreshold) {
            optimizedSize = Math.max(10, Math.floor(optimizedSize * 0.5)); // 减少批处理大小
            this.logger.warn('Reducing batch size due to high memory usage', {
                usagePercent: memoryCheck.usagePercent,
                optimizedSize
            });
        }

        this.currentBatchSizes.set(JSON.stringify(context), optimizedSize);
        return optimizedSize;
    }

    /**
      * 内存优化
      */
    async optimizeMemory(): Promise<void> {
        const config = this.ensureConfigInitialized();
        try {
            const memoryCheck = this.memoryMonitor.checkMemoryUsage();

            if (memoryCheck.usagePercent > config.memoryThreshold) {
                this.logger.warn('High memory usage detected, triggering optimization', {
                    usagePercent: memoryCheck.usagePercent,
                    threshold: config.memoryThreshold
                });

                // 清理性能指标
                if (this.performanceMetrics.length > 1000) {
                    this.performanceMetrics = this.performanceMetrics.slice(-500);
                }

                // 触发垃圾回收（如果可用）
                if (global.gc) {
                    global.gc();
                }
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
        try {
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
        } catch (error) {
            this.logger.warn('Failed to load batch processing configuration from ConfigService, using defaults', { error });
            // 返回默认配置
            return {
                enabled: true,
                defaultBatchSize: 50,
                maxBatchSize: 500,
                maxConcurrentOperations: 5,
                memoryThreshold: 0.80,
                processingTimeout: 300000,
                retryAttempts: 3,
                retryDelay: 1000,
                continueOnError: true,
                monitoring: undefined
            };
        }
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
      * 执行带监控的操作
      */
    async executeWithMonitoring<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        const startTime = Date.now();
        let success = false;
        let error: Error | undefined;

        try {
            const result = await operation();
            success = true;
            return result;
        } catch (err) {
            error = err instanceof Error ? err : new Error(String(err));
            throw error;
        } finally {
            const processingTime = Date.now() - startTime;

            this.performanceMetrics.push({
                operation: operationName,
                duration: processingTime,
                success,
                timestamp: new Date(),
                metadata: {
                    error: error?.message
                }
            });

            // 限制性能指标数量
            if (this.performanceMetrics.length > 10000) {
                this.performanceMetrics = this.performanceMetrics.slice(-5000);
            }
        }
    }

    /**
      * 执行带重试的操作
      */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string,
        retryOptions: RetryOptions
    ): Promise<T> {
        const { maxAttempts, baseDelay } = retryOptions;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.executeWithMonitoring(operation, `${operationName}-attempt-${attempt}`);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt === maxAttempts) {
                    this.logger.error(`Operation failed after ${maxAttempts} attempts`, {
                        operationName,
                        error: lastError.message
                    });
                    throw lastError;
                }

                const delay = baseDelay * Math.pow(2, attempt - 1); // 指数退避
                this.logger.warn(`Operation failed, retrying in ${delay}ms`, {
                    operationName,
                    attempt,
                    error: lastError.message
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }
}