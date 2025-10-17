import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { IMemoryMonitorService } from '../../memory/interfaces/IMemoryMonitorService';
import { ErrorThresholdManager } from '../universal/ErrorThresholdManager';
import { CleanupManager } from '../../../infrastructure/cleanup/CleanupManager';
import { IProcessingStrategySelector } from '../universal/coordination/interfaces/IProcessingStrategySelector';
import { IFileProcessingCoordinator } from '../universal/coordination/interfaces/IFileProcessingCoordinator';
import {
  IUnifiedGuardCoordinator,
  MemoryStatus,
  MemoryStats,
  MemoryHistory,
  FileProcessingResult,
  GuardStatus
} from './IUnifiedGuardCoordinator';
import { ICleanupContext } from '../../../infrastructure/cleanup/ICleanupStrategy';

/**
 * 统一的保护机制协调器
 * 合并 MemoryGuard 和 ProcessingGuard 的功能，提供统一的保护机制协调服务
 */
@injectable()
export class UnifiedGuardCoordinator implements IUnifiedGuardCoordinator {
  private static instance: UnifiedGuardCoordinator;

  // 核心依赖组件
  private memoryMonitor: IMemoryMonitorService;
  private errorThresholdManager: ErrorThresholdManager;
  private cleanupManager: CleanupManager;
  private processingStrategySelector: IProcessingStrategySelector;
  private fileProcessingCoordinator: IFileProcessingCoordinator;

  // 配置参数
  private memoryLimitMB: number;
  private memoryCheckIntervalMs: number;
  private logger?: LoggerService;
  private isInitialized: boolean = false;
  private isMonitoring: boolean = false;
  private memoryCheckTimer?: NodeJS.Timeout;

  /**
   * 私有构造函数 - 强制使用单例模式
   */
  private constructor(
    memoryMonitor: IMemoryMonitorService,
    errorThresholdManager: ErrorThresholdManager,
    cleanupManager: CleanupManager,
    processingStrategySelector: IProcessingStrategySelector,
    fileProcessingCoordinator: IFileProcessingCoordinator,
    memoryLimitMB: number = 500,
    memoryCheckIntervalMs: number = 5000,
    logger?: LoggerService
  ) {
    this.memoryMonitor = memoryMonitor;
    this.errorThresholdManager = errorThresholdManager;
    this.cleanupManager = cleanupManager;
    this.processingStrategySelector = processingStrategySelector;
    this.fileProcessingCoordinator = fileProcessingCoordinator;
    this.memoryLimitMB = memoryLimitMB;
    this.memoryCheckIntervalMs = memoryCheckIntervalMs;
    this.logger = logger;

    // 初始化内部状态
    this.initializeInternal();
  }

  /**
   * 静态工厂方法 - 单例模式
   */
  public static getInstance(
    memoryMonitor: IMemoryMonitorService,
    errorThresholdManager: ErrorThresholdManager,
    cleanupManager: CleanupManager,
    processingStrategySelector: IProcessingStrategySelector,
    fileProcessingCoordinator: IFileProcessingCoordinator,
    memoryLimitMB: number = 500,
    memoryCheckIntervalMs: number = 5000,
    logger?: LoggerService
  ): UnifiedGuardCoordinator {
    if (!UnifiedGuardCoordinator.instance) {
      UnifiedGuardCoordinator.instance = new UnifiedGuardCoordinator(
        memoryMonitor,
        errorThresholdManager,
        cleanupManager,
        processingStrategySelector,
        fileProcessingCoordinator,
        memoryLimitMB,
        memoryCheckIntervalMs,
        logger
      );
    }
    return UnifiedGuardCoordinator.instance;
  }

  /**
   * 内部初始化
   */
  private initializeInternal(): void {
    // 设置内存限制
    this.memoryMonitor.setMemoryLimit?.(this.memoryLimitMB);

    // 设置事件处理器
    this.setupEventHandlers();

    this.logger?.info('UnifiedGuardCoordinator initialized successfully');
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 统一处理内存压力事件
    if (typeof process !== 'undefined' && process.on) {
      process.on('memoryPressure', this.handleMemoryPressure.bind(this));
    }
  }

  /**
   * 处理内存压力事件
   */
  private handleMemoryPressure(event: any): void {
    this.logger?.warn('Memory pressure detected', event);

    // 统一清理逻辑
    this.forceCleanup().catch(error => {
      this.logger?.error(`Failed to handle memory pressure: ${error}`);
    });

    // 记录错误
    this.recordError(
      new Error('Memory pressure detected'),
      'memory-pressure'
    );
  }

  // 生命周期管理
  public initialize(): void {
    if (this.isInitialized) {
      this.logger?.warn('UnifiedGuardCoordinator is already initialized');
      return;
    }

    try {
      // 启动内存监控
      this.startMonitoring();

      this.isInitialized = true;
      this.logger?.info('UnifiedGuardCoordinator initialized successfully');
    } catch (error) {
      this.logger?.error(`Failed to initialize UnifiedGuardCoordinator: ${error}`);
      throw error;
    }
  }

  public destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      // 停止内存监控
      this.stopMonitoring();

      // 移除事件监听器
      if (typeof process !== 'undefined' && process.removeListener) {
        process.removeListener('memoryPressure', this.handleMemoryPressure.bind(this));
      }

      this.isInitialized = false;
      this.logger?.info('UnifiedGuardCoordinator destroyed');
    } catch (error) {
      this.logger?.error(`Error during UnifiedGuardCoordinator destruction: ${error}`);
    }
  }

  public reset(): void {
    this.errorThresholdManager.resetCounter();
    this.clearHistory();
    this.logger?.info('UnifiedGuardCoordinator reset completed');
  }

  // 内存保护功能
  public startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger?.warn('Memory monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    this.memoryCheckTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.memoryCheckIntervalMs);

    this.logger?.info(`Memory monitoring started (limit: ${this.memoryLimitMB}MB, interval: ${this.memoryCheckIntervalMs}ms)`);
  }

  public stopMonitoring(): void {
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

  public checkMemoryUsage(): MemoryStatus {
    try {
      // 使用统一的内存监控服务获取内存状态
      const memoryStatus = this.memoryMonitor.getMemoryStatus();
      const heapUsed = memoryStatus.heapUsed;
      const heapTotal = memoryStatus.heapTotal;
      const external = memoryStatus.external;
      const memUsage = process.memoryUsage();
      const arrayBuffers = memUsage.arrayBuffers || 0;

      const memoryLimitBytes = this.memoryLimitMB * 1024 * 1024;
      const isWithinLimit = heapUsed <= memoryLimitBytes;
      const usagePercent = (heapUsed / memoryLimitBytes) * 100;

      // 内存超限处理
      if (!isWithinLimit) {
        this.logger?.warn(`Memory usage exceeds limit: ${this.formatBytes(heapUsed)} > ${this.formatBytes(memoryLimitBytes)} (${usagePercent.toFixed(1)}%)`);

        // 触发统一清理
        this.forceCleanup().catch(error => {
          this.logger?.error(`Cleanup failed during memory check: ${error}`);
        });

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
      return this.getDefaultMemoryStatus();
    }
  }

  public async forceCleanup(): Promise<void> {
    try {
      this.logger?.info('Performing unified memory cleanup...');

      if (this.cleanupManager) {
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

        const result = await this.cleanupManager.performCleanup(cleanupContext);

        if (result.success) {
          this.logger?.info(`Cleanup completed successfully, freed ${this.formatBytes(result.memoryFreed)} bytes, cleaned caches: ${result.cleanedCaches.join(', ')}`);

          // 记录清理后的内存使用情况
          const afterCleanup = this.checkMemoryUsage();
          this.logger?.info(`Memory cleanup completed. Current usage: ${this.formatBytes(afterCleanup.heapUsed)} (${afterCleanup.usagePercent.toFixed(1)}%)`);
        } else {
          this.logger?.error(`Cleanup failed: ${result.error?.message}`);
        }
      } else {
        this.logger?.warn('CleanupManager not available, cleanup skipped');
      }
    } catch (error) {
      this.logger?.error(`Error during unified cleanup: ${error}`);
    }
  }

  public gracefulDegradation(): void {
    this.logger?.warn('Initiating graceful degradation due to memory pressure...');

    // 这里可以触发降级处理的回调或事件
    // 实际实现中可能需要与错误阈值管理器协调
    if (typeof process !== 'undefined' && process.emit) {
      (process.emit as any)('memoryPressure', {
        type: 'graceful-degradation',
        memoryUsage: process.memoryUsage(),
        limit: this.memoryLimitMB * 1024 * 1024
      });
    }

    // 强制垃圾回收
    this.forceGarbageCollection();
  }

  public getMemoryStats(): MemoryStats {
    const current = process.memoryUsage();
    const memoryLimitBytes = this.memoryLimitMB * 1024 * 1024;
    const usagePercent = (current.heapUsed / memoryLimitBytes) * 100;
    const isWithinLimit = current.heapUsed <= memoryLimitBytes;

    // 使用统一的内存监控服务获取趋势和平均值
    const memoryStatus = this.memoryMonitor.getMemoryStatus();
    const trend = memoryStatus.trend;
    const averageUsage = memoryStatus.averageUsage;

    return {
      current,
      limit: memoryLimitBytes,
      usagePercent,
      isWithinLimit,
      trend,
      averageUsage
    };
  }

  public getMemoryHistory(): MemoryHistory[] {
    // 使用统一的内存监控服务获取历史记录
    const history = this.memoryMonitor.getMemoryHistory();
    return history.map(item => ({
      timestamp: item.timestamp.getTime(),
      heapUsed: item.heapUsed,
      heapTotal: item.heapTotal
    }));
  }

  public clearHistory(): void {
    // 使用统一的内存监控服务清空历史记录
    this.memoryMonitor.clearHistory();
    this.logger?.debug('Memory usage history cleared');
  }

  public setMemoryLimit(limitMB: number): void {
    if (limitMB > 0) {
      this.memoryLimitMB = limitMB;
      this.memoryMonitor.setMemoryLimit?.(limitMB);
      this.logger?.info(`Memory limit updated to ${limitMB}MB`);
    }
  }

  public forceGarbageCollection(): void {
    try {
      // 使用统一的内存监控服务进行垃圾回收
      this.memoryMonitor.forceGarbageCollection();
      this.logger?.debug('Forced garbage collection');
    } catch (error) {
      this.logger?.debug(`Could not force garbage collection: ${(error as Error).message}`);
    }
  }

  // 错误保护功能
  public shouldUseFallback(): boolean {
    return this.errorThresholdManager.shouldUseFallback();
  }

  public recordError(error: Error, context?: string): void {
    this.errorThresholdManager.recordError(error, context);
  }

  // 文件处理协调
  public async processFile(filePath: string, content: string): Promise<FileProcessingResult> {
    try {
      // 1. 检查内存状态
      const memoryStatus = this.checkMemoryUsage();
      if (!memoryStatus.isWithinLimit) {
        const memoryLimitBytes = this.memoryLimitMB * 1024 * 1024;
        this.logger?.warn(`Memory limit exceeded before processing: ${memoryStatus.heapUsed} > ${memoryLimitBytes}`);

        const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(
          filePath,
          content,
          'Memory limit exceeded'
        );

        return {
          chunks: fallbackResult.chunks,
          language: 'text',
          processingStrategy: fallbackResult.fallbackStrategy,
          fallbackReason: fallbackResult.reason
        };
      }

      // 2. 检查错误阈值
      if (this.errorThresholdManager.shouldUseFallback()) {
        this.logger?.warn('Error threshold reached, using fallback processing');

        const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(
          filePath,
          content,
          'Error threshold exceeded'
        );

        return {
          chunks: fallbackResult.chunks,
          language: 'text',
          processingStrategy: fallbackResult.fallbackStrategy,
          fallbackReason: fallbackResult.reason
        };
      }

      // 3. 使用专门的策略选择器进行语言检测和策略选择
      const languageInfo = await this.processingStrategySelector.detectLanguageIntelligently(filePath, content);
      const strategyContext = {
        filePath,
        content,
        languageInfo,
        timestamp: new Date()
      };

      const strategy = await this.processingStrategySelector.selectProcessingStrategy(strategyContext);

      // 4. 使用专门的文件处理协调器执行处理
      const context = {
        filePath,
        content,
        strategy,
        language: languageInfo.language,
        timestamp: new Date()
      };

      const result = await this.fileProcessingCoordinator.processFile(context);

      return {
        chunks: result.chunks,
        language: languageInfo.language,
        processingStrategy: result.processingStrategy,
        fallbackReason: result.metadata?.fallbackReason
      };
    } catch (error) {
      this.logger?.error(`Error in unified file processing: ${error}`);
      this.errorThresholdManager.recordError(error as Error, `processFile: ${filePath}`);

      const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(
        filePath,
        content,
        `Processing error: ${(error as Error).message}`
      );

      return {
        chunks: fallbackResult.chunks,
        language: 'text',
        processingStrategy: fallbackResult.fallbackStrategy,
        fallbackReason: fallbackResult.reason
      };
    }
  }

  // 状态查询
  public getStatus(): GuardStatus {
    const errorThresholdStatus = this.errorThresholdManager.getStatus();
    const memoryStats = this.getMemoryStats();

    return {
      errorThreshold: {
        errorCount: errorThresholdStatus.errorCount,
        maxErrors: errorThresholdStatus.maxErrors,
        shouldUseFallback: errorThresholdStatus.shouldUseFallback,
        resetInterval: this.errorThresholdManager.getStatus().timeUntilReset
      },
      memoryGuard: memoryStats,
      isInitialized: this.isInitialized,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * 获取默认内存状态
   */
  private getDefaultMemoryStatus(): MemoryStatus {
    return {
      isWithinLimit: true,
      usagePercent: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
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