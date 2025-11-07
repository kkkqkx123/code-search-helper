/**
 * 策略类型定义
 * 定义策略配置、结果和性能统计相关类型
 */

import { ProcessingConfig } from './Config';

/**
 * 策略配置接口
 */
export interface StrategyConfig {
  /** 策略名称 */
  name: string;
  /** 策略优先级 */
  priority: number;
  /** 支持的编程语言列表 */
  supportedLanguages: string[];
  /** 策略特定参数 */
  parameters?: Record<string, any>;
  /** 是否启用 */
  enabled: boolean;
  /** 策略描述 */
  description?: string;
}

/**
 * 策略结果接口
 */
export interface StrategyResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果有） */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 处理的块数量 */
  chunkCount: number;
  /** 策略特定数据 */
  data?: Record<string, any>;
}

/**
 * 策略性能统计接口
 */
export interface StrategyPerformanceStats {
  /** 总执行次数 */
  totalExecutions: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 最快执行时间 */
  fastestExecutionTime: number;
  /** 最慢执行时间 */
  slowestExecutionTime: number;
  /** 总处理块数 */
  totalChunksProcessed: number;
  /** 平均每块处理时间 */
  averageTimePerChunk: number;
  /** 最后执行时间 */
  lastExecutionTime: number;
  /** 最后执行是否成功 */
  lastExecutionSuccess: boolean;
}

/**
 * 策略选择条件接口
 */
export interface StrategySelectionCriteria {
  /** 文件大小范围 */
  fileSizeRange?: {
    min: number;
    max: number;
  };
  /** 行数范围 */
  lineCountRange?: {
    min: number;
    max: number;
  };
  /** 复杂度范围 */
  complexityRange?: {
    min: number;
    max: number;
  };
  /** 语言列表 */
  languages?: string[];
  /** 文件特征 */
  features?: {
    hasImports?: boolean;
    hasExports?: boolean;
    hasFunctions?: boolean;
    hasClasses?: boolean;
    isStructured?: boolean;
  };
  /** 自定义条件函数 */
  customCondition?: (context: any) => boolean;
}

/**
 * 策略注册信息接口
 */
export interface StrategyRegistration {
  /** 策略类构造函数 */
  strategyClass: StrategyConstructor;
  /** 策略配置 */
  config: StrategyConfig;
  /** 注册时间 */
  registeredAt: number;
  /** 注册者信息 */
  registeredBy?: string;
}

/**
 * 策略构造函数类型
 */
export type StrategyConstructor = new (config: StrategyConfig) => IStrategy;

/**
 * 策略接口
 */
export interface IStrategy {
  /** 策略名称 */
  readonly name: string;
  /** 策略优先级 */
  readonly priority: number;
  /** 支持的编程语言列表 */
  readonly supportedLanguages: string[];
  
  /**
   * 判断是否可以处理给定的上下文
   * @param context 处理上下文
   * @returns 是否可以处理
   */
  canHandle(context: any): boolean;
  
  /**
   * 执行策略
   * @param context 处理上下文
   * @returns 策略结果
   */
  execute(context: any): Promise<StrategyResult>;
  
  /**
   * 验证上下文（可选）
   * @param context 处理上下文
   * @returns 是否有效
   */
  validateContext?(context: any): boolean;
  
  /**
   * 获取性能统计（可选）
   * @returns 性能统计
   */
  getPerformanceStats?(): StrategyPerformanceStats;
  
  /**
   * 重置性能统计（可选）
   */
  resetPerformanceStats?(): void;
}

/**
 * 策略工厂配置接口
 */
export interface StrategyFactoryConfig {
  /** 默认策略名称 */
  defaultStrategy: string;
  /** 是否启用缓存 */
  enableCaching: boolean;
  /** 缓存大小限制 */
  cacheSizeLimit: number;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;
  /** 策略选择超时时间（毫秒） */
  selectionTimeout: number;
}

/**
 * 策略选择结果接口
 */
export interface StrategySelectionResult {
  /** 选中的策略 */
  strategy: IStrategy;
  /** 选择原因 */
  reason: string;
  /** 选择分数 */
  score: number;
  /** 候选策略列表 */
  candidates: Array<{
    strategy: IStrategy;
    score: number;
    reason: string;
  }>;
}

/**
 * 策略性能统计构建器类
 */
export class StrategyPerformanceStatsBuilder {
  private stats: Partial<StrategyPerformanceStats> = {};

  constructor() {
    this.stats.totalExecutions = 0;
    this.stats.successCount = 0;
    this.stats.failureCount = 0;
    this.stats.averageExecutionTime = 0;
    this.stats.fastestExecutionTime = Infinity;
    this.stats.slowestExecutionTime = 0;
    this.stats.totalChunksProcessed = 0;
    this.stats.averageTimePerChunk = 0;
  }

  recordExecution(executionTime: number, success: boolean, chunkCount: number): StrategyPerformanceStatsBuilder {
    this.stats.totalExecutions = (this.stats.totalExecutions || 0) + 1;
    
    if (success) {
      this.stats.successCount = (this.stats.successCount || 0) + 1;
    } else {
      this.stats.failureCount = (this.stats.failureCount || 0) + 1;
    }
    
    this.stats.totalChunksProcessed = (this.stats.totalChunksProcessed || 0) + chunkCount;
    this.stats.lastExecutionTime = Date.now();
    this.stats.lastExecutionSuccess = success;
    
    // 更新执行时间统计
    const currentTotal = this.stats.averageExecutionTime * (this.stats.totalExecutions - 1);
    this.stats.averageExecutionTime = (currentTotal + executionTime) / this.stats.totalExecutions;
    
    this.stats.fastestExecutionTime = Math.min(this.stats.fastestExecutionTime, executionTime);
    this.stats.slowestExecutionTime = Math.max(this.stats.slowestExecutionTime, executionTime);
    
    // 更新平均每块处理时间
    this.stats.averageTimePerChunk = this.stats.totalChunksProcessed > 0 
      ? (this.stats.averageExecutionTime * this.stats.totalExecutions) / this.stats.totalChunksProcessed 
      : 0;
    
    return this;
  }

  build(): StrategyPerformanceStats {
    return {
      totalExecutions: this.stats.totalExecutions || 0,
      successCount: this.stats.successCount || 0,
      failureCount: this.stats.failureCount || 0,
      averageExecutionTime: this.stats.averageExecutionTime || 0,
      fastestExecutionTime: this.stats.fastestExecutionTime === Infinity ? 0 : this.stats.fastestExecutionTime,
      slowestExecutionTime: this.stats.slowestExecutionTime || 0,
      totalChunksProcessed: this.stats.totalChunksProcessed || 0,
      averageTimePerChunk: this.stats.averageTimePerChunk || 0,
      lastExecutionTime: this.stats.lastExecutionTime || 0,
      lastExecutionSuccess: this.stats.lastExecutionSuccess || false
    };
  }
}

/**
 * 策略工具函数
 */
export class StrategyUtils {
  /**
   * 创建成功的策略结果
   */
  static createSuccessResult(
    chunkCount: number,
    executionTime: number,
    data?: Record<string, any>
  ): StrategyResult {
    return {
      success: true,
      executionTime,
      chunkCount,
      data
    };
  }

  /**
   * 创建失败的策略结果
   */
  static createFailureResult(
    executionTime: number,
    error: string
  ): StrategyResult {
    return {
      success: false,
      executionTime,
      error,
      chunkCount: 0
    };
  }

  /**
   * 验证策略配置
   */
  static validateStrategyConfig(config: StrategyConfig): boolean {
    if (!config) return false;
    if (!config.name || typeof config.name !== 'string') return false;
    if (typeof config.priority !== 'number') return false;
    if (!Array.isArray(config.supportedLanguages)) return false;
    if (typeof config.enabled !== 'boolean') return false;
    
    return true;
  }

  /**
   * 检查策略是否支持指定语言
   */
  static supportsLanguage(strategy: IStrategy, language: string): boolean {
    return strategy.supportedLanguages.includes('*') || 
           strategy.supportedLanguages.includes(language);
  }

  /**
   * 计算策略匹配分数
   */
  static calculateStrategyScore(
    strategy: IStrategy,
    context: any,
    criteria: StrategySelectionCriteria
  ): number {
    let score = 0;
    
    // 语言匹配分数
    if (criteria.languages && criteria.languages.length > 0) {
      if (this.supportsLanguage(strategy, context.language)) {
        score += 30;
      }
    } else {
      score += 10; // 基础分数
    }
    
    // 优先级分数
    score += Math.max(0, 100 - strategy.priority);
    
    // 文件大小匹配
    if (criteria.fileSizeRange) {
      const { min, max } = criteria.fileSizeRange;
      if (context.metadata.size >= min && context.metadata.size <= max) {
        score += 20;
      }
    }
    
    // 行数匹配
    if (criteria.lineCountRange) {
      const { min, max } = criteria.lineCountRange;
      if (context.metadata.lineCount >= min && context.metadata.lineCount <= max) {
        score += 15;
      }
    }
    
    // 复杂度匹配
    if (criteria.complexityRange) {
      const { min, max } = criteria.complexityRange;
      if (context.metadata.complexity >= min && context.metadata.complexity <= max) {
        score += 15;
      }
    }
    
    // 特征匹配
    if (criteria.features) {
      let featureScore = 0;
      const features = criteria.features;
      
      if (features.hasImports && context.metadata.hasImports) featureScore += 5;
      if (features.hasExports && context.metadata.hasExports) featureScore += 5;
      if (features.hasFunctions && context.metadata.hasFunctions) featureScore += 5;
      if (features.hasClasses && context.metadata.hasClasses) featureScore += 5;
      if (features.isStructured && context.metadata.isStructuredFile) featureScore += 10;
      
      score += featureScore;
    }
    
    // 自定义条件
    if (criteria.customCondition && criteria.customCondition(context)) {
      score += 25;
    }
    
    return score;
  }

  /**
   * 创建默认策略配置
   */
  static createDefaultStrategyConfig(
    name: string,
    priority: number,
    supportedLanguages: string[]
  ): StrategyConfig {
    return {
      name,
      priority,
      supportedLanguages,
      enabled: true,
      description: `${name} strategy for ${supportedLanguages.join(', ')}`
    };
  }

  /**
   * 合并策略性能统计
   */
  static mergePerformanceStats(
    stats1: StrategyPerformanceStats,
    stats2: StrategyPerformanceStats
  ): StrategyPerformanceStats {
    const totalExecutions = stats1.totalExecutions + stats2.totalExecutions;
    const successCount = stats1.successCount + stats2.successCount;
    const failureCount = stats1.failureCount + stats2.failureCount;
    const totalChunksProcessed = stats1.totalChunksProcessed + stats2.totalChunksProcessed;
    
    // 计算加权平均执行时间
    const averageExecutionTime = totalExecutions > 0 
      ? (stats1.averageExecutionTime * stats1.totalExecutions + 
         stats2.averageExecutionTime * stats2.totalExecutions) / totalExecutions 
      : 0;
    
    // 计算加权平均每块处理时间
    const averageTimePerChunk = totalChunksProcessed > 0 
      ? (stats1.averageTimePerChunk * stats1.totalChunksProcessed + 
         stats2.averageTimePerChunk * stats2.totalChunksProcessed) / totalChunksProcessed 
      : 0;
    
    return {
      totalExecutions,
      successCount,
      failureCount,
      averageExecutionTime,
      fastestExecutionTime: Math.min(stats1.fastestExecutionTime, stats2.fastestExecutionTime),
      slowestExecutionTime: Math.max(stats1.slowestExecutionTime, stats2.slowestExecutionTime),
      totalChunksProcessed,
      averageTimePerChunk,
      lastExecutionTime: Math.max(stats1.lastExecutionTime, stats2.lastExecutionTime),
      lastExecutionSuccess: stats2.lastExecutionSuccess // 使用最新的执行结果
    };
  }
}