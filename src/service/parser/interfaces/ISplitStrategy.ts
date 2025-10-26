import { CodeChunk } from '../splitting';
import Parser from 'tree-sitter';

/**
 * 统一的分段策略接口
 * 整合了 IProcessingStrategy、SplitStrategy 和 ChunkingStrategy 的功能
 */
export interface ISplitStrategy {
  /**
   * 执行代码分段（通用分段方法）
   * @param content 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   * @param options 分段选项
   * @param nodeTracker AST节点跟踪器（可选）
   * @param ast AST树（可选）
   */
  split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
 ): Promise<CodeChunk[]>;

  /**
   * 基于AST的细粒度分段（来自core/strategy）
   * @param ast AST语法树
   * @param content 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   * @param options 分段选项
   */
  chunkByAST?(
    ast: any,
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): Promise<CodeChunk[]>;

  /**
   * 检查策略是否可以处理给定的语言和节点（来自core/strategy）
   * @param language 编程语言
   * @param node AST语法节点
   */
  canHandleNode?(language: string, node: Parser.SyntaxNode): boolean;

  /**
   * 获取策略名称（用于日志和调试）
   */
  getName(): string;

  /**
   * 检查是否支持该语言
   * @param language 编程语言
   */
  supportsLanguage(language: string): boolean;

  /**
   * 获取策略的优先级（数值越小优先级越高）
   */
  getPriority(): number;

  /**
   * 获取策略描述
   */
  getDescription(): string;

  /**
   * 获取策略支持的节点类型（来自core/strategy）
   * @param language 编程语言
   */
  getSupportedNodeTypes?(language: string): Set<string>;

  /**
   * 验证分段结果的合理性（来自core/strategy）
   * @param chunks 代码块数组
   */
  validateChunks?(chunks: CodeChunk[]): boolean;

  /**
   * 提取代码块关联的AST节点（来自splitting）
   * @param chunk 代码块
   * @param ast AST树
   */
  extractNodesFromChunk?(chunk: CodeChunk, ast: any): ASTNode[];

  /**
   * 检查代码块是否包含已使用的节点（来自splitting）
   * @param chunk 代码块
   * @param nodeTracker 节点跟踪器
   * @param ast AST树
   */
  hasUsedNodes?(chunk: CodeChunk, nodeTracker: any, ast: any): boolean;
}

/**
 * 分段选项接口（来自splitting）
 */
export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
  extractSnippets?: boolean;
 addOverlap?: boolean;
  optimizationLevel?: 'low' | 'medium' | 'high';
  maxLines?: number; // 内存保护：最大处理行数

  // 动态调整参数
  adaptiveBoundaryThreshold?: boolean;
  contextAwareOverlap?: boolean;
  semanticWeight?: number;
  syntacticWeight?: number;

  // 语义边界评分配置
  boundaryScoring?: {
    enableSemanticScoring: boolean;
    minBoundaryScore: number;
    maxSearchDistance: number;
    languageSpecificWeights: boolean;
 };

  // 重叠策略配置
  overlapStrategy?: {
    preferredStrategy: 'semantic' | 'syntactic' | 'size-based' | 'hybrid';
    enableContextOptimization: boolean;
    qualityThreshold: number;
  };

  // 针对不同代码类型的专门配置
  functionSpecificOptions?: {
    preferWholeFunctions: boolean;
    minFunctionOverlap: number;
    maxFunctionSize: number;
    maxFunctionLines?: number;        // 最大函数行数
    minFunctionLines?: number;        // 最小函数行数
    enableSubFunctionExtraction?: boolean; // 启用子函数提取
  };

  classSpecificOptions?: {
    keepMethodsTogether: boolean;
    classHeaderOverlap: number;
    maxClassSize: number;
  };

  // 新增：重复问题解决方案配置
  enableASTBoundaryDetection?: boolean;
  enableChunkDeduplication?: boolean;
  maxOverlapRatio?: number;
  deduplicationThreshold?: number;
  astNodeTracking?: boolean;
  chunkMergeStrategy?: 'aggressive' | 'conservative';
  minChunkSimilarity?: number;
  // 新增：协调机制配置
 enableChunkingCoordination?: boolean;
  strategyExecutionOrder?: string[];
  // 新增：性能优化配置
  enablePerformanceOptimization?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableNodeTracking?: boolean;
  // 新增：智能去重和重叠合并策略
  enableSmartDeduplication?: boolean;
  similarityThreshold?: number;
  overlapMergeStrategy?: 'aggressive' | 'conservative';
}

/**
 * 代码块元数据接口（来自splitting）
 */
export interface CodeChunkMetadata {
  startLine: number;
  endLine: number;
  language: string;
  filePath?: string;
  type?: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block' | 'markdown' | 'standardization' | 'section' | 'content' | 'declaration' | 'doctype' | 'root' | 'element' | 'instruction' | 'comment' | 'cdata' | 'text';
  functionName?: string;
  className?: string;
  complexity?: number; // 新增：代码复杂度
  startByte?: number;
  endByte?: number;
  imports?: string[];
  exports?: string[];
  nestingLevel?: number;
  nodeIds?: string[]; // 新增：关联的AST节点ID列表
  [key: string]: any;
}

/**
 * 代码块接口（来自splitting）
 */
export interface CodeChunk {
  id?: string;
  content: string;
  metadata: CodeChunkMetadata;
}

/**
 * AST节点接口（来自splitting）
 */
export interface ASTNode {
  id: string;
  type: string;
  startByte: number;
  endByte: number;
  startLine: number;
  endLine: number;
  text: string;
  parent?: ASTNode;
  children?: ASTNode[];
  contentHash?: string; // 新增：内容哈希，用于相似性检测
  similarityGroup?: string; // 新增：相似性分组标识
}

/**
 * 策略提供者接口
 * 用于创建和管理策略实例
 */
export interface IStrategyProvider {
  /**
   * 获取提供者名称
   */
  getName(): string;

  /**
   * 创建策略实例
   * @param options 分段选项
   */
  createStrategy(options?: ChunkingOptions): ISplitStrategy;

  /**
   * 获取提供者的依赖项
   */
  getDependencies(): string[];

  /**
   * 检查提供者是否支持指定的语言
   * @param language 编程语言
   */
  supportsLanguage(language: string): boolean;

  /**
   * 获取提供者的优先级
   */
  getPriority(): number;

  /**
   * 获取提供者描述
   */
  getDescription(): string;
}

/**
 * 策略配置接口（来自core/strategy）
 */
export interface StrategyConfiguration {
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;

  /** 是否启用缓存 */
  enableCaching?: boolean;

  /** 缓存大小 */
  cacheSize?: number;

  /** 最大执行时间（毫秒） */
  maxExecutionTime?: number;

  /** 是否启用并行处理 */
  enableParallel?: boolean;

  // 通用配置
  [key: string]: any;
}