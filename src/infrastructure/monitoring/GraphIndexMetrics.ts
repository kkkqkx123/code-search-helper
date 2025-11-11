/**
 * 图索引操作指标
 */
export interface GraphIndexMetric {
  operation: 'startIndexing' | 'stopIndexing' | 'processBatch' | 'storeFiles' | 'createSpace';
  projectId: string;
  duration: number;
  success: boolean;
  timestamp: number;
  metadata: {
    fileCount?: number;
    batchSize?: number;
    nodesCreated?: number;
    relationshipsCreated?: number;
    errorType?: string;
    errorMessage?: string;
    memoryUsage?: {
      heapUsed: number;
      heapTotal: number;
      percentage: number;
    };
  };
}

/**
 * 图索引性能统计
 */
export interface GraphIndexPerformanceStats {
  projectId: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  totalFilesProcessed: number;
  totalNodesCreated: number;
  totalRelationshipsCreated: number;
  averageBatchSize: number;
  successRate: number;
  lastUpdated: number;
  operations: {
    startIndexing: number;
    stopIndexing: number;
    processBatch: number;
    storeFiles: number;
    createSpace: number;
  };
}

/**
 * 图索引性能监控器接口
 */
export interface IGraphIndexPerformanceMonitor {
  /**
   * 记录图索引操作指标
   */
  recordMetric(metric: GraphIndexMetric): void;

  /**
   * 获取项目的性能统计
   */
  getPerformanceStats(projectId: string): GraphIndexPerformanceStats | null;

  /**
   * 获取所有项目的性能统计
   */
  getAllPerformanceStats(): Map<string, GraphIndexPerformanceStats>;

  /**
   * 清理指定项目的性能数据
   */
  clearProjectStats(projectId: string): void;

  /**
   * 清理所有性能数据
   */
  clearAllStats(): void;

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
  };
}

/**
 * 图索引性能阈值配置
 */
export interface GraphIndexPerformanceThresholds {
  maxOperationTime: number; // 最大操作时间（毫秒）
  minSuccessRate: number; // 最小成功率（0-1）
  maxMemoryUsage: number; // 最大内存使用率（0-1）
  maxBatchSize: number; // 最大批处理大小
  minThroughput: number; // 最小吞吐量（文件/秒）
}

/**
 * 默认性能阈值
 */
export const DEFAULT_GRAPH_INDEX_THRESHOLDS: GraphIndexPerformanceThresholds = {
  maxOperationTime: 30000, // 30秒
  minSuccessRate: 0.95, // 95%
  maxMemoryUsage: 0.85, // 85%
  maxBatchSize: 20,
  minThroughput: 1 // 至少1文件/秒
};

/**
 * 性能警告类型
 */
export enum PerformanceWarningType {
  SLOW_OPERATION = 'SLOW_OPERATION',
  LOW_SUCCESS_RATE = 'LOW_SUCCESS_RATE',
  HIGH_MEMORY_USAGE = 'HIGH_MEMORY_USAGE',
  LARGE_BATCH_SIZE = 'LARGE_BATCH_SIZE',
  LOW_THROUGHPUT = 'LOW_THROUGHPUT'
}

/**
 * 性能警告
 */
export interface PerformanceWarning {
  type: PerformanceWarningType;
  projectId: string;
  operation: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  metadata: {
    currentValue: number;
    threshold: number;
    recommendation?: string;
  };
}