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
  private enabled: boolean = true;
  private warningThreshold: number = 0.90;
  private criticalThreshold: number = 0.94;
  private emergencyThreshold: number = 0.98;
  private checkInterval: number = 30000;
  private cleanupCooldown: number = 60000; // 增加冷却时间，减少清理频率
  private maxHistorySize: number = 100;
  private lastCleanupTime: number = 0;
  private memoryHistory: IMemoryHistoryItem[] = [];
  private memoryLimit?: number; // 可选的内存限制（字节）
  private eventListeners: Map<string, IMemoryMonitorEventListener[]> = new Map();

  // 性能优化相关属性
  private lastMemoryCheck: number = 0;
  private adaptiveCheckInterval: number = 30000;
  private lowMemoryThreshold: number = 0.70; // 低内存使用阈值
  private isLowMemoryMode: boolean = false;
  private consecutiveLowMemoryChecks: number = 0;
  private maxConsecutiveLowChecks: number = 5; // 连续低内存检查次数

  // 新增监控指标相关属性
  private lastHeapUsed: number = 0;
  private lastMemoryCheckTime: number = 0;
  private gcEvents: number = 0;
  private lastGcTime: number = 0;
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
      const config = this.configService.get('memoryMonitor');

      // 从 ConfigService 获取配置参数
      this.enabled = config.enabled;
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
      this.enabled = process.env.MEMORY_MONITORING_ENABLED !== 'false';
      this.warningThreshold = parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '0.90');
      this.criticalThreshold = parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '0.94');
      this.emergencyThreshold = parseFloat(process.env.MEMORY_EMERGENCY_THRESHOLD || '0.98');
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
    if (!this.enabled) {
      this.logger.info('Memory monitoring is disabled via configuration');
      return;
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.memoryCheckInterval = setInterval(() => {
      this.internalCheckMemoryUsage();
    }, this.checkInterval);

    this.logger.info('Memory monitoring started', {
      enabled: this.enabled,
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
    if (!this.enabled) {
      return; // 如果监控被禁用，则不执行任何操作
    }

    const now = Date.now();

    // 性能优化：自适应检查间隔
    if (now - this.lastMemoryCheck < this.adaptiveCheckInterval) {
      return; // 跳过过于频繁的检查
    }

    this.lastMemoryCheck = now;

    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      const rssPercent = memoryUsage.rss / memoryUsage.heapTotal;

      // 性能优化：自适应检查间隔调整
      this.adjustAdaptiveCheckInterval(heapUsedPercent);

      // 性能优化：只在必要时记录历史数据
      if (this.shouldRecordHistory(heapUsedPercent)) {
        this.recordMemoryUsage(memoryUsage);
      }

      // 性能优化：减少调试日志频率
      if (heapUsedPercent >= this.warningThreshold || this.consecutiveLowMemoryChecks % 10 === 0) {
        this.logger.debug('Memory usage check', {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          heapUsedPercent: heapUsedPercent * 100,
          rss: memoryUsage.rss,
          rssPercent: rssPercent * 100,
          external: memoryUsage.external,
          adaptiveInterval: this.adaptiveCheckInterval,
          isLowMemoryMode: this.isLowMemoryMode
        });
      }

      // 根据内存使用级别执行相应措施
      if (heapUsedPercent >= this.emergencyThreshold) {
        this.handleEmergencyMemory(memoryUsage, heapUsedPercent);
      } else if (heapUsedPercent >= this.criticalThreshold) {
        this.handleCriticalMemory(memoryUsage, heapUsedPercent);
      } else if (heapUsedPercent >= this.warningThreshold) {
        this.handleWarningMemory(memoryUsage, heapUsedPercent);
      } else {
        // 低内存使用模式处理
        this.handleLowMemoryUsage(heapUsedPercent);
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
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers || 0
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
    if (!this.enabled) {
      return; // 如果监控被禁用，则不执行任何操作
    }

    const now = Date.now();

    if (now - this.lastCleanupTime < this.cleanupCooldown) {
      return; // 冷却期内跳过
    }

    this.logger.warn('High memory usage detected', {
      heapUsedPercent: heapUsedPercent * 100,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    });

    // 触发内存压力事件
    this.emitEvent('pressure', {
      type: 'pressure',
      timestamp: new Date(),
      memoryStatus: this.getMemoryStatus(),
      details: { level: 'warning' }
    });

    // 在开发环境中，警告级别只执行最轻量的清理
    this.forceGarbageCollection();
    this.lastCleanupTime = now;
  }

  /**
   * 处理严重级别的内存使用
   */
  private handleCriticalMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    if (!this.enabled) {
      return; // 如果监控被禁用，则不执行任何操作
    }

    const now = Date.now();

    if (now - this.lastCleanupTime < this.cleanupCooldown / 2) {
      return; // 严重情况下减少冷却时间
    }

    this.logger.error('Critical memory usage detected', {
      heapUsedPercent: heapUsedPercent * 100,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    });

    // 触发内存压力事件
    this.emitEvent('pressure', {
      type: 'pressure',
      timestamp: new Date(),
      memoryStatus: this.getMemoryStatus(),
      details: { level: 'critical' }
    });

    // 在开发环境中，严重级别执行轻量级清理和垃圾回收
    this.performLightweightCleanup();
    this.forceGarbageCollection();
    this.lastCleanupTime = now;
  }

  /**
   * 处理紧急级别的内存使用
   */
  private handleEmergencyMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    if (!this.enabled) {
      return; // 如果监控被禁用，则不执行任何操作
    }

    this.logger.error('EMERGENCY: Memory usage extremely high', {
      heapUsedPercent: heapUsedPercent * 100,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    });

    // 触发内存压力事件
    this.emitEvent('pressure', {
      type: 'pressure',
      timestamp: new Date(),
      memoryStatus: this.getMemoryStatus(),
      details: { level: 'emergency' }
    });

    // 在开发环境中，紧急级别执行深度清理和多次垃圾回收
    this.performDeepCleanup();

    // 执行多次垃圾回收，但限制次数以避免过度占用资源
    for (let i = 0; i < 2; i++) {
      if (global.gc) {
        global.gc();
      }
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
    if (!this.enabled) {
      this.logger.info('Memory monitoring is disabled, skipping cleanup trigger');
      return;
    }

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
    enabled?: boolean;
    warningThreshold?: number;
    criticalThreshold?: number;
    emergencyThreshold?: number;
    checkInterval?: number;
    cleanupCooldown?: number;
    maxHistorySize?: number;
  }): void {
    let needsRestart = false;

    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
      needsRestart = true; // 启用状态变化需要重新启动监控
    }
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
    const now = Date.now();

    // 计算新增的监控指标
    const rssPercent = memoryUsage.rss / memoryUsage.heapTotal;
    const externalPercent = memoryUsage.external / memoryUsage.heapTotal;
    const arrayBuffers = memoryUsage.arrayBuffers || 0;
    const arrayBuffersPercent = arrayBuffers / memoryUsage.heapTotal;

    // 计算增长率
    const growthRate = this.calculateGrowthRate(memoryUsage.heapUsed, now);

    // 计算健康评分
    const healthScore = this.calculateHealthScore(heapUsedPercent, growthRate);

    // 确定压力等级
    const pressureLevel = this.determinePressureLevel(heapUsedPercent, healthScore);

    // 计算预计达到限制的时间
    const timeToLimit = this.calculateTimeToLimit(heapUsedPercent, growthRate);

    // 计算垃圾回收效率
    const gcEfficiency = this.calculateGcEfficiency();

    // 计算内存碎片化程度
    const fragmentationLevel = this.calculateFragmentationLevel(memoryUsage);

    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      heapUsedPercent,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
      arrayBuffers,
      isWarning: heapUsedPercent >= this.warningThreshold,
      isCritical: heapUsedPercent >= this.criticalThreshold,
      isEmergency: heapUsedPercent >= this.emergencyThreshold,
      trend: this.calculateMemoryTrend(),
      averageUsage: this.calculateAverageUsage(),
      memoryLimit: this.memoryLimit,
      limitUsagePercent: this.memoryLimit ? (memoryUsage.heapUsed / this.memoryLimit) : undefined,
      timestamp: new Date(),

      // 新增监控指标
      rssPercent,
      externalPercent,
      arrayBuffersPercent,
      growthRate,
      timeToLimit,
      healthScore,
      pressureLevel,
      gcEfficiency,
      fragmentationLevel
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
      return this.configService.get('memoryMonitor');
    } catch (error) {
      this.logger.debug('Unable to get config from ConfigService, returning local config', error);
      // 回退到本地配置
      return {
        enabled: this.enabled,
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

  /**
   * 调整自适应检查间隔
   */
  private adjustAdaptiveCheckInterval(heapUsedPercent: number): void {
    if (heapUsedPercent < this.lowMemoryThreshold) {
      // 低内存使用模式，增加检查间隔
      this.consecutiveLowMemoryChecks++;

      if (this.consecutiveLowMemoryChecks >= this.maxConsecutiveLowChecks) {
        this.isLowMemoryMode = true;
        this.adaptiveCheckInterval = Math.min(this.checkInterval * 3, 60000); // 最多3倍间隔，不超过60秒
      }
    } else {
      // 内存使用较高，恢复正常检查间隔
      this.consecutiveLowMemoryChecks = 0;
      this.isLowMemoryMode = false;
      this.adaptiveCheckInterval = this.checkInterval;
    }
  }

  /**
   * 判断是否应该记录历史数据
   */
  private shouldRecordHistory(heapUsedPercent: number): boolean {
    // 在低内存模式下，减少历史记录频率
    if (this.isLowMemoryMode) {
      return this.consecutiveLowMemoryChecks % 5 === 0; // 每5次检查记录一次
    }

    // 正常模式下，如果内存使用率较高，增加记录频率
    if (heapUsedPercent >= this.warningThreshold) {
      return true; // 每次都记录
    }

    // 默认记录策略
    return this.consecutiveLowMemoryChecks % 2 === 0; // 每2次检查记录一次
  }

  /**
   * 处理低内存使用情况
   */
  private handleLowMemoryUsage(heapUsedPercent: number): void {
    // 在低内存模式下，可以执行一些优化操作
    if (this.isLowMemoryMode && this.consecutiveLowMemoryChecks % 20 === 0) {
      // 每20次检查执行一次轻量级优化
      this.optimizeMemory();
    }
  }

  /**
   * 计算内存增长率
   */
  private calculateGrowthRate(currentHeapUsed: number, currentTime: number): number {
    if (this.lastHeapUsed === 0 || this.lastMemoryCheckTime === 0) {
      this.lastHeapUsed = currentHeapUsed;
      this.lastMemoryCheckTime = currentTime;
      return 0;
    }

    const timeDiff = (currentTime - this.lastMemoryCheckTime) / 1000; // 转换为秒
    const memoryDiff = currentHeapUsed - this.lastHeapUsed;
    const growthRate = timeDiff > 0 ? memoryDiff / timeDiff : 0;

    this.lastHeapUsed = currentHeapUsed;
    this.lastMemoryCheckTime = currentTime;

    return growthRate;
  }

  /**
   * 计算内存健康评分（简化版）
   */
  private calculateHealthScore(heapUsedPercent: number, growthRate: number): number {
    let score = 100;

    // 简化的内存使用率评分
    if (heapUsedPercent > 0.9) {
      score -= 30;
    } else if (heapUsedPercent > 0.8) {
      score -= 15;
    } else if (heapUsedPercent > 0.7) {
      score -= 5;
    }

    // 简化的增长率评分
    const growthRateMB = Math.abs(growthRate) / (1024 * 1024); // 转换为MB/秒
    if (growthRateMB > 5) {
      score -= 10;
    } else if (growthRateMB > 2) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 确定内存压力等级
   */
  private determinePressureLevel(heapUsedPercent: number, healthScore: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (heapUsedPercent >= this.emergencyThreshold || healthScore < 30) {
      return 'critical';
    } else if (heapUsedPercent >= this.criticalThreshold || healthScore < 50) {
      return 'high';
    } else if (heapUsedPercent >= this.warningThreshold || healthScore < 70) {
      return 'moderate';
    } else {
      return 'low';
    }
  }

  /**
   * 计算预计达到限制的时间
   */
  private calculateTimeToLimit(heapUsedPercent: number, growthRate: number): number | undefined {
    if (!this.memoryLimit || growthRate <= 0) {
      return undefined;
    }

    const currentUsage = heapUsedPercent * this.memoryLimit;
    const remainingMemory = this.memoryLimit - currentUsage;

    if (remainingMemory <= 0) {
      return 0;
    }

    return remainingMemory / growthRate; // 返回秒数
  }

  /**
   * 计算垃圾回收效率
   */
  private calculateGcEfficiency(): number | undefined {
    // 简化实现，基于清理统计计算
    if (this.cleanupStats.totalCleanups === 0) {
      return undefined;
    }

    const successRate = (this.cleanupStats.lightweightCleanups + this.cleanupStats.deepCleanups) / this.cleanupStats.totalCleanups;
    return Math.max(0, Math.min(1, successRate));
  }

  /**
   * 计算内存碎片化程度（简化版）
   */
  private calculateFragmentationLevel(memoryUsage: NodeJS.MemoryUsage): number {
    // 简化实现：仅基于外部内存与堆内存的比例
    const heapUsed = memoryUsage.heapUsed;
    const external = memoryUsage.external;

    if (heapUsed === 0) return 0;

    // 简单的外部内存比例
    const externalRatio = external / heapUsed;

    return Math.max(0, Math.min(1, externalRatio * 0.5)); // 降低影响权重
  }
}