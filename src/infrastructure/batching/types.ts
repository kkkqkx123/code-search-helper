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
}

export interface BatchProcessingOptions {
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  concurrency?: number;
}