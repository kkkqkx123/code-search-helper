import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../../infrastructure/types';
import { IPerformanceMonitor, PerformanceMetrics, GraphDatabaseMetric, VectorOperationMetric, ParsingOperationMetric, NormalizationOperationMetric, ChunkingOperationMetric, OperationContext, OperationResult } from '../../infrastructure/monitoring/types';

@injectable()
export class DatabasePerformanceMonitor implements IPerformanceMonitor {
  private logger: LoggerService;
  private metrics: PerformanceMetrics;
 private monitoringInterval: NodeJS.Timeout | null = null;
  private queryExecutionTimes: number[] = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private batchSizes: number[] = [];
  private batchSuccesses: number = 0;
  private batchFailures: number = 0;
  // 数据库特定的指标
  private nebulaOperationMetrics: GraphDatabaseMetric[] = [];
  private vectorOperationMetrics: VectorOperationMetric[] = [];
  // 操作监控相关属性
  private operationContexts: Map<string, OperationContext> = new Map();

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
      this.logger.warn('Performance monitoring is already running');
      return;
    }

    this.logger.info('Starting periodic performance monitoring', { intervalMs });

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
      this.logger.info('Stopped periodic performance monitoring');
    } else {
      this.logger.warn('Performance monitoring is not running');
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
    this.logger.info('Resetting performance metrics');
    this.queryExecutionTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.batchSizes = [];
    this.batchSuccesses = 0;
    this.batchFailures = 0;
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

    this.logger.info('Performance metrics summary', {
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

  // 扩展方法：记录Nebula操作指标
  async recordNebulaOperation(
    operation: string,
    spaceName: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    const metric: GraphDatabaseMetric = {
      databaseType: DatabaseType.NEBULA,
      operation,
      spaceName,
      duration,
      success,
      timestamp: Date.now(),
      metadata: {
        vertexCount: 0, // 从操作结果中获取
        edgeCount: 0    // 从操作结果中获取
      }
    };

    // 保留最近的1000个指标
    if (this.nebulaOperationMetrics.length >= 1000) {
      this.nebulaOperationMetrics = this.nebulaOperationMetrics.slice(-500); // 保留一半
    }

    this.nebulaOperationMetrics.push(metric);

    this.logger.debug('Recorded Nebula operation metric', {
      operation,
      spaceName,
      duration,
      success
    });

    // 检查健康状态
    await this.checkNebulaHealth(spaceName, success, duration);
  }

  // 扩展方法：记录向量操作指标
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
      throughput: vectorCount / (duration / 1000) // 向量/秒
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

    // 检查性能阈值
    if (success && this.shouldAlertOnPerformance(operation, duration, vectorCount)) {
      await this.sendPerformanceAlert(operation, collectionName, duration, vectorCount);
    }
  }

  private async checkNebulaHealth(spaceName: string, success: boolean, duration: number): Promise<void> {
    const healthStatus = this.calculateHealthStatus(success, duration);

    if (healthStatus !== 'healthy') {
      this.logger.warn(`Nebula graph space ${spaceName} is ${healthStatus}`, {
        duration,
        success
      });
    }
  }

  private calculateHealthStatus(success: boolean, duration: number): 'healthy' | 'degraded' | 'critical' {
    if (!success) return 'critical';
    // 假设超过1秒的查询为降级状态
    if (duration > 1000) return 'degraded';
    return 'healthy';
  }

  private shouldAlertOnPerformance(
    operation: string,
    duration: number,
    vectorCount: number
  ): boolean {
    // 假设平均每个向量操作超过10ms需要警报
    const avgDurationPerVector = duration / vectorCount;
    return avgDurationPerVector > 100;
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
      vectorCount
    });
  }

  // 通用操作监控功能（用于数据库相关操作）
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

  // 解析操作监控（对于数据库查询解析等）
  async recordParsingOperation(metric: ParsingOperationMetric): Promise<void> {
    // 专门记录数据库相关的解析操作
    this.logger.debug('Recorded database parsing operation', {
      operation: metric.operation,
      language: metric.language,
      duration: metric.duration,
      success: metric.success
    });
  }

  // 标准化操作监控（对于数据库查询标准化等）
  async recordNormalizationOperation(metric: NormalizationOperationMetric): Promise<void> {
    // 专门记录数据库相关的标准化操作
    this.logger.debug('Recorded database normalization operation', {
      operation: metric.operation,
      language: metric.language,
      queryType: metric.queryType,
      duration: metric.duration,
      success: metric.success
    });
  }

  // 分段操作监控（对于数据库数据分段等）
  async recordChunkingOperation(metric: ChunkingOperationMetric): Promise<void> {
    // 专门记录数据库相关的分段操作
    this.logger.debug('Recorded database chunking operation', {
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
    // 返回空数组，因为DatabasePerformanceMonitor不存储这些详细指标
    // 如果需要存储，可以扩展类来存储这些指标
    return {
      parsing: [],
      normalization: [],
      chunking: []
    };
  }

  getOperationStats(): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    operationsByType: Record<string, number>;
    operationsByLanguage: Record<string, number>;
  } {
    // 返回基本统计信息
    return {
      totalOperations: 0,
      successRate: 0,
      averageDuration: 0,
      operationsByType: {},
      operationsByLanguage: {}
    };
  }
}