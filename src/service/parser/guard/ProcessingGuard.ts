import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { ErrorThresholdManager } from '../universal/ErrorThresholdManager';
import { MemoryGuard } from './MemoryGuard';
import { ProcessingStrategySelector } from '../universal/coordination/ProcessingStrategySelector';
import { FileProcessingCoordinator } from '../universal/coordination/FileProcessingCoordinator';
import { IProcessingStrategySelector } from '../universal/coordination/interfaces/IProcessingStrategySelector';
import { IFileProcessingCoordinator } from '../universal/coordination/interfaces/IFileProcessingCoordinator';

/**
 * 处理保护器
 * 整合所有保护机制，提供统一的文件处理接口
 * 重构后：专注于保护和监控职责，业务逻辑已迁移到专门的协调器模块
 */
@injectable()
export class ProcessingGuard {
  private static instance: ProcessingGuard;
  private errorThresholdManager: ErrorThresholdManager;
  private memoryGuard: MemoryGuard;
  private processingStrategySelector: IProcessingStrategySelector;
  private fileProcessingCoordinator: IFileProcessingCoordinator;
  private logger?: LoggerService;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ErrorThresholdManager) errorThresholdManager?: ErrorThresholdManager,
    @inject(TYPES.MemoryGuard) memoryGuard?: MemoryGuard,
    @inject(TYPES.ProcessingStrategySelector) processingStrategySelector?: IProcessingStrategySelector,
    @inject(TYPES.FileProcessingCoordinator) fileProcessingCoordinator?: IFileProcessingCoordinator
  ) {
    this.logger = logger;
    this.errorThresholdManager = errorThresholdManager || new ErrorThresholdManager(logger);

    // 创建默认的内存监控器（简化实现）
    let defaultMemoryGuard: MemoryGuard;
    if (!memoryGuard) {
      const defaultMemoryMonitor: any = {
        getMemoryStatus: () => ({
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsedPercent: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
          rss: process.memoryUsage().rss,
          external: process.memoryUsage().external || 0,
          isWarning: false,
          isCritical: false,
          isEmergency: false,
          trend: 'stable',
          averageUsage: process.memoryUsage().heapUsed,
          timestamp: new Date()
        }),
        forceGarbageCollection: () => {
          if (typeof global !== 'undefined' && global.gc) {
            global.gc();
          }
        },
        triggerCleanup: () => { },
        isWithinLimit: () => true,
        setMemoryLimit: () => { }
      };
      defaultMemoryGuard = new MemoryGuard(defaultMemoryMonitor, 500, 5000, logger || new LoggerService());
    }
    this.memoryGuard = memoryGuard || defaultMemoryGuard!;

    this.processingStrategySelector = processingStrategySelector || new ProcessingStrategySelector(logger);
    this.fileProcessingCoordinator = fileProcessingCoordinator || new FileProcessingCoordinator(logger);
  }

  /**
   * 获取单例实例
   */
  static getInstance(
    logger?: LoggerService,
    errorThresholdManager?: ErrorThresholdManager,
    memoryGuard?: MemoryGuard,
    processingStrategySelector?: IProcessingStrategySelector,
    fileProcessingCoordinator?: IFileProcessingCoordinator
  ): ProcessingGuard {
    if (!ProcessingGuard.instance) {
      ProcessingGuard.instance = new ProcessingGuard(
        logger,
        errorThresholdManager,
        memoryGuard,
        processingStrategySelector,
        fileProcessingCoordinator
      );
    }
    return ProcessingGuard.instance;
  }

  /**
   * 初始化处理保护器
   */
  initialize(): void {
    if (this.isInitialized) {
      this.logger?.warn('ProcessingGuard is already initialized');
      return;
    }

    try {
      // 启动内存监控
      this.memoryGuard.startMonitoring();

      // 监听内存压力事件
      if (typeof process !== 'undefined' && process.on) {
        process.on('memoryPressure', this.handleMemoryPressure.bind(this));
      }

      this.isInitialized = true;
      this.logger?.info('ProcessingGuard initialized successfully');
    } catch (error) {
      this.logger?.error(`Failed to initialize ProcessingGuard: ${error}`);
      throw error;
    }
  }

  /**
   * 销毁处理保护器
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      // 停止内存监控
      this.memoryGuard.destroy();

      // 移除事件监听器
      if (typeof process !== 'undefined' && process.removeListener) {
        process.removeListener('memoryPressure', this.handleMemoryPressure.bind(this));
      }

      this.isInitialized = false;
      this.logger?.info('ProcessingGuard destroyed');
    } catch (error) {
      this.logger?.error(`Error during ProcessingGuard destruction: ${error}`);
    }
  }

  /**
   * 检查是否应该使用降级方案
   */
  shouldUseFallback(): boolean {
    return this.errorThresholdManager.shouldUseFallback();
  }

  /**
   * 记录错误并清理资源
   */
  recordError(error: Error, context?: string): void {
    this.errorThresholdManager.recordError(error, context);
  }

  /**
   * 智能文件处理（保护协调入口）
   * 专注于保护决策，具体业务逻辑委托给专门的协调器
   */
  async processFile(filePath: string, content: string): Promise<{
    chunks: any[];
    language: string;
    processingStrategy: string;
    fallbackReason?: string;
  }> {
    try {
      // 检查内存状态
      const memoryStatus = this.memoryGuard.checkMemoryUsage();
      if (!memoryStatus.isWithinLimit) {
        // 获取内存限制值用于日志
        const memoryLimit = this.memoryGuard.getMemoryStats().limit;
        this.logger?.warn(`Memory limit exceeded before processing: ${memoryStatus.heapUsed} > ${memoryLimit}`);
        const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(filePath, content, 'Memory limit exceeded');
        return {
          chunks: fallbackResult.chunks,
          language: 'text',
          processingStrategy: fallbackResult.fallbackStrategy,
          fallbackReason: fallbackResult.reason
        };
      }

      // 检查错误阈值
      if (this.errorThresholdManager.shouldUseFallback()) {
        this.logger?.warn('Error threshold reached, using fallback processing');
        const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(filePath, content, 'Error threshold exceeded');
        return {
          chunks: fallbackResult.chunks,
          language: 'text',
          processingStrategy: fallbackResult.fallbackStrategy,
          fallbackReason: fallbackResult.reason
        };
      }

      // 使用专门的策略选择器进行语言检测和策略选择
      const languageInfo = await this.processingStrategySelector.detectLanguageIntelligently(filePath, content);
      const strategyContext = {
        filePath,
        content,
        languageInfo,
        timestamp: new Date()
      };
      const strategy = await this.processingStrategySelector.selectProcessingStrategy(strategyContext);

      // 使用专门的文件处理协调器执行处理
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
      this.logger?.error(`Error in intelligent file processing: ${error}`);
      this.errorThresholdManager.recordError(error as Error, `processFile: ${filePath}`);

      const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(filePath, content, `Processing error: ${(error as Error).message}`);
      return {
        chunks: fallbackResult.chunks,
        language: 'text',
        processingStrategy: fallbackResult.fallbackStrategy,
        fallbackReason: fallbackResult.reason
      };
    }
  }

  /**
   * 处理内存压力事件
   */
  private handleMemoryPressure(event: any): void {
    this.logger?.warn('Memory pressure detected', event);

    // 强制清理
    this.memoryGuard.forceCleanup();

    // 记录错误
    this.errorThresholdManager.recordError(
      new Error('Memory pressure detected'),
      'memory-pressure'
    );
  }

  /**
   * 获取处理状态
   */
  getStatus(): {
    errorThreshold: any;
    memoryGuard: any;
    isInitialized: boolean;
  } {
    return {
      errorThreshold: this.errorThresholdManager.getStatus(),
      memoryGuard: this.memoryGuard.getMemoryStats(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.errorThresholdManager.resetCounter();
    this.memoryGuard.clearHistory();
    this.logger?.info('ProcessingGuard reset completed');
  }
}