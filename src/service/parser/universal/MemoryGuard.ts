import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';

/**
 * 内存监控和保护机制
 * 负责监控内存使用情况，在达到限制时触发清理或降级处理
 */
@injectable()
export class MemoryGuard {
  private memoryLimit: number;
  private readonly checkInterval: number;
  private memoryCheckTimer?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  private logger?: LoggerService;
  private memoryHistory: Array<{ timestamp: number; heapUsed: number; heapTotal: number }> = [];
  private maxHistorySize: number = 100;

  constructor(
    @inject(TYPES.MemoryLimitMB) memoryLimitMB: number = 500,
    @inject(TYPES.MemoryCheckIntervalMs) checkIntervalMs: number = 5000,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.memoryLimit = memoryLimitMB * 1024 * 1024; // 转换为字节
    this.checkInterval = checkIntervalMs;
    this.logger = logger;
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
      const memUsage = process.memoryUsage();
      const heapUsed = memUsage.heapUsed;
      const heapTotal = memUsage.heapTotal;
      const external = memUsage.external;
      const arrayBuffers = memUsage.arrayBuffers || 0;

      const isWithinLimit = heapUsed <= this.memoryLimit;
      const usagePercent = (heapUsed / this.memoryLimit) * 100;

      // 记录历史数据
      this.recordMemoryUsage(heapUsed, heapTotal);

      // 如果内存使用过高，记录警告
      if (!isWithinLimit) {
        this.logger?.warn(`Memory usage exceeds limit: ${this.formatBytes(heapUsed)} > ${this.formatBytes(this.memoryLimit)} (${usagePercent.toFixed(1)}%)`);

        // 触发清理
        this.forceCleanup();

        // 如果仍然超过限制，触发降级处理
        if (this.checkMemoryUsage().heapUsed > this.memoryLimit) {
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
   */
  forceCleanup(): void {
    try {
      this.logger?.info('Performing forced memory cleanup...');

      // 清理TreeSitter缓存
      this.cleanupTreeSitterCache();

      // 清理其他缓存
      this.cleanupOtherCaches();

      // 强制垃圾回收
      this.forceGarbageCollection();

      // 记录清理后的内存使用情况
      const afterCleanup = this.checkMemoryUsage();
      this.logger?.info(`Memory cleanup completed. Current usage: ${this.formatBytes(afterCleanup.heapUsed)} (${afterCleanup.usagePercent.toFixed(1)}%)`);
    } catch (error) {
      this.logger?.error(`Error during memory cleanup: ${error}`);
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
    const trend = this.calculateMemoryTrend();
    const averageUsage = this.calculateAverageUsage();

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
    return [...this.memoryHistory];
  }

  /**
   * 清空内存使用历史
   */
  clearHistory(): void {
    this.memoryHistory = [];
    this.logger?.debug('Memory usage history cleared');
  }

  /**
   * 设置内存限制
   */
  setMemoryLimit(limitMB: number): void {
    const newLimit = limitMB * 1024 * 1024;
    if (newLimit > 0) {
      this.memoryLimit = newLimit;
      this.logger?.info(`Memory limit updated to ${limitMB}MB`);
    }
  }

  /**
   * 记录内存使用情况
   */
  private recordMemoryUsage(heapUsed: number, heapTotal: number): void {
    const now = Date.now();
    this.memoryHistory.push({
      timestamp: now,
      heapUsed,
      heapTotal
    });

    // 限制历史记录大小
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 计算内存使用趋势
   */
  private calculateMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.memoryHistory.length < 3) {
      return 'stable';
    }

    const recent = this.memoryHistory.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const diff = last.heapUsed - first.heapUsed;
    const threshold = this.memoryLimit * 0.05; // 5%的阈值

    if (diff > threshold) {
      return 'increasing';
    } else if (diff < -threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * 计算平均内存使用量
   */
  private calculateAverageUsage(): number {
    if (this.memoryHistory.length === 0) {
      return 0;
    }

    const total = this.memoryHistory.reduce((sum, entry) => sum + entry.heapUsed, 0);
    return total / this.memoryHistory.length;
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
        this.logger?.debug('TreeSitter cache cleared during memory cleanup');
      }
    } catch (error) {
      // 忽略错误，可能是模块不存在或方法不可用
      this.logger?.debug(`Could not clear TreeSitter cache during memory cleanup: ${(error as Error).message}`);
    }
  }

  /**
   * 清理其他缓存
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
   * 强制垃圾回收
   */
  private forceGarbageCollection(): void {
    try {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
        this.logger?.debug('Forced garbage collection during memory cleanup');
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
}