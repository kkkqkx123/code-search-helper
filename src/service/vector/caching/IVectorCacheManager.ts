import { Vector, SearchResult, CacheStats, CacheClearOptions, CacheClearResult } from '../types/VectorTypes';

/**
 * 向量缓存管理器接口
 */
export interface IVectorCacheManager {
  /**
   * 获取向量
   */
  getVector(key: string): Promise<Vector | null>;

  /**
   * 设置向量
   */
  setVector(key: string, vector: Vector, ttl?: number): Promise<void>;

  /**
   * 获取搜索结果
   */
  getSearchResult(key: string): Promise<SearchResult[] | null>;

  /**
   * 设置搜索结果
   */
  setSearchResult(key: string, results: SearchResult[], ttl?: number): Promise<void>;

  /**
   * 删除缓存
   */
  delete(key: string): Promise<void>;

  /**
   * 批量删除缓存
   */
  deleteByPattern(pattern: string): Promise<void>;

  /**
   * 清空所有缓存
   */
  clear(options?: CacheClearOptions): Promise<CacheClearResult>;

  /**
   * 获取缓存统计
   */
  getStats(): Promise<CacheStats>;
}