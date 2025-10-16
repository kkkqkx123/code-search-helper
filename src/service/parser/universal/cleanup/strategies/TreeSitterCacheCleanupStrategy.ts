import { ICleanupStrategy, ICleanupContext, ICleanupResult } from '../interfaces/ICleanupStrategy';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * TreeSitter缓存清理策略
 * 负责清理TreeSitter解析器的缓存，释放内存
 */
export class TreeSitterCacheCleanupStrategy implements ICleanupStrategy {
  public readonly name = 'TreeSitterCacheCleanup';
  public readonly priority = 1; // 高优先级，优先清理
  public readonly description = '清理TreeSitter解析器缓存，释放内存';
  
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  /**
   * 检查策略是否适用于当前上下文
   */
  isApplicable(context: ICleanupContext): boolean {
    // 适用于内存压力较大或错误阈值触发的情况
    const memoryPressure = context.memoryUsage && 
      context.memoryUsage.heapUsed > 0 && 
      context.memoryUsage.heapTotal > 0 &&
      (context.memoryUsage.heapUsed / context.memoryUsage.heapTotal) > 0.7;

    const errorThreshold = context.errorStats && context.errorStats.count > 3;

    return memoryPressure || errorThreshold || context.triggerReason.includes('memory') || context.triggerReason.includes('error');
  }

  /**
   * 检查策略是否可用
   */
  isAvailable(): boolean {
    try {
      // 检查TreeSitterCoreService是否可用
      const TreeSitterCoreService = require('../../core/parse/TreeSitterCoreService').TreeSitterCoreService;
      return TreeSitterCoreService && typeof TreeSitterCoreService.getInstance === 'function';
    } catch (error) {
      this.logger?.debug(`TreeSitterCoreService not available: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 估算清理影响
   */
  estimateCleanupImpact(context: ICleanupContext): number {
    try {
      // 估算TreeSitter缓存大小（基于经验值）
      const baseEstimate = 50 * 1024 * 1024; // 基础估算50MB
      
      // 根据内存使用情况调整估算
      if (context.memoryUsage && context.memoryUsage.heapUsed > 0) {
        const memoryRatio = context.memoryUsage.heapUsed / context.memoryUsage.heapTotal;
        return Math.floor(baseEstimate * Math.min(memoryRatio, 1.5));
      }
      
      return baseEstimate;
    } catch (error) {
      this.logger?.warn(`Failed to estimate TreeSitter cache impact: ${error}`);
      return 0;
    }
  }

  /**
   * 执行清理操作
   */
  async cleanup(context: ICleanupContext): Promise<ICleanupResult> {
    const startTime = Date.now();
    this.logger?.info(`Starting TreeSitter cache cleanup, reason: ${context.triggerReason}`);

    try {
      // 获取清理前的内存状态
      const beforeCleanup = process.memoryUsage();
      
      // 清理TreeSitter缓存
      const cleanupSuccess = await this.performTreeSitterCacheCleanup();
      
      if (!cleanupSuccess) {
        throw new Error('TreeSitter cache cleanup failed');
      }

      // 获取清理后的内存状态
      const afterCleanup = process.memoryUsage();
      const memoryFreed = Math.max(0, beforeCleanup.heapUsed - afterCleanup.heapUsed);

      const duration = Date.now() - startTime;
      
      this.logger?.info(`TreeSitter cache cleanup completed, freed ${this.formatBytes(memoryFreed)} in ${duration}ms`);

      return {
        success: true,
        cleanedCaches: ['TreeSitter'],
        memoryFreed,
        duration,
        metadata: {
          beforeHeapUsed: beforeCleanup.heapUsed,
          afterHeapUsed: afterCleanup.heapUsed,
          cacheType: 'TreeSitter'
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error(`TreeSitter cache cleanup failed: ${error}`);
      
      return {
        success: false,
        cleanedCaches: [],
        memoryFreed: 0,
        duration,
        error: error as Error,
        metadata: {
          cacheType: 'TreeSitter',
          errorContext: 'cleanup_execution'
        }
      };
    }
  }

  /**
   * 执行TreeSitter缓存清理
   */
  private async performTreeSitterCacheCleanup(): Promise<boolean> {
    try {
      const TreeSitterCoreService = require('../../core/parse/TreeSitterCoreService').TreeSitterCoreService;
      
      if (!TreeSitterCoreService || typeof TreeSitterCoreService.getInstance !== 'function') {
        throw new Error('TreeSitterCoreService not available');
      }

      const instance = TreeSitterCoreService.getInstance();
      if (!instance || typeof instance.clearCache !== 'function') {
        throw new Error('TreeSitterCoreService instance or clearCache method not available');
      }

      // 执行缓存清理
      instance.clearCache();
      
      // 等待一小段时间让清理生效
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      this.logger?.warn(`TreeSitter cache cleanup error: ${(error as Error).message}`);
      return false;
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
}