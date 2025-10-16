import { GraphNode, GraphRelationship } from '../mapping/IGraphDataMappingService';
import { GraphAnalysisResult } from '../core/types';
import { GraphCacheStats, GraphMappingResult, CacheUsage, CacheHealthStatus } from './types';

/**
 * 统一的图缓存服务接口
 * 整合了 GraphMappingCache 和 GraphCacheService 的功能
 */
export interface IGraphCacheService {
  // ===== 图节点缓存 =====
  cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean>;
  getNodes(key: string): Promise<GraphNode[] | null>;

  // ===== 图关系缓存 =====
  cacheRelationships(key: string, relationships: GraphRelationship[], ttl?: number): Promise<boolean>;
  getRelationships(key: string): Promise<GraphRelationship[] | null>;

  // ===== 图映射结果缓存 =====
  cacheMappingResult(key: string, nodes: GraphNode[], relationships: GraphRelationship[], ttl?: number): Promise<boolean>;
  getMappingResult(key: string): Promise<GraphMappingResult | null>;

  // ===== 图分析结果缓存 =====
  getGraphStatsCache(): GraphAnalysisResult | null;
  setGraphStatsCache(stats: GraphAnalysisResult): void;

  // ===== 文件分析缓存 =====
  cacheFileAnalysis(key: string, analysis: any, ttl?: number): Promise<boolean>;
  getFileAnalysis(key: string): Promise<any | null>;

  // ===== 通用缓存功能 =====
  getFromCache<T>(key: string): T | null;
  setCache<T>(key: string, value: T, ttl?: number): void;
  invalidateCache(key: string): void;
  clearAllCache(): void;

  // ===== 批量操作 =====
  cacheBatch<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean>;
  getBatch<T>(keys: string[]): Promise<Map<string, T | null>>;

  // ===== 统计和监控 =====
  getCacheStats(): GraphCacheStats;
  getCacheUsage(): CacheUsage;
  isHealthy(): boolean;
  getStatus(): string;
  cleanupExpired(): void;
  isNearCapacity(): boolean;
  evictOldestEntries(ratio?: number): void;

  // ===== 缓存管理 =====
  clear(): Promise<void>;
  getKeys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
  size(): number;
  warmup(commonKeys: string[]): Promise<void>;
  getHealthStatus(): Promise<CacheHealthStatus>;
}

/**
 * 多级缓存管理器接口
 */
export interface IMultiLevelCacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  getMany<T>(keys: string[]): Promise<Map<string, T | null>>;
  setMany<T>(entries: Array<{ key: string; data: T; ttl?: number }>): Promise<number>;
  clearLevel(levelName: string): Promise<void>;
  clearAll(): Promise<void>;
  getStats(): Promise<GraphCacheStats>;
  getKeys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
}