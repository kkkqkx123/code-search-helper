/**
 * 图缓存模块类型定义
 * 简化的图缓存服务类型定义
 */

import { GraphNode, GraphRelationship } from '../mapping/IGraphDataMappingService';

/**
 * 统一的图数据结构
 * 用于缓存的图数据格式
 */
export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  metadata?: Record<string, any>;
}

/**
 * 缓存配置选项
 */
export interface CacheOptions {
  /** 缓存过期时间（毫秒） */
  ttl?: number;
  /** 是否启用压缩 */
  compress?: boolean;
}

/**
 * 缓存项（用于批量操作）
 */
export interface CacheItem {
  key: string;
  data: GraphData;
  options?: CacheOptions;
}

/**
 * 批量操作结果
 */
export interface BatchResult {
  /** 成功缓存的数量 */
  successCount: number;
  /** 失败的数量 */
  failureCount: number;
  /** 失败的键列表 */
  failedKeys: string[];
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
  /** 缓存设置次数 */
  sets: number;
  /** 当前缓存条目数量 */
  size: number;
  /** 内存使用量（字节） */
  memoryUsage: number;
  /** 缓存命中率 */
  hitRate: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 默认TTL（毫秒） */
  defaultTTL: number;
  /** 最大内存使用（字节） */
  maxMemory: number;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 压缩阈值（字节） */
  compressionThreshold: number;
  /** 是否启用统计 */
  enableStats: boolean;
}

/**
 * 图缓存服务接口
 */
export interface IGraphCacheService {
  /**
   * 缓存图数据
   * @param key 缓存键
   * @param data 图数据
   * @param options 缓存选项
   * @returns 是否成功
   */
  set(key: string, data: GraphData, options?: CacheOptions): Promise<boolean>;

  /**
   * 获取图数据
   * @param key 缓存键
   * @returns 图数据或null
   */
  get(key: string): Promise<GraphData | null>;

  /**
   * 删除缓存
   * @param key 缓存键
   * @returns 是否成功
   */
  delete(key: string): Promise<boolean>;

  /**
   * 批量缓存图数据
   * @param items 缓存项列表
   * @returns 成功缓存的数量
   */
  setBatch(items: CacheItem[]): Promise<number>;

  /**
   * 批量获取图数据
   * @param keys 缓存键列表
   * @returns 键值映射
   */
  getBatch(keys: string[]): Promise<Map<string, GraphData | null>>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;

  /**
   * 获取缓存大小
   * @returns 缓存条目数量
   */
  size(): number;

  /**
   * 获取所有缓存键
   * @returns 缓存键列表
   */
  keys(): string[];

  /**
   * 获取缓存统计信息
   * @returns 统计信息
   */
  getStats(): CacheStats;

  /**
   * 检查缓存是否健康
   * @returns 是否健康
   */
  isHealthy(): boolean;
}

/**
 * 缓存错误类型
 */
export enum CacheErrorType {
  /** 缓存已满 */
  CACHE_FULL = 'CACHE_FULL',
  /** 内存不足 */
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  /** 序列化失败 */
  SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
  /** 反序列化失败 */
  DESERIALIZATION_FAILED = 'DESERIALIZATION_FAILED',
  /** 配置错误 */
  CONFIG_ERROR = 'CONFIG_ERROR'
}

/**
 * 缓存错误
 */
export class CacheError extends Error {
  constructor(
    public type: CacheErrorType,
    message: string,
    public key?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 10000,
  defaultTTL: 300000, // 5分钟
  maxMemory: 100 * 1024 * 1024, // 100MB
  enableCompression: true,
  compressionThreshold: 1024, // 1KB
  enableStats: true
};

/**
 * 开发环境缓存配置
 */
export const DEV_CACHE_CONFIG: CacheConfig = {
  ...DEFAULT_CACHE_CONFIG,
  enableCompression: false, // 开发环境禁用压缩
  maxMemory: 50 * 1024 * 1024, // 50MB
  enableStats: true
};

/**
 * 生产环境缓存配置
 */
export const PROD_CACHE_CONFIG: CacheConfig = {
  ...DEFAULT_CACHE_CONFIG,
  enableCompression: true,
  maxMemory: 500 * 1024 * 1024, // 500MB
  enableStats: true
};