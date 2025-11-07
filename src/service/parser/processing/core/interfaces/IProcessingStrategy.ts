/**
 * 处理策略接口
 * 定义了代码分割策略的基本契约
 */
export interface IProcessingStrategy {
  /** 策略名称 */
  readonly name: string;
  
  /** 策略优先级，数值越小优先级越高 */
  readonly priority: number;
  
  /** 支持的编程语言列表，'*' 表示支持所有语言 */
  readonly supportedLanguages: string[];
  
  /**
   * 判断是否可以处理给定的上下文
   * @param context 处理上下文
   * @returns 是否可以处理
   */
  canHandle(context: IProcessingContext): boolean;
  
  /**
   * 执行代码分割策略
   * @param context 处理上下文
   * @returns 处理结果
   */
  execute(context: IProcessingContext): Promise<ProcessingResult>;
  
  /**
   * 验证上下文是否有效（可选实现）
   * @param context 处理上下文
   * @returns 是否有效
   */
  validateContext?(context: IProcessingContext): boolean;
  
  /**
   * 获取性能统计信息（可选实现）
   * @returns 性能统计
   */
  getPerformanceStats?(): StrategyPerformanceStats;
}

/**
 * 策略性能统计接口
 */
export interface StrategyPerformanceStats {
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
}

// 导入相关类型，避免循环依赖
import type { IProcessingContext } from './IProcessingContext';
import type { ProcessingResult } from '../types/ResultTypes';