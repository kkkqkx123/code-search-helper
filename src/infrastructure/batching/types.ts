import { DatabaseType } from '../../infrastructure/types';
import { ISimilarityStrategy, SimilarityOptions, BatchSimilarityResult } from '../../service/similarity/types/SimilarityTypes';
import { EmbeddingInput, EmbeddingResult, Embedder } from '../../embedders/BaseEmbedder';

// 批处理上下文
export interface BatchContext {
  domain: 'database' | 'similarity' | 'embedding';
  subType?: string; // 'qdrant', 'nebula', 'semantic', 'api', etc.
  metadata?: Record<string, any>;
}

// 批处理策略接口
export interface IBatchStrategy {
  calculateOptimalBatchSize(itemsCount: number, context?: BatchContext): number;
  shouldRetry(error: Error, attempt: number, context?: BatchContext): boolean;
  getRetryDelay(attempt: number, context?: BatchContext): number;
  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number, context?: BatchContext): number;
}

// 批处理选项
export interface BatchProcessingOptions {
  batchSize?: number;
  maxConcurrency?: number;
  timeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableMonitoring?: boolean;
  context?: BatchContext;
}

// 重试选项
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

// 性能指标
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// 性能统计
export interface PerformanceStats {
  count: number;
  successRate: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
}

// 批处理配置
export interface BatchProcessingConfig {
  // 通用配置
  defaultBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  maxConcurrentOperations: number;

  // 重试配置
  retryAttempts: number;
  retryDelay: number;
  maxRetryDelay: number;
  backoffFactor: number;
  enableJitter: boolean;

  // 性能配置
  performanceThreshold: number;
  adjustmentFactor: number;
  memoryThreshold: number;

  // 数据库特定配置
  databaseSpecific: {
    [key in DatabaseType]?: {
      defaultBatchSize: number;
      maxBatchSize: number;
      minBatchSize: number;
      performanceThreshold: number;
    };
  };

  // 相似度计算特定配置
  similaritySpecific: {
    semanticOptimization: boolean;
    maxApiBatchSize: number;
    cacheEnabled: boolean;
  };

  // 嵌入器特定配置
  embeddingSpecific: {
    maxConcurrent: number;
    timeout: number;
    cacheEnabled: boolean;
  };

  // 监控配置
  enableMonitoring: boolean;
  metricsRetentionCount: number;
}

// 数据库批处理选项
export interface DatabaseBatchOptions extends BatchProcessingOptions {
  databaseType: DatabaseType;
  operationType?: 'read' | 'write' | 'mixed';
}

// 嵌入器批处理选项
export interface EmbeddingOptions extends BatchProcessingOptions {
  embedderModel?: string;
  useCache?: boolean;
}

// 批处理结果
export interface BatchResult {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalDuration: number;
  results: any[];
}

// 图操作接口
export interface GraphOperation {
  type: string;
  query: string;
  parameters: any;
}

// 批处理操作结果
export interface BatchOperationResult {
  batchId: string;
  success: boolean;
  duration: number;
  processedCount: number;
  result?: any;
  error?: Error;
}

// 统一批处理服务接口
export interface IBatchProcessingService {
  // 核心批处理方法
  executeBatch<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, options?: BatchProcessingOptions): Promise<R[]>;

  // 便捷方法
  executeDatabaseBatch<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, options?: DatabaseBatchOptions): Promise<R[]>;
  executeEmbeddingBatch(inputs: EmbeddingInput[], embedder: Embedder, options?: EmbeddingOptions): Promise<EmbeddingResult[]>;
  executeSimilarityBatch(items: any[], strategy: ISimilarityStrategy, options?: SimilarityOptions): Promise<BatchSimilarityResult>;
  executeHotReloadBatch(projectId: string, changes: any[], options?: any): Promise<any>;
  executeBatchWithRetry<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, options?: BatchProcessingOptions): Promise<R[]>;
  executeBatchWithMonitoring<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, operationName: string, options?: BatchProcessingOptions): Promise<R[]>;

  // 重试和监控
  executeWithRetry<T>(operation: () => Promise<T>, operationName: string, options?: Partial<RetryOptions>): Promise<T>;
  executeWithMonitoring<T>(operation: () => Promise<T>, operationName: string): Promise<T>;

  // 配置和统计
  updateConfig(config: Partial<BatchProcessingConfig>): void;
  getPerformanceStats(operationName?: string): PerformanceStats;
  getCurrentBatchSize(context?: BatchContext): number;
  optimizeMemory(): Promise<void>;
  optimizeBatchSize(context: BatchContext): Promise<number>;
  resetPerformanceStats(): void;
}

// 批处理策略工厂接口
export interface IBatchStrategyFactory {
  getStrategy(context: BatchContext): IBatchStrategy;
  registerStrategy(domain: string, subType: string, strategy: IBatchStrategy): void;
  getAvailableStrategies(): Array<{ domain: string; subType: string; strategy: IBatchStrategy }>;
}

// 内存使用情况
export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: Date;
}

// 批处理选项（扩展）
export interface ExtendedBatchProcessingOptions extends BatchProcessingOptions {
  strategy?: IBatchStrategy;
  onProgress?: (progress: number, current: number, total: number) => void;
  onBatchComplete?: (batchIndex: number, batchSize: number, duration: number) => void;
  onError?: (error: Error, batchIndex: number) => void;
}

// 批处理统计信息
export interface BatchProcessingStats {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalItems: number;
  processedItems: number;
  totalDuration: number;
  averageBatchDuration: number;
  throughput: number; // items per second
  strategy: string;
  context: BatchContext;
}

// 批处理优化器配置
export interface BatchOptimizerConfig {
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  adaptiveBatchingEnabled: boolean;
  performanceThreshold: number;
  adjustmentFactor: number;
  databaseSpecific: {
    [key in DatabaseType]?: {
      defaultBatchSize: number;
      maxBatchSize: number;
      minBatchSize: number;
    };
  };
}

// 批处理优化器接口
export interface IBatchOptimizer {
  getConfig(): BatchOptimizerConfig;
  updateConfig(config: Partial<BatchOptimizerConfig>): void;
  calculateOptimalBatchSize(itemsCount: number): number;
  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number): number;
  calculateOptimalGraphBatchSize(operationCount: number, databaseType: DatabaseType): number;
  executeWithOptimalBatching<T>(items: T[], operation: (batch: T[]) => Promise<any>, options?: { batchSize?: number; concurrency?: number }): Promise<any[]>;
  shouldRetry<T>(operation: () => Promise<T>, maxRetries?: number): Promise<T>;
}

