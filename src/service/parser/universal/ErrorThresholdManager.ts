import { injectable } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 错误阈值管理器
 * 负责监控错误计数，当达到阈值时触发降级处理
 */
@injectable()
export class ErrorThresholdManager {
  private errorCount: number = 0;
  private lastErrorTime: number = 0;
  private maxErrors: number;
  private resetInterval: number;
  private logger?: LoggerService;

  constructor(logger?: LoggerService, maxErrors: number = 5, resetInterval: number = 60000) {
    this.logger = logger;
    this.maxErrors = maxErrors;
    this.resetInterval = resetInterval;
  }

  /**
   * 检查是否应该使用降级方案
   */
  shouldUseFallback(): boolean {
    const now = Date.now();
    
    // 重置计数器（超过重置间隔时间且无错误）
    if (now - this.lastErrorTime > this.resetInterval) {
      this.resetCounter();
    }
    
    return this.errorCount >= this.maxErrors;
  }

  /**
   * 记录错误并清理资源
   */
  recordError(error: Error, context?: string): void {
    this.errorCount++;
    this.lastErrorTime = Date.now();
    
    // 记录日志
    this.logger?.warn(`Processing error #${this.errorCount}: ${error.message}`, {
      context,
      stack: error.stack,
      errorCount: this.errorCount,
      maxErrors: this.maxErrors
    });
    
    // 如果达到阈值，执行清理
    if (this.errorCount >= this.maxErrors) {
      this.logger?.warn(`Error threshold reached (${this.errorCount}/${this.maxErrors}), triggering cleanup`);
      this.forceCleanup();
    }
  }

  /**
   * 重置计数器
   */
  resetCounter(): void {
    if (this.errorCount > 0) {
      this.logger?.info(`Resetting error counter from ${this.errorCount} to 0`);
      this.errorCount = 0;
    }
  }

  /**
   * 强制清理缓存和临时对象
   */
  private forceCleanup(): void {
    try {
      // 清理TreeSitter缓存（如果可用）
      this.cleanupTreeSitterCache();
      
      // 清理LRU缓存（如果可用）
      this.cleanupLRUCache();
      
      // 强制垃圾回收（如果可用）
      this.forceGarbageCollection();
      
      this.logger?.info('Cleanup completed after error threshold reached');
    } catch (error) {
      this.logger?.error(`Error during cleanup: ${error}`);
    }
  }

  /**
   * 清理TreeSitter缓存
   */
  private cleanupTreeSitterCache(): void {
    try {
      // 动态导入TreeSitterCoreService以避免循环依赖
      const TreeSitterCoreService = require('../core/parse/TreeSitterCoreService').TreeSitterCoreService;
      if (TreeSitterCoreService && typeof TreeSitterCoreService.getInstance === 'function') {
        TreeSitterCoreService.getInstance().clearCache();
        this.logger?.debug('TreeSitter cache cleared');
      }
    } catch (error) {
      // 忽略错误，可能是模块不存在或方法不可用
      this.logger?.debug(`Could not clear TreeSitter cache: ${(error as Error).message}`);
    }
  }

  /**
   * 清理LRU缓存
   */
  private cleanupLRUCache(): void {
    try {
      // 尝试清理常见的LRU缓存实例
      if (typeof global !== 'undefined' && (global as any).LRUCache) {
        if (typeof (global as any).LRUCache.clearAll === 'function') {
          (global as any).LRUCache.clearAll();
          this.logger?.debug('LRU cache cleared');
        }
      }
    } catch (error) {
      // 忽略错误，可能是缓存不存在
      this.logger?.debug(`Could not clear LRU cache: ${(error as Error).message}`);
    }
  }

  /**
   * 强制垃圾回收
   */
  private forceGarbageCollection(): void {
    try {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
        this.logger?.debug('Forced garbage collection');
      }
    } catch (error) {
      // 忽略错误，可能是垃圾回收不可用
      this.logger?.debug(`Could not force garbage collection: ${(error as Error).message}`);
    }
  }

  /**
   * 获取当前错误状态
   */
  getStatus(): {
    errorCount: number;
    maxErrors: number;
    lastErrorTime: number;
    shouldUseFallback: boolean;
    timeUntilReset: number;
  } {
    const now = Date.now();
    const timeUntilReset = Math.max(0, this.resetInterval - (now - this.lastErrorTime));
    
    return {
      errorCount: this.errorCount,
      maxErrors: this.maxErrors,
      lastErrorTime: this.lastErrorTime,
      shouldUseFallback: this.shouldUseFallback(),
      timeUntilReset
    };
  }

  /**
   * 设置最大错误数
   */
  setMaxErrors(maxErrors: number): void {
    if (maxErrors > 0) {
      this.maxErrors = maxErrors;
      this.logger?.info(`Max errors set to ${maxErrors}`);
    }
  }

  /**
   * 设置重置间隔
   */
  setResetInterval(resetInterval: number): void {
    if (resetInterval > 0) {
      this.resetInterval = resetInterval;
      this.logger?.info(`Reset interval set to ${resetInterval}ms`);
    }
  }

  /**
   * 获取错误率（每分钟的错误数）
   */
  getErrorRate(): number {
    const now = Date.now();
    const timeDiff = now - this.lastErrorTime;
    
    if (timeDiff === 0) {
      return 0;
    }
    
    // 计算每分钟的错误数
    const minutesDiff = timeDiff / 60000;
    return this.errorCount / Math.max(minutesDiff, 1/60); // 避免除以零
  }
}