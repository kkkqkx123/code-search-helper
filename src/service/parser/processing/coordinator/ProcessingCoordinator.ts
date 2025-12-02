/**
 * 处理协调器实现
 * 协调代码分割策略的选择和执行，管理分割流程
 */

import { IProcessingStrategy } from '../core/interfaces/IProcessingStrategy';
import { IStrategyFactory } from '../core/interfaces/IStrategyFactory';
import { ProcessingConfig } from '../core/types/ConfigTypes';
import { ProcessingResult, ProcessingUtils } from '../types/Processing';
import { ProcessingContext, ContextBuilder, ContextUtils } from '../types/Context';
import { FileFeatures } from '../core/interfaces/IProcessingContext';
import { LineEndingType, IndentType } from '../core/interfaces/IProcessingContext';
import { CodeChunk } from '../types/CodeChunk';
import { ChunkPostProcessorCoordinator } from '../../post-processing/ChunkPostProcessorCoordinator';
import { PostProcessingContext } from '../../post-processing/IChunkPostProcessor';
import { LoggerService } from '../../../../utils/LoggerService';
import { injectable, inject, optional } from 'inversify';
import { FileFeatureDetector } from '../../detection/FileFeatureDetector';
import { LanguageDetector } from '../../detection/LanguageDetector';
import { TYPES } from '../../../../types';
import {
  UNIFIED_STRATEGY_PRIORITIES,
  getPrioritizedStrategies,
  getLanguageSpecificStrategies,
  getFileTypeSpecificStrategy
} from '../../constants/StrategyPriorities';
import { BatchProcessingOptions } from '../../../../infrastructure/batching/types';

/**
 * 处理协调器类
 * 负责协调整个代码处理流程
 */
@injectable()
export class ProcessingCoordinator {
  /** 策略工厂 */
  private strategyFactory: IStrategyFactory;

  /** 处理配置 */
  private config: ProcessingConfig;

  /** 后处理协调器 */
  private postProcessorCoordinator: ChunkPostProcessorCoordinator;

  /** 日志服务 */
  private logger?: LoggerService;
  /** 文件特征检测器 */
  private fileFeatureDetector: FileFeatureDetector;

  /** 检测服务 */
  private detectionService: LanguageDetector;

  /** 性能监控 */
  private performanceStats: ProcessingPerformanceStats;

  /**
   * 构造函数
   * @param strategyFactory 策略工厂
   * @param config 处理配置
   * @param postProcessorCoordinator 后处理协调器
   * @param logger 日志服务
   */
  constructor(
    @inject(TYPES.StrategyFactory) strategyFactory: IStrategyFactory,
    @inject(TYPES.ConfigurationManager) config: ProcessingConfig,
    @inject(TYPES.FileFeatureDetector) fileFeatureDetector: FileFeatureDetector,
    @inject(TYPES.LanguageDetector) detectionService: LanguageDetector,
    @inject(TYPES.ChunkPostProcessorCoordinator) postProcessorCoordinator: ChunkPostProcessorCoordinator,
    @inject(TYPES.LoggerService) @optional() logger?: LoggerService
  ) {
    this.strategyFactory = strategyFactory;
    this.config = config;
    this.fileFeatureDetector = fileFeatureDetector;
    this.detectionService = detectionService;
    this.postProcessorCoordinator = postProcessorCoordinator;
    this.logger = logger;
    this.performanceStats = this.initializePerformanceStats();
  }

  /**
   * 处理代码内容
   * @param content 代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   * @param ast AST节点（可选，由上游提供）
   * @param features 文件特征（可选，由上游提供）
   * @param nodeTracker 节点跟踪器（可选，由上游提供）
   * @returns 处理结果
   */
  async process(
    content: string,
    language: string,
    filePath?: string,
    ast?: any,
    features?: FileFeatures,
    nodeTracker?: any
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger?.info(`开始处理代码: ${filePath || 'unknown'} (${language})`);

      // 1. 创建处理上下文
      const context = await this.createContext(
        content,
        language,
        filePath,
        ast,
        features,
        nodeTracker
      );

      // 2. 选择并执行策略
      const strategy = this.selectStrategy(context);
      this.logger?.debug(`选择策略: ${strategy.name}`);

      const result = await this.executeStrategy(strategy, context);

      // 3. 后处理
      const processedResult = await this.postProcess(result, context);

      // 4. 更新性能统计
      const executionTime = Date.now() - startTime;
      this.updatePerformanceStats(executionTime, processedResult.success, strategy.name);

      this.logger?.info(`处理完成: ${processedResult.chunks.length} 个代码块, 耗时 ${executionTime}ms`);

      return processedResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`处理失败: ${errorMessage}`, error);

      return ProcessingUtils.createFailureResult(
        'unknown',
        executionTime,
        errorMessage
      );
    }
  }

  /**
   * 批量处理多个文件（简化版本）
   * @param requests 处理请求数组
   * @param options 批量处理选项
   * @returns 处理结果数组
   */
  async processBatch(
    requests: ProcessingRequest[],
    options?: BatchProcessingOptions
  ): Promise<ProcessingResult[]> {
    const startTime = Date.now();

    this.logger?.info(`Processing batch of ${requests.length} files`, {
      requestCount: requests.length,
      options
    });

    // 使用简单的Promise.allSettled实现批处理
    const results = await Promise.allSettled(
      requests.map(request =>
        this.process(
          request.content,
          request.language,
          request.filePath,
          request.ast,
          request.features,
          request.nodeTracker
        )
      )
    );

    // 处理结果，将fulfilled和rejected的结果分别处理
    const processedResults: ProcessingResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // 如果处理失败，返回失败结果
        const request = requests[index];
        return ProcessingUtils.createFailureResult(
          'unknown',
          Date.now() - startTime,
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        );
      }
    });

    const successCount = processedResults.filter(r => r.success).length;
    const failureCount = processedResults.filter(r => !r.success).length;

    this.logger?.info(`Batch processing completed`, {
      requestCount: requests.length,
      successCount,
      failureCount,
      totalDuration: Date.now() - startTime
    });

    return processedResults;
  }

  /**
   * 创建处理上下文
   * @param content 代码内容
   * @param language 编程语言
   * @param filePath 文件路径
   * @param ast AST节点
   * @param features 文件特征
   * @param nodeTracker 节点跟踪器
   * @returns 处理上下文
   */
  private async createContext(
    content: string,
    language: string,
    filePath?: string,
    ast?: any,
    features?: FileFeatures,
    nodeTracker?: any
  ): Promise<ProcessingContext> {
    try {
      // 如果上游没有提供特征，使用默认特征
      const finalFeatures = features || this.createDefaultFileFeatures(content, filePath);

      // 构建上下文
      const context = new ContextBuilder(content)
        .setLanguage(language)
        .setFilePath(filePath)
        .setConfig(this.config)
        .setFeatures(finalFeatures)
        .setAST(ast)
        .setNodeTracker(nodeTracker)
        .build();

      this.logger?.debug(`创建处理上下文: ${ContextUtils.getContextSummary(context)}`);

      return context;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`创建处理上下文失败: ${errorMessage}`, error);
      throw new Error(`Failed to create processing context: ${errorMessage}`);
    }
  }

  /**
   * 选择合适的处理策略
   * 策略选择完全基于 UNIFIED_STRATEGY_PRIORITIES
   * @param context 处理上下文
   * @returns 处理策略
   */
  private selectStrategy(context: ProcessingContext): IProcessingStrategy {
    const language = context.language || 'unknown';
    const filePath = context.filePath || '';

    // 1. 检查文件类型特定策略（最高优先级）
    const fileTypeStrategy = getFileTypeSpecificStrategy(filePath);
    if (fileTypeStrategy && this.strategyFactory.supportsStrategy(fileTypeStrategy)) {
      const strategy = this.strategyFactory.createStrategy(fileTypeStrategy, context.config);
      if (strategy.canHandle(context)) {
        this.logger?.debug(`使用文件类型特定策略: ${fileTypeStrategy} (文件: ${filePath})`);
        return strategy;
      }
    }

    // 2. 如果配置中指定了默认策略，优先使用
    if (context.config.chunking.defaultStrategy &&
      this.strategyFactory.supportsStrategy(context.config.chunking.defaultStrategy)) {
      const defaultStrategy = this.strategyFactory.createStrategy(
        context.config.chunking.defaultStrategy,
        context.config
      );

      if (defaultStrategy.canHandle(context)) {
        this.logger?.debug(`使用配置的默认策略: ${context.config.chunking.defaultStrategy}`);
        return defaultStrategy;
      }
    }

    // 3. 获取语言特定的策略推荐，并按 UNIFIED_STRATEGY_PRIORITIES 排序
    const languageStrategies = getLanguageSpecificStrategies(language);
    const prioritizedStrategies = getPrioritizedStrategies(languageStrategies);

    // 4. 按优先级尝试策略
    for (const strategyType of prioritizedStrategies) {
      if (!this.strategyFactory.supportsStrategy(strategyType)) {
        continue;
      }

      const strategy = this.strategyFactory.createStrategy(strategyType, context.config);
      if (strategy.canHandle(context)) {
        this.logger?.debug(`选择策略: ${strategyType} (语言: ${language}, 优先级: ${UNIFIED_STRATEGY_PRIORITIES[strategyType]})`);
        return strategy;
      }
    }

    // 5. 如果没有语言特定策略可用，尝试所有可用策略，按 UNIFIED_STRATEGY_PRIORITIES 排序
    const allStrategies = this.strategyFactory.getAvailableStrategies();
    const allPrioritizedStrategies = getPrioritizedStrategies(allStrategies);

    for (const strategyType of allPrioritizedStrategies) {
      const strategy = this.strategyFactory.createStrategy(strategyType, context.config);
      if (strategy.canHandle(context)) {
        this.logger?.debug(`使用通用策略: ${strategyType} (优先级: ${UNIFIED_STRATEGY_PRIORITIES[strategyType]})`);
        return strategy;
      }
    }

    // 6. 最后降级到行分段策略（最低优先级）
    if (this.strategyFactory.supportsStrategy('line-segmentation')) {
      const fallbackStrategy = this.strategyFactory.createStrategy('line-segmentation', context.config);
      this.logger?.warn(`所有策略失败，使用行分段策略作为最后保障 (优先级: ${UNIFIED_STRATEGY_PRIORITIES['line-segmentation']})`);
      return fallbackStrategy;
    }

    // 7. 如果连行分段策略都不可用，使用第一个可用策略
    const availableStrategies = this.strategyFactory.getAvailableStrategies();
    if (availableStrategies.length > 0) {
      const emergencyStrategy = this.strategyFactory.createStrategy(availableStrategies[0], context.config);
      this.logger?.error(`紧急降级到第一个可用策略: ${availableStrategies[0]}`);
      return emergencyStrategy;
    }

    // 8. 如果没有任何策略可用，抛出错误
    throw new Error('没有可用的处理策略');
  }

  /**
   * 执行处理策略
   * @param strategy 处理策略
   * @param context 处理上下文
   * @returns 处理结果
   */
  private async executeStrategy(
    strategy: IProcessingStrategy,
    context: ProcessingContext
  ): Promise<ProcessingResult> {
    try {
      // 验证上下文
      if (strategy.validateContext && !strategy.validateContext(context)) {
        throw new Error(`Strategy ${strategy.name} cannot handle the provided context`);
      }

      // 执行策略
      const result = await strategy.execute(context);

      this.logger?.debug(`策略 ${strategy.name} 执行完成，生成 ${result.chunks.length} 个代码块`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`策略 ${strategy.name} 执行失败: ${errorMessage}`, error);

      // 尝试降级到更简单的策略
      return await this.executeFallbackStrategy(context, strategy.name);
    }
  }

  /**
   * 执行降级策略
   * @param context 处理上下文
   * @param failedStrategyName 失败的策略名称
   * @returns 处理结果
   */
  private async executeFallbackStrategy(
    context: ProcessingContext,
    failedStrategyName: string
  ): Promise<ProcessingResult> {
    const availableStrategies = this.strategyFactory.getAvailableStrategies();

    // 尝试使用行数分段策略作为降级
    if (this.strategyFactory.supportsStrategy('line-segmentation')) {
      const lineStrategy = this.strategyFactory.createStrategy('line-segmentation', context.config);

      if (lineStrategy.canHandle(context)) {
        this.logger?.warn(`使用行数分段策略作为降级，原策略 ${failedStrategyName} 失败`);
        return await lineStrategy.execute(context);
      }
    }

    // 如果连行级策略都不能使用，创建基本的分割结果
    this.logger?.error(`所有策略都失败，创建基本分割结果`);
    return this.createBasicChunkingResult(context);
  }

  /**
   * 转换配置类型
   */
  private convertConfigToCoreType(config: any): ProcessingConfig {
    // 创建符合核心类型要求的配置
    return {
      chunking: config.chunking,
      features: config.features,
      performance: config.performance,
      languages: config.languages,
      postProcessing: config.postProcessing,
      advanced: config.advanced,
      global: config.global || {
        debugMode: false,
        logLevel: 'info',
        enableMetrics: true,
        enableStatistics: true,
        configVersion: '1.0.0',
        compatibilityMode: false,
        strictMode: false,
        experimentalFeatures: [],
        customProperties: {}
      },
      version: config.version || '1.0.0',
      createdAt: config.createdAt || Date.now(),
      updatedAt: config.updatedAt || Date.now()
    };
  }

  /**
   * 执行后处理
   * @param result 处理结果
   * @param context 处理上下文
   * @returns 后处理结果
   */
  private async postProcess(
    result: ProcessingResult,
    context: ProcessingContext
  ): Promise<ProcessingResult> {
    if (!context.config.postProcessing.enabled || result.chunks.length === 0) {
      return result;
    }

    try {
      // 创建后处理上下文
      const postProcessingContext: PostProcessingContext = {
        originalContent: context.content,
        language: context.language,
        filePath: context.filePath,
        config: this.convertConfigToCoreType(context.config),
        options: {
          maxChunkSize: context.config.chunking.maxChunkSize,
          minChunkSize: context.config.chunking.minChunkSize,
          overlapSize: context.config.chunking.overlapSize,
          maxLinesPerChunk: context.config.chunking.maxLinesPerChunk,
          minLinesPerChunk: context.config.chunking.minLinesPerChunk,
          enableIntelligentChunking: true
        },
        advancedOptions: context.config.advanced
      };

      // 执行后处理
      const processedChunks = await this.postProcessorCoordinator.process(
        result.chunks,
        postProcessingContext
      );

      // 更新结果
      const processedResult: ProcessingResult = {
        ...result,
        chunks: processedChunks,
        metadata: {
          ...result.metadata,
          chunkCount: processedChunks.length,
          postProcessed: true,
          originalChunkCount: result.chunks.length,
          optimizationRatio: (result.chunks.length - processedChunks.length) / result.chunks.length
        }
      };

      this.logger?.debug(`后处理完成: ${result.chunks.length} -> ${processedChunks.length} 个代码块`);

      return processedResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`后处理失败: ${errorMessage}`, error);
      // 后处理失败时返回原始结果
      return result;
    }
  }

  /**
   * 检测换行符类型
   */
  private detectLineEndingType(content: string): LineEndingType {
    // 使用FileFeatureDetector检测换行符类型
    return this.fileFeatureDetector.detectLineEndingType(content);
  }

  /**
   * 检测缩进类型
   */
  private detectIndentationType(content: string): { type: IndentType; size: number } {
    // 使用FileFeatureDetector检测缩进类型
    return this.fileFeatureDetector.detectIndentationType(content);
  }

  /**
   * 检测是否为二进制内容
   */
  private isBinaryContent(content: string): boolean {
    // 使用FileFeatureDetector检测是否为二进制内容
    return this.fileFeatureDetector.isBinaryContent(content);
  }

  /**
   * 创建默认文件特征
   * @param content 代码内容
   * @param filePath 文件路径
   * @returns 文件特征
   */
  private createDefaultFileFeatures(content: string, filePath?: string): FileFeatures {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const size = new Blob([content]).size;
    const extension = filePath ? filePath.split('.').pop()?.toLowerCase() : '';

    // 基本特征检测 - 使用FileFeatureDetector
    const hasImports = this.fileFeatureDetector.hasImports(content, 'unknown');
    const hasExports = this.fileFeatureDetector.hasExports(content, 'unknown');
    const hasFunctions = this.fileFeatureDetector.hasFunctions(content, 'unknown');
    const hasClasses = this.fileFeatureDetector.hasClasses(content, 'unknown');

    // 计算基本复杂度 - 使用FileFeatureDetector
    const complexity = this.fileFeatureDetector.calculateComplexity(content);

    // 检测换行符类型 - 使用FileFeatureDetector
    const lineEndingType = this.fileFeatureDetector.detectLineEndingType(content);

    // 检测缩进类型 - 使用FileFeatureDetector
    const { type: indentType, size: averageIndentSize } = this.fileFeatureDetector.detectIndentationType(content);

    // 检测是否为二进制文件 - 使用FileFeatureDetector
    const isBinary = this.fileFeatureDetector.isBinaryContent(content);

    // 检测是否包含非ASCII字符
    const hasNonASCII = /[^\x00-\x7F]/.test(content);

    // 检测是否包含BOM
    const hasBOM = content.charCodeAt(0) === 0xFEFF ||
      content.charCodeAt(0) === 0xFFFE;

    return {
      size,
      lineCount,
      isSmallFile: size < 1024,
      isCodeFile: this.fileFeatureDetector.isCodeContent(content),
      isStructuredFile: hasFunctions || hasClasses,
      complexity,
      hasImports,
      hasExports,
      hasFunctions,
      hasClasses,
      languageFeatures: {
        characterCount: content.length,
        isBinary,
        isText: !isBinary,
        extension,
        hasNonASCII,
        hasBOM,
        lineEndingType,
        indentType,
        averageIndentSize
      }
    };
  }
  /**
   * 计算基本复杂度
   * @param content 代码内容
   * @returns 复杂度评分
   */
  private calculateBasicComplexity(content: string): number {
    // 使用FileFeatureDetector计算文件复杂度
    return this.fileFeatureDetector.calculateComplexity(content);
  }

  /**
   * 判断是否为代码内容
   * @param content 内容
   * @returns 是否为代码
   */
  private isCodeContent(content: string): boolean {
    // 使用FileFeatureDetector判断是否为代码内容
    return this.fileFeatureDetector.isCodeContent(content);
  }

  /**
   * 创建基本分割结果
   * @param context 处理上下文
   * @returns 基本处理结果
   */
  private createBasicChunkingResult(context: ProcessingContext): ProcessingResult {
    // 简单的行级分割
    const lines = context.content.split('\n');
    const chunks: CodeChunk[] = [];

    const maxLinesPerChunk = context.config.chunking.maxLinesPerChunk || 50;

    for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
      const chunkLines = lines.slice(i, i + maxLinesPerChunk);
      const chunkContent = chunkLines.join('\n');

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: i + 1,
          endLine: Math.min(i + maxLinesPerChunk, lines.length),
          language: context.language,
          filePath: context.filePath,
          strategy: 'basic-line-fallback',
          complexity: 1,
          timestamp: Date.now(),
          type: 'generic' as any,
          size: chunkContent.length,
          lineCount: chunkLines.length
        }
      });
    }

    return ProcessingUtils.createSuccessResult(
      chunks,
      'basic-line-fallback',
      0,
      {
        language: context.language,
        filePath: context.filePath,
        chunkCount: chunks.length,
        averageChunkSize: chunks.length > 0
          ? chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length
          : 0,
        totalSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
        strategy: 'basic-line-fallback',
        fallback: true
      }
    );
  }

  /**
   * 初始化性能统计
   * @returns 性能统计
   */
  private initializePerformanceStats(): ProcessingPerformanceStats {
    return {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      strategyUsage: {},
      languageUsage: {}
    };
  }

  /**
   * 更新性能统计
   * @param executionTime 执行时间
   * @param success 是否成功
   * @param strategyName 策略名称
   */
  private updatePerformanceStats(
    executionTime: number,
    success: boolean,
    strategyName: string
  ): void {
    this.performanceStats.totalProcessed++;
    this.performanceStats.totalProcessingTime += executionTime;

    if (success) {
      this.performanceStats.successCount++;
    } else {
      this.performanceStats.failureCount++;
    }

    this.performanceStats.averageProcessingTime =
      this.performanceStats.totalProcessingTime / this.performanceStats.totalProcessed;

    // 更新策略使用统计
    this.performanceStats.strategyUsage[strategyName] =
      (this.performanceStats.strategyUsage[strategyName] || 0) + 1;
  }

  /**
   * 获取性能统计
   * @returns 性能统计
   */
  getPerformanceStats(): ProcessingPerformanceStats {
    return { ...this.performanceStats };
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.performanceStats = this.initializePerformanceStats();
  }
}

/**
 * 处理请求接口
 */
export interface ProcessingRequest {
  /** 代码内容 */
  content: string;
  /** 编程语言 */
  language: string;
  /** 文件路径（可选） */
  filePath?: string;
  /** AST节点（可选） */
  ast?: any;
  /** 文件特征（可选） */
  features?: FileFeatures;
  /** 节点跟踪器（可选） */
  nodeTracker?: any;
}

/**
 * 处理性能统计接口
 */
export interface ProcessingPerformanceStats {
  /** 总处理次数 */
  totalProcessed: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均处理时间 */
  averageProcessingTime: number;
  /** 总处理时间 */
  totalProcessingTime: number;
  /** 策略使用统计 */
  strategyUsage: Record<string, number>;
  /** 语言使用统计 */
  languageUsage: Record<string, number>;
}