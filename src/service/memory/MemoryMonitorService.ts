import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { TYPES } from '../../types';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { ConfigService } from '../../config/ConfigService';
import {
  IMemoryStatus,
  IMemoryMonitorConfig,
  MemoryCleanupLevel,
  IMemoryMonitorEventListener,
  IMemoryStats,
  IMemoryHistoryItem,
  IMemoryMonitorEvent
} from './interfaces/IMemoryStatus';
import { IMemoryMonitorService } from './interfaces/IMemoryMonitorService';

/**
 * 内存监控和保护服务
 * 监控内存使用情况，在内存压力时执行保护措施
 */
@injectable()
export class MemoryMonitorService implements IMemoryMonitorService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private embeddingCache: EmbeddingCacheService;
  private configService: ConfigService;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private warningThreshold: number = 0.70;
  private criticalThreshold: number = 0.85;
  private emergencyThreshold: number = 0.95;
  private checkInterval: number = 30000;
  private cleanupCooldown: number = 30000;
  private maxHistorySize: number = 100;
  private lastCleanupTime: number = 0;
  private memoryHistory: IMemoryHistoryItem[] = [];
  private memoryLimit?: number; // 可选的内存限制（字节）
  private eventListeners: Map<string, IMemoryMonitorEventListener[]> = new Map();
  private cleanupStats: {
    totalCleanups: number;
    lightweightCleanups: number;
    deepCleanups: number;
    emergencyCleanups: number;
    lastCleanupTime?: Date;
 } = {
    totalCleanups: 0,
    lightweightCleanups: 0,
    deepCleanups: 0,
    emergencyCleanups: 0
  };

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.EmbeddingCacheService) embeddingCache: EmbeddingCacheService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.embeddingCache = embeddingCache;
    this.configService = configService;

    // 延迟初始化，等待配置服务初始化完成
    this.initializeConfig();
  }

  /**
   * 初始化配置
   */
  private initializeConfig(): void {
    try {
      const config = this.configService.getMemoryMonitorConfig();
      
      // 从 ConfigService 获取配置参数
      this.warningThreshold = config.warningThreshold;
      this.criticalThreshold = config.criticalThreshold;
      this.emergencyThreshold = config.emergencyThreshold;
      this.checkInterval = config.checkInterval;
      this.cleanupCooldown = config.cleanupCooldown;
      this.maxHistorySize = config.maxHistorySize;
      
      this.logger.info('Memory monitor configuration loaded from ConfigService', {
        warningThreshold: this.warningThreshold,
        criticalThreshold: this.criticalThreshold,
        emergencyThreshold: this.emergencyThreshold,
        checkInterval: this.checkInterval,
        cleanupCooldown: this.cleanupCooldown,
        maxHistorySize: this.maxHistorySize
      });
    } catch (error) {
      this.logger.warn('Failed to load memory monitor configuration from ConfigService, falling back to environment variables', error);
      
      // 回退到环境变量
      this.warningThreshold = parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '0.70');
      this.criticalThreshold = parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '0.85');
      this.emergencyThreshold = parseFloat(process.env.MEMORY_EMERGENCY_THRESHOLD || '0.95');
      this.checkInterval = parseInt(process.env.MEMORY_CHECK_INTERVAL || '30000');
      this.cleanupCooldown = parseInt(process.env.MEMORY_CLEANUP_COOLDOWN || '30000');
      this.maxHistorySize = parseInt(process.env.MEMORY_HISTORY_SIZE || '100');
    }
    
    this.startMonitoring();
  }

  /**
   * 启动内存监控
   */
  startMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.memoryCheckInterval = setInterval(() => {
      this.internalCheckMemoryUsage();
    }, this.checkInterval);

    this.logger.info('Memory monitoring started', {
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      emergencyThreshold: this.emergencyThreshold,
      checkInterval: this.checkInterval
    });
  }

  /**
   * 检查内存使用情况（内部方法）
   */
 private internalCheckMemoryUsage(): void {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      const rssPercent = memoryUsage.rss / memoryUsage.heapTotal;

      // 记录历史数据
      this.recordMemoryUsage(memoryUsage);

      this.logger.debug('Memory usage check', {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        heapUsedPercent: heapUsedPercent * 100,
        rss: memoryUsage.rss,
        rssPercent: rssPercent * 100,
        external: memoryUsage.external
      });

      // 根据内存使用级别执行相应措施
      if (heapUsedPercent >= this.emergencyThreshold) {
        this.handleEmergencyMemory(memoryUsage, heapUsedPercent);
      } else if (heapUsedPercent >= this.criticalThreshold) {
        this.handleCriticalMemory(memoryUsage, heapUsedPercent);
      } else if (heapUsedPercent >= this.warningThreshold) {
        this.handleWarningMemory(memoryUsage, heapUsedPercent);
      }
    } catch (error) {
      this.logger.error('Error checking memory usage', error);
    }
 }

  /**
   * 记录内存使用情况到历史记录
   */
  private recordMemoryUsage(memoryUsage: NodeJS.MemoryUsage): void {
    const now = new Date();
    this.memoryHistory.push({
      timestamp: now,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external
    });

    // 限制历史记录大小
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
    }
  }

 /**
   * 处理警告级别的内存使用
   */
  private handleWarningMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    const now = Date.now();

    if (now - this.lastCleanupTime < this.cleanupCooldown) {
      return; // 冷却期内跳过
    }

    this.logger.warn('High memory usage detected', {
      heapUsedPercent: heapUsedPercent * 100,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    });

    // 执行轻量级清理
    this.performLightweightCleanup();
    this.lastCleanupTime = now;
  }

  /**
   * 处理严重级别的内存使用
   */
  private handleCriticalMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    const now = Date.now();

    if (now - this.lastCleanupTime < this.cleanupCooldown / 2) {
      return; // 严重情况下减少冷却时间
    }

    this.logger.error('Critical memory usage detected', {
      heapUsedPercent: heapUsedPercent * 100,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    });

    // 执行深度清理
    this.performDeepCleanup();
    this.lastCleanupTime = now;

    // 触发垃圾回收
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 处理紧急级别的内存使用
   */
  private handleEmergencyMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    this.logger.error('EMERGENCY: Memory usage extremely high', {
      heapUsedPercent: heapUsedPercent * 100,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    });

    // 执行紧急清理
    this.performEmergencyCleanup();

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }

    // 记录紧急状态
    this.errorHandler.handleError(
      new Error(`Emergency memory usage: ${heapUsedPercent * 100}%`),
      { component: 'MemoryMonitorService', operation: 'memory_monitor' }
    );
  }

  /**
   * 执行轻量级清理
   */
  private performLightweightCleanup(): void {
    try {
      // 清理嵌入缓存
      this.embeddingCache.forceCleanup();

      // 更新清理统计
      this.cleanupStats.totalCleanups++;
      this.cleanupStats.lightweightCleanups++;
      this.cleanupStats.lastCleanupTime = new Date();

      // 触发清理事件
      this.emitEvent('cleanup', {
        type: 'cleanup',
        timestamp: new Date(),
        memoryStatus: this.getMemoryStatus(),
        details: { level: 'lightweight' }
      });

      this.logger.info('Lightweight cleanup completed');
    } catch (error) {
      this.logger.error('Error during lightweight cleanup', error);
    }
 }

  /**
   * 执行深度清理
   */
  private performDeepCleanup(): void {
    try {
      // 清理嵌入缓存
      this.embeddingCache.forceCleanup();

      // 清理全局缓存（如果有）
      if (global.gc) {
        global.gc();
      }

      // 更新清理统计
      this.cleanupStats.totalCleanups++;
      this.cleanupStats.deepCleanups++;
      this.cleanupStats.lastCleanupTime = new Date();

      // 触发清理事件
      this.emitEvent('cleanup', {
        type: 'cleanup',
        timestamp: new Date(),
        memoryStatus: this.getMemoryStatus(),
        details: { level: 'deep' }
      });

      this.logger.info('Deep cleanup completed');
    } catch (error) {
      this.logger.error('Error during deep cleanup', error);
    }
 }

  /**
   * 执行紧急清理
   */
  private performEmergencyCleanup(): void {
    try {
      // 强制清理嵌入缓存
      this.embeddingCache.forceCleanup();

      // 多次垃圾回收
      for (let i = 0; i < 3; i++) {
        if (global.gc) {
          global.gc();
        }
      }

      // 更新清理统计
      this.cleanupStats.totalCleanups++;
      this.cleanupStats.emergencyCleanups++;
      this.cleanupStats.lastCleanupTime = new Date();

      // 触发清理事件
      this.emitEvent('cleanup', {
        type: 'cleanup',
        timestamp: new Date(),
        memoryStatus: this.getMemoryStatus(),
        details: { level: 'emergency' }
      });

      this.logger.info('Emergency cleanup completed');
    } catch (error) {
      this.logger.error('Error during emergency cleanup', error);
    }
  }

  /**
   * 获取当前内存使用情况
   */
  getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    heapUsedPercent: number;
    rss: number;
    external: number;
  } {
    const memoryUsage = process.memoryUsage();
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      heapUsedPercent: memoryUsage.heapUsed / memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external
    };
 }

  /**
   * 手动触发内存清理
   */
  triggerCleanup(level: 'lightweight' | 'deep' | 'emergency' = 'lightweight'): void {
    switch (level) {
      case 'lightweight':
        this.performLightweightCleanup();
        break;
      case 'deep':
        this.performDeepCleanup();
        break;
      case 'emergency':
        this.performEmergencyCleanup();
        break;
    }
  }

 /**
   * 停止内存监控
   */
  stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
      this.logger.info('Memory monitoring stopped');
    }
  }

 /**
  * 更新配置
  */
 updateConfig(config: {
   warningThreshold?: number;
   criticalThreshold?: number;
   emergencyThreshold?: number;
   checkInterval?: number;
   cleanupCooldown?: number;
   maxHistorySize?: number;
 }): void {
   let needsRestart = false;
   
   if (config.warningThreshold !== undefined) {
     this.warningThreshold = config.warningThreshold;
   }
   if (config.criticalThreshold !== undefined) {
     this.criticalThreshold = config.criticalThreshold;
   }
   if (config.emergencyThreshold !== undefined) {
     this.emergencyThreshold = config.emergencyThreshold;
   }
   if (config.checkInterval !== undefined) {
     this.checkInterval = config.checkInterval;
     needsRestart = true; // 检查间隔变化需要重新启动监控
   }
   if (config.cleanupCooldown !== undefined) {
     this.cleanupCooldown = config.cleanupCooldown;
   }
   if (config.maxHistorySize !== undefined) {
     this.maxHistorySize = config.maxHistorySize;
     // 调整历史记录大小
     if (this.memoryHistory.length > this.maxHistorySize) {
       this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
     }
   }
   
   if (needsRestart) {
     // 重新启动监控
     this.startMonitoring();
   }

   this.logger.info('Memory monitoring configuration updated', config);
 }

 /**
   * 获取当前内存状态
   */
  getMemoryStatus(): IMemoryStatus {
    const memoryUsage = process.memoryUsage();
    const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      heapUsedPercent,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
      isWarning: heapUsedPercent >= this.warningThreshold,
      isCritical: heapUsedPercent >= this.criticalThreshold,
      isEmergency: heapUsedPercent >= this.emergencyThreshold,
      trend: this.calculateMemoryTrend(),
      averageUsage: this.calculateAverageUsage(),
      memoryLimit: this.memoryLimit,
      limitUsagePercent: this.memoryLimit ? (memoryUsage.heapUsed / this.memoryLimit) : undefined,
      timestamp: new Date()
    };
  }

  /**
   * 获取内存统计信息
   */
  getMemoryStats(): IMemoryStats {
    const current = this.getMemoryStatus();
    const peak = this.calculatePeakMemory();
    const average = this.calculateAverageMemoryStats();

    return {
      current,
      history: [...this.memoryHistory],
      peak,
      average,
      cleanup: { ...this.cleanupStats }
    };
  }

 /**
   * 获取内存使用历史
   */
  getMemoryHistory(): IMemoryHistoryItem[] {
    return [...this.memoryHistory];
  }

 /**
   * 清空内存使用历史
   */
  clearHistory(): void {
    this.memoryHistory = [];
    this.logger.debug('Memory usage history cleared');
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

      const isWithinLimit = this.memoryLimit ? heapUsed <= this.memoryLimit : true;
      const usagePercent = this.memoryLimit ? (heapUsed / this.memoryLimit) * 10 : 0;

      // 记录历史数据
      this.recordMemoryUsage(memUsage);

      return {
        isWithinLimit,
        usagePercent,
        heapUsed,
        heapTotal,
        external,
        arrayBuffers
      };
    } catch (error) {
      this.logger.error(`Error checking memory usage: ${error}`);
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
   * 获取当前配置
   * 优先从 ConfigService 获取最新配置，如果不可用则返回本地配置
   */
  getConfig(): IMemoryMonitorConfig {
    try {
      // 尝试从 ConfigService 获取最新配置
      return this.configService.getMemoryMonitorConfig();
    } catch (error) {
      this.logger.debug('Unable to get config from ConfigService, returning local config', error);
      // 回退到本地配置
      return {
        warningThreshold: this.warningThreshold,
        criticalThreshold: this.criticalThreshold,
        emergencyThreshold: this.emergencyThreshold,
        checkInterval: this.checkInterval,
        cleanupCooldown: this.cleanupCooldown,
        maxHistorySize: this.maxHistorySize
      };
    }
  }

  /**
   * 添加内存事件监听器
   */
  addEventListener(event: string, listener: IMemoryMonitorEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
 }

  /**
   * 移除内存事件监听器
   */
  removeEventListener(event: string, listener: IMemoryMonitorEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 强制垃圾回收
   */
  forceGarbageCollection(): void {
    try {
      if (global.gc) {
        global.gc();
        this.logger.debug('Forced garbage collection');
      }
    } catch (error) {
      this.logger.error('Error forcing garbage collection', error);
    }
 }

  /**
   * 优化内存使用
   */
  optimizeMemory(): void {
    try {
      // 强制垃圾回收
      this.forceGarbageCollection();
      
      // 清理历史记录
      if (this.memoryHistory.length > 50) {
        this.memoryHistory = this.memoryHistory.slice(-50);
        this.logger.debug('Cleared old memory usage records during optimization');
      }
      
      this.logger.info('Memory optimization completed');
    } catch (error) {
      this.logger.error('Error optimizing memory', error);
    }
  }

  /**
   * 设置内存限制（适用于MemoryGuard场景）
   */
  setMemoryLimit(limitMB: number): void {
    this.memoryLimit = limitMB * 1024 * 1024;
    this.logger.info(`Memory limit set to ${limitMB}MB`);
  }

  /**
   * 获取内存限制（适用于MemoryGuard场景）
   */
  getMemoryLimit(): number | undefined {
    return this.memoryLimit;
  }

  /**
   * 检查是否在限制范围内（适用于MemoryGuard场景）
   */
  isWithinLimit(): boolean {
    if (!this.memoryLimit) {
      return true; // 如果没有设置限制，默认在范围内
    }
    
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed <= this.memoryLimit;
  }

  /**
   * 销毁服务，清理所有资源
   */
  destroy(): void {
    this.stopMonitoring();
    this.clearHistory();
    this.eventListeners.clear();
    this.logger.info('MemoryMonitorService destroyed');
  }

  /**
   * 触发事件
   */
  private emitEvent(eventType: string, event: IMemoryMonitorEvent): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          this.logger.error(`Error in memory event listener for ${eventType}`, error);
        }
      });
    }
  }

  /**
   * 计算内存趋势
   */
  private calculateMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.memoryHistory.length < 3) {
      return 'stable';
    }

    const recent = this.memoryHistory.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const diff = last.heapUsed - first.heapUsed;
    const threshold = this.maxHistorySize * 0.05; // 5%的阈值

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
   * 计算峰值内存使用
   */
 private calculatePeakMemory(): {
    heapUsed: number;
    heapUsedPercent: number;
    timestamp: Date;
  } {
    if (this.memoryHistory.length === 0) {
      const current = process.memoryUsage();
      return {
        heapUsed: current.heapUsed,
        heapUsedPercent: current.heapUsed / current.heapTotal,
        timestamp: new Date()
      };
    }

    const peak = this.memoryHistory.reduce((max, entry) => 
      entry.heapUsed > max.heapUsed ? entry : max,
      this.memoryHistory[0]
    );

    return {
      heapUsed: peak.heapUsed,
      heapUsedPercent: peak.heapUsed / peak.heapTotal,
      timestamp: peak.timestamp
    };
  }

  /**
   * 计算平均内存统计
   */
  private calculateAverageMemoryStats(): {
    heapUsed: number;
    heapUsedPercent: number;
  } {
    if (this.memoryHistory.length === 0) {
      return { heapUsed: 0, heapUsedPercent: 0 };
    }

    const totalHeapUsed = this.memoryHistory.reduce((sum, entry) => sum + entry.heapUsed, 0);
    const totalHeapTotal = this.memoryHistory.reduce((sum, entry) => sum + entry.heapTotal, 0);
    
    return {
      heapUsed: totalHeapUsed / this.memoryHistory.length,
      heapUsedPercent: (totalHeapUsed / totalHeapTotal)
    };
  }
}