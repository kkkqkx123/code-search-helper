/**
 * 策略基类
 * 提供策略实现的通用逻辑和性能统计功能
 */

import type { IProcessingStrategy, StrategyPerformanceStats } from '../../core/interfaces/IProcessingStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult, ResultMetadata, CodeChunk } from '../../core/types/ResultTypes';
import { ChunkType } from '../../core/types/ResultTypes';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkFactory, ChunkCreationConfig } from '../../../../../utils/processing/ChunkFactory';
import { UNIFIED_STRATEGY_PRIORITIES } from '../../../constants/StrategyPriorities';

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
    // 从 UNIFIED_STRATEGY_PRIORITIES 中获取优先级，不再从 config 中读取
    this.priority = UNIFIED_STRATEGY_PRIORITIES[config.name] || 999; // 默认优先级为999（最低）
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
  ): CodeChunk {
    // 合并元数据
    const metadata = {
      ...additionalMetadata,
      strategy: this.name
    };

    // 使用ChunkFactory创建代码块，提供自动复杂度计算和验证
    return ChunkFactory.createCodeChunk(
      content,
      startLine,
      endLine,
      language,
      type,
      metadata,
      this.getChunkCreationConfig()
    );
  }

  /**
  * 创建成功的处理结果
  */
  protected createSuccessResult(
  chunks: any[],
  executionTime: number,
  additionalMetadata?: Record<string, any>
  ): ProcessingResult {
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
  const averageChunkSize = chunks.length > 0 ? totalSize / chunks.length : 0;
  const originalSize = additionalMetadata?.originalSize || totalSize;
  const compressionRatio = originalSize > 0 ? totalSize / originalSize : 1;

  const metadata: ResultMetadata = {
      language: additionalMetadata?.language || 'unknown',
       filePath: additionalMetadata?.filePath,
       chunkCount: chunks.length,
       averageChunkSize,
       totalSize,
       originalSize,
       compressionRatio,
       startTime: additionalMetadata?.startTime || Date.now() - executionTime,
       endTime: additionalMetadata?.endTime || Date.now(),
       ...additionalMetadata
     };

     return {
       chunks,
       success: true,
       executionTime,
       strategy: this.name,
       metadata
     };
   }

  /**
  * 创建失败的处理结果
  */
  protected createFailureResult(
  executionTime: number,
  error: string
  ): ProcessingResult {
  return {
  chunks: [],
  success: false,
  executionTime,
    strategy: this.name,
      error
     };
   }

  /**
  * 更新性能统计
  */
  protected updatePerformanceStats(executionTime: number, success: boolean, chunkCount: number): void {
  const totalExecutions = this.performanceStats.totalExecutions + 1;
  const successfulExecutions = success ? this.performanceStats.successfulExecutions + 1 : this.performanceStats.successfulExecutions;
  const errorCount = success ? this.performanceStats.errorCount : this.performanceStats.errorCount + 1;

  // 计算新的平均执行时间
  const currentTotalTime = this.performanceStats.averageExecutionTime * this.performanceStats.totalExecutions;
  const averageExecutionTime = (currentTotalTime + executionTime) / totalExecutions;

  this.performanceStats = {
    totalExecutions,
    successfulExecutions,
    averageExecutionTime,
    lastExecutionTime: Date.now(),
    errorCount
  };
  }

  /**
  * 初始化性能统计
  */
  private initializeStats(): StrategyPerformanceStats {
  return {
  totalExecutions: 0,
  successfulExecutions: 0,
  averageExecutionTime: 0,
  lastExecutionTime: 0,
  errorCount: 0
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
   * 获取代码块创建配置
   */
  protected getChunkCreationConfig(): ChunkCreationConfig {
    return {
      autoCalculateComplexity: true,
      autoGenerateHash: true,
      defaultStrategy: this.name,
      validateRequired: true
    };
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