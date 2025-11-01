import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { PerformanceMetrics, VectorOperationMetric, ParsingOperationMetric, NormalizationOperationMetric, ChunkingOperationMetric, OperationContext, OperationResult } from '../../infrastructure/monitoring/types';
import { IPerformanceMonitor } from '../../infrastructure/monitoring/types';

export interface VectorCollectionMetrics {
  totalVectors: number;
  averageDimension: number;
  storageSize: number;
  insertionRate: number;
  queryRate: number;
  averageQueryTime: number;
  timestamp: number;
}

@injectable()
export class VectorPerformanceMonitor implements IPerformanceMonitor {
  private logger: LoggerService;
  private metrics: PerformanceMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private queryExecutionTimes: number[] = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private batchSizes: number[] = [];
  private batchSuccesses: number = 0;
  private batchFailures: number = 0;
  // 特定于向量操作的指标
  private vectorOperationMetrics: VectorOperationMetric[] = [];
  private collectionMetrics: Map<string, VectorCollectionMetrics> = new Map();
  // 添加解析和标准化操作监控相关属性
  private operationContexts: Map<string, OperationContext> = new Map();
  private parsingOperationMetrics: ParsingOperationMetric[] = [];
  private normalizationOperationMetrics: NormalizationOperationMetric[] = [];
  private chunkingOperationMetrics: ChunkingOperationMetric[] = [];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
    this.metrics = this.initializeMetrics();
  }
  

  private initializeMetrics(): PerformanceMetrics {
    return {
      queryExecutionTimes: [],
      averageQueryTime: 0,
      cacheHitRate: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        percentage: 0,
      },
      systemHealthStatus: 'healthy',
      batchProcessingStats: {
        totalBatches: 0,
        averageBatchSize: 0,
        successRate: 0,
      },
      timestamp: Date.now(),
    };
  }

  startPeriodicMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.logger.warn('Vector performance monitoring is already running');
      return;
    }

    this.logger.info('Starting periodic vector performance monitoring', { intervalMs });

    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.logMetricsSummary();
    }, intervalMs);

    // Ensure interval doesn't prevent Node.js from exiting
    if (this.monitoringInterval.unref) {
      this.monitoringInterval.unref();
    }
  }

  stopPeriodicMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Stopped periodic vector performance monitoring');
    } else {
      this.logger.warn('Vector performance monitoring is not running');
    }
  }

  recordQueryExecution(executionTimeMs: number): void {
    this.queryExecutionTimes.push(executionTimeMs);

    // Keep only the last 1000 query execution times
    if (this.queryExecutionTimes.length > 1000) {
      this.queryExecutionTimes = this.queryExecutionTimes.slice(-1000);
    }

    this.updateAverageQueryTime();
    this.logger.debug('Recorded query execution time', { executionTimeMs });
  }

  updateCacheHitRate(isHit: boolean): void {
    if (isHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    this.logger.debug('Updated cache hit rate', {
      isHit,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.metrics.cacheHitRate,
    });
  }

  updateBatchSize(batchSize: number): void {
    this.batchSizes.push(batchSize);

    // Keep only the last 100 batch sizes
    if (this.batchSizes.length > 100) {
      this.batchSizes = this.batchSizes.slice(-100);
    }

    this.updateBatchProcessingStats();
    this.logger.debug('Updated batch size', { batchSize });
  }

  updateSystemHealthStatus(status: 'healthy' | 'degraded' | 'error'): void {
    this.metrics.systemHealthStatus = status;
    this.logger.debug('Updated system health status', { status });
  }

  getMetrics(): PerformanceMetrics {
    // Update timestamp to current time
    this.metrics.timestamp = Date.now();

    // Calculate current memory usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    };

    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.logger.info('Resetting vector performance metrics');
    this.queryExecutionTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.batchSizes = [];
    this.batchSuccesses = 0;
    this.batchFailures = 0;
    this.vectorOperationMetrics = [];
    this.collectionMetrics.clear();
    this.metrics = this.initializeMetrics();
  }

  private updateAverageQueryTime(): void {
    if (this.queryExecutionTimes.length > 0) {
      const sum = this.queryExecutionTimes.reduce((acc, time) => acc + time, 0);
      this.metrics.averageQueryTime = sum / this.queryExecutionTimes.length;
    } else {
      this.metrics.averageQueryTime = 0;
    }
  }

  private updateBatchProcessingStats(): void {
    const totalBatches = this.batchSuccesses + this.batchFailures;
    this.metrics.batchProcessingStats = {
      totalBatches,
      averageBatchSize: this.batchSizes.length > 0
        ? this.batchSizes.reduce((sum, size) => sum + size, 0) / this.batchSizes.length
        : 0,
      successRate: totalBatches > 0 ? this.batchSuccesses / totalBatches : 0,
    };
  }

  private collectSystemMetrics(): void {
    // Update memory usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    };

    // Update query execution times
    this.metrics.queryExecutionTimes = [...this.queryExecutionTimes];
    this.updateAverageQueryTime();

    // Update batch processing stats
    this.updateBatchProcessingStats();

    // Update timestamp
    this.metrics.timestamp = Date.now();
  }

  private logMetricsSummary(): void {
    const metrics = this.getMetrics();

    this.logger.info('Vector performance metrics summary', {
      averageQueryTime: `${metrics.averageQueryTime.toFixed(2)}ms`,
      cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(2)}%`,
      memoryUsage: `${metrics.memoryUsage.percentage.toFixed(2)}%`,
      systemHealthStatus: metrics.systemHealthStatus,
      batchProcessing: {
        totalBatches: metrics.batchProcessingStats.totalBatches,
        averageBatchSize: Math.round(metrics.batchProcessingStats.averageBatchSize),
        successRate: `${(metrics.batchProcessingStats.successRate * 100).toFixed(2)}%`,
      },
    });

    // Log warnings for potential issues
    if (metrics.memoryUsage.percentage > 80) {
      this.logger.warn('High memory usage detected', {
        percentage: metrics.memoryUsage.percentage,
      });
    }

    if (metrics.averageQueryTime > 1000) {
      this.logger.warn('High average query time detected', {
        averageQueryTime: metrics.averageQueryTime,
      });
    }

    if (metrics.systemHealthStatus === 'error') {
      this.logger.error('System health status is error');
    }
  }

  // Additional utility methods for batch processing
  recordBatchResult(success: boolean): void {
    if (success) {
      this.batchSuccesses++;
    } else {
      this.batchFailures++;
    }
    this.updateBatchProcessingStats();
  }

  getDetailedMetrics(): PerformanceMetrics & {
    queryExecutionTimes: number[];
    cacheHits: number;
    cacheMisses: number;
    batchSizes: number[];
    batchSuccesses: number;
    batchFailures: number;
  } {
    return {
      ...this.getMetrics(),
      queryExecutionTimes: [...this.queryExecutionTimes],
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      batchSizes: [...this.batchSizes],
      batchSuccesses: this.batchSuccesses,
      batchFailures: this.batchFailures,
    };
  }

  // 向量操作性能监控方法
  async recordVectorOperation(
    operation: 'insert' | 'search' | 'update' | 'delete',
    collectionName: string,
    vectorCount: number,
    dimension: number,
    duration: number,
    success: boolean
  ): Promise<void> {
    const metric: VectorOperationMetric = {
      operation,
      collectionName,
      vectorCount,
      dimension,
      duration,
      success,
      timestamp: Date.now(),
      throughput: vectorCount / (duration / 1000) // vectors per second
    };

    // 保留最近的1000个指标
    if (this.vectorOperationMetrics.length >= 1000) {
      this.vectorOperationMetrics = this.vectorOperationMetrics.slice(-500); // 保留一半
    }

    this.vectorOperationMetrics.push(metric);

    this.logger.debug('Recorded vector operation metric', {
      operation,
      collectionName,
      vectorCount,
      dimension,
      duration,
      success,
      throughput: metric.throughput
    });

    // 更新集合级别的指标
    await this.updateCollectionMetrics(collectionName, operation, vectorCount, duration, success);

    // 检查性能阈值
    if (success && this.shouldAlertOnPerformance(operation, duration, vectorCount)) {
      await this.sendPerformanceAlert(operation, collectionName, duration, vectorCount);
    }
  }

  private shouldAlertOnPerformance(
    operation: string,
    duration: number,
    vectorCount: number
  ): boolean {
    const thresholds: { [key: string]: number } = {
      'insert': 100, // 每个向量插入操作超过100ms需要警报
      'search': 200, // 每个向量搜索操作超过200ms需要警报
      'update': 150, // 每个向量更新操作超过150ms需要警报
      'delete': 100  // 每个向量删除操作超过100ms需要警报
    };

    const avgDurationPerVector = duration / vectorCount;
    const threshold = thresholds[operation as 'insert' | 'search' | 'update' | 'delete'] || 100;

    return avgDurationPerVector > threshold;
  }

  private async sendPerformanceAlert(
    operation: string,
    collectionName: string,
    duration: number,
    vectorCount: number
  ): Promise<void> {
    this.logger.warn('Vector operation performance alert', {
      operation,
      collectionName,
      duration,
      vectorCount,
      avgDurationPerVector: duration / vectorCount
    });
  }

  private async updateCollectionMetrics(
    collectionName: string,
    operation: string,
    vectorCount: number,
    duration: number,
    success: boolean
  ): Promise<void> {
    if (!this.collectionMetrics.has(collectionName)) {
      this.collectionMetrics.set(collectionName, {
        totalVectors: 0,
        averageDimension: 0,
        storageSize: 0,
        insertionRate: 0,
        queryRate: 0,
        averageQueryTime: 0,
        timestamp: Date.now()
      });
    }

    const metrics = this.collectionMetrics.get(collectionName)!;

    // 更新集合指标
    switch (operation) {
      case 'insert':
        metrics.totalVectors += vectorCount;
        metrics.averageDimension = (metrics.averageDimension + vectorCount) / 2; // 简单平均
        metrics.insertionRate = metrics.insertionRate || 0;
        metrics.insertionRate += vectorCount / (duration / 1000); // 向量/秒
        break;
      case 'search':
        metrics.queryRate = metrics.queryRate || 0;
        metrics.queryRate += 1 / (duration / 1000); // 查询/秒
        metrics.averageQueryTime = (metrics.averageQueryTime + duration) / 2; // 简单平均
        break;
    }

    metrics.timestamp = Date.now();
  }

  async getVectorCollectionMetrics(collectionName: string): Promise<VectorCollectionMetrics | null> {
    return this.collectionMetrics.get(collectionName) || null;
  }

  // 生成向量操作报告
  generateVectorOperationReport(): {
    totalOperations: number;
    operationBreakdown: { [key: string]: number };
    successRate: number;
    avgDuration: number;
    avgThroughput: number;
    byCollection: { [key: string]: number };
  } {
    if (this.vectorOperationMetrics.length === 0) {
      return {
        totalOperations: 0,
        operationBreakdown: {},
        successRate: 0,
        avgDuration: 0,
        avgThroughput: 0,
        byCollection: {}
      };
    }

    const totalOperations = this.vectorOperationMetrics.length;
    const successfulOperations = this.vectorOperationMetrics.filter(m => m.success).length;
    const successRate = successfulOperations / totalOperations;

    const totalDuration = this.vectorOperationMetrics.reduce((sum, m) => sum + m.duration, 0);
    const avgDuration = totalDuration / totalOperations;

    const totalThroughput = this.vectorOperationMetrics.reduce((sum, m) => sum + m.throughput, 0);
    const avgThroughput = totalThroughput / totalOperations;

    // 按操作类型统计
    const operationBreakdown: { [key: string]: number } = {};
    const byCollection: { [key: string]: number } = {};

    this.vectorOperationMetrics.forEach(metric => {
      operationBreakdown[metric.operation] = (operationBreakdown[metric.operation] || 0) + 1;
      byCollection[metric.collectionName] = (byCollection[metric.collectionName] || 0) + 1;
    });

    return {
      totalOperations,
      operationBreakdown,
      successRate,
      avgDuration,
      avgThroughput,
      byCollection
    };
  }

  startOperation(operationType: string, metadata?: Record<string, any>): string {
    const operationId = `${operationType}_${Date.now()}_${Math.random()}`;
    const context: OperationContext = {
      operationId,
      operationType,
      startTime: Date.now(),
      metadata
    };

    this.operationContexts.set(operationId, context);
    this.logger.debug('Started operation', { operationId, operationType, metadata });

    return operationId;
  }

  endOperation(operationId: string, result?: Partial<OperationResult>): void {
    const context = this.operationContexts.get(operationId);
    if (!context) {
      this.logger.warn('Attempted to end non-existent operation', { operationId });
      return;
    }

    const duration = Date.now() - context.startTime;
    const operationResult: OperationResult = {
      operationId,
      duration,
      success: result?.success ?? true,
      resultCount: result?.resultCount,
      error: result?.error,
      metadata: result?.metadata
    };

    this.operationContexts.delete(operationId);
    this.logger.debug('Ended operation', { ...operationResult, duration });

    // 可以根据需要记录到特定的指标数组
  }

  async recordParsingOperation(metric: ParsingOperationMetric): Promise<void> {
    // 保留最近的1000个指标
    if (this.parsingOperationMetrics.length >= 1000) {
      this.parsingOperationMetrics = this.parsingOperationMetrics.slice(-500); // 保留一半
    }

    this.parsingOperationMetrics.push(metric);
    this.logger.debug('Recorded parsing operation', {
      operation: metric.operation,
      language: metric.language,
      duration: metric.duration,
      success: metric.success
    });
  }

  async recordNormalizationOperation(metric: NormalizationOperationMetric): Promise<void> {
    // 保留最近的1000个指标
    if (this.normalizationOperationMetrics.length >= 1000) {
      this.normalizationOperationMetrics = this.normalizationOperationMetrics.slice(-500); // 保留一半
    }

    this.normalizationOperationMetrics.push(metric);
    this.logger.debug('Recorded normalization operation', {
      operation: metric.operation,
      language: metric.language,
      queryType: metric.queryType,
      duration: metric.duration,
      success: metric.success
    });
  }

  async recordChunkingOperation(metric: ChunkingOperationMetric): Promise<void> {
    // 保留最近的1000个指标
    if (this.chunkingOperationMetrics.length >= 1000) {
      this.chunkingOperationMetrics = this.chunkingOperationMetrics.slice(-500); // 保留一半
    }

    this.chunkingOperationMetrics.push(metric);
    this.logger.debug('Recorded chunking operation', {
      operation: metric.operation,
      language: metric.language,
      duration: metric.duration,
      success: metric.success
    });
  }

  getOperationMetrics(): {
    parsing: ParsingOperationMetric[];
    normalization: NormalizationOperationMetric[];
    chunking: ChunkingOperationMetric[];
  } {
    return {
      parsing: [...this.parsingOperationMetrics],
      normalization: [...this.normalizationOperationMetrics],
      chunking: [...this.chunkingOperationMetrics]
    };
  }

  getOperationStats(): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    operationsByType: Record<string, number>;
    operationsByLanguage: Record<string, number>;
  } {
    // 合并所有操作指标
    const allMetrics = [
      ...this.parsingOperationMetrics.map(m => ({ ...m, type: 'parsing' })),
      ...this.normalizationOperationMetrics.map(m => ({ ...m, type: 'normalization' })),
      ...this.chunkingOperationMetrics.map(m => ({ ...m, type: 'chunking' }))
    ];

    if (allMetrics.length === 0) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageDuration: 0,
        operationsByType: {},
        operationsByLanguage: {}
      };
    }

    // 计算总操作数
    const totalOperations = allMetrics.length;

    // 计算成功率
    const successfulOperations = allMetrics.filter(m => m.success).length;
    const successRate = totalOperations > 0 ? successfulOperations / totalOperations : 0;

    // 计算平均耗时
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalOperations > 0 ? totalDuration / totalOperations : 0;

    // 按类型统计
    const operationsByType: Record<string, number> = {};
    allMetrics.forEach(m => {
      operationsByType[m.type] = (operationsByType[m.type] || 0) + 1;
    });

    // 按语言统计
    const operationsByLanguage: Record<string, number> = {};
    allMetrics.forEach(m => {
      if (m.language) {
        operationsByLanguage[m.language] = (operationsByLanguage[m.language] || 0) + 1;
      }
    });

    return {
      totalOperations,
      successRate,
      averageDuration,
      operationsByType,
      operationsByLanguage
    };
  }

  async recordNebulaOperation(operation: string, spaceName: string, duration: number, success: boolean): Promise<void> {
    // 在VectorPerformanceMonitor中，我们记录一个虚拟的Nebula操作
    // 实际上VectorPerformanceMonitor应该主要关注向量操作，但为了实现接口，这里提供一个基本实现
    this.logger.debug('Recorded Nebula operation (in VectorPerformanceMonitor)', {
      operation,
      spaceName,
      duration,
      success
    });
  }
}