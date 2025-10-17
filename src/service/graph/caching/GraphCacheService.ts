/**
 * 图缓存服务实现
 * 简化的图缓存服务，复用现有缓存工具
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { GraphCacheConfigService } from '../../../config/service/GraphCacheConfigService';
import { MemoryAwareCache } from '../../../utils/cache/MemoryAwareCache';
import { IGraphCacheService } from './IGraphCacheService';
import {
  GraphData,
  CacheOptions,
  CacheItem,
  CacheStats,
  CacheConfig,
  DEFAULT_CACHE_CONFIG
} from './types';

@injectable()
export class GraphCacheService implements IGraphCacheService {
  private cache: MemoryAwareCache<string, GraphData>;
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.GraphCacheConfigService) private graphCacheConfigService: GraphCacheConfigService
  ) {
    this.config = this.loadConfig();
    this.cache = new MemoryAwareCache<string, GraphData>(this.config.maxSize, {
      maxMemory: this.config.maxMemory,
      enableCompression: this.config.enableCompression,
      compressionThreshold: this.config.compressionThreshold,
      enableDetailedStats: this.config.enableStats
    });

    this.logger.info('GraphCacheService initialized', {
      maxSize: this.config.maxSize,
      maxMemory: this.config.maxMemory,
      enableCompression: this.config.enableCompression,
      defaultTTL: this.config.defaultTTL
    });
  }

  /**
   * 加载缓存配置
   */
  private loadConfig(): CacheConfig {
    try {
      const graphCacheConfig = this.graphCacheConfigService.getConfig();
      
      return {
        maxSize: graphCacheConfig.maxSize,
        defaultTTL: graphCacheConfig.defaultTTL * 1000, // 转换为毫秒
        maxMemory: graphCacheConfig.maxMemory,
        enableCompression: graphCacheConfig.enableCompression,
        compressionThreshold: graphCacheConfig.compressionThreshold,
        enableStats: graphCacheConfig.enableStats
      };
    } catch (error) {
      this.logger.warn('Failed to load graph cache config, using defaults', { error });
      return DEFAULT_CACHE_CONFIG;
    }
  }

  async set(key: string, data: GraphData, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl ?? this.config.defaultTTL;
      this.cache.set(key, data, ttl);
      
      this.logger.debug('Graph data cached', { 
        key, 
        nodes: data.nodes.length,
        relationships: data.relationships.length,
        ttl 
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache graph data', { key, error });
      return false;
    }
  }

  async get(key: string): Promise<GraphData | null> {
    try {
      const data = this.cache.get(key);
      
      if (data) {
        this.hits++;
        this.logger.debug('Graph data cache hit', { key });
      } else {
        this.misses++;
        this.logger.debug('Graph data cache miss', { key });
      }
      
      return data || null;
    } catch (error) {
      this.logger.error('Failed to get graph data', { key, error });
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = this.cache.delete(key);
      this.logger.debug('Graph data cache deleted', { key, result });
      return result;
    } catch (error) {
      this.logger.error('Failed to delete graph data', { key, error });
      return false;
    }
  }

  async setBatch(items: CacheItem[]): Promise<number> {
    let successCount = 0;
    
    for (const item of items) {
      if (await this.set(item.key, item.data, item.options)) {
        successCount++;
      }
    }
    
    this.logger.debug('Batch cache completed', { 
      total: items.length, 
      success: successCount,
      failed: items.length - successCount 
    });
    
    return successCount;
  }

  async getBatch(keys: string[]): Promise<Map<string, GraphData | null>> {
    const results = new Map<string, GraphData | null>();
    
    for (const key of keys) {
      results.set(key, await this.get(key));
    }
    
    return results;
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
      this.logger.info('Graph cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear graph cache', { error });
      throw error;
    }
  }

  size(): number {
    return this.cache.size();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  getStats(): CacheStats {
    try {
      const memoryStats = this.cache.getDetailedMemoryStats();
      const totalGets = this.hits + this.misses;
      
      return {
        hits: this.hits,
        misses: this.misses,
        evictions: memoryStats.totalEntries, // 简化统计
        sets: memoryStats.totalEntries,
        size: memoryStats.totalEntries,
        memoryUsage: memoryStats.totalMemoryUsage,
        hitRate: totalGets > 0 ? this.hits / totalGets : 0
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      return {
        hits: this.hits,
        misses: this.misses,
        evictions: 0,
        sets: 0,
        size: this.size(),
        memoryUsage: 0,
        hitRate: 0
      };
    }
  }

  isHealthy(): boolean {
    try {
      const stats = this.getStats();
      const memoryUtilization = this.cache.getMemoryUtilization();
      
      // 健康检查逻辑
      if (memoryUtilization > 95) {
        this.logger.warn('Cache memory utilization too high', { utilization: memoryUtilization });
        return false;
      }
      
      if (stats.hitRate < 0.1 && stats.size > 100) {
        this.logger.warn('Cache hit rate too low', { hitRate: stats.hitRate });
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats(): any {
    return this.cache.getDetailedMemoryStats();
  }

  /**
   * 获取压缩统计
   */
  getCompressionStats(): any {
    return this.cache.getCompressionStats();
  }

  /**
   * 获取内存使用率
   */
  getMemoryUtilization(): number {
    return this.cache.getMemoryUtilization();
  }
}