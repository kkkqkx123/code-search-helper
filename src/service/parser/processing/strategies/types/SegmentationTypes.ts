import { CodeChunk, CodeChunkMetadata } from '../../types/splitting-types';
// import { ProtectionContext, ProtectionDecision } from '../../../universal/protection/ProtectionInterceptor';
// import { IProtectionInterceptor } from '../../../universal/protection/interfaces/IProtectionInterceptor';

// 重新导出CodeChunk类型
export { CodeChunk };

// 临时定义这些类型，直到相关模块实现完成
export interface ProtectionContext {
  operation: string;
  segmentationContext?: SegmentationContext; // 设为可选以兼容测试
  additionalMetadata?: Record<string, any>;
  // 添加测试文件期望的属性
  filePath?: string;
  content?: string;
  language?: string;
  metadata?: {
    contentLength?: number;
    lineCount?: number;
    [key: string]: any;
  };
}

export interface ProtectionDecision {
  allowed?: boolean; // 设为可选以兼容测试
  reason?: string;
  // 添加测试文件期望的属性
  shouldProceed?: boolean;
  metadata?: {
    checkType?: string;
    threshold?: number;
    [key: string]: any;
  };
}

export interface IProtectionInterceptor {
  check?(context: ProtectionContext): Promise<ProtectionDecision>;
  getName?(): string;
  // 添加测试文件期望的属性
  name?: string;
  priority?: number;
  description?: string;
  intercept?(context: ProtectionContext): Promise<ProtectionDecision>;
  isApplicable?(context: ProtectionContext): boolean;
  isAvailable?(): boolean;
}
// 导出已在上面定义的类型

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
    [key: string]: any;
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
 * 块过滤器接口
 */
export interface IChunkFilter {
  /**
   * 过滤块
   */
  filter(context: ChunkFilterContext): Promise<FilterResult>;

  /**
   * 检查是否应该应用此过滤器
   */
  shouldApply(chunks: CodeChunk[], context: ChunkFilterContext): boolean;

  /**
   * 获取过滤器名称
   */
  getName(): string;
}

/**
 * 块重新平衡器接口
 */
export interface IChunkRebalancer {
  /**
   * 重新平衡块
   */
  rebalance(context: ChunkRebalancerContext): Promise<RebalancerResult>;

  /**
   * 检查是否应该应用此重新平衡器
   */
  shouldApply(chunks: CodeChunk[], context: ChunkRebalancerContext): boolean;

  /**
   * 获取重新平衡器名称
   */
  getName(): string;
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

/**
 * 块过滤器上下文
 */
export interface ChunkFilterContext {
  chunks: CodeChunk[];
  options: {
    enableSmallChunkFilter: boolean;
    enableChunkRebalancing: boolean;
    minChunkSize: number;
    maxChunkSize: number;
  };
  metadata: {
    totalChunks: number;
    averageChunkSize: number;
    [key: string]: any;
  };
}

/**
 * 块重新平衡器上下文
 */
export interface ChunkRebalancerContext {
  chunks: CodeChunk[];
  options: {
    enableSmallChunkFilter: boolean;
    enableChunkRebalancing: boolean;
    minChunkSize: number;
    maxChunkSize: number;
  };
  metadata: {
    totalChunks: number;
    averageChunkSize: number;
    [key: string]: any;
  };
}

/**
 * 过滤结果
 */
export interface FilterResult {
  chunks: CodeChunk[];
  filtered: number;
  metadata?: {
    filterReason?: string;
    originalSize?: number;
    filteredSize?: number;
    [key: string]: any;
  };
}

/**
 * 重新平衡结果
 */
export interface RebalancerResult {
  chunks: CodeChunk[];
  rebalanced: number;
  metadata?: {
    rebalanceReason?: string;
    originalSize?: number;
    rebalancedSize?: number;
    [key: string]: any;
  };
}
