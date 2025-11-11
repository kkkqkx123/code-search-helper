import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { 
  IGraphIndexPerformanceMonitor, 
  GraphIndexMetric, 
  GraphIndexPerformanceStats,
  PerformanceWarning,
  PerformanceWarningType,
  DEFAULT_GRAPH_INDEX_THRESHOLDS,
  GraphIndexPerformanceThresholds
} from './GraphIndexMetrics';

/**
 * 图索引性能监控器实现
 */
@injectable()
export class GraphIndexPerformanceMonitor implements IGraphIndexPerformanceMonitor {
  private performanceStats: Map<string, GraphIndexPerformanceStats> = new Map();
  private metrics: GraphIndexMetric[] = [];
  private warnings: PerformanceWarning[] = [];
  private thresholds: GraphIndexPerformanceThresholds;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    this.thresholds = { ...DEFAULT_GRAPH_INDEX_THRESHOLDS };
    this.logger.info('GraphIndexPerformanceMonitor initialized');
  }

  /**
   * 记录图索引操作指标
   */
  recordMetric(metric: GraphIndexMetric): void {
    // 添加到指标列表
    this.metrics.push(metric);

    // 更新项目统计
    this.updateProjectStats(metric);

    // 检查性能警告
    this.checkPerformanceWarnings(metric);

    this.logger.debug('Recorded graph index metric', {
      operation: metric.operation,
      projectId: metric.projectId,
      duration: metric.duration,
      success: metric.success
    });
  }

  /**
   * 获取项目的性能统计
   */
  getPerformanceStats(projectId: string): GraphIndexPerformanceStats | null {
    return this.performanceStats.get(projectId) || null;
  }

  /**
   * 获取所有项目的性能统计
   */
  getAllPerformanceStats(): Map<string, GraphIndexPerformanceStats> {
    return new Map(this.performanceStats);
  }

  /**
   * 清理指定项目的性能数据
   */
  clearProjectStats(projectId: string): void {
    this.performanceStats.delete(projectId);
    this.metrics = this.metrics.filter(m => m.projectId !== projectId);
    this.warnings = this.warnings.filter(w => w.projectId !== projectId);
    
    this.logger.info(`Cleared performance stats for project: ${projectId}`);
  }

  /**
   * 清理所有性能数据
   */
  clearAllStats(): void {
    this.performanceStats.clear();
    this.metrics = [];
    this.warnings = [];
    
    this.logger.info('Cleared all performance stats');
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(projectId?: string): {
    summary: {
      totalProjects: number;
      totalOperations: number;
      overallSuccessRate: number;
      averageOperationTime: number;
    };
    projectStats?: Array<{
      projectId: string;
      stats: GraphIndexPerformanceStats;
    }>;
  } {
    const allStats = Array.from(this.performanceStats.values());
    
    if (projectId) {
      const projectStats = this.performanceStats.get(projectId);
      if (!projectStats) {
        return {
          summary: {
            totalProjects: 0,
            totalOperations: 0,
            overallSuccessRate: 0,
            averageOperationTime: 0
          }
        };
      }

      return {
        summary: {
          totalProjects: 1,
          totalOperations: projectStats.totalOperations,
          overallSuccessRate: projectStats.successRate,
          averageOperationTime: projectStats.averageOperationTime
        },
        projectStats: [{
          projectId,
          stats: projectStats
        }]
      };
    }

    // 计算总体统计
    const totalProjects = allStats.length;
    const totalOperations = allStats.reduce((sum, stats) => sum + stats.totalOperations, 0);
    const overallSuccessRate = totalOperations > 0 
      ? allStats.reduce((sum, stats) => sum + (stats.successRate * stats.totalOperations), 0) / totalOperations
      : 0;
    const averageOperationTime = totalOperations > 0
      ? allStats.reduce((sum, stats) => sum + (stats.averageOperationTime * stats.totalOperations), 0) / totalOperations
      : 0;

    return {
      summary: {
        totalProjects,
        totalOperations,
        overallSuccessRate,
        averageOperationTime
      },
      projectStats: allStats.map(stats => ({
        projectId: this.findProjectIdByStats(stats),
        stats
      }))
    };
  }

  /**
   * 获取性能警告
   */
  getWarnings(projectId?: string): PerformanceWarning[] {
    if (projectId) {
      return this.warnings.filter(w => w.projectId === projectId);
    }
    return [...this.warnings];
  }

  /**
   * 设置性能阈值
   */
  setThresholds(thresholds: Partial<GraphIndexPerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info('Updated performance thresholds', { thresholds: this.thresholds });
  }

  /**
   * 更新项目统计
   */
  private updateProjectStats(metric: GraphIndexMetric): void {
    const existingStats = this.performanceStats.get(metric.projectId);
    
    if (!existingStats) {
      // 创建新的统计记录
      this.performanceStats.set(metric.projectId, {
        projectId: metric.projectId,
        totalOperations: 1,
        successfulOperations: metric.success ? 1 : 0,
        failedOperations: metric.success ? 0 : 1,
        averageOperationTime: metric.duration,
        totalFilesProcessed: metric.metadata.fileCount || 0,
        totalNodesCreated: metric.metadata.nodesCreated || 0,
        totalRelationshipsCreated: metric.metadata.relationshipsCreated || 0,
        averageBatchSize: metric.metadata.batchSize || 0,
        successRate: metric.success ? 1 : 0,
        lastUpdated: metric.timestamp,
        operations: {
          startIndexing: metric.operation === 'startIndexing' ? 1 : 0,
          stopIndexing: metric.operation === 'stopIndexing' ? 1 : 0,
          processBatch: metric.operation === 'processBatch' ? 1 : 0,
          storeFiles: metric.operation === 'storeFiles' ? 1 : 0,
          createSpace: metric.operation === 'createSpace' ? 1 : 0
        }
      });
    } else {
      // 更新现有统计记录
      const totalOps = existingStats.totalOperations + 1;
      const successfulOps = existingStats.successfulOperations + (metric.success ? 1 : 0);
      
      this.performanceStats.set(metric.projectId, {
        ...existingStats,
        totalOperations: totalOps,
        successfulOperations: successfulOps,
        failedOperations: totalOps - successfulOps,
        averageOperationTime: (existingStats.averageOperationTime * existingStats.totalOperations + metric.duration) / totalOps,
        totalFilesProcessed: existingStats.totalFilesProcessed + (metric.metadata.fileCount || 0),
        totalNodesCreated: existingStats.totalNodesCreated + (metric.metadata.nodesCreated || 0),
        totalRelationshipsCreated: existingStats.totalRelationshipsCreated + (metric.metadata.relationshipsCreated || 0),
        averageBatchSize: existingStats.averageBatchSize > 0 
          ? (existingStats.averageBatchSize + (metric.metadata.batchSize || 0)) / 2 
          : (metric.metadata.batchSize || 0),
        successRate: successfulOps / totalOps,
        lastUpdated: metric.timestamp,
        operations: {
          ...existingStats.operations,
          [metric.operation]: existingStats.operations[metric.operation as keyof typeof existingStats.operations] + 1
        }
      });
    }
  }

  /**
   * 检查性能警告
   */
  private checkPerformanceWarnings(metric: GraphIndexMetric): void {
    const warnings: PerformanceWarning[] = [];

    // 检查操作时间
    if (metric.duration > this.thresholds.maxOperationTime) {
      warnings.push({
        type: PerformanceWarningType.SLOW_OPERATION,
        projectId: metric.projectId,
        operation: metric.operation,
        message: `Operation ${metric.operation} took ${metric.duration}ms, exceeding threshold of ${this.thresholds.maxOperationTime}ms`,
        severity: metric.duration > this.thresholds.maxOperationTime * 2 ? 'high' : 'medium',
        timestamp: metric.timestamp,
        metadata: {
          currentValue: metric.duration,
          threshold: this.thresholds.maxOperationTime,
          recommendation: 'Consider reducing batch size or optimizing the operation'
        }
      });
    }

    // 检查内存使用
    if (metric.metadata.memoryUsage && metric.metadata.memoryUsage.percentage > this.thresholds.maxMemoryUsage) {
      warnings.push({
        type: PerformanceWarningType.HIGH_MEMORY_USAGE,
        projectId: metric.projectId,
        operation: metric.operation,
        message: `Memory usage at ${(metric.metadata.memoryUsage.percentage * 100).toFixed(1)}%, exceeding threshold of ${(this.thresholds.maxMemoryUsage * 100).toFixed(1)}%`,
        severity: metric.metadata.memoryUsage.percentage > 0.95 ? 'critical' : 'high',
        timestamp: metric.timestamp,
        metadata: {
          currentValue: metric.metadata.memoryUsage.percentage,
          threshold: this.thresholds.maxMemoryUsage,
          recommendation: 'Consider reducing batch size or implementing memory cleanup'
        }
      });
    }

    // 检查批处理大小
    if (metric.metadata.batchSize && metric.metadata.batchSize > this.thresholds.maxBatchSize) {
      warnings.push({
        type: PerformanceWarningType.LARGE_BATCH_SIZE,
        projectId: metric.projectId,
        operation: metric.operation,
        message: `Batch size ${metric.metadata.batchSize} exceeds threshold of ${this.thresholds.maxBatchSize}`,
        severity: 'medium',
        timestamp: metric.timestamp,
        metadata: {
          currentValue: metric.metadata.batchSize,
          threshold: this.thresholds.maxBatchSize,
          recommendation: 'Consider reducing batch size for better performance'
        }
      });
    }

    // 添加警告到列表
    this.warnings.push(...warnings);

    // 记录警告
    if (warnings.length > 0) {
      this.logger.warn(`Performance warnings detected for project ${metric.projectId}`, {
        warnings: warnings.map(w => ({
          type: w.type,
          message: w.message,
          severity: w.severity
        }))
      });
    }
  }

  /**
   * 根据统计查找项目ID
   */
  private findProjectIdByStats(stats: GraphIndexPerformanceStats): string {
    return stats.projectId;
  }
}