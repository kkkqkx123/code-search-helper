import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { CleanupManager } from './cleanup/CleanupManager';
import { ICleanupContext } from './cleanup/interfaces/ICleanupStrategy';

/**
 * 错误阈值管理器
 * 负责监控错误计数，当达到阈值时触发降级处理
 * 重构后：专注于错误阈值管理，清理逻辑完全委托给CleanupManager
 */
@injectable()
export class ErrorThresholdManager {
  private errorCount: number = 0;
  private lastErrorTime: number = 0;
  private maxErrors: number;
  private resetInterval: number;
  private logger?: LoggerService;
  private cleanupManager?: CleanupManager;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.CleanupManager) cleanupManager?: CleanupManager,
    maxErrors: number = 5, 
    resetInterval: number = 60000
  ) {
    this.logger = logger;
    this.cleanupManager = cleanupManager;
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
   * 记录错误并触发清理
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
   * 重构后：完全委托给CleanupManager执行清理
   */
  private forceCleanup(): void {
    try {
      this.logger?.info('Starting error threshold cleanup...');

      if (this.cleanupManager) {
        // 使用CleanupManager执行清理
        const cleanupContext: ICleanupContext = {
          triggerReason: `error_threshold_reached_${this.errorCount}_${this.maxErrors}`,
          errorStats: {
            count: this.errorCount,
            lastErrorTime: this.lastErrorTime,
            errorRate: this.getErrorRate()
          },
          timestamp: new Date()
        };

        this.cleanupManager.performCleanup(cleanupContext).then(result => {
          if (result.success) {
            this.logger?.info(`Cleanup completed successfully, freed ${this.formatBytes(result.memoryFreed)} bytes, cleaned caches: ${result.cleanedCaches.join(', ')}`);
          } else {
            this.logger?.error(`Cleanup failed: ${result.error?.message}`);
          }
        }).catch(error => {
          this.logger?.error(`Cleanup execution failed: ${error}`);
        });
      } else {
        this.logger?.warn('CleanupManager not available, cleanup skipped');
      }

      this.logger?.info('Error threshold cleanup completed');
    } catch (error) {
      this.logger?.error(`Error during cleanup: ${error}`);
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

  /**
   * 设置CleanupManager（用于动态注入）
   */
  setCleanupManager(cleanupManager: CleanupManager): void {
    this.cleanupManager = cleanupManager;
    this.logger?.info('CleanupManager injected into ErrorThresholdManager');
  }

  /**
   * 格式化字节数为可读格式
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
}