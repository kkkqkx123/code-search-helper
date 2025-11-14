import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

export interface VectorMetrics {
  totalOperations: number;
  averageDuration: number;
  cacheHitRate: number;
  errorRate: number;
  lastOperationTime?: Date;
}

@injectable()
export class VectorMetricsCollector {
  private metrics: Map<string, number> = new Map();
  private operationCounts: Map<string, number> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  recordOperation(operation: string, duration: number, success: boolean = true): void {
    const durationKey = `${operation}_duration`;
    const countKey = `${operation}_count`;
    const errorKey = `${operation}_errors`;

    const currentDuration = this.metrics.get(durationKey) || 0;
    const currentCount = this.operationCounts.get(countKey) || 0;

    this.metrics.set(durationKey, currentDuration + duration);
    this.operationCounts.set(countKey, currentCount + 1);

    if (!success) {
      const currentErrors = this.metrics.get(errorKey) || 0;
      this.metrics.set(errorKey, currentErrors + 1);
    }

    this.metrics.set('last_operation_time', Date.now());
  }

  getMetrics(): VectorMetrics {
    const totalOps = Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0);
    const totalDuration = Array.from(this.metrics.entries())
      .filter(([key]) => key.endsWith('_duration'))
      .reduce((sum, [, value]) => sum + value, 0);
    const totalErrors = Array.from(this.metrics.entries())
      .filter(([key]) => key.endsWith('_errors'))
      .reduce((sum, [, value]) => sum + value, 0);

    return {
      totalOperations: totalOps,
      averageDuration: totalOps > 0 ? totalDuration / totalOps : 0,
      cacheHitRate: this.calculateCacheHitRate(),
      errorRate: totalOps > 0 ? totalErrors / totalOps : 0,
      lastOperationTime: this.metrics.has('last_operation_time') 
        ? new Date(this.metrics.get('last_operation_time')!) 
        : undefined
    };
  }

  private calculateCacheHitRate(): number {
    const hits = this.metrics.get('cache_hits') || 0;
    const misses = this.metrics.get('cache_misses') || 0;
    const total = hits + misses;
    return total > 0 ? hits / total : 0;
  }

  reset(): void {
    this.metrics.clear();
    this.operationCounts.clear();
  }
}