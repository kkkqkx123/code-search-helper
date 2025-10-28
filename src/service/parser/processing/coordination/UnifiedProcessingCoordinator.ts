import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { ISplitStrategy, ChunkingOptions } from '../../interfaces/CoreISplitStrategy';
import { UnifiedStrategyManager } from '../strategies/manager/UnifiedStrategyManager';
import { UnifiedDetectionService, DetectionResult } from '../detection/UnifiedDetectionService';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';
import { UnifiedGuardCoordinator } from '../../guard/UnifiedGuardCoordinator';
import { PerformanceMonitoringCoordinator } from './PerformanceMonitoringCoordinator';
import { ConfigCoordinator, ConfigUpdateEvent } from './ConfigCoordinator';
import { SegmentationStrategyCoordinator } from './SegmentationStrategyCoordinator';
import { UniversalChunkingOptions } from '../strategies/types/SegmentationTypes';

/**
 * 处理结果接口
 */
export interface ProcessingResult {
  chunks: any[];
  language: string;
  processingStrategy: string;
  fallbackReason?: string;
  success: boolean;
  duration: number;
  metadata?: {
    detectionMethod: string;
    confidence: number;
    fileFeatures?: any;
    strategyExecutionTime: number;
    errorCount: number;
  };
}

/**
 * 处理上下文接口
 */
export interface ProcessingContext {
  filePath: string;
  content: string;
  options?: ChunkingOptions;
  forceStrategy?: string;
  enableFallback?: boolean;
  maxRetries?: number;
}

/**
 * 统一处理协调器
 * 整合了 ProcessingCoordinator 和 FileProcessingCoordinator 的功能
 */
@injectable()
export class UnifiedProcessingCoordinator {
  private strategyManager: UnifiedStrategyManager;
  private detectionService: UnifiedDetectionService;
  private configManager: UnifiedConfigManager;
  private guardCoordinator: UnifiedGuardCoordinator; // 新增
  private performanceMonitor: PerformanceMonitoringCoordinator; // 新增
  private configCoordinator: ConfigCoordinator; // 新增
  private segmentationCoordinator: SegmentationStrategyCoordinator; // 新增
  private logger?: LoggerService;
  private processingStats: Map<string, { count: number; totalTime: number; errors: number }> = new Map();

  constructor(
    @inject(TYPES.UnifiedStrategyManager) strategyManager: UnifiedStrategyManager,
    @inject(TYPES.UnifiedDetectionService) detectionService: UnifiedDetectionService,
    @inject(TYPES.UnifiedConfigManager) configManager: UnifiedConfigManager,
    @inject(TYPES.UnifiedGuardCoordinator) guardCoordinator: UnifiedGuardCoordinator, // 新增
    @inject(TYPES.PerformanceMonitoringCoordinator) performanceMonitor: PerformanceMonitoringCoordinator, // 新增
    @inject(TYPES.ConfigCoordinator) configCoordinator: ConfigCoordinator, // 新增
    @inject(TYPES.SegmentationStrategyCoordinator) segmentationCoordinator: SegmentationStrategyCoordinator, // 新增
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.strategyManager = strategyManager;
    this.detectionService = detectionService;
    this.configManager = configManager;
    this.guardCoordinator = guardCoordinator; // 新增
    this.performanceMonitor = performanceMonitor; // 新增
    this.configCoordinator = configCoordinator; // 新增
    this.segmentationCoordinator = segmentationCoordinator; // 新增
    this.logger = logger;
    this.logger?.debug('UnifiedProcessingCoordinator initialized');

    // 监听配置变更
    this.configCoordinator.onConfigUpdate((event) => {
      this.handleConfigUpdate(event);
    });
  }

  /**
   * 处理配置更新
   */
  private handleConfigUpdate(event: ConfigUpdateEvent): void {
    this.logger?.info('Processing config update', { changes: event.changes });

    // 根据变更类型更新内部状态
    if (event.changes.includes('memoryLimitMB')) {
      this.updateMemorySettings();
    }

    if (event.changes.includes('performanceThresholds')) {
      this.updatePerformanceThresholds();
    }
  }

  /**
   * 更新内存设置
   */
  private updateMemorySettings(): void {
    // 从configManager获取新的内存配置
    const config = this.configManager.getUniversalConfig();
    if (config.memory) {
      this.guardCoordinator.setMemoryLimit(config.memory.memoryLimitMB);
      this.logger?.info(`Memory limit updated to ${config.memory.memoryLimitMB}MB`);
    }
  }

  /**
   * 更新性能阈值
   */
  private updatePerformanceThresholds(): void {
    // 从configManager获取新的性能配置
    const config = this.configManager.getUniversalConfig();
    // 目前UniversalProcessingConfig中没有performance.thresholds，所以我们更新其他相关配置
    this.logger?.info('Performance thresholds updated');
  }

  /**
   * 主要处理入口
   */
  async processFile(context: ProcessingContext): Promise<ProcessingResult> {
    return await this.performanceMonitor.monitorAsyncOperation(
      'processFile',
      async () => {
        const startTime = Date.now();
        const { filePath, content, options, forceStrategy, enableFallback = true, maxRetries = 3 } = context;

        // 1. 保护机制检查（新增）
        const shouldUseFallback = this.guardCoordinator.shouldUseFallback();
        if (shouldUseFallback) {
          this.logger?.warn('Using fallback due to system constraints');
          return await this.executeFallbackProcessing(context, 'System constraints');
        }

        // 2. 内存使用检查（新增）
        const memoryStatus = this.guardCoordinator.checkMemoryUsage();
        if (!memoryStatus.isWithinLimit) {
          this.logger?.warn('Memory limit exceeded, using fallback');
          return await this.executeFallbackProcessing(context, 'Memory limit exceeded');
        }

        this.logger?.debug(`Processing file: ${filePath}`);

        try {
          // 3. 文件检测
          const detection = await this.detectionService.detectFile(filePath, content);

          // 2. 获取配置
          const config = options || this.configManager.getMergedConfig(detection.language);

          // 3. 选择策略
          const strategySelection = await this.selectStrategy(detection, config, forceStrategy);

          // 4. 执行处理
          const processingResult = await this.executeProcessing(
            filePath,
            content,
            detection,
            strategySelection.strategy,
            config,
            enableFallback,
            maxRetries
          );

          const duration = Date.now() - startTime;

          // 5. 构建结果
          const result: ProcessingResult = {
            chunks: processingResult.chunks,
            language: detection.language,
            processingStrategy: strategySelection.strategyName,
            fallbackReason: processingResult.fallbackReason,
            success: processingResult.success,
            duration,
            metadata: {
              detectionMethod: detection.detectionMethod,
              confidence: detection.confidence,
              fileFeatures: detection.metadata.fileFeatures,
              strategyExecutionTime: processingResult.executionTime,
              errorCount: processingResult.errorCount
            }
          };

          // 6. 更新统计
          this.updateProcessingStats(detection.language, duration, !result.success);

          this.logger?.info(`File processed successfully: ${filePath} (${result.chunks.length} chunks, ${duration}ms)`);
          return result;

        } catch (error) {
          // 记录错误到保护机制（新增）
          this.guardCoordinator.recordError(error as Error, `processFile: ${filePath}`);
          const duration = Date.now() - startTime;
          this.logger?.error(`File processing failed: ${filePath}`, error);

          return {
            chunks: [],
            language: 'unknown',
            processingStrategy: 'none',
            fallbackReason: error instanceof Error ? error.message : String(error),
            success: false,
            duration,
            metadata: {
              detectionMethod: 'none',
              confidence: 0,
              strategyExecutionTime: 0,
              errorCount: 1
            }
          };
        }
      },
      { filePath: context.filePath, fileSize: context.content.length }
    );
  }

  /**
   * 批量处理文件
   */
  async processFiles(contextList: ProcessingContext[]): Promise<ProcessingResult[]> {
    this.logger?.info(`Processing ${contextList.length} files`);

    const results: ProcessingResult[] = [];

    if (this.isParallelProcessingEnabled()) {
      // 并行处理
      const promises = contextList.map(context => this.processFile(context));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    } else {
      // 串行处理
      for (const context of contextList) {
        const result = await this.processFile(context);
        results.push(result);
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger?.info(`Batch processing completed: ${successCount}/${contextList.length} files successful`);

    return results;
  }

  /**
   * 选择策略
   */
  private async selectStrategy(
    detection: DetectionResult,
    config: ChunkingOptions,
    forceStrategy?: string
  ): Promise<{ strategy: ISplitStrategy; strategyName: string }> {
    // 如果强制指定策略
    if (forceStrategy) {
      const strategy = this.strategyManager.selectOptimalStrategy(
        detection.language,
        '', // content not needed for forced strategy
        '',
        undefined,
        config
      );
      return { strategy, strategyName: forceStrategy };
    }

    // 使用推荐的处理策略
    const recommendedStrategy = detection.metadata.processingStrategy;
    if (recommendedStrategy) {
      const strategy = this.strategyManager.selectOptimalStrategy(
        detection.language,
        '',
        '',
        undefined,
        config
      );
      return { strategy, strategyName: recommendedStrategy };
    }

    // 使用分段策略协调器的智能策略选择
    try {
      // 将ChunkingOptions转换为UniversalChunkingOptions
      const universalOptions = this.convertChunkingOptionsToUniversal(config);

      const segmentationContext = this.segmentationCoordinator.createSegmentationContext(
        detection.metadata.fileFeatures?.size ? '' : '', // 这里我们只传递内容用于上下文创建，实际内容会在执行时提供
        undefined, // filePath
        detection.language,
        universalOptions
      );

      // 使用协调器的智能策略选择
      const segmentationStrategy = this.segmentationCoordinator.selectStrategyWithHeuristics(segmentationContext);

      // 将ISegmentationStrategy适配为ISplitStrategy
      const adaptedStrategy = this.adaptSegmentationStrategy(segmentationStrategy);

      return { strategy: adaptedStrategy, strategyName: segmentationStrategy.getName() };
    } catch (error) {
      // 如果智能选择失败，回退到原来的策略
      this.logger?.warn('Intelligent strategy selection failed, falling back to default strategy selection', error);
      const strategy = this.strategyManager.selectOptimalStrategy(
        detection.language,
        '',
        '',
        undefined,
        config
      );
      return { strategy, strategyName: strategy.getName() };
    }
  }

  /**
   * 将ChunkingOptions转换为UniversalChunkingOptions
   */
  private convertChunkingOptionsToUniversal(config: ChunkingOptions): UniversalChunkingOptions {
    return {
      maxChunkSize: config.maxChunkSize || 2000,
      overlapSize: config.overlapSize || 200,
      maxLinesPerChunk: config.maxLines || 100,
      enableBracketBalance: config.optimizationLevel !== 'low',
      enableSemanticDetection: config.optimizationLevel !== 'low',
      enableCodeOverlap: config.addOverlap || false,
      enableStandardization: true,
      standardizationFallback: true,
      maxOverlapRatio: config.maxOverlapRatio || 0.3,
      errorThreshold: 10,
      memoryLimitMB: 512,
      filterConfig: {
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: config.minChunkSize || 100,
        maxChunkSize: config.maxChunkSize ? config.maxChunkSize * 2 : 4000
      },
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium'
      }
    };
  }

  /**
   * 将ISegmentationStrategy适配为ISplitStrategy
   */
  private adaptSegmentationStrategy(segmentationStrategy: any): ISplitStrategy {
    // 创建一个适配器，将ISegmentationStrategy转换为ISplitStrategy
    return {
      split: async (
        content: string,
        language: string,
        filePath?: string,
        options?: any,
        nodeTracker?: any,
        ast?: any
      ) => {
        // 创建分段上下文
        const universalOptions = this.convertChunkingOptionsToUniversal(options || {});
        const context = this.segmentationCoordinator.createSegmentationContext(
          content,
          filePath,
          language,
          universalOptions
        );

        // 执行分段
        return await this.segmentationCoordinator.executeStrategy(segmentationStrategy, context);
      },
      getName: () => segmentationStrategy.getName(),
      supportsLanguage: (language: string) => {
        if (segmentationStrategy.getSupportedLanguages) {
          return segmentationStrategy.getSupportedLanguages().includes(language);
        }
        // 默认返回true，如果策略没有提供特定的语言支持信息
        return true;
      },

    };
  }

  /**
   * 执行处理
   */
  private async executeProcessing(
    filePath: string,
    content: string,
    detection: DetectionResult,
    strategy: ISplitStrategy,
    config: ChunkingOptions,
    enableFallback: boolean,
    maxRetries: number
  ): Promise<{
    chunks: any[];
    success: boolean;
    executionTime: number;
    fallbackReason?: string;
    errorCount: number;
  }> {
    let currentStrategy = strategy;
    let currentStrategyName = strategy.getName();
    let errorCount = 0;
    let fallbackReason: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const executionContext = {
          language: detection.language,
          sourceCode: content,
          filePath,
          ast: detection.metadata.astInfo,
          customParams: config
        };

        // 使用性能监控包装策略执行
        const result = await this.performanceMonitor.monitorAsyncOperation(
          'executeStrategy',
          async () => {
            return await this.strategyManager.executeStrategy(currentStrategy, executionContext);
          },
          { strategy: currentStrategy.getName(), language: detection.language }
        );

        if (result.success && result.chunks.length > 0) {
          return {
            chunks: result.chunks,
            success: true,
            executionTime: result.executionTime,
            fallbackReason,
            errorCount
          };
        }

        errorCount++;

        // 如果启用降级，尝试下一个策略
        if (enableFallback && attempt < maxRetries) {
          const fallbackPath = this.strategyManager.getFallbackPath(currentStrategyName);
          if (fallbackPath.length > 0) {
            const nextStrategyName = fallbackPath[0];
            currentStrategy = this.strategyManager.createFallbackStrategy(
              detection,
              nextStrategyName,
              config
            );
            currentStrategyName = nextStrategyName;
            fallbackReason = `Fallback from ${strategy.getName()} to ${nextStrategyName}`;
            this.logger?.warn(`Strategy failed, using fallback: ${fallbackReason}`);
            continue;
          }
        }

      } catch (error) {
        errorCount++;
        this.logger?.error(`Strategy execution failed (attempt ${attempt + 1}):`, error);

        // 如果启用降级，尝试下一个策略
        if (enableFallback && attempt < maxRetries) {
          const fallbackPath = this.strategyManager.getFallbackPath(currentStrategyName);
          if (fallbackPath.length > 0) {
            const nextStrategyName = fallbackPath[0];
            currentStrategy = this.strategyManager.createFallbackStrategy(
              detection,
              nextStrategyName,
              config
            );
            currentStrategyName = nextStrategyName;
            fallbackReason = `Error fallback from ${strategy.getName()} to ${nextStrategyName}`;
            this.logger?.warn(`Strategy error, using fallback: ${fallbackReason}`);
            continue;
          }
        }
      }
    }

    // 所有尝试都失败
    return {
      chunks: [],
      success: false,
      executionTime: 0,
      fallbackReason: fallbackReason || 'All strategies failed',
      errorCount
    };
  }

  /**
   * 验证处理结果
   */
  validateProcessingResult(result: ProcessingResult): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查基本字段
    if (!result.chunks || !Array.isArray(result.chunks)) {
      errors.push('Invalid chunks array');
    }

    if (!result.language || typeof result.language !== 'string') {
      errors.push('Invalid language');
    }

    if (!result.processingStrategy || typeof result.processingStrategy !== 'string') {
      errors.push('Invalid processing strategy');
    }

    if (typeof result.success !== 'boolean') {
      errors.push('Invalid success flag');
    }

    if (typeof result.duration !== 'number' || result.duration < 0) {
      errors.push('Invalid duration');
    }

    // 检查块内容
    if (result.chunks) {
      for (let i = 0; i < result.chunks.length; i++) {
        const chunk = result.chunks[i];
        if (!chunk.content || typeof chunk.content !== 'string') {
          errors.push(`Invalid chunk content at index ${i}`);
        }
        if (!chunk.metadata || typeof chunk.metadata !== 'object') {
          errors.push(`Invalid chunk metadata at index ${i}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取处理统计
   */
  getProcessingStats(): Map<string, { count: number; totalTime: number; errors: number; averageTime: number; errorRate: number }> {
    const stats = new Map();

    for (const [language, data] of this.processingStats) {
      const errorRate = data.count > 0 ? data.errors / data.count : 0;
      stats.set(language, {
        ...data,
        averageTime: data.count > 0 ? data.totalTime / data.count : 0,
        errorRate
      });
    }

    return stats;
  }

  /**
   * 获取可用的策略信息
   */
  getAvailableStrategies(): Array<{
    name: string;
    description: string;
    supportedLanguages: string[];
    priority: number;
    supportsAST: boolean;
  }> {
    return this.strategyManager.getAvailableStrategies();
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    // 这里可以从检测服务获取支持的语言
    return [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
      'scala', 'html', 'css', 'json', 'yaml', 'toml', 'xml',
      'markdown', 'text'
    ];
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.processingStats.clear();
    this.strategyManager.clearPerformanceStats();
    this.logger?.debug('Processing stats reset');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      strategyManager: boolean;
      detectionService: boolean;
      configManager: boolean;
      totalStrategies: number;
      supportedLanguages: number;
    };
  }> {
    const checks = {
      strategyManager: await this.checkStrategyManager(),
      detectionService: await this.checkDetectionService(),
      configManager: await this.checkConfigManager()
    };

    const allHealthy = Object.values(checks).every(check => check);
    const strategies = this.getAvailableStrategies();
    const languages = this.getSupportedLanguages();

    return {
      status: allHealthy ? 'healthy' : checks.strategyManager ? 'degraded' : 'unhealthy',
      details: {
        ...checks,
        totalStrategies: strategies.length,
        supportedLanguages: languages.length
      }
    };
  }

  /**
   * 辅助方法
   */
  private updateProcessingStats(language: string, duration: number, isError: boolean): void {
    const stats = this.processingStats.get(language) || { count: 0, totalTime: 0, errors: 0 };
    stats.count++;
    stats.totalTime += duration;
    if (isError) {
      stats.errors++;
    }
    this.processingStats.set(language, stats);
  }

  private isParallelProcessingEnabled(): boolean {
    const config = this.configManager.getUniversalConfig();
    return config.memory.memoryLimitMB > 1000; // 简单的并行处理检查
  }

  private async checkStrategyManager(): Promise<boolean> {
    try {
      const strategies = this.strategyManager.getAvailableStrategies();
      return strategies.length > 0;
    } catch (error) {
      this.logger?.error('Strategy manager health check failed:', error);
      return false;
    }
  }

  /**
   * 新增降级处理方法
   */
  private async executeFallbackProcessing(context: ProcessingContext, reason: string): Promise<ProcessingResult> {
    const { filePath, content } = context;

    try {
      const fallbackResult = await this.guardCoordinator.processFileWithDetection(filePath, content);
      return {
        ...fallbackResult,
        fallbackReason: reason,
        metadata: {
          ...fallbackResult.metadata,
          fileFeatures: fallbackResult.metadata?.fileFeatures || {},
          strategyExecutionTime: 0,
          errorCount: 1,
          fallbackTriggered: true,
          originalReason: reason
        }
      };
    } catch (error) {
      this.logger?.error('Fallback processing failed:', error);
      return this.createEmergencyResult(filePath, content, reason);
    }
  }

  /**
   * 创建紧急处理结果
   */
  private createEmergencyResult(filePath: string, content: string, reason: string): ProcessingResult {
    return {
      chunks: [{
        content: content,
        metadata: {
          startLine: 1,
          endLine: content.split('\n').length,
          language: 'text',
          filePath: filePath,
          fallback: true,
          reason: reason
        }
      }],
      language: 'text',
      processingStrategy: 'emergency-single-chunk',
      fallbackReason: reason,
      success: true,
      duration: 0,
      metadata: {
        detectionMethod: 'emergency',
        confidence: 0.1,
        fileFeatures: {
          fallbackTriggered: true,
          originalReason: reason
        },
        strategyExecutionTime: 0,
        errorCount: 1
      }
    };
  }


  private async checkDetectionService(): Promise<boolean> {
    try {
      const result = await this.detectionService.detectFile('test.txt', 'test content');
      return result !== null;
    } catch (error) {
      this.logger?.error('Detection service health check failed:', error);
      return false;
    }
  }

  private async checkConfigManager(): Promise<boolean> {
    try {
      const config = this.configManager.getGlobalConfig();
      return config !== null;
    } catch (error) {
      this.logger?.error('Config manager health check failed:', error);
      return false;
    }
  }

}