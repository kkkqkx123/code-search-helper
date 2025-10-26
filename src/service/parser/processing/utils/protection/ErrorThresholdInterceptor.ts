import { ProtectionInterceptor, ProtectionContext, ProtectionDecision } from './ProtectionInterceptor';
import { LoggerService } from '../../../../../utils/LoggerService';
import { CleanupManager } from '../../../../../infrastructure/cleanup/CleanupManager';
import { ICleanupContext } from '../../../../../infrastructure/cleanup/ICleanupStrategy';

/**
 * 错误阈值配置
 */
export interface ErrorThresholdConfig {
  maxErrorCount: number;      // 最大错误数量
  timeWindowMs?: number;      // 时间窗口（毫秒）
  autoResetCount?: number;    // 自动重置计数（达到多少次后自动重置）
  errorTypes?: string[];      // 需要统计的错误类型
}

/**
 * 错误记录
 */
interface ErrorRecord {
  timestamp: number;          // 错误发生时间
  type: string;              // 错误类型
  message: string;           // 错误信息
  context?: Record<string, any>; // 错误上下文
}

/**
 * 错误阈值拦截器
 * 监控错误数量，当超过阈值时阻止操作
 */
export class ErrorThresholdInterceptor implements ProtectionInterceptor {
  private config: ErrorThresholdConfig;
  private logger?: LoggerService;
  private errorRecords: ErrorRecord[] = [];
  private errorCount: number = 0;
  private lastErrorTime: number = 0;
  private maxErrors: number;
  private resetInterval: number;
  private cleanupManager?: CleanupManager;

  constructor(config: ErrorThresholdConfig, logger?: LoggerService, cleanupManager?: CleanupManager, maxErrors: number = 5, resetInterval: number = 60000) {
    this.config = {
      timeWindowMs: 5 * 60 * 1000, // 默认5分钟时间窗口
      autoResetCount: 1000,        // 默认1000次后自动重置
      errorTypes: ['parse_error', 'processing_error', 'memory_error', 'timeout_error'],
      ...config
    };
    this.logger = logger;
    this.cleanupManager = cleanupManager;
    this.maxErrors = maxErrors;
    this.resetInterval = resetInterval;
  }

  getName(): string {
    return 'ErrorThresholdInterceptor';
  }

  getPriority(): number {
    return 2; // 中等优先级，在内存检查之后
  }

  async intercept(context: ProtectionContext): Promise<ProtectionDecision> {
    // 只在可能出错的操作中进行错误阈值检查
    if (!this.shouldCheckErrors(context.operation)) {
      return { shouldProceed: true };
    }

    try {
      // 检查是否应该使用降级方案（基于错误计数器）
      if (this.shouldUseFallback()) {
        const reason = `Error threshold exceeded: ${this.errorCount} >= ${this.maxErrors} errors`;
        this.logger?.warn(`[ErrorThresholdInterceptor] ${reason}`);
        
        return {
          shouldProceed: false,
          reason,
          alternativeAction: 'degrade_gracefully',
          metadata: {
            currentErrorCount: this.errorCount,
            maxErrorCount: this.maxErrors,
            timeWindowMs: this.config.timeWindowMs,
            recentErrors: this.getRecentErrors(5) // 返回最近5个错误
          }
        };
      }

      // 清理过期的错误记录
      this.cleanExpiredErrors();

      // 获取当前错误数量
      const currentErrorCount = this.getCurrentErrorCount();
      const maxErrorCount = this.config.maxErrorCount;

      this.logger?.debug(`Error threshold check: ${currentErrorCount} / ${maxErrorCount} errors`);

      // 如果错误数量超过阈值
      if (currentErrorCount >= maxErrorCount) {
        const reason = `Error threshold exceeded: ${currentErrorCount} >= ${maxErrorCount} errors`;
        this.logger?.warn(`[ErrorThresholdInterceptor] ${reason}`);
        
        return {
          shouldProceed: false,
          reason,
          alternativeAction: 'degrade_gracefully',
          metadata: {
            currentErrorCount,
            maxErrorCount,
            timeWindowMs: this.config.timeWindowMs,
            recentErrors: this.getRecentErrors(5) // 返回最近5个错误
          }
        };
      }

      return {
        shouldProceed: true,
        metadata: {
          currentErrorCount,
          maxErrorCount,
          remainingCapacity: maxErrorCount - currentErrorCount
        }
      };

    } catch (error) {
      this.logger?.error('[ErrorThresholdInterceptor] Error checking error threshold:', error);
      // 错误阈值检查出错时，默认允许继续执行，但记录错误
      return {
        shouldProceed: true,
        reason: 'Error threshold check failed, allowing to proceed',
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };
    }
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
   * 记录错误（兼容旧方法）
   */
  recordErrorByType(errorType: string, errorMessage: string, context?: Record<string, any>): void {
    if (!this.shouldRecordError(errorType)) {
      return;
    }

    const errorRecord: ErrorRecord = {
      timestamp: Date.now(),
      type: errorType,
      message: errorMessage,
      context
    };

    this.errorRecords.push(errorRecord);
    this.logger?.debug(`Recorded error: ${errorType} - ${errorMessage}`);

    // 检查是否需要自动重置
    if (this.errorRecords.length >= (this.config.autoResetCount || 1000)) {
      this.resetErrors();
      this.logger?.info('Auto-reset error count due to reaching auto-reset threshold');
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
   * 重置错误记录
   */
  resetErrors(): void {
    const oldCount = this.errorRecords.length;
    this.errorRecords = [];
    this.logger?.info(`Reset error records (cleared ${oldCount} errors)`);
  }

  /**
   * 强制清理缓存和临时对象
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
   * 获取当前错误数量
   */
  getCurrentErrorCount(): number {
    this.cleanExpiredErrors();
    return this.errorRecords.length;
  }

  /**
   * 获取最近的错误
   */
  getRecentErrors(count: number): ErrorRecord[] {
    this.cleanExpiredErrors();
    return this.errorRecords.slice(-count);
  }

  /**
   * 判断是否应该进行错误阈值检查
   */
  private shouldCheckErrors(operation: string): boolean {
    // 只在处理操作中检查错误阈值
    const errorSensitiveOperations = [
      'chunk_text',
      'parse_file',
      'process_content',
      'semantic_chunk',
      'bracket_chunk',
      'line_chunk',
      'split_text'
    ];

    return errorSensitiveOperations.includes(operation);
  }

  /**
   * 判断是否应该记录错误
   */
  private shouldRecordError(errorType: string): boolean {
    if (!this.config.errorTypes || this.config.errorTypes.length === 0) {
      return true; // 如果没有指定错误类型，记录所有错误
    }
    return this.config.errorTypes.includes(errorType);
  }

  /**
   * 清理过期的错误记录
   */
  private cleanExpiredErrors(): void {
    const now = Date.now();
    const timeWindowMs = this.config.timeWindowMs || 5 * 60 * 1000;
    
    const oldLength = this.errorRecords.length;
    this.errorRecords = this.errorRecords.filter(
      record => now - record.timestamp <= timeWindowMs
    );
    
    const cleanedCount = oldLength - this.errorRecords.length;
    if (cleanedCount > 0) {
      this.logger?.debug(`Cleaned ${cleanedCount} expired error records`);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ErrorThresholdConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger?.debug(`Error threshold config updated: ${JSON.stringify(this.config)}`);
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
     return this.errorCount / Math.max(minutesDiff, 1 / 60); // 避免除以零
   }
 
   /**
    * 设置CleanupManager（用于动态注入）
    */
   setCleanupManager(cleanupManager: CleanupManager): void {
     this.cleanupManager = cleanupManager;
     this.logger?.info('CleanupManager injected into ErrorThresholdInterceptor');
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
    * 获取错误统计信息
    */
   getErrorStats(): {
     totalErrors: number;
     errorTypes: Record<string, number>;
     timeWindowMs: number;
     oldestErrorTimestamp?: number;
     newestErrorTimestamp?: number;
   } {
     this.cleanExpiredErrors();
     
     const errorTypes: Record<string, number> = {};
     let oldestTimestamp: number | undefined;
     let newestTimestamp: number | undefined;
 
     this.errorRecords.forEach(record => {
       errorTypes[record.type] = (errorTypes[record.type] || 0) + 1;
       
       if (!oldestTimestamp || record.timestamp < oldestTimestamp) {
         oldestTimestamp = record.timestamp;
       }
       if (!newestTimestamp || record.timestamp > newestTimestamp) {
         newestTimestamp = record.timestamp;
       }
     });
 
     return {
       totalErrors: this.errorRecords.length,
       errorTypes,
       timeWindowMs: this.config.timeWindowMs || 5 * 60 * 1000,
       oldestErrorTimestamp: oldestTimestamp,
       newestErrorTimestamp: newestTimestamp
     };
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