import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { UnifiedStrategyManager } from '../strategies/manager/UnifiedStrategyManager';
import { UnifiedDetectionService, DetectionResult } from '../detection/UnifiedDetectionService';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';

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
  private logger?: LoggerService;
  private processingStats: Map<string, { count: number; totalTime: number; errors: number }> = new Map();

  constructor(
    @inject(TYPES.UnifiedStrategyManager) strategyManager: UnifiedStrategyManager,
    @inject(TYPES.UnifiedDetectionService) detectionService: UnifiedDetectionService,
    @inject(TYPES.UnifiedConfigManager) configManager: UnifiedConfigManager,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.strategyManager = strategyManager;
    this.detectionService = detectionService;
    this.configManager = configManager;
    this.logger = logger;
    this.logger?.debug('UnifiedProcessingCoordinator initialized');
  }

  /**
   * 主要处理入口
   */
  async processFile(context: ProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    const { filePath, content, options, forceStrategy, enableFallback = true, maxRetries = 3 } = context;

    this.logger?.debug(`Processing file: ${filePath}`);

    try {
      // 1. 文件检测
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
  }

  /**
   * 批量处理文件
   */
  async processFiles(contexts: ProcessingContext[]): Promise<ProcessingResult[]> {
    this.logger?.info(`Processing ${contexts.length} files`);

    const results: ProcessingResult[] = [];
    
    if (this.isParallelProcessingEnabled()) {
      // 并行处理
      const promises = contexts.map(context => this.processFile(context));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    } else {
      // 串行处理
      for (const context of contexts) {
        const result = await this.processFile(context);
        results.push(result);
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger?.info(`Batch processing completed: ${successCount}/${contexts.length} files successful`);

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

    // 智能策略选择
    const strategy = this.strategyManager.selectOptimalStrategy(
      detection.language,
      '',
      '',
      undefined,
      config
    );

    return { strategy, strategyName: strategy.getName() };
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

        const result = await this.strategyManager.executeStrategy(currentStrategy, executionContext);
        
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