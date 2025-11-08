/**
 * 结果类型定义
 * 定义了处理结果相关的类型
 */

/**
 * 代码块接口
 */
export interface CodeChunk {
  /** 代码内容 */
  content: string;

  /** 代码块元数据 */
  metadata: ChunkMetadata;
}

/**
 * 代码块元数据接口
 */
export interface ChunkMetadata {
  /** 起始行号 */
  startLine: number;

  /** 结束行号 */
  endLine: number;

  /** 编程语言 */
  language: string;

  /** 文件路径（可选） */
  filePath?: string;

  /** 使用的策略 */
  strategy: string;

  /** 复杂度评分（可选） */
  complexity?: number;

  /** 内容哈希（可选） */
  hash?: string;

  /** 时间戳 */
  timestamp: number;

  /** 代码块类型 */
  type: ChunkType;

  /** 代码块大小（字符数） */
  size: number;

  /** 代码块行数 */
  lineCount: number;

  /** 是否包含导入语句 */
  hasImports?: boolean;

  /** 是否包含导出语句 */
  hasExports?: boolean;

  /** 是否包含函数定义 */
  hasFunctions?: boolean;

  /** 是否包含类定义 */
  hasClasses?: boolean;

  /** 语义边界信息（可选） */
  semanticBoundary?: SemanticBoundaryInfo;

  /** AST节点信息（可选） */
  astNodes?: ASTNodeInfo[];

  /** 重叠信息（可选） */
  overlapInfo?: OverlapInfo;

  /** 额外的元数据 */
  [key: string]: any;
}

/**
* 代码块类型枚举
*/
export enum ChunkType {
  FUNCTION = 'function',
  CLASS = 'class',
  METHOD = 'method',
  IMPORT = 'import',
  EXPORT = 'export',
  GENERIC = 'generic',
  COMMENT = 'comment',
  DOCUMENTATION = 'documentation',
  VARIABLE = 'variable',
  INTERFACE = 'interface',
  TYPE = 'type',
  ENUM = 'enum',
  MODULE = 'module',
  BLOCK = 'block',
  LINE = 'line'
}

/**
 * 语义边界信息接口
 */
export interface SemanticBoundaryInfo {
  /** 边界类型 */
  boundaryType: string;

  /** 边界强度（0-1） */
  strength: number;

  /** 边界原因 */
  reason: string;

  /** 相关符号 */
  symbols: string[];
}

/**
 * AST节点信息接口
 */
export interface ASTNodeInfo {
  /** 节点类型 */
  type: string;

  /** 节点位置 */
  position: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };

  /** 节点名称 */
  name?: string;

  /** 节点属性 */
  properties?: Record<string, any>;
}

/**
 * 重叠信息接口
 */
export interface OverlapInfo {
  /** 重叠大小 */
  overlapSize: number;

  /** 重叠比例 */
  overlapRatio: number;

  /** 重叠类型 */
  overlapType: 'prefix' | 'suffix' | 'full' | 'partial';

  /** 重叠原因 */
  reason: string;
}

/**
 * 处理结果接口
 */
export interface ProcessingResult {
  /** 代码块数组 */
  chunks: CodeChunk[];

  /** 是否成功 */
  success: boolean;

  /** 执行时间（毫秒） */
  executionTime: number;

  /** 使用的策略 */
  strategy: string;

  /** 错误信息（如果有） */
  error?: string;

  /** 结果元数据 */
  metadata?: ResultMetadata;

  /** 性能指标 */
  performance?: ProcessingPerformanceMetrics;

  /** 后处理结果（如果有） */
  postProcessingResults?: PostProcessingResult[];
}

/**
 * 结果元数据接口
 */
export interface ResultMetadata {
  /** 编程语言 */
  language: string;

  /** 文件路径（可选） */
  filePath?: string;

  /** 块数量 */
  chunkCount: number;

  /** 平均块大小 */
  averageChunkSize: number;

  /** 总大小 */
  totalSize: number;

  /** 原始内容大小 */
  originalSize: number;

  /** 压缩比例 */
  compressionRatio: number;

  /** 处理开始时间 */
  startTime: number;

  /** 处理结束时间 */
  endTime: number;

  /** 使用的策略版本 */
  strategyVersion?: string;

  /** 处理器版本 */
  processorVersion?: string;

  /** 额外的元数据 */
  [key: string]: any;
}

/**
 * 后处理结果接口
 */
export interface PostProcessingResult {
  /** 处理器名称 */
  processor: string;

  /** 执行时间（毫秒） */
  executionTime: number;

  /** 是否成功 */
  success: boolean;

  /** 错误信息（如果有） */
  error?: string;

  /** 处理前的块数量 */
  inputChunkCount: number;

  /** 处理后的块数量 */
  outputChunkCount: number;

  /** 优化比例 */
  optimizationRatio: number;

  /** 处理器特定的元数据 */
  metadata?: Record<string, any>;
}

/**
 * 处理性能指标接口
 */
export interface ProcessingPerformanceMetrics {
  /** 总处理时间 */
  totalProcessingTime: number;

  /** 策略执行时间 */
  strategyExecutionTime: number;

  /** 后处理时间 */
  postProcessingTime: number;

  /** 内存使用量（字节） */
  memoryUsage: number;

  /** 缓存命中率 */
  cacheHitRate: number;

  /** 处理的块数量 */
  chunkCount: number;

  /** 平均块大小 */
  averageChunkSize: number;

  /** 处理速度（字符/秒） */
  processingSpeed: number;

  /** CPU使用率 */
  cpuUsage?: number;

  /** 其他性能指标 */
  [key: string]: any;
}

/**
 * 结果验证接口
 */
export interface ResultValidation {
  /** 是否有效 */
  isValid: boolean;

  /** 验证错误列表 */
  errors: ValidationError[];

  /** 验证警告列表 */
  warnings: ValidationWarning[];

  /** 验证指标 */
  metrics: ValidationMetrics;
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  /** 错误代码 */
  code: string;

  /** 错误消息 */
  message: string;

  /** 错误位置 */
  location?: {
    chunkIndex: number;
    line?: number;
    column?: number;
  };

  /** 错误严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 验证警告接口
 */
export interface ValidationWarning {
  /** 警告代码 */
  code: string;

  /** 警告消息 */
  message: string;

  /** 警告位置 */
  location?: {
    chunkIndex: number;
    line?: number;
    column?: number;
  };

  /** 警告严重程度 */
  severity: 'info' | 'low' | 'medium';
}

/**
 * 验证指标接口
 */
export interface ValidationMetrics {
  /** 总块数 */
  totalChunks: number;

  /** 有效块数 */
  validChunks: number;

  /** 无效块数 */
  invalidChunks: number;

  /** 平均块大小 */
  averageChunkSize: number;

  /** 最大块大小 */
  maxChunkSize: number;

  /** 最小块大小 */
  minChunkSize: number;

  /** 总重叠大小 */
  totalOverlapSize: number;

  /** 重叠比例 */
  overlapRatio: number;
}