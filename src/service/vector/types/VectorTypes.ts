/**
 * 向量服务核心类型定义
 * 包含代码转文本、嵌入和向量管理的完整类型体系
 */

// ==================== 代码转文本类型 ====================

/**
 * 代码转文本配置接口
 */
export interface CodeToTextConfig {
  /** 命名风格转换配置 */
  namingConversion: {
    /** 是否启用驼峰转自然语言 */
    camelToNatural: boolean;
    /** 是否启用蛇形转自然语言 */
    snakeToNatural: boolean;
    /** 是否启用帕斯卡转自然语言 */
    pascalToNatural: boolean;
  };

  /** 文本组装配置 */
  textAssembly: {
    /** 是否包含代码类型 */
    includeCodeType: boolean;
    /** 是否包含功能描述 */
    includeDescription: boolean;
    /** 是否包含签名信息 */
    includeSignature: boolean;
    /** 是否包含上下文信息 */
    includeContext: boolean;
  };

  /** 文本清洗配置 */
  textCleaning: {
    /** 是否移除特殊字符 */
    removeSpecialChars: boolean;
    /** 是否移除注释符号 */
    removeCommentSymbols: boolean;
    /** 是否标准化空白字符 */
    normalizeWhitespace: boolean;
  };
}

/**
 * 代码转文本结果接口
 */
export interface CodeToTextResult {
  /** 转换后的自然语言文本 */
  text: string;
  /** 原始代码内容 */
  originalCode: string;
  /** 转换统计信息 */
  stats: {
    /** 原始字符数 */
    originalLength: number;
    /** 转换后字符数 */
    convertedLength: number;
    /** 转换时间（毫秒） */
    conversionTime: number;
  };
  /** 转换元数据 */
  metadata: {
    /** 代码语言 */
    language: string;
    /** 代码类型 */
    codeType: string;
    /** 使用的转换规则 */
    conversionRules: string[];
  };
}

// ==================== 嵌入类型 ====================

/**
 * 向量嵌入配置接口
 */
export interface EmbeddingConfig {
  /** 嵌入模型配置 */
  model: {
    /** 模型名称 */
    name: string;
    /** 模型版本 */
    version: string;
    /** 向量维度 */
    dimension: number;
    /** 最大序列长度 */
    maxSequenceLength: number;
  };

  /** 预处理配置 */
  preprocessing: {
    /** 是否启用分词 */
    enableTokenization: boolean;
    /** 是否启用截断 */
    enableTruncation: boolean;
    /** 是否启用填充 */
    enablePadding: boolean;
  };

  /** 后处理配置 */
  postprocessing: {
    /** 是否启用归一化 */
    enableNormalization: boolean;
    /** 归一化方法 */
    normalizationMethod: 'l2' | 'cosine' | 'none';
  };
}

/**
 * 向量嵌入结果接口
 */
export interface EmbeddingResult {
  /** 嵌入向量 */
  vector: number[];
  /** 原始文本 */
  text: string;
  /** 嵌入元数据 */
  metadata: EmbeddingMetadata;
}

/**
 * 嵌入元数据接口
 */
export interface EmbeddingMetadata {
  /** 嵌入模型信息 */
  model: {
    name: string;
    version: string;
    dimension: number;
  };

  /** 处理信息 */
  processing: {
    /** 处理时间（毫秒） */
    processingTime: number;
    /** 文本长度 */
    textLength: number;
    /** token数量 */
    tokenCount: number;
    /** 是否被截断 */
    wasTruncated: boolean;
  };

  /** 源数据信息 */
  source: {
    /** 源数据类型 */
    sourceType: 'entity' | 'relationship' | 'chunk';
    /** 源数据ID */
    sourceId: string;
    /** 文件路径 */
    filePath: string;
    /** 语言类型 */
    language: string;
  };

  /** 质量指标 */
  quality: {
    /** 置信度分数 */
    confidence: number;
    /** 相似度分数（如果有参考） */
    similarity?: number;
    /** 质量标签 */
    qualityLabel: 'high' | 'medium' | 'low';
  };
}

// ==================== 向量存储类型 ====================

/**
 * 向量类型
 */
export interface Vector {
  id: string;
  vector: number[];
  content: string;
  metadata: VectorMetadata;
  timestamp: Date;
}

/**
 * 向量元数据
 */
export interface VectorMetadata {
  projectId?: string;
  filePath?: string;
  language?: string;
  chunkType?: string[];
  startLine?: number;
  endLine?: number;
  functionName?: string;
  className?: string;
  snippetMetadata?: any;
  customFields?: Record<string, any>;

  // 保留上游模块提供的丰富信息
  complexity?: number;
  complexityAnalysis?: any;
  nestingLevel?: number;
  strategy?: string;
  isSignatureOnly?: boolean;
  originalStructure?: string;

  // AST和语义信息
  astNodes?: any;
  semanticBoundary?: any;

  // 其他有价值的元数据
  size?: number;
  lineCount?: number;
  hash?: string;
  overlapInfo?: any;
  contextLines?: string[];

  // 嵌入和转换信息
  embeddingInfo?: {
    model: string;
    version: string;
    dimension: number;
  };
  codeToTextInfo?: {
    originalLength: number;
    convertedLength: number;
    conversionRules: string[];
  };
}

/**
 * 统一的向量点接口 - 兼容 Qdrant 格式
 */
export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload: VectorPayload;
}

/**
 * 统一的向量载荷 - 合并 VectorMetadata 和 VectorPoint.payload
 */
export interface VectorPayload {
  content: string;
  filePath: string;
  language: string;
  chunkType: string[];
  startLine: number;
  endLine: number;
  functionName?: string;
  className?: string;
  snippetMetadata?: any;
  metadata: Record<string, any>;
  timestamp: Date;
  projectId?: string;

  // 保留上游模块提供的丰富信息
  complexity?: number;
  complexityAnalysis?: any;
  nestingLevel?: number;
  strategy?: string;
  isSignatureOnly?: boolean;
  originalStructure?: string;

  // AST和语义信息
  astNodes?: any;
  semanticBoundary?: any;

  // 其他有价值的元数据
  size?: number;
  lineCount?: number;
  hash?: string;
  overlapInfo?: any;
  contextLines?: string[];

  // 嵌入和转换信息
  embeddingInfo?: {
    model: string;
    version: string;
    dimension: number;
  };
  codeToTextInfo?: {
    originalLength: number;
    convertedLength: number;
    conversionRules: string[];
  };
}

// ==================== 搜索和操作类型 ====================

/**
 * 搜索选项
 */
export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: VectorFilter;
  withMetadata?: boolean;
  withVector?: boolean;
}

/**
 * 向量过滤器
 */
export interface VectorFilter {
  projectId?: string;
  language?: string[];
  chunkType?: string[];
  filePath?: string[];
  customFilters?: Record<string, any>;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  id: string;
  score: number;
  vector?: Vector;
  metadata?: VectorMetadata;
}

/**
 * 向量操作
 */
export interface VectorOperation {
  type: 'create' | 'delete';
  data: Vector | string;
}

/**
 * 批量结果
 */
export interface BatchResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors?: Error[];
  executionTime: number;
}

// ==================== 配置选项类型 ====================

/**
 * 向量选项
 */
export interface VectorOptions {
  projectId?: string;
  embedderProvider?: string;
  batchSize?: number;
  metadata?: Partial<VectorMetadata>;
}

/**
 * 项目选项
 */
export interface ProjectOptions {
  vectorSize?: number;
  distance?: VectorDistance;
  recreateIfExists?: boolean;
  optimizersConfig?: OptimizersConfig;
}

/**
 * 优化器配置
 */
export interface OptimizersConfig {
  defaultSegmentNumber?: number;
  indexingThreshold?: number;
  flushIntervalSec?: number;
  maxOptimizationThreads?: number;
}

/**
 * 向量距离类型
 */
export type VectorDistance = 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';

/**
 * 嵌入选项
 */
export interface EmbeddingOptions {
  provider?: string;
  model?: string;
  batchSize?: number;
  timeout?: number;
}

/**
 * 批处理选项
 */
export interface BatchOptions {
  batchSize?: number;
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * 索引选项
 */
export interface IndexOptions {
  vectorSize?: number;
  distance?: VectorDistance;
  optimizersConfig?: OptimizersConfig;
}

// ==================== 监控和统计类型 ====================

/**
 * 服务状态
 */
export interface ServiceStatus {
  healthy: boolean;
  connected: boolean;
  stats: {
    totalVectors: number;
    totalProjects: number;
    cacheHitRate: number;
    averageResponseTime: number;
  };
}

/**
 * 向量统计
 */
export interface VectorStats {
  totalCount: number;
  projectCount: number;
  averageVectorSize: number;
  indexCount: number;
  storageSize: number;
  lastUpdateTime: Date;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  operationCounts: Record<string, number>;
  averageResponseTimes: Record<string, number>;
  cacheHitRates: Record<string, number>;
  errorRates: Record<string, number>;
  throughput: {
    operationsPerSecond: number;
    vectorsPerSecond: number;
  };
}

/**
 * 缓存统计
 */
export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalEntries: number;
  memoryUsage: number;
}

/**
 * 缓存清理选项
 */
export interface CacheClearOptions {
  /**
   * 是否清理向量缓存
   */
  clearVectors?: boolean;
  /**
   * 是否清理搜索结果缓存
   */
  clearSearchResults?: boolean;
  /**
   * 只清理指定时间之前的缓存（时间戳）
   */
  olderThan?: number;
}

/**
 * 缓存清理结果
 */
export interface CacheClearResult {
  /**
   * 清理的向量缓存数量
   */
  vectorsCleared: number;
  /**
   * 清理的搜索结果缓存数量
   */
  searchResultsCleared: number;
  /**
   * 总清理数量
   */
  totalCleared: number;
  /**
   * 清理操作是否成功
   */
  success: boolean;
  /**
   * 错误信息（如果有）
   */
  error?: string;
  /**
   * 清理操作耗时（毫秒）
   */
  executionTime: number;
}

// ==================== 错误处理类型 ====================

/**
 * 向量错误代码
 */
export enum VectorErrorCode {
  INVALID_VECTOR_DATA = 'INVALID_VECTOR_DATA',
  VECTOR_NOT_FOUND = 'VECTOR_NOT_FOUND',
  INDEX_NOT_FOUND = 'INDEX_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  OPERATION_NOT_SUPPORTED = 'OPERATION_NOT_SUPPORTED',
  CODE_TO_TEXT_ERROR = 'CODE_TO_TEXT_ERROR'
}

/**
 * 向量服务错误
 */
export class VectorError extends Error {
  constructor(
    message: string,
    public code: VectorErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'VectorError';
  }
}

// ==================== 事件类型 ====================

/**
 * 向量事件类型
 */
export enum VectorEventType {
  VECTOR_CREATED = 'VECTOR_CREATED',
  VECTOR_DELETED = 'VECTOR_DELETED',
  VECTORS_BATCH_CREATED = 'VECTORS_BATCH_CREATED',
  VECTORS_BATCH_DELETED = 'VECTORS_BATCH_DELETED',
  SEARCH_PERFORMED = 'SEARCH_PERFORMED',
  INDEX_CREATED = 'INDEX_CREATED',
  INDEX_DELETED = 'INDEX_DELETED',
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  EMBEDDING_GENERATED = 'EMBEDDING_GENERATED',
  CODE_TO_TEXT_CONVERTED = 'CODE_TO_TEXT_CONVERTED'
}

/**
 * 向量事件
 */
export interface VectorEvent {
  type: VectorEventType;
  timestamp: Date;
  data?: any;
  error?: Error;
  metadata?: {
    projectId?: string;
    operationId?: string;
    duration?: number;
    userId?: string;
  };
}

/**
 * 事件监听器
 */
export interface VectorEventListener {
  (event: VectorEvent): void;
}

// ==================== 类型转换工具 ====================

/**
 * 类型转换工具函数
 */
export class VectorTypeConverter {
  /**
   * 将 Vector 转换为 VectorPoint
   */
  static toVectorPoint(vector: Vector): VectorPoint {
    return {
      id: vector.id,
      vector: vector.vector,
      payload: this.toVectorPayload(vector.metadata, vector.content, vector.timestamp)
    };
  }

  /**
   * 将 VectorMetadata 转换为 VectorPayload
   */
  static toVectorPayload(metadata: VectorMetadata, content: string, timestamp: Date): VectorPayload {
    return {
      content,
      filePath: metadata.filePath || '',
      language: metadata.language || 'unknown',
      chunkType: metadata.chunkType || ['code'],
      startLine: metadata.startLine || 0,
      endLine: metadata.endLine || 0,
      functionName: metadata.functionName,
      className: metadata.className,
      snippetMetadata: metadata.snippetMetadata,
      metadata: metadata.customFields || {},
      timestamp,
      projectId: metadata.projectId,

      // 保留所有扩展字段
      complexity: metadata.complexity,
      complexityAnalysis: metadata.complexityAnalysis,
      nestingLevel: metadata.nestingLevel,
      strategy: metadata.strategy,
      isSignatureOnly: metadata.isSignatureOnly,
      originalStructure: metadata.originalStructure,
      astNodes: metadata.astNodes,
      semanticBoundary: metadata.semanticBoundary,
      size: metadata.size,
      lineCount: metadata.lineCount,
      hash: metadata.hash,
      overlapInfo: metadata.overlapInfo,
      contextLines: metadata.contextLines,

      // 嵌入和转换信息
      embeddingInfo: metadata.embeddingInfo,
      codeToTextInfo: metadata.codeToTextInfo
    };
  }

  /**
   * 将 VectorPoint 转换为 Vector
   */
  static fromVectorPoint(point: VectorPoint): Vector {
    return {
      id: point.id as string,
      vector: point.vector,
      content: point.payload.content,
      metadata: this.fromVectorPayload(point.payload),
      timestamp: point.payload.timestamp
    };
  }

  /**
   * 将 VectorPayload 转换为 VectorMetadata
   */
  static fromVectorPayload(payload: VectorPayload): VectorMetadata {
    return {
      projectId: payload.projectId,
      filePath: payload.filePath,
      language: payload.language,
      chunkType: payload.chunkType,
      startLine: payload.startLine,
      endLine: payload.endLine,
      functionName: payload.functionName,
      className: payload.className,
      snippetMetadata: payload.snippetMetadata,
      customFields: payload.metadata,

      // 保留所有扩展字段
      complexity: payload.complexity,
      complexityAnalysis: payload.complexityAnalysis,
      nestingLevel: payload.nestingLevel,
      strategy: payload.strategy,
      isSignatureOnly: payload.isSignatureOnly,
      originalStructure: payload.originalStructure,
      astNodes: payload.astNodes,
      semanticBoundary: payload.semanticBoundary,
      size: payload.size,
      lineCount: payload.lineCount,
      hash: payload.hash,
      overlapInfo: payload.overlapInfo,
      contextLines: payload.contextLines,

      // 嵌入和转换信息
      embeddingInfo: payload.embeddingInfo,
      codeToTextInfo: payload.codeToTextInfo
    };
  }

  /**
   * 将 CodeToTextResult 的元数据添加到 VectorMetadata
   */
  static enrichMetadataWithCodeToText(
    metadata: VectorMetadata,
    textResult: CodeToTextResult
  ): VectorMetadata {
    return {
      ...metadata,
      codeToTextInfo: {
        originalLength: textResult.stats.originalLength,
        convertedLength: textResult.stats.convertedLength,
        conversionRules: textResult.metadata.conversionRules
      }
    };
  }

  /**
   * 将 EmbeddingResult 的元数据添加到 VectorMetadata
   */
  static enrichMetadataWithEmbedding(
    metadata: VectorMetadata,
    embeddingResult: EmbeddingResult
  ): VectorMetadata {
    return {
      ...metadata,
      embeddingInfo: {
        model: embeddingResult.metadata.model.name,
        version: embeddingResult.metadata.model.version,
        dimension: embeddingResult.metadata.model.dimension
      }
    };
  }
}
