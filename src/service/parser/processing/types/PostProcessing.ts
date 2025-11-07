/**
 * 后处理类型定义
 * 定义后处理器接口、上下文和结果类型
 */

import { CodeChunk } from './CodeChunk';
import { ProcessingConfig } from './Config';

/**
 * 后处理器接口
 */
export interface PostProcessor {
  /** 处理器名称 */
  readonly name: string;
  /** 处理器优先级（数值越小优先级越高） */
  readonly priority: number;
  
  /**
   * 判断是否应该应用此处理器
   * @param chunks 代码块数组
   * @param context 后处理上下文
   * @returns 是否应该应用
   */
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean;
  
  /**
   * 执行后处理
   * @param chunks 代码块数组
   * @param context 后处理上下文
   * @returns 处理后的代码块数组
   */
  process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;
}

/**
 * 后处理上下文接口
 */
export interface PostProcessingContext {
  /** 原始内容 */
  originalContent: string;
  /** 编程语言 */
  language: string;
  /** 文件路径（可选） */
  filePath?: string;
  /** 处理配置 */
  config: ProcessingConfig;
  /** 策略名称 */
  strategyName: string;
  /** 后处理元数据 */
  metadata?: PostProcessingMetadata;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 后处理元数据接口
 */
export interface PostProcessingMetadata {
  /** 原始块数量 */
  originalChunkCount: number;
  /** 处理后块数量 */
  processedChunkCount: number;
  /** 优化比例 */
  optimizationRatio: number;
  /** 处理轮次 */
  processingRounds: number;
  /** 处理开始时间 */
  startTime: number;
  /** 处理结束时间 */
  endTime?: number;
  /** 应用的处理器列表 */
  appliedProcessors: string[];
  /** 处理器执行时间映射 */
  processorExecutionTimes: Record<string, number>;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 后处理结果接口
 */
export interface PostProcessingResult {
  /** 处理后的代码块数组 */
  chunks: CodeChunk[];
  /** 处理器名称 */
  processor: string;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果有） */
  error?: string;
  /** 处理统计信息 */
  stats?: PostProcessingStats;
}

/**
 * 后处理统计信息接口
 */
export interface PostProcessingStats {
  /** 处理前块数量 */
  beforeCount: number;
  /** 处理后块数量 */
  afterCount: number;
  /** 合并的块数量 */
  mergedCount: number;
  /** 分割的块数量 */
  splitCount: number;
  /** 过滤的块数量 */
  filteredCount: number;
  /** 优化的块数量 */
  optimizedCount: number;
  /** 平均块大小变化 */
  averageSizeChange: number;
  /** 总大小变化 */
  totalSizeChange: number;
}

/**
 * 后处理协调器配置接口
 */
export interface PostProcessorCoordinatorConfig {
  /** 最大处理轮次 */
  maxRounds: number;
  /** 是否启用并行处理 */
  enableParallelProcessing: boolean;
  /** 是否启用早期终止 */
  enableEarlyTermination: boolean;
  /** 早期终止阈值（连续无变化轮次） */
  earlyTerminationThreshold: number;
  /** 是否启用详细日志 */
  enableVerboseLogging: boolean;
}

/**
 * 后处理任务接口
 */
export interface PostProcessingTask {
  /** 任务ID */
  id: string;
  /** 输入代码块 */
  inputChunks: CodeChunk[];
  /** 后处理上下文 */
  context: PostProcessingContext;
  /** 任务状态 */
  status: PostProcessingTaskStatus;
  /** 创建时间 */
  createdAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 当前轮次 */
  currentRound: number;
  /** 结果 */
  result?: PostProcessingResult;
  /** 错误信息 */
  error?: string;
}

/**
 * 后处理任务状态枚举
 */
export enum PostProcessingTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * 后处理结果构建器类
 */
export class PostProcessingResultBuilder {
  private result: Partial<PostProcessingResult> = {};

  constructor(processor: string) {
    this.result.processor = processor;
    this.result.success = false;
    this.result.executionTime = 0;
  }

  setChunks(chunks: CodeChunk[]): PostProcessingResultBuilder {
    this.result.chunks = chunks;
    return this;
  }

  setExecutionTime(executionTime: number): PostProcessingResultBuilder {
    this.result.executionTime = executionTime;
    return this;
  }

  setSuccess(success: boolean): PostProcessingResultBuilder {
    this.result.success = success;
    return this;
  }

  setError(error: string): PostProcessingResultBuilder {
    this.result.error = error;
    this.result.success = false;
    return this;
  }

  setStats(stats: PostProcessingStats): PostProcessingResultBuilder {
    this.result.stats = stats;
    return this;
  }

  build(): PostProcessingResult {
    // 验证必需字段
    if (!this.result.processor) {
      throw new Error('PostProcessingResult processor is required');
    }
    if (!this.result.chunks) {
      throw new Error('PostProcessingResult chunks is required');
    }

    return this.result as PostProcessingResult;
  }
}

/**
 * 后处理上下文构建器类
 */
export class PostProcessingContextBuilder {
  private context: Partial<PostProcessingContext> = {};

  constructor(originalContent: string, language: string, strategyName: string) {
    this.context.originalContent = originalContent;
    this.context.language = language;
    this.context.strategyName = strategyName;
  }

  setFilePath(filePath: string): PostProcessingContextBuilder {
    this.context.filePath = filePath;
    return this;
  }

  setConfig(config: ProcessingConfig): PostProcessingContextBuilder {
    this.context.config = config;
    return this;
  }

  setMetadata(metadata: PostProcessingMetadata): PostProcessingContextBuilder {
    this.context.metadata = metadata;
    return this;
  }

  addContext(key: string, value: any): PostProcessingContextBuilder {
    this.context[key] = value;
    return this;
  }

  build(): PostProcessingContext {
    // 验证必需字段
    if (!this.context.originalContent) {
      throw new Error('PostProcessingContext originalContent is required');
    }
    if (!this.context.language) {
      throw new Error('PostProcessingContext language is required');
    }
    if (!this.context.strategyName) {
      throw new Error('PostProcessingContext strategyName is required');
    }
    if (!this.context.config) {
      throw new Error('PostProcessingContext config is required');
    }

    return this.context as PostProcessingContext;
  }
}

/**
 * 后处理工具函数
 */
export class PostProcessingUtils {
  /**
   * 创建成功的后处理结果
   */
  static createSuccessResult(
    chunks: CodeChunk[],
    processor: string,
    executionTime: number,
    stats?: PostProcessingStats
  ): PostProcessingResult {
    return {
      chunks,
      processor,
      executionTime,
      success: true,
      stats
    };
  }

  /**
   * 创建失败的后处理结果
   */
  static createFailureResult(
    processor: string,
    executionTime: number,
    error: string
  ): PostProcessingResult {
    return {
      chunks: [],
      processor,
      executionTime,
      success: false,
      error
    };
  }

  /**
   * 计算后处理统计信息
   */
  static calculateStats(
    beforeChunks: CodeChunk[],
    afterChunks: CodeChunk[]
  ): PostProcessingStats {
    const beforeCount = beforeChunks.length;
    const afterCount = afterChunks.length;
    
    const beforeTotalSize = beforeChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    const afterTotalSize = afterChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    
    const beforeAverageSize = beforeCount > 0 ? beforeTotalSize / beforeCount : 0;
    const afterAverageSize = afterCount > 0 ? afterTotalSize / afterCount : 0;

    return {
      beforeCount,
      afterCount,
      mergedCount: Math.max(0, beforeCount - afterCount),
      splitCount: Math.max(0, afterCount - beforeCount),
      filteredCount: 0, // 需要根据具体实现计算
      optimizedCount: afterCount, // 简化处理
      averageSizeChange: afterAverageSize - beforeAverageSize,
      totalSizeChange: afterTotalSize - beforeTotalSize
    };
  }

  /**
   * 创建后处理元数据
   */
  static createMetadata(
    originalChunkCount: number,
    processedChunkCount: number,
    appliedProcessors: string[] = []
  ): PostProcessingMetadata {
    const optimizationRatio = originalChunkCount > 0 
      ? (originalChunkCount - processedChunkCount) / originalChunkCount 
      : 0;

    return {
      originalChunkCount,
      processedChunkCount,
      optimizationRatio,
      processingRounds: 1,
      startTime: Date.now(),
      appliedProcessors,
      processorExecutionTimes: {}
    };
  }

  /**
   * 验证后处理器
   */
  static validateProcessor(processor: PostProcessor): boolean {
    if (!processor) return false;
    if (!processor.name || typeof processor.name !== 'string') return false;
    if (typeof processor.priority !== 'number') return false;
    if (typeof processor.shouldApply !== 'function') return false;
    if (typeof processor.process !== 'function') return false;
    
    return true;
  }

  /**
   * 比较处理器优先级
   */
  static compareProcessorPriority(a: PostProcessor, b: PostProcessor): number {
    return a.priority - b.priority;
  }

  /**
   * 检查处理器是否已启用
   */
  static isProcessorEnabled(
    processor: PostProcessor,
    context: PostProcessingContext
  ): boolean {
    return context.config.postProcessing.enabledProcessors.includes(processor.name);
  }

  /**
   * 更新元数据
   */
  static updateMetadata(
    metadata: PostProcessingMetadata,
    processorName: string,
    executionTime: number
  ): PostProcessingMetadata {
    const updated = { ...metadata };
    updated.processorExecutionTimes[processorName] = executionTime;
    
    if (!updated.appliedProcessors.includes(processorName)) {
      updated.appliedProcessors.push(processorName);
    }
    
    return updated;
  }

  /**
   * 创建基本后处理上下文
   */
  static createBasicContext(
    originalContent: string,
    language: string,
    strategyName: string,
    config: ProcessingConfig,
    filePath?: string
  ): PostProcessingContext {
    return new PostProcessingContextBuilder(originalContent, language, strategyName)
      .setConfig(config)
      .setFilePath(filePath)
      .build();
  }
}