import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphNode, GraphRelationship } from '../mapping/IGraphDataMappingService';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number; // 数据大小（字节）
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  size: number;
  memoryUsage: number;
  hitRate: number;
}

@injectable()
export class GraphMappingCache {
  private logger: LoggerService;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0
  };
  private readonly defaultTTL: number = 300000; // 5分钟
  private readonly maxEntries: number = 10000;
  private readonly maxMemory: number = 50 * 1024 * 1024; // 50MB
  private memoryUsage: number = 0;

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
    this.logger.info('GraphMappingCache initialized', {
      defaultTTL: this.defaultTTL,
      maxEntries: this.maxEntries,
      maxMemory: this.maxMemory
    });
  }

  /**
   * 存储图节点到缓存
   */
  async cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean> {
    return this.set(key, nodes, ttl);
  }

  /**
   * 从缓存获取图节点
   */
  async getNodes(key: string): Promise<GraphNode[] | null> {
    const result = await this.get(key);
    return Array.isArray(result) ? result as GraphNode[] : null;
  }

  /**
   * 存储图关系到缓存
   */
  async cacheRelationships(key: string, relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    return this.set(key, relationships, ttl);
  }

  /**
   * 从缓存获取图关系
   */
  async getRelationships(key: string): Promise<GraphRelationship[] | null> {
    const result = await this.get(key);
    return Array.isArray(result) ? result as GraphRelationship[] : null;
  }

  /**
   * 存储映射结果到缓存
   */
  async cacheMappingResult(key: string, nodes: GraphNode[], relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    const mappingResult = {
      nodes,
      relationships,
      timestamp: Date.now()
    };
    return this.set(key, mappingResult, ttl);
  }

  /**
   * 从缓存获取映射结果
   */
  async getMappingResult(key: string): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[]; timestamp: number } | null> {
    const result = await this.get(key);
    if (result && typeof result === 'object' && 'nodes' in result && 'relationships' in result) {
      return result as { nodes: GraphNode[]; relationships: GraphRelationship[]; timestamp: number };
    }
    return null;
  }

  /**
   * 存储文件分析结果到缓存
   */
  async cacheFileAnalysis(key: string, analysis: any, ttl?: number): Promise<boolean> {
    return this.set(key, analysis, ttl);
  }

  /**
   * 从缓存获取文件分析结果
   */
  async getFileAnalysis(key: string): Promise<any | null> {
    return await this.get(key);
  }

  private async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.logger.debug('Cache miss', { key });
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      await this.delete(key);
      this.stats.misses++;
      this.logger.debug('Cache entry expired', { key });
      return null;
    }

    this.stats.hits++;
    this.logger.debug('Cache hit', { key });
    return entry.data as T;
  }

  private async set<T>(key: string, data: T, ttl?: number): Promise<boolean> {
    try {
      // 计算数据大小（简单估算）
      const dataSize = JSON.stringify(data).length;
      
      // 检查内存使用情况
      if (this.memoryUsage + dataSize > this.maxMemory) {
        this.evictOldestEntries(dataSize);
      }

      // 检查条目数量
      if (this.cache.size >= this.maxEntries) {
        // 删除最旧的条目
        const oldestKey = this.getOldestKey();
        if (oldestKey) {
          await this.delete(oldestKey);
        }
      }

      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL,
        size: dataSize
      };

      this.cache.set(key, cacheEntry);
      this.memoryUsage += dataSize;
      this.stats.sets++;

      this.logger.debug('Cache set', { 
        key, 
        ttl: cacheEntry.ttl, 
        size: dataSize,
        totalSize: this.memoryUsage 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to set cache entry', { 
        key, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  private async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this.memoryUsage -= entry.size;
      this.cache.delete(key);
      this.stats.evictions++;
      this.logger.debug('Cache entry deleted', { key, size: entry.size });
      return true;
    }
    return false;
  }

  private getOldestKey(): string | null> {
    let oldestKey: string | null = null;
    let oldestTime = Number.MAX_VALUE;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private evictOldestEntries(requiredSpace: number): void {
    let freedSpace = 0;
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // 按时间排序

    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) {
        break;
      }
      
      this.cache.delete(key);
      freedSpace += entry.size;
      this.stats.evictions++;
      this.logger.debug('Evicted cache entry due to memory pressure', { 
        key, 
        size: entry.size,
        freedSpace 
      });
    }

    this.memoryUsage -= freedSpace;
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<CacheStats> {
    const totalAccesses = this.stats.hits + this.stats.misses;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      sets: this.stats.sets,
      size: this.cache.size,
      memoryUsage: this.memoryUsage,
      hitRate
    };
  }

 /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.memoryUsage = 0;
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
    this.logger.info('Cache cleared');
  }

  /**
   * 获取所有缓存键
   */
  async getKeys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  /**
   * 检查键是否存在且未过期
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    
    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      await this.delete(key);
      return false;
    }
    
    return true;
  }
}