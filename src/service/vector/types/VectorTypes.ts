/**
 * 向量服务核心类型定义
 */

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
}

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
  OPERATION_NOT_SUPPORTED = 'OPERATION_NOT_SUPPORTED'
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
  ERROR_OCCURRED = 'ERROR_OCCURRED'
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