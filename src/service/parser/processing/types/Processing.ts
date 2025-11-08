/**
 * 处理相关类型定义
 * 定义处理结果、策略选项和处理流程相关类型
 */

import { CodeChunk } from './CodeChunk';

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
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 是否启用性能监控 */
  enableMonitoring?: boolean;
  /** 是否启用后处理 */
  enablePostProcessing?: boolean;
  /** 自定义策略参数 */
  customParams?: Record<string, any>;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 结果元数据接口
 */
export interface ResultMetadata {
  /** 编程语言（可选） */
  language?: string;
  /** 文件路径（可选） */
  filePath?: string;
  /** 代码块数量 */
  chunkCount: number;
  /** 平均块大小（可选） */
  averageChunkSize?: number;
  /** 总大小（可选） */
  totalSize?: number;
  /** 处理开始时间 */
  startTime?: number;
  /** 处理结束时间 */
  endTime?: number;
  /** 使用的策略（可选） */
  strategy?: string;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 处理结果接口
 */
export interface ProcessingResult {
  /** 分割后的代码块数组 */
  chunks: CodeChunk[];
  /** 处理是否成功 */
  success: boolean;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 使用的策略名称 */
  strategy: string;
  /** 错误信息（如果有） */
  error?: string;
  /** 结果元数据 */
  metadata?: ResultMetadata;
}

/**
 * 处理状态枚举
 */
export enum ProcessingStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * 处理任务接口
 */
export interface ProcessingTask {
  /** 任务ID */
  id: string;
  /** 输入内容 */
  content: string;
  /** 编程语言 */
  language: string;
  /** 文件路径（可选） */
  filePath?: string;
  /** 处理选项 */
  options?: ProcessingOptions;
  /** 任务状态 */
  status: ProcessingStatus;
  /** 创建时间 */
  createdAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 处理结果 */
  result?: ProcessingResult;
  /** 错误信息 */
  error?: string;
}

/**
 * 处理统计信息接口
 */
export interface ProcessingStats {
  /** 总处理次数 */
  totalProcessed: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均处理时间 */
  averageProcessingTime: number;
  /** 最快处理时间 */
  fastestProcessingTime: number;
  /** 最慢处理时间 */
  slowestProcessingTime: number;
  /** 各策略使用次数 */
  strategyUsage: Record<string, number>;
  /** 各语言处理次数 */
  languageUsage: Record<string, number>;
}

/**
 * 处理结果构建器类
 */
export class ProcessingResultBuilder {
  private result: Partial<ProcessingResult> = {};

  constructor(strategy: string) {
    this.result.strategy = strategy;
    this.result.success = false;
    this.result.chunks = [];
    this.result.executionTime = 0;
  }

  setChunks(chunks: CodeChunk[]): ProcessingResultBuilder {
    this.result.chunks = chunks;
    return this;
  }

  setSuccess(success: boolean): ProcessingResultBuilder {
    this.result.success = success;
    return this;
  }

  setExecutionTime(executionTime: number): ProcessingResultBuilder {
    this.result.executionTime = executionTime;
    return this;
  }

  setError(error: string): ProcessingResultBuilder {
    this.result.error = error;
    this.result.success = false;
    return this;
  }

  setMetadata(metadata: ResultMetadata): ProcessingResultBuilder {
    this.result.metadata = metadata;
    return this;
  }

  build(): ProcessingResult {
    // 验证必需字段
    if (!this.result.strategy) {
      throw new Error('ProcessingResult strategy is required');
    }
    if (!this.result.chunks) {
      throw new Error('ProcessingResult chunks is required');
    }

    // 如果没有设置元数据，自动生成基本元数据
    if (!this.result.metadata) {
      this.result.metadata = this.generateDefaultMetadata();
    }

    return this.result as ProcessingResult;
  }

  private generateDefaultMetadata(): ResultMetadata {
    const chunks = this.result.chunks || [];
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    const averageChunkSize = chunks.length > 0 ? totalSize / chunks.length : 0;

    return {
      language: 'unknown',
      chunkCount: chunks.length,
      averageChunkSize,
      totalSize,
      strategy: this.result.strategy || 'unknown'
    };
  }
}

/**
 * 处理工具函数
 */
export class ProcessingUtils {
  /**
   * 创建成功的处理结果
   */
  static createSuccessResult(
    chunks: CodeChunk[],
    strategy: string,
    executionTime: number,
    metadata?: Partial<ResultMetadata>
  ): ProcessingResult {
    const defaultMetadata: ResultMetadata = {
      language: 'unknown',
      chunkCount: chunks.length,
      averageChunkSize: chunks.length > 0 
        ? chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length 
        : 0,
      totalSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
      strategy
    };

    return {
      chunks,
      success: true,
      executionTime,
      strategy,
      metadata: { ...defaultMetadata, ...metadata }
    };
  }

  /**
   * 创建失败的处理结果
   */
  static createFailureResult(
    strategy: string,
    executionTime: number,
    error: string
  ): ProcessingResult {
    return {
      chunks: [],
      success: false,
      executionTime,
      strategy,
      error
    };
  }

  /**
   * 验证处理结果
   */
  static validateResult(result: ProcessingResult): boolean {
    if (!result) return false;
    if (!Array.isArray(result.chunks)) return false;
    if (typeof result.success !== 'boolean') return false;
    if (typeof result.executionTime !== 'number') return false;
    if (!result.strategy) return false;
    
    // 如果成功，验证chunks不为空
    if (result.success && result.chunks.length === 0) return false;
    
    return true;
  }

  /**
   * 合并多个处理结果
   */
  static mergeResults(results: ProcessingResult[]): ProcessingResult {
    if (results.length === 0) {
      throw new Error('Cannot merge empty results array');
    }

    const allChunks = results.flatMap(r => r.chunks);
    const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    const allSuccessful = results.every(r => r.success);
    const primaryStrategy = results[0].strategy;

    const mergedMetadata: ResultMetadata = {
      language: results[0].metadata?.language || 'unknown',
      filePath: results[0].metadata?.filePath,
      chunkCount: allChunks.length,
      averageChunkSize: allChunks.length > 0 
        ? allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / allChunks.length 
        : 0,
      totalSize: allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
      strategy: primaryStrategy,
      mergedFrom: results.map(r => ({ strategy: r.strategy, chunkCount: r.chunks.length }))
    };

    return {
      chunks: allChunks,
      success: allSuccessful,
      executionTime: totalExecutionTime,
      strategy: primaryStrategy,
      metadata: mergedMetadata
    };
  }
}