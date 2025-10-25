import { ICleanupStrategy, ICleanupContext, ICleanupResult } from '../ICleanupStrategy';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 垃圾回收策略
 * 负责触发垃圾回收，释放未使用的内存
 */
export class GarbageCollectionStrategy implements ICleanupStrategy {
  public readonly name = 'GarbageCollection';
  public readonly priority = 3; // 低优先级，最后执行
  public readonly description = '触发垃圾回收，释放未使用的内存';

  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  /**
   * 检查策略是否适用于当前上下文
   */
  isApplicable(context: ICleanupContext): boolean {
    // 适用于内存压力较大或需要深度清理的情况
    const memoryPressure = context.memoryUsage &&
      context.memoryUsage.heapUsed > 0 &&
      context.memoryUsage.heapTotal > 0 &&
      (context.memoryUsage.heapUsed / context.memoryUsage.heapTotal) > 0.75;

    const deepCleanup = context.triggerReason.includes('deep') ||
      context.triggerReason.includes('force') ||
      context.triggerReason.includes('gc');

    return memoryPressure || deepCleanup;
  }

  /**
   * 检查策略是否可用
   */
  isAvailable(): boolean {
    try {
      // 检查是否支持强制垃圾回收
      // 在Node.js环境中，即使没有显式启用--expose-gc，我们也可以尝试触发GC
      return typeof global !== 'undefined' && 
             (typeof (global as any).gc === 'function' || 
              typeof (global as any).gc === 'undefined' /* 允许尝试触发GC */);
    } catch (error) {
      this.logger?.debug(`Garbage collection check failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 估算清理影响
   */
  estimateCleanupImpact(context: ICleanupContext): number {
    try {
      // 基础估算垃圾回收效果
      const baseEstimate = 30 * 1024 * 1024; // 基础估算30MB

      // 根据内存使用情况调整估算
      if (context.memoryUsage && context.memoryUsage.heapUsed > 0 && context.memoryUsage.heapTotal > 0) {
        const heapUsed = context.memoryUsage.heapUsed;
        const heapTotal = context.memoryUsage.heapTotal;
        const memoryRatio = heapUsed / heapTotal;

        // 估算可回收的内存（通常为已使用内存的10-20%）
        const reclaimableRatio = Math.min(memoryRatio * 0.15, 0.2);
        return Math.floor(heapUsed * reclaimableRatio);
      }

      return baseEstimate;
    } catch (error) {
      this.logger?.warn(`Failed to estimate garbage collection impact: ${error}`);
      return 0;
    }
  }

  /**
   * 执行清理操作
   */
  async cleanup(context: ICleanupContext): Promise<ICleanupResult> {
    const startTime = Date.now();
    this.logger?.info(`Starting garbage collection, reason: ${context.triggerReason}`);

    try {
      // 获取清理前的内存状态
      const beforeCleanup = process.memoryUsage();

      // 执行垃圾回收
      const gcSuccess = await this.performGarbageCollection();

      if (!gcSuccess) {
        throw new Error('Garbage collection failed or not available');
      }

      // 等待一小段时间让垃圾回收生效
      await new Promise(resolve => setTimeout(resolve, 200));

      // 获取清理后的内存状态
      const afterCleanup = process.memoryUsage();
      const memoryFreed = Math.max(0, beforeCleanup.heapUsed - afterCleanup.heapUsed);

      const duration = Date.now() - startTime;

      this.logger?.info(`Garbage collection completed, freed ${this.formatBytes(memoryFreed)} in ${duration}ms`);

      return {
        success: true,
        cleanedCaches: ['GarbageCollection'],
        memoryFreed,
        duration,
        metadata: {
          beforeHeapUsed: beforeCleanup.heapUsed,
          afterHeapUsed: afterCleanup.heapUsed,
          beforeHeapTotal: beforeCleanup.heapTotal,
          afterHeapTotal: afterCleanup.heapTotal,
          beforeExternal: beforeCleanup.external,
          afterExternal: afterCleanup.external,
          gcType: 'manual'
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error(`Garbage collection failed: ${error}`);

      return {
        success: false,
        cleanedCaches: [],
        memoryFreed: 0,
        duration,
        error: error as Error,
        metadata: {
          gcType: 'manual',
          errorContext: 'gc_execution'
        }
      };
    }
  }

  /**
   * 执行垃圾回收
   */
  private async performGarbageCollection(): Promise<boolean> {
    try {
      // 尝试多种垃圾回收方式

      // 1. 强制垃圾回收（如果可用）
      if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
        (global as any).gc();
        this.logger?.debug('Manual garbage collection triggered');
        return true;
      }

      // 2. 尝试通过内存压力触发垃圾回收
      await this.triggerGCByMemoryPressure();

      return true;
    } catch (error) {
      this.logger?.warn(`Garbage collection error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 通过内存压力触发垃圾回收
   */
  private async triggerGCByMemoryPressure(): Promise<void> {
    try {
      // 创建临时对象来触发垃圾回收
      const tempArrays: any[] = [];

      // 分配一些内存来触发GC
      for (let i = 0; i < 10; i++) {
        tempArrays.push(new Array(1024 * 1024).fill(0)); // 1MB数组
      }

      // 清除引用
      tempArrays.length = 0;

      // 等待GC执行
      await new Promise(resolve => setTimeout(resolve, 100));

      this.logger?.debug('Garbage collection triggered by memory pressure');
    } catch (error) {
      this.logger?.debug(`Memory pressure GC trigger failed: ${(error as Error).message}`);
    }
  }

  /**
   * 获取垃圾回收统计信息
   */
  private getGCStats(): any {
    try {
      if (typeof process !== 'undefined' && (process as any).memoryUsage) {
        const memUsage = (process as any).memoryUsage();

        // 尝试获取V8的垃圾回收统计（如果可用）
        if ((process as any).getV8GCStatistics) {
          return {
            memoryUsage: memUsage,
            v8GCStats: (process as any).getV8GCStatistics()
          };
        }

        return {
          memoryUsage: memUsage
        };
      }

      return null;
    } catch (error) {
      this.logger?.debug(`Failed to get GC stats: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 格式化字节数为可读格式
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = Math.abs(bytes);
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * 获取策略详细信息
   */
  getDetails(): {
    available: boolean;
    gcEnabled: boolean;
    v8StatsAvailable: boolean;
  } {
    const available = this.isAvailable();

    return {
      available,
      gcEnabled: available && typeof (global as any).gc === 'function',
      v8StatsAvailable: typeof (process as any).getV8GCStatistics === 'function'
    };
  }
}