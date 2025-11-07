/**
 * 处理相关类型定义
 * 定义了代码处理过程中的核心类型
 */

/**
 * 处理策略枚举
 */
export enum ProcessingStrategy {
  LINE = 'line',
  SEMANTIC = 'semantic',
  AST = 'ast',
  BRACKET = 'bracket',
  HYBRID = 'hybrid'
}

/**
 * 处理选项接口
 */
export interface ProcessingOptions {
  /** 强制使用指定策略 */
  forceStrategy?: ProcessingStrategy;

  /** 跳过后处理 */
  skipPostProcessing?: boolean;

  /** 启用性能监控 */
  enablePerformanceMonitoring?: boolean;

  /** 自定义参数 */
  customParams?: Record<string, any>;
}

/**
 * 处理状态枚举
 */
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * 处理优先级枚举
 */
export enum ProcessingPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3
}

/**
 * 处理任务接口
 */
export interface ProcessingTask {
  /** 任务ID */
  id: string;

  /** 处理内容 */
  content: string;

  /** 编程语言 */
  language: string;

  /** 文件路径 */
  filePath?: string;

  /** 处理选项 */
  options?: ProcessingOptions;

  /** 处理状态 */
  status: ProcessingStatus;

  /** 优先级 */
  priority: ProcessingPriority;

  /** 创建时间 */
  createdAt: number;

  /** 开始时间 */
  startedAt?: number;

  /** 完成时间 */
  completedAt?: number;

  /** 错误信息 */
  error?: string;

  /** 结果 */
  result?: ProcessingResult;
}

/**
 * 处理器统计信息接口
 */
export interface ProcessingStatistics {
  /** 总处理次数 */
  totalProcessed: number;

  /** 成功处理次数 */
  successfulProcessed: number;

  /** 失败处理次数 */
  failedProcessed: number;

  /** 平均处理时间 */
  averageProcessingTime: number;

  /** 按策略分组的统计 */
  strategyStats: Record<string, StrategyStatistics>;

  /** 按语言分组的统计 */
  languageStats: Record<string, LanguageStatistics>;

  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 策略统计信息接口
 */
export interface StrategyStatistics {
  /** 策略名称 */
  strategy: string;

  /** 使用次数 */
  usageCount: number;

  /** 成功次数 */
  successCount: number;

  /** 平均执行时间 */
  averageExecutionTime: number;

  /** 最后使用时间 */
  lastUsed: number;
}

/**
 * 语言统计信息接口
 */
export interface LanguageStatistics {
  /** 语言名称 */
  language: string;

  /** 处理次数 */
  processedCount: number;

  /** 平均块数量 */
  averageChunkCount: number;

  /** 平均处理时间 */
  averageProcessingTime: number;

  /** 最常用的策略 */
  mostUsedStrategy: string;
}

// 导入相关类型，避免循环依赖
import type { ProcessingResult, ProcessingPerformanceMetrics } from './ResultTypes';