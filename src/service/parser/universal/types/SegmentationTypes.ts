import { CodeChunk, CodeChunkMetadata } from '../../splitting';
import { ProtectionContext } from '../protection/ProtectionInterceptor';

/**
 * 分段上下文，包含分段所需的所有信息
 */
export interface SegmentationContext {
  /** 文件内容 */
  content: string;
  /** 文件路径 */
  filePath?: string;
  /** 编程语言 */
  language?: string;
  /** 分段选项 */
  options: UniversalChunkingOptions;
  /** 保护上下文 */
  protectionContext?: ProtectionContext;
  /** 元数据 */
  metadata: {
    contentLength: number;
    lineCount: number;
    isSmallFile: boolean;
    isCodeFile: boolean;
    isMarkdownFile: boolean;
  };
}

/**
 * 通用分段选项（重构后版本）
 */
export interface UniversalChunkingOptions {
  // 基础分段参数
  maxChunkSize: number;
  overlapSize: number;
  maxLinesPerChunk: number;
  
  // 功能开关
  enableBracketBalance: boolean;
  enableSemanticDetection: boolean;
  enableCodeOverlap: boolean;
  enableStandardization: boolean;
  standardizationFallback: boolean;
  
  // 重叠控制
  maxOverlapRatio: number;
  
  // 错误和性能控制
  errorThreshold: number;
  memoryLimitMB: number;
  
  // 策略优先级（可配置）
  strategyPriorities: Record<string, number>;
  
  // 处理器配置
  filterConfig: {
    enableSmallChunkFilter: boolean;
    enableChunkRebalancing: boolean;
    minChunkSize: number;
    maxChunkSize: number;
  };
  
  // 保护配置
  protectionConfig: {
    enableProtection: boolean;
    protectionLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * 复杂度计算器接口
 */
export interface IComplexityCalculator {
  /**
   * 计算内容复杂度
   */
  calculate(content: string): number;
}

/**
 * 文本分段器接口
 */
export interface ITextSplitter {
  /**
   * 基于语义边界的分段
   */
  chunkBySemanticBoundaries(content: string, filePath?: string, language?: string): Promise<CodeChunk[]>;
  
  /**
   * 基于括号和行数的分段
   */
  chunkByBracketsAndLines(content: string, filePath?: string, language?: string): Promise<CodeChunk[]>;
  
  /**
   * 基于行数的分段
   */
  chunkByLines(content: string, filePath?: string, language?: string): Promise<CodeChunk[]>;
  
  /**
   * 设置分段选项
   */
  setOptions(options: Partial<UniversalChunkingOptions>): void;
  
  /**
   * 获取当前分段选项
   */
  getOptions(): UniversalChunkingOptions;
}

/**
 * 分段策略接口
 */
export interface ISegmentationStrategy {
  /**
   * 检查是否可以处理给定的上下文
   */
  canHandle(context: SegmentationContext): boolean;
  
  /**
   * 执行分段
   */
  segment(context: SegmentationContext): Promise<CodeChunk[]>;
  
  /**
   * 获取策略名称
   */
  getName(): string;
  
  /**
   * 获取策略优先级（数值越小优先级越高）
   */
  getPriority(): number;
  
  /**
   * 获取策略支持的语言列表（可选）
   */
  getSupportedLanguages?(): string[];
  
  /**
   * 验证上下文是否适合此策略（可选）
   */
  validateContext?(context: SegmentationContext): boolean;
}

/**
 * 分段处理器接口，用于处理分段后的各种操作
 */
export interface ISegmentationProcessor {
  /**
   * 处理分段结果
   */
  process(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]>;
  
  /**
   * 获取处理器名称
   */
  getName(): string;
  
  /**
   * 检查是否应该应用此处理器
   */
  shouldApply(chunks: CodeChunk[], context: SegmentationContext): boolean;
}

/**
 * 分段上下文管理器接口
 */
export interface ISegmentationContextManager {
  /**
   * 选择合适的分段策略
   */
  selectStrategy(context: SegmentationContext, preferredType?: string): ISegmentationStrategy;
  
  /**
   * 执行分段策略
   */
  executeStrategy(strategy: ISegmentationStrategy, context: SegmentationContext): Promise<CodeChunk[]>;
  
  /**
   * 创建分段上下文
   */
  createSegmentationContext(
    content: string, 
    filePath?: string, 
    language?: string,
    options?: UniversalChunkingOptions
  ): SegmentationContext;
  
  /**
   * 添加策略
   */
  addStrategy(strategy: ISegmentationStrategy): void;
  
  /**
   * 移除策略
   */
  removeStrategy(strategyName: string): void;
  
  /**
   * 获取所有策略
   */
  getStrategies(): ISegmentationStrategy[];
}

/**
 * 保护协调器接口
 */
export interface IProtectionCoordinator {
  /**
   * 设置保护拦截器链
   */
  setProtectionChain(chain: any): void;
  
  /**
   * 检查操作是否被允许
   */
  checkProtection(context: ProtectionContext): Promise<boolean>;
  
  /**
   * 创建保护上下文
   */
  createProtectionContext(
    operation: string,
    segmentationContext: SegmentationContext,
    additionalMetadata?: Record<string, any>
  ): ProtectionContext;
}

/**
 * 配置管理器接口
 */
export interface IConfigurationManager {
  /**
   * 获取默认配置
   */
  getDefaultOptions(): UniversalChunkingOptions;
  
  /**
   * 验证配置
   */
  validateOptions(options: Partial<UniversalChunkingOptions>): boolean;
  
  /**
   * 合并配置
   */
  mergeOptions(
    base: UniversalChunkingOptions,
    override: Partial<UniversalChunkingOptions>
  ): UniversalChunkingOptions;
  
  /**
   * 获取特定语言的配置
   */
  getLanguageSpecificConfig(language: string): Partial<UniversalChunkingOptions>;
}

/**
 * 保护拦截器链接口
 */
export interface ProtectionInterceptorChain {
  /**
   * 执行保护检查
   */
  execute(context: ProtectionContext): Promise<{
    shouldProceed: boolean;
    reason?: string;
  }>;
  
  /**
   * 获取所有拦截器
   */
  getInterceptors(): any[];
}