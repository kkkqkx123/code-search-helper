import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { ErrorThresholdManager } from '../universal/ErrorThresholdManager';
import { MemoryGuard } from './MemoryGuard';
import { ProcessingStrategyFactory } from '../processing/strategies/providers/ProcessingStrategyFactory';
import { UnifiedDetectionCenter, DetectionResult } from '../universal/UnifiedDetectionCenter';
import { IProcessingStrategy } from '../processing/strategies/impl/IProcessingStrategy';
import { IntelligentFallbackEngine } from '../universal/IntelligentFallbackEngine';

export interface ProcessingResult {
  chunks: any[];
  language: string;
  processingStrategy: string;
  fallbackReason?: string;
  success: boolean;
  duration: number;
  metadata?: any;
}

@injectable()
export class ProcessingGuard {
  private static instance: ProcessingGuard;
  private errorManager: ErrorThresholdManager;
  private memoryGuard: MemoryGuard;
  private strategyFactory: ProcessingStrategyFactory;
  private detectionCenter: UnifiedDetectionCenter;
  private fallbackEngine: IntelligentFallbackEngine;
  private logger?: LoggerService;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ErrorThresholdManager) errorManager?: ErrorThresholdManager,
    @inject(TYPES.MemoryGuard) memoryGuard?: MemoryGuard,
    @inject(TYPES.ProcessingStrategyFactory) strategyFactory?: ProcessingStrategyFactory,
    @inject(TYPES.UnifiedDetectionCenter) detectionCenter?: UnifiedDetectionCenter,
    @inject(TYPES.IntelligentFallbackEngine) fallbackEngine?: IntelligentFallbackEngine
  ) {
    this.logger = logger;
    this.errorManager = errorManager || new ErrorThresholdManager(logger);
    this.memoryGuard = memoryGuard || new MemoryGuard(
      // 创建默认内存监控器
      {
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
        setMemoryLimit: () => { },
        getMemoryHistory: () => [],
        clearHistory: () => { }
      } as any,
      100, 1000, logger || new LoggerService()
    );
    this.strategyFactory = strategyFactory || new ProcessingStrategyFactory(logger);
    this.detectionCenter = detectionCenter || new UnifiedDetectionCenter(logger);
    this.fallbackEngine = fallbackEngine || new IntelligentFallbackEngine(logger);
  }


  /**
   * 获取单例实例
   */
  static getInstance(
    logger?: LoggerService,
    errorManager?: ErrorThresholdManager,
    memoryGuard?: MemoryGuard,
    strategyFactory?: ProcessingStrategyFactory,
    detectionCenter?: UnifiedDetectionCenter
  ): ProcessingGuard {
    if (!ProcessingGuard.instance) {
      ProcessingGuard.instance = new ProcessingGuard(
        logger,
        errorManager,
        memoryGuard,
        strategyFactory,
        detectionCenter
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
      this.memoryGuard?.destroy();

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
    return this.errorManager.shouldUseFallback();
  }

  /**
    * 记录错误并清理资源
    */
  recordError(error: Error, context?: string): void {
    this.errorManager.recordError(error, context);
  }

  /**
   * 优化的文件处理方法（使用统一检测中心和策略模式）
   */
  async processFile(filePath: string, content: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    // 1. 快速预检查（内存、错误阈值）
    if (this.shouldUseImmediateFallback()) {
      this.logger?.warn('Using immediate fallback due to system constraints');
      const fallbackResult = await this.executeFallback(filePath, content, 'System constraints');
      return {
        ...fallbackResult,
        success: true,
        duration: Date.now() - startTime
      };
    }

    // 2. 统一检测（一次性完成所有检测）
    let detection;
    try {
      detection = await this.detectionCenter.detectFile(filePath, content);
    } catch (detectionError) {
      // 如果检测失败，直接进入fallback
      const duration = Date.now() - startTime;
      this.logger?.error(`Detection failed: ${detectionError}`);
      this.errorManager.recordError(detectionError as Error, `detection: ${filePath}`);

      try {
        // 不需要再次检测，因为检测已经失败了
        const fallbackResult = await this.executeFallback(filePath, content, `Detection error: ${(detectionError as Error).message}`);
        return {
          ...fallbackResult,
          success: true,
          duration,
          metadata: {
            detectionError: (detectionError as Error).message
          }
        };
      } catch (fallbackError) {
        this.logger?.error(`Fallback processing also failed: ${fallbackError}`);
        return {
          chunks: [],
          language: 'text',
          processingStrategy: 'none',
          success: false,
          duration,
          metadata: {
            detectionError: detectionError as Error,
            fallbackError: fallbackError as Error
          }
        };
      }
    }

    try {
      // 3. 策略选择（基于检测结果）
      const strategy = this.strategyFactory.createStrategy(detection);

      // 4. 执行处理
      const result = await strategy.execute(filePath, content, detection);

      const duration = Date.now() - startTime;
      this.logger?.info(`File processing completed in ${duration}ms, generated ${result.chunks.length} chunks`);

      return {
        chunks: result.chunks,
        language: detection.language,
        processingStrategy: detection.processingStrategy || 'unknown',
        success: true,
        duration,
        metadata: result.metadata
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error(`Error in optimized file processing: ${error}`);

      // 统一异常处理
      this.errorManager.recordError(error as Error, `processFile: ${filePath}`);

      try {
        // 使用已检测的结果避免重复检测
        const fallbackResult = await this.executeFallback(filePath, content, `Processing error: ${(error as Error).message}`, detection);
        return {
          ...fallbackResult,
          success: true,
          duration,
          metadata: {
            originalError: (error as Error).message
          }
        };
      } catch (fallbackError) {
        this.logger?.error(`Fallback processing also failed: ${fallbackError}`);
        return {
          chunks: [],
          language: 'text',
          processingStrategy: 'none',
          success: false,
          duration,
          metadata: {
            error: error as Error,
            fallbackError: fallbackError as Error
          }
        };
      }
    }
  }

  /**
   * 检查是否需要立即降级
   */
  private shouldUseImmediateFallback(): boolean {
    // 检查内存状态
    const memoryStatus = this.memoryGuard.checkMemoryUsage();
    if (!memoryStatus.isWithinLimit) {
      return true;
    }

    // 检查错误阈值
    if (this.errorManager.shouldUseFallback()) {
      return true;
    }

    return false;
  }

  /**
    * 执行降级处理
    */
  private async executeFallback(filePath: string, content: string, reason: string, cachedDetection?: DetectionResult): Promise<Omit<ProcessingResult, 'success' | 'duration'>> {
    this.logger?.info(`Executing fallback processing for ${filePath}: ${reason}`);

    try {
      // 使用智能降级引擎确定最佳降级策略
      // 如果已经有检测结果，则避免重复检测
      const detection = cachedDetection || await this.detectionCenter.detectFile(filePath, content);
      const fallbackStrategy = await this.fallbackEngine.determineFallbackStrategy(filePath, new Error(reason), detection);

      this.logger?.info(`Using intelligent fallback strategy: ${fallbackStrategy.strategy} for ${filePath}`);

      // 创建对应策略并执行
      const strategy = this.strategyFactory.createStrategy({
        language: detection.language,
        confidence: detection.confidence,
        fileType: detection.fileType,
        processingStrategy: fallbackStrategy.strategy
      });

      const result = await strategy.execute(filePath, content, {
        language: detection.language,
        confidence: detection.confidence,
        fileType: detection.fileType,
        processingStrategy: fallbackStrategy.strategy
      });

      return {
        chunks: result.chunks,
        language: detection.language,
        processingStrategy: fallbackStrategy.strategy,
        fallbackReason: `${reason} (${fallbackStrategy.reason})`,
        metadata: {
          ...result.metadata,
          intelligentFallback: true,
          originalReason: reason
        }
      };
    } catch (fallbackError) {
      this.logger?.error(`Fallback processing failed: ${fallbackError}`);

      // 如果连降级处理都失败，返回一个包含整个内容的单一块
      return {
        chunks: [{
          content: content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: 'text',
            filePath: filePath,
            fallback: true,
            reason: reason,
            error: (fallbackError as Error).message
          }
        }],
        language: 'text',
        processingStrategy: 'emergency-single-chunk',
        fallbackReason: `${reason} (fallback also failed: ${(fallbackError as Error).message})`
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
    this.errorManager.recordError(
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
      errorThreshold: this.errorManager.getStatus(),
      memoryGuard: this.memoryGuard.getMemoryStats(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.errorManager.resetCounter();
    this.memoryGuard.clearHistory();
    this.detectionCenter.clearCache();
    this.logger?.info('ProcessingGuard reset completed');
  }
}