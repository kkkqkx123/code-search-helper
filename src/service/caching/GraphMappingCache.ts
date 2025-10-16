import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphNode, GraphRelationship } from '../graph/mapping/IGraphDataMappingService';
import { MemoryAwareCache } from '../../utils/cache/MemoryAwareCache';
import { CacheStats } from '../../utils/LRUCache';

export interface GraphCacheStats extends CacheStats {
  memoryUsage: number;
  maxMemory: number;
  hasSufficientData: boolean;
  hitRate: number;
}

@injectable()
export class GraphMappingCache {
  private logger: LoggerService;
  private cache: MemoryAwareCache<string, any>;
  private readonly defaultTTL: number = 300000; // 5分钟

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    try {
      this.logger = logger;
      // 使用内存感知的缓存，替换原有的Map实现
      this.cache = new MemoryAwareCache<string, any>(10000, {
        maxMemory: 50 * 1024 * 1024, // 50MB
        defaultTTL: this.defaultTTL,
        enableStats: true
      });
      
      this.logger.info('GraphMappingCache initialized with enhanced cache', {
        maxSize: 10000,
        maxMemory: 50 * 1024 * 1024,
        defaultTTL: this.defaultTTL
      });
    } catch (error) {
      logger.error('Failed to initialize GraphMappingCache', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  }

  /**
   * 存储图节点到缓存
   */
  async cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean> {
    try {
      this.cache.set(key, nodes, ttl);
      this.logger.debug('Nodes cached', { key, count: nodes.length });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache nodes', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * 从缓存获取图节点
   */
  async getNodes(key: string): Promise<GraphNode[] | null> {
    const result = this.cache.get(key);
    if (result) {
      this.logger.debug('Cache hit for nodes', { key });
      return Array.isArray(result) ? result as GraphNode[] : null;
    } else {
      this.logger.debug('Cache miss for nodes', { key });
      return null;
    }
  }

  /**
   * 存储图关系到缓存
   */
  async cacheRelationships(key: string, relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    try {
      this.cache.set(key, relationships, ttl);
      this.logger.debug('Relationships cached', { key, count: relationships.length });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache relationships', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * 从缓存获取图关系
   */
  async getRelationships(key: string): Promise<GraphRelationship[] | null> {
    const result = this.cache.get(key);
    if (result) {
      this.logger.debug('Cache hit for relationships', { key });
      return Array.isArray(result) ? result as GraphRelationship[] : null;
    } else {
      this.logger.debug('Cache miss for relationships', { key });
      return null;
    }
  }

  /**
   * 存储映射结果到缓存
   */
  async cacheMappingResult(key: string, nodes: GraphNode[], relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    try {
      const mappingResult = {
        nodes,
        relationships,
        timestamp: Date.now()
      };
      this.cache.set(key, mappingResult, ttl);
      this.logger.debug('Mapping result cached', { key, nodeCount: nodes.length, relationshipCount: relationships.length });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache mapping result', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * 从缓存获取映射结果
   */
  async getMappingResult(key: string): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[]; timestamp: number } | null> {
    const result = this.cache.get(key);
    if (result && typeof result === 'object' && 'nodes' in result && 'relationships' in result) {
      this.logger.debug('Cache hit for mapping result', { key });
      return result as { nodes: GraphNode[]; relationships: GraphRelationship[]; timestamp: number };
    } else {
      this.logger.debug('Cache miss for mapping result', { key });
      return null;
    }
  }

  /**
   * 存储文件分析结果到缓存
   */
  async cacheFileAnalysis(key: string, analysis: any, ttl?: number): Promise<boolean> {
    try {
      this.cache.set(key, analysis, ttl);
      this.logger.debug('File analysis cached', { key });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache file analysis', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * 从缓存获取文件分析结果
   */
  async getFileAnalysis(key: string): Promise<any | null> {
    const result = this.cache.get(key);
    if (result) {
      this.logger.debug('Cache hit for file analysis', { key });
    } else {
      this.logger.debug('Cache miss for file analysis', { key });
    }
    return result || null;
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<GraphCacheStats> {
    const baseStats = this.cache.getStats();
    if (!baseStats) {
      // 如果统计未启用，返回默认值
      return {
        hits: 0,
        misses: 0,
        evictions: 0,
        sets: 0,
        size: this.cache.size(),
        memoryUsage: this.cache.getMemoryUsage(),
        maxMemory: this.cache.getMaxMemory(),
        hitRate: 0,
        hasSufficientData: false
      };
    }

    const totalAccesses = baseStats.hits + baseStats.misses;
    const MIN_STATISTICALLY_SIGNIFICANT_ACCESSES = 10;
    const hasSufficientData = totalAccesses >= MIN_STATISTICALLY_SIGNIFICANT_ACCESSES;

    return {
      ...baseStats,
      memoryUsage: this.cache.getMemoryUsage(),
      maxMemory: this.cache.getMaxMemory(),
      hitRate: totalAccesses > 0 ? baseStats.hits / totalAccesses : 0,
      hasSufficientData
    };
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * 获取所有缓存键
   */
  async getKeys(): Promise<string[]> {
    return this.cache.keys();
  }

  /**
   * 检查键是否存在且未过期
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * 清理过期条目
   */
  async cleanup(): Promise<number> {
    const removed = this.cache.cleanup();
    if (removed > 0) {
      this.logger.debug('Cleaned up expired entries', { count: removed });
    }
    return removed;
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): number {
    return this.cache.getMemoryUsage();
  }

  /**
   * 获取最大内存限制
   */
  getMaxMemory(): number {
    return this.cache.getMaxMemory();
  }
}