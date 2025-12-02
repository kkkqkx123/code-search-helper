/**
 * Tree-sitter智能分段系统的核心类型定义
 */

import Parser from 'tree-sitter';

/**
 * 基础代码分段接口
 */
export interface CodeChunk {
  /** 分段内容 */
  content: string;

  /** 分段元数据 */
  metadata: CodeChunkMetadata;
}

/**
 * 代码分段元数据
 */
export interface CodeChunkMetadata {
  /** 开始行号 */
  startLine: number;

  /** 结束行号 */
  endLine: number;

  /** 语言类型 */
  language: string;

  /** 文件路径（可选） */
  filePath?: string;

  /** 分段类型 */
  type?: string;

  /** 复杂度评分 */
  complexity?: number;

  /** 嵌套层级 */
  nestingLevel?: number;

  /** 其他自定义属性 */
  [key: string]: any;
}

/**
 * 策略执行上下文
 */
export interface StrategyExecutionContext {
  /** 语言 */
  language: string;

  /** 源代码 */
  sourceCode: string;

  /** AST根节点 */
  ast: Parser.SyntaxNode;

  /** 文件路径 */
  filePath?: string;

  /** 自定义参数 */
  customParams?: Record<string, any>;
}

/**
 * 策略执行结果
 */
export interface StrategyExecutionResult {
  /** 生成的分段 */
  chunks: CodeChunk[];

  /** 执行时间（毫秒） */
  executionTime: number;

  /** 处理的节点数量 */
  processedNodes: number;

  /** 策略名称 */
  strategyName: string;

  /** 是否成功 */
  success: boolean;

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 性能统计信息
 */
export interface PerformanceStats {
  /** 执行次数 */
  executionCount: number;

  /** 总执行时间 */
  totalExecutionTime: number;

  /** 平均执行时间 */
  averageExecutionTime: number;

  /** 最大执行时间 */
  maxExecutionTime: number;

  /** 最小执行时间 */
  minExecutionTime: number;

  /** 成功次数 */
  successCount: number;

  /** 失败次数 */
  failureCount: number;

  /** 总分段数 */
  totalChunks: number;

  /** 平均分段数 */
  averageChunks: number;
}

/**
 * 语言配置接口
 */
export interface LanguageConfiguration {
  /** 语言名称 */
  language: string;

  /** 文件扩展名 */
  fileExtensions: string[];

  /** 支持的分段类型 */
  chunkTypes: string[];

  /** 默认分段配置 */
  defaultChunkConfig: StrategyConfiguration;

  /** 语法规则 */
  syntaxRules: SyntaxRule[];

  /** 特殊处理规则 */
  specialRules: SpecialRule[];

  /** 性能优化配置 */
  performanceConfig: PerformanceConfig;
}

/**
 * 策略配置接口
 */
export interface StrategyConfiguration {
  /** 最大分段大小（字符数） */
  maxChunkSize: number;

  /** 最小分段大小（字符数） */
  minChunkSize: number;

  /** 是否保留注释 */
  preserveComments: boolean;

  /** 是否保留空行 */
  preserveEmptyLines: boolean;

  /** 嵌套深度限制 */
  maxNestingLevel: number;

  /** 其他自定义配置 */
  [key: string]: any;
}

/**
 * 语法规则
 */
export interface SyntaxRule {
  /** 规则名称 */
  name: string;

  /** 规则描述 */
  description: string;

  /** 适用的节点类型 */
  nodeTypes: string[];

  /** 处理函数 */
  handler: string;

  /** 优先级 */
  priority: number;
}

/**
 * 特殊处理规则
 */
export interface SpecialRule {
  /** 规则名称 */
  name: string;

  /** 规则描述 */
  description: string;

  /** 匹配模式 */
  pattern: string;

  /** 替换模式 */
  replacement: string;

  /** 是否启用 */
  enabled: boolean;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  /** 最大文件大小（字节） */
  maxFileSize: number;

  /** 最大解析时间（毫秒） */
  maxParseTime: number;

  /** 缓存大小 */
  cacheSize: number;

  /** 是否启用并行处理 */
  enableParallel: boolean;

  /** 并行处理线程数 */
  parallelThreads: number;
}

/**
 * 查询模式定义
 */
export interface QueryPattern {
  /** 查询名称 */
  name: string;

  /** 查询描述 */
  description: string;

  /** S-expression查询模式 */
  pattern: string;

  /** 适用的语言 */
  languages: string[];

  /** 捕获名称映射 */
  captures: Record<string, string>;

  /** 额外的匹配条件 */
  conditions?: QueryCondition[];
}

/**
 * 查询条件
 */
export interface QueryCondition {
  /** 条件类型 */
  type: 'length' | 'complexity' | 'nesting' | 'custom';

  /** 条件参数 */
  params: Record<string, any>;
}

/**
 * 查询结果
 */
export interface QueryResult {
  /** 匹配的节点 */
  matches: QueryMatch[];

  /** 查询执行时间 */
  executionTime: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息 */
  error?: string;
}

/**
 * 查询匹配
 */
export interface QueryMatch {
  /** 匹配的节点 */
  node: Parser.SyntaxNode;

  /** 捕获的节点 */
  captures: Record<string, Parser.SyntaxNode>;

  /** 匹配的位置信息 */
  location: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
}

/**
 * 策略管理器配置
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
 * 增量解析编辑信息
 */
export interface IncrementalEdit {
  /** 编辑类型 */
  type: 'insert' | 'delete' | 'replace';

  /** 开始位置 */
  startPos: number;

  /** 结束位置 */
  endPos: number;

  /** 新内容（对于插入和替换） */
  newContent?: string;

  /** 旧内容（对于删除和替换） */
  oldContent?: string;
}

/**
 * 增量解析结果
 */
export interface IncrementalParseResult {
  /** 新的语法树 */
  newTree: Parser.Tree;

  /** 变化的节点 */
  changedNodes: Parser.SyntaxNode[];

  /** 解析时间 */
  parseTime: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息 */
  error?: string;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 缓存命中次数 */
  hits: number;

  /** 缓存未命中次数 */
  misses: number;

  /** 缓存驱逐次数 */
  evictions: number;

  /** 总请求数 */
  totalRequests: number;

  /** 命中率 */
  hitRate: string;

  /** AST缓存大小 */
  astCacheSize: number;

  /** 节点缓存大小 */
  nodeCacheSize: number;
}

/**
 * 批量处理结果
 */
export interface BatchProcessingResult {
  /** 处理的文件路径 */
  filePath: string;

  /** 生成的分段 */
  chunks: CodeChunk[];

  /** 处理时间 */
  processingTime: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息 */
  error?: string;
}

/**
 * 系统健康状态
 */
export interface SystemHealth {
  /** 系统状态 */
  status: 'healthy' | 'warning' | 'error';

  /** 内存使用情况 */
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };

  /** 缓存状态 */
  cacheStatus: CacheStats;

  /** 性能指标 */
  performanceMetrics: {
    averageParseTime: number;
    averageChunkingTime: number;
    throughput: number;
  };

  /** 错误计数 */
  errorCount: number;

  /** 最后更新时间 */
  lastUpdated: Date;
}
