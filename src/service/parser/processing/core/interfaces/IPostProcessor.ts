/**
 * 后处理器接口
 * 定义了代码块后处理的基本契约
 */
export interface IPostProcessor {
  /** 处理器名称 */
  readonly name: string;
  
  /** 处理器优先级，数值越小优先级越高 */
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
  
  /**
   * 获取处理器性能统计（可选实现）
   * @returns 性能统计
   */
  getPerformanceStats?(): PostProcessorPerformanceStats;
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
  
  /** 使用的策略名称 */
  strategyName: string;
  
  /** 后处理元数据 */
  metadata?: PostProcessingMetadata;
  
  /** 额外的上下文数据 */
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
  
  /** 处理开始时间 */
  startTime: number;
  
  /** 处理器执行顺序 */
  processorOrder: string[];
  
  /** 额外的元数据 */
  [key: string]: any;
}

/**
 * 后处理器性能统计接口
 */
export interface PostProcessorPerformanceStats {
  /** 总执行次数 */
  totalExecutions: number;
  
  /** 成功执行次数 */
  successfulExecutions: number;
  
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  
  /** 最后执行时间 */
  lastExecutionTime: number;
  
  /** 错误次数 */
  errorCount: number;
  
  /** 平均优化比例 */
  averageOptimizationRatio: number;
}

// 导入相关类型，避免循环依赖
import type { CodeChunk } from '../types/ResultTypes';
import type { ProcessingConfig } from '../types/ConfigTypes';