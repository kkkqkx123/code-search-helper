import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { IMemoryMonitorService } from '../../memory/interfaces/IMemoryMonitorService';
import { CleanupManager } from '../universal/cleanup/CleanupManager';
import { ICleanupContext } from '../universal/cleanup/interfaces/ICleanupStrategy';

/**
 * 内存监控和保护机制
 * 负责监控内存使用情况，在达到限制时触发清理或降级处理
 * 重构为依赖统一的内存监控服务和CleanupManager
 */
@injectable()
export class MemoryGuard {
  private memoryLimit: number;
  private readonly checkInterval: number;
  private memoryCheckTimer?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  private logger?: LoggerService;
  private memoryMonitor: IMemoryMonitorService;
  private cleanupManager?: CleanupManager;

  constructor(
    @inject(TYPES.MemoryMonitorService) memoryMonitor: IMemoryMonitorService,
    @inject(TYPES.MemoryLimitMB) memoryLimitMB: number = 500,
    @inject(TYPES.MemoryCheckIntervalMs) checkIntervalMs: number = 5000,
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.CleanupManager) cleanupManager?: CleanupManager
  ) {
    this.memoryMonitor = memoryMonitor;
    this.memoryLimit = memoryLimitMB * 1024 * 1024; // 转换为字节
    this.checkInterval = checkIntervalMs;
    this.logger = logger;
    this.cleanupManager = cleanupManager;
    
    // 设置内存限制到内存监控服务
    this.memoryMonitor.setMemoryLimit?.(memoryLimitMB);
  }

  /**
   * 开始内存监控
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger?.warn('Memory monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    this.memoryCheckTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);

    this.logger?.info(`Memory monitoring started (limit: ${this.memoryLimit / 1024 / 1024}MB, interval: ${this.checkInterval}ms)`);
  }

  /**
   * 停止内存监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = undefined;
    }

    this.isMonitoring = false;
    this.logger?.info('Memory monitoring stopped');
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage(): {
    isWithinLimit: boolean;
    usagePercent: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  } {
    try {
      // 使用统一的内存监控服务获取内存状态
      const memoryStatus = this.memoryMonitor.getMemoryStatus();
      const heapUsed = memoryStatus.heapUsed;
      const heapTotal = memoryStatus.heapTotal;
      const external = memoryStatus.external;
      const memUsage = process.memoryUsage();
      const arrayBuffers = memUsage.arrayBuffers || 0;

      const isWithinLimit = heapUsed <= this.memoryLimit;
      const usagePercent = (heapUsed / this.memoryLimit) * 100;

      // 如果内存使用过高，记录警告
      if (!isWithinLimit) {
        this.logger?.warn(`Memory usage exceeds limit: ${this.formatBytes(heapUsed)} > ${this.formatBytes(this.memoryLimit)} (${usagePercent.toFixed(1)}%)`);

        // 触发清理
        this.forceCleanup();

        // 如果仍然超过限制，触发降级处理
        if (!this.memoryMonitor.isWithinLimit?.()) {
          this.logger?.warn('Memory still exceeds limit after cleanup, triggering graceful degradation');
          this.gracefulDegradation();
        }
      } else if (usagePercent > 80) {
        this.logger?.warn(`High memory usage detected: ${usagePercent.toFixed(1)}%`);
      }

      return {
        isWithinLimit,
        usagePercent,
        heapUsed,
        heapTotal,
        external,
        arrayBuffers
      };
    } catch (error) {
      this.logger?.error(`Error checking memory usage: ${error}`);
      return {
        isWithinLimit: true,
        usagePercent: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0
      };
    }
  }

  /**
   * 强制清理缓存和临时对象
   * 重构后：委托给CleanupManager执行清理
   */
  forceCleanup(): void {
    try {
      this.logger?.info('Performing forced memory cleanup...');

      if (this.cleanupManager) {
        // 使用CleanupManager执行清理
        const cleanupContext: ICleanupContext = {
          triggerReason: 'memory_limit_exceeded',
          memoryUsage: {
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external,
            arrayBuffers: process.memoryUsage().arrayBuffers
          },
          timestamp: new Date()
        };

        this.cleanupManager.performCleanup(cleanupContext).then(result => {
          if (result.success) {
            this.logger?.info(`Cleanup completed successfully, freed ${this.formatBytes(result.memoryFreed)} bytes, cleaned caches: ${result.cleanedCaches.join(', ')}`);
            
            // 记录清理后的内存使用情况
            const afterCleanup = this.checkMemoryUsage();
            this.logger?.info(`Memory cleanup completed. Current usage: ${this.formatBytes(afterCleanup.heapUsed)} (${afterCleanup.usagePercent.toFixed(1)}%)`);
          } else {
            this.logger?.error(`Cleanup failed: ${result.error?.message}`);
          }
        }).catch(error => {
          this.logger?.error(`Cleanup execution failed: ${error}`);
        });
      } else {
        // 降级到原有的清理逻辑（向后兼容）
        this.logger?.warn('CleanupManager not available, falling back to legacy cleanup');
        this.legacyCleanup();
      }
    } catch (error) {
      this.logger?.error(`Error during memory cleanup: ${error}`);
    }
  }

  /**
   * 遗留清理逻辑（向后兼容）
   * @deprecated 仅在没有CleanupManager时使用
   */
  private legacyCleanup(): void {
    try {
      // 清理TreeSitter缓存
      this.cleanupTreeSitterCache();

      // 清理其他缓存
      this.cleanupOtherCaches();

      // 使用统一的内存监控服务进行垃圾回收和清理
      this.memoryMonitor.forceGarbageCollection();
      this.memoryMonitor.triggerCleanup('deep');

      // 记录清理后的内存使用情况
      const afterCleanup = this.checkMemoryUsage();
      this.logger?.info(`Legacy memory cleanup completed. Current usage: ${this.formatBytes(afterCleanup.heapUsed)} (${afterCleanup.usagePercent.toFixed(1)}%)`);
    } catch (error) {
      this.logger?.error(`Error during legacy memory cleanup: ${error}`);
    }
  }

  /**
   * 优雅降级处理
   */
  gracefulDegradation(): void {
    this.logger?.warn('Initiating graceful degradation due to memory pressure...');

    // 这里可以触发降级处理的回调或事件
    // 实际实现中可能需要与错误阈值管理器协调
    if (typeof process !== 'undefined' && process.emit) {
      (process.emit as any)('memoryPressure', {
        type: 'graceful-degradation',
        memoryUsage: process.memoryUsage(),
        limit: this.memoryLimit
      });
    }

    // 强制垃圾回收
    this.forceGarbageCollection();
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats(): {
    current: NodeJS.MemoryUsage;
    limit: number;
    usagePercent: number;
    isWithinLimit: boolean;
    trend: 'increasing' | 'decreasing' | 'stable';
    averageUsage: number;
  } {
    const current = process.memoryUsage();
    const usagePercent = (current.heapUsed / this.memoryLimit) * 100;
    const isWithinLimit = current.heapUsed <= this.memoryLimit;
    
    // 使用统一的内存监控服务获取趋势和平均值
    const memoryStatus = this.memoryMonitor.getMemoryStatus();
    const trend = memoryStatus.trend;
    const averageUsage = memoryStatus.averageUsage;

    return {
      current,
      limit: this.memoryLimit,
      usagePercent,
      isWithinLimit,
      trend,
      averageUsage
    };
  }

  /**
   * 获取内存使用历史
   */
  getMemoryHistory(): Array<{ timestamp: number; heapUsed: number; heapTotal: number }> {
    // 使用统一的内存监控服务获取历史记录
    const history = this.memoryMonitor.getMemoryHistory();
    return history.map(item => ({
      timestamp: item.timestamp.getTime(),
      heapUsed: item.heapUsed,
      heapTotal: item.heapTotal
    }));
  }

  /**
   * 清空内存使用历史
   */
  clearHistory(): void {
    // 使用统一的内存监控服务清空历史记录
    this.memoryMonitor.clearHistory();
    this.logger?.debug('Memory usage history cleared');
  }

  /**
   * 设置内存限制
   */
  setMemoryLimit(limitMB: number): void {
    const newLimit = limitMB * 1024 * 1024;
    if (newLimit > 0) {
      this.memoryLimit = newLimit;
      this.memoryMonitor.setMemoryLimit?.(limitMB);
      this.logger?.info(`Memory limit updated to ${limitMB}MB`);
    }
  }

  /**
   * 清理TreeSitter缓存（遗留方法）
   * @deprecated 将由CleanupManager处理
   */
  private cleanupTreeSitterCache(): void {
    try {
      // 动态导入TreeSitterCoreService以避免循环依赖
      const TreeSitterCoreService = require('../core/parse/TreeSitterCoreService').TreeSitterCoreService;
      if (TreeSitterCoreService && typeof TreeSitterCoreService.getInstance === 'function') {
        TreeSitterCoreService.getInstance().clearCache();
        this.logger?.debug('TreeSitter cache cleared during memory cleanup');
      }
    } catch (error) {
      // 忽略错误，可能是模块不存在或方法不可用
      this.logger?.debug(`Could not clear TreeSitter cache during memory cleanup: ${(error as Error).message}`);
    }
  }

  /**
   * 清理其他缓存（遗留方法）
   * @deprecated 将由CleanupManager处理
   */
  private cleanupOtherCaches(): void {
    try {
      // 清理可能的LRU缓存
      if (typeof global !== 'undefined' && (global as any).LRUCache) {
        if (typeof (global as any).LRUCache.clearAll === 'function') {
          (global as any).LRUCache.clearAll();
          this.logger?.debug('LRU cache cleared during memory cleanup');
        }
      }
    } catch (error) {
      this.logger?.debug(`Could not clear other caches during memory cleanup: ${(error as Error).message}`);
    }
  }

  /**
   * 强制垃圾回收（遗留方法）
   * @deprecated 将由CleanupManager处理
   */
  private forceGarbageCollection(): void {
    try {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
        this.logger?.debug('Forced garbage collection');
      }
    } catch (error) {
      this.logger?.debug(`Could not force garbage collection: ${(error as Error).message}`);
    }
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

  /**
   * 销毁内存监控器
   */
  destroy(): void {
    this.stopMonitoring();
    this.clearHistory();
    this.logger?.info('MemoryGuard destroyed');
  }

  /**
   * 设置CleanupManager（用于动态注入）
   */
  setCleanupManager(cleanupManager: CleanupManager): void {
    this.cleanupManager = cleanupManager;
    this.logger?.info('CleanupManager injected into MemoryGuard');
  }
}