# 向量服务接口设计

## 概述

本文档详细定义了向量服务模块的所有接口，包括服务层、仓库层、缓存层和协调层的接口设计。

## 核心服务接口

### IVectorService

```typescript
import { Vector, VectorOptions, SearchOptions, SearchResult, BatchResult, VectorStats, PerformanceMetrics } from './types';

/**
 * 向量服务核心接口
 * 提供统一的向量操作API
 */
export interface IVectorService {
  /**
   * 初始化服务
   */
  initialize(): Promise<boolean>;

  /**
   * 关闭服务
   */
  close(): Promise<void>;

  /**
   * 检查服务是否健康
   */
  isHealthy(): Promise<boolean>;

  /**
   * 获取服务状态
   */
  getStatus(): Promise<ServiceStatus>;

  // === 向量管理 ===

  /**
   * 创建向量
   * @param content 内容数组
   * @param options 创建选项
   * @returns 创建的向量数组
   */
  createVectors(content: string[], options?: VectorOptions): Promise<Vector[]>;

  /**
   * 更新向量
   * @param vectors 要更新的向量数组
   * @returns 更新是否成功
   */
  updateVectors(vectors: Vector[]): Promise<boolean>;

  /**
   * 删除向量
   * @param vectorIds 向量ID数组
   * @returns 删除是否成功
   */
  deleteVectors(vectorIds: string[]): Promise<boolean>;

  // === 向量搜索 ===

  /**
   * 搜索相似向量
   * @param query 查询向量
   * @param options 搜索选项
   * @returns 搜索结果数组
   */
  searchSimilarVectors(query: number[], options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * 按内容搜索相似向量
   * @param content 查询内容
   * @param options 搜索选项
   * @returns 搜索结果数组
   */
  searchByContent(content: string, options?: SearchOptions): Promise<SearchResult[]>;

  // === 批量操作 ===

  /**
   * 批量处理向量操作
   * @param operations 操作数组
   * @returns 批量处理结果
   */
  batchProcess(operations: VectorOperation[]): Promise<BatchResult>;

  // === 项目管理 ===

  /**
   * 创建项目索引
   * @param projectId 项目ID
   * @param options 创建选项
   * @returns 创建是否成功
   */
  createProjectIndex(projectId: string, options?: ProjectOptions): Promise<boolean>;

  /**
   * 删除项目索引
   * @param projectId 项目ID
   * @returns 删除是否成功
   */
  deleteProjectIndex(projectId: string): Promise<boolean>;

  // === 统计和监控 ===

  /**
   * 获取向量统计信息
   * @param projectId 项目ID（可选）
   * @returns 统计信息
   */
  getVectorStats(projectId?: string): Promise<VectorStats>;

  /**
   * 获取性能指标
   * @returns 性能指标
   */
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
}
```

## 仓库层接口

### IVectorRepository

```typescript
/**
 * 向量仓库接口
 * 提供数据访问抽象层
 */
export interface IVectorRepository {
  /**
   * 创建单个向量
   * @param vector 向量数据
   * @returns 向量ID
   */
  create(vector: Vector): Promise<string>;

  /**
   * 批量创建向量
   * @param vectors 向量数组
   * @returns 向量ID数组
   */
  createBatch(vectors: Vector[]): Promise<string[]>;

  /**
   * 根据ID查找向量
   * @param id 向量ID
   * @returns 向量或null
   */
  findById(id: string): Promise<Vector | null>;

  /**
   * 根据ID数组查找向量
   * @param ids 向量ID数组
   * @returns 向量数组
   */
  findByIds(ids: string[]): Promise<Vector[]>;

  /**
   * 更新向量
   * @param id 向量ID
   * @param vector 更新的向量数据
   * @returns 更新是否成功
   */
  update(id: string, vector: Partial<Vector>): Promise<boolean>;

  /**
   * 删除向量
   * @param id 向量ID
   * @returns 删除是否成功
   */
  delete(id: string): Promise<boolean>;

  /**
   * 批量删除向量
   * @param ids 向量ID数组
   * @returns 删除是否成功
   */
  deleteBatch(ids: string[]): Promise<boolean>;

  // === 搜索操作 ===

  /**
   * 按向量搜索
   * @param query 查询向量
   * @param options 搜索选项
   * @returns 搜索结果数组
   */
  searchByVector(query: number[], options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * 按条件过滤搜索
   * @param filter 过滤条件
   * @param options 搜索选项
   * @returns 向量数组
   */
  searchByFilter(filter: VectorFilter, options?: SearchOptions): Promise<Vector[]>;

  // === 聚合操作 ===

  /**
   * 统计向量数量
   * @param filter 过滤条件（可选）
   * @returns 数量
   */
  count(filter?: VectorFilter): Promise<number>;

  /**
   * 获取统计信息
   * @param projectId 项目ID（可选）
   * @returns 统计信息
   */
  getStats(projectId?: string): Promise<VectorStats>;

  // === 索引管理 ===

  /**
   * 创建索引
   * @param projectId 项目ID
   * @param options 创建选项
   * @returns 创建是否成功
   */
  createIndex(projectId: string, options?: IndexOptions): Promise<boolean>;

  /**
   * 删除索引
   * @param projectId 项目ID
   * @returns 删除是否成功
   */
  deleteIndex(projectId: string): Promise<boolean>;

  /**
   * 检查索引是否存在
   * @param projectId 项目ID
   * @returns 是否存在
   */
  indexExists(projectId: string): Promise<boolean>;
}
```

## 缓存层接口

### IVectorCacheManager

```typescript
/**
 * 向量缓存管理器接口
 */
export interface IVectorCacheManager {
  /**
   * 获取向量
   * @param key 缓存键
   * @returns 向量或null
   */
  getVector(key: string): Promise<Vector | null>;

  /**
   * 设置向量
   * @param key 缓存键
   * @param vector 向量
   * @param ttl 过期时间（毫秒）
   */
  setVector(key: string, vector: Vector, ttl?: number): Promise<void>;

  /**
   * 获取搜索结果
   * @param key 缓存键
   * @returns 搜索结果或null
   */
  getSearchResult(key: string): Promise<SearchResult[] | null>;

  /**
   * 设置搜索结果
   * @param key 缓存键
   * @param results 搜索结果
   * @param ttl 过期时间（毫秒）
   */
  setSearchResult(key: string, results: SearchResult[], ttl?: number): Promise<void>;

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): Promise<void>;

  /**
   * 批量删除缓存
   * @param pattern 匹配模式
   */
  deleteByPattern(pattern: string): Promise<void>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;

  /**
   * 获取缓存统计
   */
  getStats(): Promise<CacheStats>;
}
```

## 协调层接口

### IVectorCoordinationService

```typescript
/**
 * 向量协调服务接口
 * 负责协调复杂的向量操作流程
 */
export interface IVectorCoordinationService {
  /**
   * 协调向量创建流程
   * @param contents 内容数组
   * @param options 创建选项
   * @returns 创建的向量数组
   */
  coordinateVectorCreation(contents: string[], options?: VectorOptions): Promise<Vector[]>;

  /**
   * 协调向量搜索流程
   * @param query 查询向量或内容
   * @param options 搜索选项
   * @returns 搜索结果数组
   */
  coordinateVectorSearch(query: number[] | string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * 协调批量操作
   * @param operations 操作数组
   * @returns 批量处理结果
   */
  coordinateBatchOperations(operations: VectorOperation[]): Promise<BatchResult>;

  /**
   * 处理嵌入生成
   * @param contents 内容数组
   * @param options 生成选项
   * @returns 嵌入向量数组
   */
  handleEmbeddingGeneration(contents: string[], options?: EmbeddingOptions): Promise<number[][]>;

  /**
   * 优化批处理
   * @param items 待处理项目
   * @param processor 处理器函数
   * @param options 批处理选项
   * @returns 处理结果
   */
  optimizeBatchProcessing<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: BatchOptions
  ): Promise<R[]>;
}
```

## 类型定义

### 核心类型

```typescript
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
  projectId: string;
  filePath?: string;
  language?: string;
  chunkType?: string[];
  startLine?: number;
  endLine?: number;
  functionName?: string;
  className?: string;
  snippetMetadata?: any;
  customFields?: Record<string, any>;
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
 * 批量操作
 */
export interface VectorOperation {
  type: 'create' | 'update' | 'delete';
  data: Vector | string; // Vector for create/update, id for delete
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
 * 向距离类型
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
```

## 错误处理接口

### VectorError

```typescript
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
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES'
}
```

## 事件接口

### VectorEvent

```typescript
/**
 * 向量事件类型
 */
export enum VectorEventType {
  VECTOR_CREATED = 'VECTOR_CREATED',
  VECTOR_UPDATED = 'VECTOR_UPDATED',
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
 * 事件发布者
 */
export interface IVectorEventPublisher {
  publish(event: VectorEvent): void;
  subscribe(type: VectorEventType, listener: VectorEventListener): void;
  unsubscribe(type: VectorEventType, listener: VectorEventListener): void;
}
```

## 配置接口

### VectorServiceConfig

```typescript
/**
 * 向量服务配置
 */
export interface VectorServiceConfig {
  // 数据库配置
  database: {
    type: 'qdrant' | 'pinecone' | 'weaviate';
    connection: DatabaseConnectionConfig;
    pool?: ConnectionPoolConfig;
  };

  // 缓存配置
  cache: {
    enabled: boolean;
    type: 'memory' | 'redis';
    ttl: number;
    maxSize: number;
    redis?: RedisConfig;
  };

  // 嵌入配置
  embedding: {
    defaultProvider: string;
    defaultModel: string;
    timeout: number;
    maxRetries: number;
    cacheEmbeddings: boolean;
  };

  // 批处理配置
  batch: {
    enabled: boolean;
    defaultBatchSize: number;
    maxConcurrency: number;
    retryAttempts: number;
    retryDelay: number;
  };

  // 性能配置
  performance: {
    enableMetrics: boolean;
    metricsInterval: number;
    slowQueryThreshold: number;
    maxQueryTime: number;
  };

  // 监控配置
  monitoring: {
    enabled: boolean;
    healthCheckInterval: number;
    metricsCollectionInterval: number;
    alerting: AlertingConfig;
  };
}

/**
 * 数据库连接配置
 */
export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
}

/**
 * 连接池配置
 */
export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
}

/**
 * Redis配置
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

/**
 * 告警配置
 */
export interface AlertingConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number;
    responseTime: number;
    cacheHitRate: number;
  };
  channels: string[];
}
```

## 总结

这些接口设计提供了完整的向量服务功能，包括：

1. **统一的服务接口**：IVectorService提供统一的API
2. **清晰的数据访问层**：IVectorRepository隔离数据库细节
3. **完善的缓存机制**：IVectorCacheManager管理多级缓存
4. **智能的协调层**：IVectorCoordinationService优化复杂操作
5. **丰富的类型系统**：完整的类型定义和错误处理
6. **灵活的配置系统**：支持各种配置选项
7. **完善的事件系统**：支持事件驱动的架构

这些接口设计借鉴了Graph服务的成功经验，同时针对向量操作的特殊需求进行了优化和扩展。