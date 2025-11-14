import { injectable, inject } from 'inversify';
import { IVectorCacheManager } from './IVectorCacheManager';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { Vector, SearchResult, CacheStats, CacheClearOptions, CacheClearResult } from '../types/VectorTypes';
import { ICacheService } from '../../../infrastructure/caching/types';

/**
 * 向量缓存管理器实现，委托给基础设施层的CacheService
 */
@injectable()
export class VectorCacheManager implements IVectorCacheManager {
  private defaultTTL = 300000; // 5分钟

  constructor(
    @inject(TYPES.CacheService) private cacheService: ICacheService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async getVector(key: string): Promise<Vector | null> {
    const vector = this.cacheService.getFromCache<Vector>(`vector:${key}`);
    return vector || null;
  }

  async setVector(key: string, vector: Vector, ttl?: number): Promise<void> {
    this.cacheService.setCache(`vector:${key}`, vector, ttl || this.defaultTTL);
  }

  async getSearchResult(key: string): Promise<SearchResult[] | null> {
    const results = this.cacheService.getFromCache<SearchResult[]>(`search:${key}`);
    return results || null;
  }

 async setSearchResult(key: string, results: SearchResult[], ttl?: number): Promise<void> {
    this.cacheService.setCache(`search:${key}`, results, ttl || this.defaultTTL);
  }

 async delete(key: string): Promise<void> {
    this.cacheService.deleteFromCache(`vector:${key}`);
    this.cacheService.deleteFromCache(`search:${key}`);
  }

  async deleteByPattern(pattern: string): Promise<void> {
    // 删除向量缓存中的匹配项
    const vectorPattern = new RegExp(`^vector:${pattern}`);
    this.cacheService.deleteByPattern(vectorPattern);
    
    // 删除搜索结果缓存中的匹配项
    const searchPattern = new RegExp(`^search:${pattern}`);
    this.cacheService.deleteByPattern(searchPattern);
  }

  async clear(options: CacheClearOptions = {}): Promise<CacheClearResult> {
    const startTime = Date.now();
    const {
      clearVectors = true,
      clearSearchResults = true,
      olderThan
    } = options;

    let vectorsCleared = 0;
    let searchResultsCleared = 0;
    let error: string | undefined;

    try {
      // 构建匹配模式
      const patterns: RegExp[] = [];
      
      if (clearVectors) {
        patterns.push(/^vector:/);
      }
      
      if (clearSearchResults) {
        patterns.push(/^search:/);
      }

      if (patterns.length === 0) {
        return {
          vectorsCleared: 0,
          searchResultsCleared: 0,
          totalCleared: 0,
          success: true,
          executionTime: Date.now() - startTime
        };
      }

      // 使用单一正则表达式匹配所有需要清理的缓存键
      const combinedPattern = new RegExp(`^(${patterns.map(p => p.source).join('|')})`);
      
      // 获取所有匹配的键
      const allKeys = this.cacheService.getKeysByPattern(combinedPattern);
      
      // 如果指定了时间过滤，进一步筛选
      const keysToDelete = olderThan 
        ? allKeys.filter((key: string) => {
            const entry = this.cacheService.getFromCache<any>(key);
            return entry && entry.timestamp < olderThan;
          })
        : allKeys;

      // 分别统计向量和搜索结果的清理数量
      for (const key of keysToDelete) {
        if (key.startsWith('vector:')) {
          vectorsCleared++;
        } else if (key.startsWith('search:')) {
          searchResultsCleared++;
        }
        
        this.cacheService.deleteFromCache(key);
      }

      this.logger.info('Vector cache cleared successfully', {
        vectorsCleared,
        searchResultsCleared,
        totalCleared: vectorsCleared + searchResultsCleared,
        olderThan: olderThan ? new Date(olderThan).toISOString() : undefined,
        executionTime: Date.now() - startTime
      });

    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      this.logger.error('Error clearing vector cache', { error, options });
    }

    return {
      vectorsCleared,
      searchResultsCleared,
      totalCleared: vectorsCleared + searchResultsCleared,
      success: !error,
      error,
      executionTime: Date.now() - startTime
    };
  }

  async getStats(): Promise<CacheStats> {
    const stats = this.cacheService.getCacheStats();
    return {
      hitCount: stats.hitCount,
      missCount: stats.missCount,
      hitRate: stats.hitRate,
      totalEntries: stats.totalEntries,
      memoryUsage: 0 // CacheService目前没有提供内存使用量，设为0
    };
  }
}