/**
 * 策略基类
 * 提供策略实现的通用逻辑和性能统计功能
 */

import type { IProcessingStrategy } from '../../core/interfaces/IProcessingStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../types/Processing';
import type { StrategyConfig, StrategyPerformanceStats } from '../../types/Strategy';
import { ProcessingUtils } from '../../types/Processing';
import { CodeChunkBuilder, ChunkType } from '../../types/CodeChunk';

/**
 * 策略基类抽象实现
 */
export abstract class BaseStrategy implements IProcessingStrategy {
  /** 策略名称 */
  public readonly name: string;
  
  /** 策略优先级 */
  public readonly priority: number;
  
  /** 支持的编程语言列表 */
  public readonly supportedLanguages: string[];
  
  /** 策略配置 */
  protected readonly config: StrategyConfig;
  
  /** 性能统计 */
  protected performanceStats: StrategyPerformanceStats;

  constructor(config: StrategyConfig) {
    this.name = config.name;
    this.priority = config.priority;
    this.supportedLanguages = config.supportedLanguages;
    this.config = config;
    this.performanceStats = this.initializeStats();
  }

  /**
   * 判断是否可以处理给定的上下文
   * 子类应该重写此方法以提供特定的处理逻辑
   */
  abstract canHandle(context: IProcessingContext): boolean;

  /**
   * 执行代码分割策略
   * 子类应该重写此方法以提供特定的分割逻辑
   */
  abstract execute(context: IProcessingContext): Promise<ProcessingResult>;

  /**
   * 验证上下文是否有效
   * 提供基本的验证逻辑，子类可以重写以添加特定验证
   */
  validateContext(context: IProcessingContext): boolean {
    if (!context) {
      return false;
    }
    
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }
    
    if (!context.language || context.language.trim().length === 0) {
      return false;
    }
    
    if (!context.config) {
      return false;
    }
    
    return true;
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): StrategyPerformanceStats {
    return { ...this.performanceStats };
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.performanceStats = this.initializeStats();
  }

  /**
   * 创建代码块
   */
  protected createChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    type: ChunkType = ChunkType.GENERIC,
    additionalMetadata?: Record<string, any>
  ) {
    return new CodeChunkBuilder()
      .setContent(content)
      .setStartLine(startLine)
      .setEndLine(endLine)
      .setLanguage(language)
      .setStrategy(this.name)
      .setType(type)
      .addMetadata('filePath', additionalMetadata?.filePath)
      .addMetadata('complexity', additionalMetadata?.complexity)
      .addMetadata('hash', additionalMetadata?.hash)
      .addMetadata('functionName', additionalMetadata?.functionName)
      .addMetadata('className', additionalMetadata?.className)
      .addMetadata('nodeIds', additionalMetadata?.nodeIds)
      .build();
  }

  /**
   * 创建成功的处理结果
   */
  protected createSuccessResult(
    chunks: any[],
    executionTime: number,
    additionalMetadata?: Record<string, any>
  ): ProcessingResult {
    return ProcessingUtils.createSuccessResult(
      chunks,
      this.name,
      executionTime,
      additionalMetadata
    );
  }

  /**
   * 创建失败的处理结果
   */
  protected createFailureResult(
    executionTime: number,
    error: string
  ): ProcessingResult {
    return ProcessingUtils.createFailureResult(
      this.name,
      executionTime,
      error
    );
  }

  /**
   * 更新性能统计
   */
  protected updatePerformanceStats(executionTime: number, success: boolean, chunkCount: number): void {
    const totalExecutions = this.performanceStats.totalExecutions + 1;
    const successCount = success ? this.performanceStats.successCount + 1 : this.performanceStats.successCount;
    const failureCount = success ? this.performanceStats.failureCount : this.performanceStats.failureCount + 1;
    const totalChunksProcessed = this.performanceStats.totalChunksProcessed + chunkCount;
    
    // 计算新的平均执行时间
    const currentTotalTime = this.performanceStats.averageExecutionTime * this.performanceStats.totalExecutions;
    const averageExecutionTime = (currentTotalTime + executionTime) / totalExecutions;
    
    // 更新最快和最慢执行时间
    const fastestExecutionTime = Math.min(this.performanceStats.fastestExecutionTime, executionTime);
    const slowestExecutionTime = Math.max(this.performanceStats.slowestExecutionTime, executionTime);
    
    // 计算平均每块处理时间
    const averageTimePerChunk = totalChunksProcessed > 0 
      ? (averageExecutionTime * totalExecutions) / totalChunksProcessed 
      : 0;

    this.performanceStats = {
      totalExecutions,
      successCount,
      failureCount,
      averageExecutionTime,
      fastestExecutionTime,
      slowestExecutionTime,
      totalChunksProcessed,
      averageTimePerChunk,
      lastExecutionTime: Date.now(),
      lastExecutionSuccess: success
    };
  }

  /**
   * 初始化性能统计
   */
  private initializeStats(): StrategyPerformanceStats {
    return {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      fastestExecutionTime: 0,
      slowestExecutionTime: 0,
      totalChunksProcessed: 0,
      averageTimePerChunk: 0,
      lastExecutionTime: 0,
      lastExecutionSuccess: false
    };
  }

  /**
   * 检查是否支持指定语言
   */
  protected supportsLanguage(language: string): boolean {
    return this.supportedLanguages.includes('*') || 
           this.supportedLanguages.includes(language.toLowerCase());
  }

  /**
   * 计算代码复杂度
   * 提供基本的复杂度计算，子类可以重写以提供更精确的计算
   */
  protected calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }

  /**
   * 执行策略并自动处理性能统计
   */
  async executeWithStats(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.execute(context);
      const executionTime = Date.now() - startTime;
      
      this.updatePerformanceStats(executionTime, result.success, result.chunks.length);
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.updatePerformanceStats(executionTime, false, 0);
      
      return this.createFailureResult(executionTime, errorMessage);
    }
  }
}