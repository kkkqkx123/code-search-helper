import { injectable } from 'inversify';

export interface BatchOptimizationConfig {
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  adaptiveBatchingEnabled: boolean;
}

export interface BatchOptimizationResult {
  optimalBatchSize: number;
  shouldRetry: boolean;
  retryDelay: number;
  memoryUsage: number;
}

@injectable()
export class GraphBatchOptimizer {
  private config: BatchOptimizationConfig;
  private lastBatchSizes: number[] = [];
  private lastMemoryUsage: number[] = [];
  private consecutiveFailures: number = 0;

  constructor(config: Partial<BatchOptimizationConfig> = {}) {
    this.config = {
      maxConcurrentOperations: 5,
      defaultBatchSize: 50,
      maxBatchSize: 500,
      memoryThreshold: 80,
      processingTimeout: 300000,
      retryAttempts: 3,
      retryDelay: 1000,
      adaptiveBatchingEnabled: true,
      ...config,
    };
  }

  calculateOptimalBatchSize(totalItems: number, currentMemoryUsage?: number): number {
    if (!this.config.adaptiveBatchingEnabled) {
      return Math.min(this.config.defaultBatchSize, totalItems);
    }

    let optimalSize = this.config.defaultBatchSize;

    // Adjust based on memory usage
    if (currentMemoryUsage !== undefined) {
      if (currentMemoryUsage > this.config.memoryThreshold) {
        // Reduce batch size if memory usage is high
        optimalSize = Math.max(10, Math.floor(optimalSize * 0.5));
      } else if (currentMemoryUsage < 50) {
        // Increase batch size if memory usage is low
        optimalSize = Math.min(this.config.maxBatchSize, Math.floor(optimalSize * 1.5));
      }
    }

    // Adjust based on historical performance
    if (this.lastBatchSizes.length > 0) {
      const avgSuccessSize = this.calculateAverageSuccessSize();
      if (avgSuccessSize > 0) {
        optimalSize = Math.min(optimalSize, avgSuccessSize);
      }
    }

    // Adjust based on consecutive failures
    if (this.consecutiveFailures > 0) {
      const reductionFactor = Math.max(0.3, 1 - this.consecutiveFailures * 0.2);
      optimalSize = Math.max(10, Math.floor(optimalSize * reductionFactor));
    }

    // Ensure batch size is within bounds
    optimalSize = Math.max(
      1,
      Math.min(optimalSize, Math.min(this.config.maxBatchSize, totalItems))
    );

    return optimalSize;
  }

  private calculateAverageSuccessSize(): number {
    if (this.lastBatchSizes.length === 0) return 0;

    const recentSizes = this.lastBatchSizes.slice(-10);
    return Math.floor(recentSizes.reduce((a, b) => a + b, 0) / recentSizes.length);
  }

  shouldRetryOperation(failureCount: number, error?: Error): BatchOptimizationResult {
    const shouldRetry = failureCount < this.config.retryAttempts;
    const retryDelay = this.calculateRetryDelay(failureCount);

    if (!shouldRetry) {
      this.consecutiveFailures++;
    } else {
      this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
    }

    return {
      optimalBatchSize: this.calculateOptimalBatchSize(1000), // Default fallback
      shouldRetry,
      retryDelay,
      memoryUsage: this.getCurrentMemoryUsage(),
    };
  }

  private calculateRetryDelay(failureCount: number): number {
    const baseDelay = this.config.retryDelay;
    const exponentialBackoff = Math.pow(2, failureCount);
    const jitter = Math.random() * 0.1; // Add 10% jitter

    return Math.floor(baseDelay * exponentialBackoff * (1 + jitter));
  }

  recordBatchResult(batchSize: number, success: boolean, processingTime?: number): void {
    this.lastBatchSizes.push(batchSize);

    // Keep only last 20 batch sizes
    if (this.lastBatchSizes.length > 20) {
      this.lastBatchSizes = this.lastBatchSizes.slice(-20);
    }

    if (success) {
      this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
    } else {
      this.consecutiveFailures++;
    }
  }

  checkMemoryUsage(): boolean {
    const currentUsage = this.getCurrentMemoryUsage();
    return currentUsage < this.config.memoryThreshold;
  }

  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal + memUsage.external;
      const usedMemory = memUsage.heapUsed + memUsage.external;

      if (totalMemory > 0) {
        return (usedMemory / totalMemory) * 100;
      }
    }

    // Fallback if memory usage is not available
    return 50; // Assume moderate usage
  }

  getOptimizationReport(): string {
    return `
Batch Optimization Report:
- Current optimal batch size: ${this.calculateOptimalBatchSize(1000)}
- Consecutive failures: ${this.consecutiveFailures}
- Memory usage: ${this.getCurrentMemoryUsage().toFixed(2)}%
- Last batch sizes: [${this.lastBatchSizes.slice(-5).join(', ')}]
- Adaptive batching: ${this.config.adaptiveBatchingEnabled ? 'enabled' : 'disabled'}
    `.trim();
  }

  updateConfig(newConfig: Partial<BatchOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): BatchOptimizationConfig {
    return { ...this.config };
  }

  chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
