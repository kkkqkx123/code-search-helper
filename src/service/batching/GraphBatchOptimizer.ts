import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphNode, GraphRelationship } from '../mapping/IGraphDataMappingService';

export interface BatchOperation<T> {
  items: T[];
  operation: (batch: T[]) => Promise<any>;
  options?: {
    batchSize?: number;
    concurrency?: number;
    timeout?: number;
  };
}

export interface BatchResult<T> {
  success: boolean;
  results: any[];
  failedItems: T[];
  successfulItems: T[];
  processingTime: number;
  batchSize: number;
}

export interface BatchOptimizerConfig {
  defaultBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  maxConcurrentBatches: number;
  timeout: number;
  performanceThreshold: number; // 毫秒
  adjustmentFactor: number; // 批大小调整因子
}

@injectable()
export class GraphBatchOptimizer {
  private logger: LoggerService;
  private config: BatchOptimizerConfig;
  private performanceHistory: {
    batchSize: number;
    processingTime: number;
    itemsProcessed: number;
    timestamp: number;
  }[] = [];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    config?: Partial<BatchOptimizerConfig>
  ) {
    this.logger = logger;
    this.config = {
      defaultBatchSize: 50,
      maxBatchSize: 500,
      minBatchSize: 10,
      maxConcurrentBatches: 5,
      timeout: 30000,
      performanceThreshold: 1000,
      adjustmentFactor: 0.1,
      ...config
    };
    
    this.logger.info('GraphBatchOptimizer initialized', { config: this.config });
  }

  /**
   * 执行图节点批处理操作
   */
  async executeNodeBatch(
    nodes: GraphNode[],
    operation: (batch: GraphNode[]) => Promise<any>,
    options?: {
      batchSize?: number;
      concurrency?: number;
      timeout?: number;
    }
  ): Promise<BatchResult<GraphNode>> {
    return this.executeBatch(nodes, operation, options);
  }

  /**
   * 执行图关系批处理操作
   */
  async executeRelationshipBatch(
    relationships: GraphRelationship[],
    operation: (batch: GraphRelationship[]) => Promise<any>,
    options?: {
      batchSize?: number;
      concurrency?: number;
      timeout?: number;
    }
  ): Promise<BatchResult<GraphRelationship>> {
    return this.executeBatch(relationships, operation, options);
  }

  /**
   * 执行通用批处理操作
   */
  async executeBatch<T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>,
    options?: {
      batchSize?: number;
      concurrency?: number;
      timeout?: number;
    }
  ): Promise<BatchResult<T>> {
    const startTime = Date.now();
    const batchSize = options?.batchSize || this.config.defaultBatchSize;
    const concurrency = options?.concurrency || this.config.maxConcurrentBatches;
    const timeout = options?.timeout || this.config.timeout;

    this.logger.debug('Starting batch operation', {
      itemCount: items.length,
      batchSize,
      concurrency
    });

    // 分批处理
    const batches: T[][] = this.createBatches(items, batchSize);
    const results: any[] = [];
    const failedItems: T[] = [];
    const successfulItems: T[] = [];

    // 并发处理批次
    const batchPromises: Promise<any>[] = [];
    
    for (let i = 0; i < batches.length; i += concurrency) {
      const concurrentBatches = batches.slice(i, i + concurrency);
      
      const concurrentPromises = concurrentBatches.map(async (batch, batchIndex) => {
        try {
          // 使用超时包装操作
          const result = await this.executeWithTimeout(
            operation(batch),
            timeout,
            `Batch operation timeout after ${timeout}ms`
          );
          
          results.push(result);
          successfulItems.push(...batch);
          
          // 记录性能数据
          this.recordPerformance(batchSize, Date.now() - startTime, batch.length);
          
          this.logger.debug('Batch completed successfully', {
            batchIndex: i + batchIndex,
            batchSize: batch.length
          });
        } catch (error) {
          this.logger.error('Batch operation failed', {
            batchIndex: i + batchIndex,
            batchSize: batch.length,
            error: (error as Error).message
          });
          
          failedItems.push(...batch);
        }
      });

      batchPromises.push(...concurrentPromises);
      await Promise.all(concurrentPromises); // 等待当前并发批次完成
    }

    await Promise.all(batchPromises);

    const processingTime = Date.now() - startTime;
    const success = failedItems.length === 0;

    this.logger.info('Batch operation completed', {
      success,
      totalItems: items.length,
      successfulItems: successfulItems.length,
      failedItems: failedItems.length,
      processingTime
    });

    return {
      success,
      results,
      failedItems,
      successfulItems,
      processingTime,
      batchSize
    };
  }

  /**
   * 智能批处理优化 - 根据性能历史自动调整批大小
   */
  async executeWithOptimalBatching<T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>
  ): Promise<BatchResult<T>> {
    // 根据性能历史确定最佳批大小
    const optimalBatchSize = this.calculateOptimalBatchSize();
    
    this.logger.debug('Executing with optimal batching', {
      itemCount: items.length,
      optimalBatchSize
    });

    return this.executeBatch(items, operation, { batchSize: optimalBatchSize });
  }

  /**
   * 执行图数据混合批处理（节点和关系一起处理）
   */
 async executeGraphMixedBatch(
    nodes: GraphNode[],
    relationships: GraphRelationship[],
    nodeOperation: (batch: GraphNode[]) => Promise<any>,
    relationshipOperation: (batch: GraphRelationship[]) => Promise<any>,
    options?: {
      batchSize?: number;
      concurrency?: number;
      timeout?: number;
    }
  ): Promise<{
    nodeResult: BatchResult<GraphNode>;
    relationshipResult: BatchResult<GraphRelationship>;
  }> {
    const nodePromise = this.executeBatch(nodes, nodeOperation, options);
    const relationshipPromise = this.executeBatch(relationships, relationshipOperation, options);

    const [nodeResult, relationshipResult] = await Promise.all([
      nodePromise,
      relationshipPromise
    ]);

    return { nodeResult, relationshipResult };
  }

  /**
   * 动态调整批大小
   */
  private calculateOptimalBatchSize(): number {
    if (this.performanceHistory.length === 0) {
      return this.config.defaultBatchSize;
    }

    // 计算平均处理时间
    const recentHistory = this.performanceHistory.slice(-10); // 取最近10次记录
    if (recentHistory.length === 0) {
      return this.config.defaultBatchSize;
    }

    const avgProcessingTime = recentHistory.reduce((sum, record) => sum + record.processingTime, 0) / recentHistory.length;
    const avgItemsPerMs = recentHistory.reduce((sum, record) => 
      sum + (record.itemsProcessed / Math.max(record.processingTime, 1)), 0) / recentHistory.length;

    // 根据性能阈值调整批大小
    if (avgProcessingTime > this.config.performanceThreshold) {
      // 处理时间过长，减小批大小
      const newBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(this.config.defaultBatchSize * (this.config.performanceThreshold / avgProcessingTime))
      );
      return Math.min(newBatchSize, this.config.maxBatchSize);
    } else {
      // 处理时间较短，可以增加批大小
      const newBatchSize = Math.min(
        this.config.maxBatchSize,
        Math.floor(this.config.defaultBatchSize * 1.1) // 增加10%
      );
      return Math.max(newBatchSize, this.config.defaultBatchSize);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      )
    ]);
  }

  private recordPerformance(batchSize: number, processingTime: number, itemsProcessed: number): void {
    this.performanceHistory.push({
      batchSize,
      processingTime,
      itemsProcessed,
      timestamp: Date.now()
    });

    // 保持性能历史记录在合理大小
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-50); // 保留最近50条记录
    }
  }

  /**
   * 获取批处理性能统计
   */
  getPerformanceStats(): {
    avgProcessingTime: number;
    avgItemsPerMs: number;
    optimalBatchSize: number;
    historyLength: number;
  } {
    if (this.performanceHistory.length === 0) {
      return {
        avgProcessingTime: 0,
        avgItemsPerMs: 0,
        optimalBatchSize: this.config.defaultBatchSize,
        historyLength: 0
      };
    }

    const totalProcessingTime = this.performanceHistory.reduce((sum, record) => sum + record.processingTime, 0);
    const avgProcessingTime = totalProcessingTime / this.performanceHistory.length;

    const totalItems = this.performanceHistory.reduce((sum, record) => sum + record.itemsProcessed, 0);
    const totalTime = this.performanceHistory.reduce((sum, record) => sum + record.processingTime, 0);
    const avgItemsPerMs = totalTime > 0 ? totalItems / totalTime : 0;

    return {
      avgProcessingTime,
      avgItemsPerMs,
      optimalBatchSize: this.calculateOptimalBatchSize(),
      historyLength: this.performanceHistory.length
    };
  }
}