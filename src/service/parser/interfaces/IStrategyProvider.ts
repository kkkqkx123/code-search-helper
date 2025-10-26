import { ISplitStrategy, ChunkingOptions } from './ISplitStrategy';

/**
 * 策略提供者接口
 * 用于创建和管理分段策略实例
 */
export interface IStrategyProvider {
  /**
   * 获取策略提供者的名称
   */
  getName(): string;

  /**
   * 创建策略实例
   * @param options 分段选项
   */
  createStrategy(options?: ChunkingOptions): ISplitStrategy;

  /**
   * 获取策略提供者依赖的服务
   */
  getDependencies(): string[];
}

/**
 * 策略管理器配置接口
 */
export interface StrategyManagerConfig {
 /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;

  /** 是否启用缓存 */
  enableCaching: boolean;

  /** 缓存大小 */
  cacheSize: number;

  /** 最大执行时间（毫秒） */
 maxExecutionTime: number;

  /** 是否启用并行处理 */
  enableParallel: boolean;
}

/**
 * 策略执行上下文接口
 */
export interface StrategyExecutionContext {
  /** 语言 */
  language: string;

  /** 源代码 */
  sourceCode: string;

  /** AST根节点 */
  ast: any;

  /** 文件路径 */
  filePath?: string;

  /** 自定义参数 */
  customParams?: Record<string, any>;
}

/**
 * 策略执行结果接口
 */
export interface StrategyExecutionResult {
  /** 执行的策略名称 */
  strategyName: string;

  /** 生成的代码块 */
  chunks: any[];

  /** 执行耗时（毫秒） */
  executionTime: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息（如果有） */
  error?: string;

  /** 元数据 */
  metadata?: any;
}