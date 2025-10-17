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

// 增强的分段选项，用于解决片段重复问题
export interface EnhancedChunkingOptions extends ChunkingOptions {
  maxOverlapRatio: number;           // 最大重叠比例（默认0.3）
  enableASTBoundaryDetection: boolean; // 启用AST边界检测
  deduplicationThreshold: number;    // 去重阈值（相似度>0.8）
  astNodeTracking: boolean;          // 启用AST节点跟踪
  chunkMergeStrategy: 'aggressive' | 'conservative'; // 合并策略
  enableChunkDeduplication: boolean; // 启用块去重
  maxOverlapLines: number;           // 最大重叠行数限制
  minChunkSimilarity: number;        // 最小块相似度阈值
  enableSmartDeduplication: boolean; // 启用智能去重
  similarityThreshold: number;       // 相似度阈值
  overlapMergeStrategy: 'aggressive' | 'conservative'; // 重叠合并策略
}

// 默认配置
export const DEFAULT_CHUNKING_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 1000,
  overlapSize: 200,
  preserveFunctionBoundaries: true,
  preserveClassBoundaries: true,
  includeComments: false,
  minChunkSize: 100,
  extractSnippets: true,
  addOverlap: false,
  optimizationLevel: 'medium',
  maxLines: 10000,
  adaptiveBoundaryThreshold: false,
  contextAwareOverlap: false,
  semanticWeight: 0.7,
  syntacticWeight: 0.3,
  boundaryScoring: {
    enableSemanticScoring: true,
    minBoundaryScore: 0.5,
    maxSearchDistance: 10,
    languageSpecificWeights: true
  },
  overlapStrategy: {
    preferredStrategy: 'semantic',
    enableContextOptimization: true,
    qualityThreshold: 0.7
  },
  functionSpecificOptions: {
    preferWholeFunctions: true,
    minFunctionOverlap: 50,
    maxFunctionSize: 2000,
    maxFunctionLines: 30,              // 最大函数行数
    minFunctionLines: 5,               // 最小函数行数
    enableSubFunctionExtraction: true  // 启用子函数提取
  },
  classSpecificOptions: {
    keepMethodsTogether: true,
    classHeaderOverlap: 100,
    maxClassSize: 3000
  },
  // 新增：重复问题解决方案配置
  enableASTBoundaryDetection: false,
  enableChunkDeduplication: false,
  maxOverlapRatio: 0.3,
  deduplicationThreshold: 0.8,
  astNodeTracking: false,
  chunkMergeStrategy: 'conservative',
  minChunkSimilarity: 0.6,
  // 新增：性能优化配置
  enablePerformanceOptimization: false,
  enablePerformanceMonitoring: false,
  // 新增：协调机制配置
  enableChunkingCoordination: false,
  strategyExecutionOrder: ['ImportSplitter', 'ClassSplitter', 'FunctionSplitter', 'SyntaxAwareSplitter', 'IntelligentSplitter'],
  enableNodeTracking: false,
  // 新增：智能去重和重叠合并策略
  enableSmartDeduplication: false,
  similarityThreshold: 0.8,
  overlapMergeStrategy: 'conservative'
};

// 增强配置的默认值
export const DEFAULT_ENHANCED_CHUNKING_OPTIONS: Required<EnhancedChunkingOptions> = {
  ...DEFAULT_CHUNKING_OPTIONS,
  maxOverlapRatio: 0.3,
  enableASTBoundaryDetection: true,
  deduplicationThreshold: 0.8,
  astNodeTracking: true,
  chunkMergeStrategy: 'conservative',
  enableChunkDeduplication: true,
  maxOverlapLines: 50,
  minChunkSimilarity: 0.6,
  enableSmartDeduplication: true,
  similarityThreshold: 0.8,
  overlapMergeStrategy: 'conservative'
};

export interface CodeChunkMetadata {
  startLine: number;
  endLine: number;
  language: string;
  filePath?: string;
  type?: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block';
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

export interface CodeChunk {
  id?: string;
  content: string;
  metadata: CodeChunkMetadata;
}

// AST节点接口定义
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

// 增强的SplitStrategy接口，支持节点跟踪
export interface SplitStrategy {
  /**
   * 执行代码分段
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
   * 提取代码块关联的AST节点（新增）
   * @param chunk 代码块
   * @param ast AST树
   */
  extractNodesFromChunk?(chunk: CodeChunk, ast: any): ASTNode[];

  /**
   * 检查代码块是否包含已使用的节点（新增）
   * @param chunk 代码块
   * @param nodeTracker 节点跟踪器
   * @param ast AST树
   */
  hasUsedNodes?(chunk: CodeChunk, nodeTracker: any, ast: any): boolean;
}

export interface ComplexityCalculator {
  /**
   * 计算代码复杂度
   * @param content 代码内容
   */
  calculate(content: string): number;

  /**
   * 快速估算复杂度（用于性能优化）
   * @param content 代码内容
   */
  estimate(content: string): number;

  /**
   * 计算语义分数
   * @param line 单行代码
   */
  calculateSemanticScore(line: string): number;
}

export interface SyntaxValidator {
  /**
   * 验证代码段语法完整性
   * @param content 代码内容
   * @param language 编程语言
   */
  validate(content: string, language: string): boolean;

  /**
   * 检查括号平衡
   * @param content 代码内容
   */
  checkBracketBalance(content: string): number;

  /**
   * 检查花括号平衡
   * @param content 代码内容
   */
  checkBraceBalance(content: string): number;

  /**
   * 检查符号平衡（使用BalancedChunker）
   * @param content 代码内容
   */
  checkSymbolBalance(content: string): boolean;
}

export interface ChunkOptimizer {
  /**
   * 优化块大小
   * @param chunks 代码块数组
   * @param originalCode 原始代码（用于上下文）
   */
  optimize(chunks: CodeChunk[], originalCode: string): CodeChunk[];

  /**
   * 检查是否应该合并两个块
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   */
  shouldMerge(chunk1: CodeChunk, chunk2: CodeChunk): boolean;

  /**
   * 合并两个代码块
   * @param chunk1 第一个块
   * @param chunk2 第二个块
   */
  merge(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk;
}

export interface OverlapCalculator {
  /**
   * 为代码块添加重叠内容
   * @param chunks 代码块数组
   * @param originalCode 原始代码
   */
  addOverlap(chunks: CodeChunk[], originalCode: string): CodeChunk[];

  /**
   * 提取重叠内容
   * @param currentChunk 当前块
   * @param nextChunk 下一个块
   * @param originalCode 原始代码
   */
  extractOverlapContent(
    currentChunk: CodeChunk,
    nextChunk: CodeChunk,
    originalCode: string
  ): string;

  /**
   * 智能计算重叠
   * @param currentChunk 当前块的行数组
   * @param originalCode 原始代码
   * @param startLine 起始行号
   */
  calculateSmartOverlap(
    currentChunk: string[],
    originalCode: string,
    startLine: number
  ): string[];
}

export interface PerformanceStats {
  totalLines: number;
  totalTime: number;
  averageTimePerLine: number;
  cacheHitRate: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export interface PerformanceMonitor {
  /**
   * 记录性能指标
   * @param startTime 开始时间
   * @param linesProcessed 处理的行数
   * @param cacheHit 是否缓存命中
   */
  record(startTime: number, linesProcessed: number, cacheHit: boolean): void;

  /**
   * 获取性能统计
   */
  getStats(): PerformanceStats;

  /**
   * 重置性能统计
   */
  reset(): void;
}
