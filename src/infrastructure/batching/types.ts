import { DatabaseType } from '../types';

export interface BatchOptimizerConfig {
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  adaptiveBatchingEnabled: boolean;
  minBatchSize: number;
  performanceThreshold: number;
  adjustmentFactor: number;
  // 添加数据库特定配置
  databaseSpecific: {
    [key in DatabaseType]?: {
      defaultBatchSize: number;
      maxBatchSize: number;
      minBatchSize: number;
    };
  };
}

export interface IBatchOptimizer {
  getConfig(): BatchOptimizerConfig;
  updateConfig(config: Partial<BatchOptimizerConfig>): void;
  calculateOptimalBatchSize(itemsCount: number): number;
  adjustBatchSizeBasedOnPerformance(executionTime: number, batchSize: number): number;
  shouldRetry<T>(operation: () => Promise<T>, maxRetries?: number): Promise<T>;
  executeWithOptimalBatching<T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<any[]>;
  hasSufficientResources(): boolean;
  waitForResources(): Promise<void>;
  estimateProcessingTime(itemCount: number, avgTimePerItem: number): number;
  isBatchSizeAppropriate(batchSize: number): boolean;

  // 扩展接口以支持多数据库类型
  calculateOptimalGraphBatchSize(
    operationCount: number,
    databaseType: DatabaseType
  ): number;
}

export interface BatchProcessingOptions {
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  concurrency?: number;
}

export interface GraphOperation {
  type: string;
  query: string;
  parameters: any;
}

export interface BatchResult {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalDuration: number;
  results: BatchOperationResult[];
}

export interface BatchOperationResult {
  batchId: string;
  success: boolean;
  duration: number;
  processedCount: number;
  result?: any;
  error?: Error;
}