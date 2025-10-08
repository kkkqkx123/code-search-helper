import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { TYPES } from '../../types';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { ConfigService } from '../../config/ConfigService';

/**
 * 内存监控和保护服务
 * 监控内存使用情况，在内存压力时执行保护措施
 */
@injectable()
export class MemoryMonitorService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private embeddingCache: EmbeddingCacheService;
  private configService: ConfigService;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private warningThreshold: number;
  private criticalThreshold: number;
  private emergencyThreshold: number;
  private checkInterval: number;
  private lastCleanupTime: number = 0;
  private cleanupCooldown: number = 30000; // 30秒冷却时间

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

    // 从配置或环境变量获取阈值
    this.warningThreshold = parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '0.70');
    this.criticalThreshold = parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '0.85');
    this.emergencyThreshold = parseFloat(process.env.MEMORY_EMERGENCY_THRESHOLD || '0.95');
    this.checkInterval = parseInt(process.env.MEMORY_CHECK_INTERVAL || '30000');

    this.startMonitoring();
  }

  /**
   * 启动内存监控
   */
  private startMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);

    this.logger.info('Memory monitoring started', {
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      emergencyThreshold: this.emergencyThreshold,
      checkInterval: this.checkInterval
    });
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      const rssPercent = memoryUsage.rss / memoryUsage.heapTotal;

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
  }): void {
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
      // 重新启动监控
      this.startMonitoring();
    }

    this.logger.info('Memory monitoring configuration updated', config);
  }
}