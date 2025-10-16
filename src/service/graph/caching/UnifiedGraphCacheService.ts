import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { GraphNode, GraphRelationship } from '../mapping/IGraphDataMappingService';
import { GraphAnalysisResult } from '../core/types';
import { LRUCache } from '../../../utils/LRUCache';
import { IGraphCacheService, IMultiLevelCacheManager } from './IGraphCacheService';
import { 
  GraphCacheStats, 
  GraphMappingResult, 
  CacheUsage, 
  CacheHealthStatus,
  CacheEntry,
  MultiLevelCacheConfig,
  CacheLevel
} from './types';

/**
 * 统一的图缓存服务实现
 * 整合了 GraphMappingCache、GraphCacheService 和 MappingCacheManager 的功能
 */
@injectable()
export class UnifiedGraphCacheService implements IGraphCacheService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  
  // 主缓存 - 用于通用缓存和图分析结果
  private mainCache: LRUCache<string, CacheEntry<any>>;
  private hits: number = 0;
  private misses: number = 0;
  
  // 图分析结果专用缓存
  private graphStatsCache: CacheEntry<GraphAnalysisResult> | null = null;
  
  // 多级缓存管理器
  private multiLevelManager: MultiLevelCacheManager | null = null;
  
  private readonly defaultTTL: number = 300000; // 5分钟
  private readonly maxCacheSize: number = 10000;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;

    try {
      // 初始化主缓存
      this.mainCache = new LRUCache<string, CacheEntry<any>>(this.maxCacheSize, {
        enableStats: true,
        defaultTTL: this.defaultTTL,
        enableFastAccess: true
      });

      // 初始化多级缓存管理器（可选）
      const cacheConfig = this.getCacheConfig();
      if (cacheConfig.enableMultiLevel) {
        this.multiLevelManager = new MultiLevelCacheManager(
          logger,
          cacheConfig.multiLevelConfig
        );
      }

      this.logger.info('UnifiedGraphCacheService initialized', {
        maxSize: this.maxCacheSize,
        defaultTTL: this.defaultTTL,
        multiLevelEnabled: !!this.multiLevelManager
      });
    } catch (error) {
      logger.error('Failed to initialize UnifiedGraphCacheService', { 
        error: (error as Error).message, 
        stack: (error as Error).stack 
      });
      throw error;
    }
  }

  private getCacheConfig() {
    try {
      if (!this.configService) {
        return { 
          maxSize: this.maxCacheSize, 
          defaultTTL: this.defaultTTL,
          enableMultiLevel: false 
        };
      }

      try {
        const config = this.configService.get('caching');
        return {
          maxSize: config.maxSize || this.maxCacheSize,
          defaultTTL: config.defaultTTL || this.defaultTTL,
          enableMultiLevel: (config as any).enableMultiLevel || false,
          multiLevelConfig: (config as any).multiLevelConfig
        };
      } catch (error) {
        this.logger.warn('Failed to get cache configuration, using defaults', { 
          error: (error as Error).message 
        });
        return { 
          maxSize: this.maxCacheSize, 
          defaultTTL: this.defaultTTL,
          enableMultiLevel: false 
        };
      }
    } catch (error) {
      this.logger.error('Error getting cache configuration', { 
        error: (error as Error).message 
      });
      return { 
        maxSize: this.maxCacheSize, 
        defaultTTL: this.defaultTTL,
        enableMultiLevel: false 
      };
    }
  }

  // ===== 图节点缓存 =====
  async cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean> {
    try {
      if (this.multiLevelManager) {
        return await this.multiLevelManager.cacheNodes(key, nodes, ttl);
      } else {
        const cacheKey = `${key}_nodes`;
        const entry: CacheEntry<GraphNode[]> = {
          data: nodes,
          timestamp: Date.now(),
          ttl: ttl || this.defaultTTL
        };
        this.mainCache.set(cacheKey, entry);
        this.logger.debug('Nodes cached', { key, count: nodes.length });
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to cache nodes', { 
        key, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  async getNodes(key: string): Promise<GraphNode[] | null> {
    try {
      if (this.multiLevelManager) {
        return await this.multiLevelManager.getNodes(key);
      } else {
        const cacheKey = `${key}_nodes`;
        const entry = this.mainCache.get(cacheKey);
        
        if (!entry) {
          this.misses++;
          return null;
        }

        // 检查是否过期
        if (Date.now() - entry.timestamp > entry.ttl) {
          this.mainCache.delete(cacheKey);
          this.misses++;
          return null;
        }

        this.hits++;
        return Array.isArray(entry.data) ? entry.data as GraphNode[] : null;
      }
    } catch (error) {
      this.logger.error('Failed to get nodes', { 
        key, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // ===== 图关系缓存 =====
  async cacheRelationships(key: string, relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    try {
      if (this.multiLevelManager) {
        return await this.multiLevelManager.cacheRelationships(key, relationships, ttl);
      } else {
        const cacheKey = `${key}_relationships`;
        const entry: CacheEntry<GraphRelationship[]> = {
          data: relationships,
          timestamp: Date.now(),
          ttl: ttl || this.defaultTTL
        };
        this.mainCache.set(cacheKey, entry);
        this.logger.debug('Relationships cached', { key, count: relationships.length });
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to cache relationships', { 
        key, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  async getRelationships(key: string): Promise<GraphRelationship[] | null> {
    try {
      if (this.multiLevelManager) {
        return await this.multiLevelManager.getRelationships(key);
      } else {
        const cacheKey = `${key}_relationships`;
        const entry = this.mainCache.get(cacheKey);
        
        if (!entry) {
          this.misses++;
          return null;
        }

        // 检查是否过期
        if (Date.now() - entry.timestamp > entry.ttl) {
          this.mainCache.delete(cacheKey);
          this.misses++;
          return null;
        }

        this.hits++;
        return Array.isArray(entry.data) ? entry.data as GraphRelationship[] : null;
      }
    } catch (error) {
      this.logger.error('Failed to get relationships', { 
        key, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // ===== 图映射结果缓存 =====
  async cacheMappingResult(key: string, nodes: GraphNode[], relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    try {
      const mappingResult: GraphMappingResult = {
        nodes,
        relationships,
        timestamp: Date.now()
      };

      if (this.multiLevelManager) {
        return await this.multiLevelManager.cacheMappingResult(key, nodes, relationships, ttl);
      } else {
        const entry: CacheEntry<GraphMappingResult> = {
          data: mappingResult,
          timestamp: Date.now(),
          ttl: ttl || this.defaultTTL
        };
        this.mainCache.set(key, entry);
        this.logger.debug('Mapping result cached', { 
          key, 
          nodeCount: nodes.length, 
          relationshipCount: relationships.length 
        });
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to cache mapping result', { 
        key, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  async getMappingResult(key: string): Promise<GraphMappingResult | null> {
    try {
      if (this.multiLevelManager) {
        return await this.multiLevelManager.getMappingResult(key);
      } else {
        const entry = this.mainCache.get(key);
        
        if (!entry || !entry.data || typeof entry.data !== 'object') {
          this.misses++;
          return null;
        }

        const result = entry.data as GraphMappingResult;
        if (!result.nodes || !result.relationships || !result.timestamp) {
          this.misses++;
          return null;
        }

        // 检查是否过期
        if (Date.now() - entry.timestamp > entry.ttl) {
          this.mainCache.delete(key);
          this.misses++;
          return null;
        }

        this.hits++;
        return result;
      }
    } catch (error) {
      this.logger.error('Failed to get mapping result', { 
        key, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // ===== 图分析结果缓存 =====
  getGraphStatsCache(): GraphAnalysisResult | null {
    try {
      if (!this.graphStatsCache) {
        return null;
      }

      // 检查是否过期
      const now = Date.now();
      if (now - this.graphStatsCache.timestamp > this.graphStatsCache.ttl) {
        this.graphStatsCache = null;
        this.logger.debug('Graph stats cache expired');
        return null;
      }

      this.hits++;
      this.logger.debug('Graph stats cache hit');
      return this.graphStatsCache.data;
    } catch (error) {
      this.logger.error('Failed to get graph stats cache', { 
        error: (error as Error).message 
      });
      return null;
    }
  }

  setGraphStatsCache(stats: GraphAnalysisResult): void {
    try {
      const cacheConfig = this.getCacheConfig();
      const defaultTTL = cacheConfig.defaultTTL || 300000; // 5 minutes default

      this.graphStatsCache = {
        data: stats,
        timestamp: Date.now(),
        ttl: defaultTTL,
      };

      this.logger.debug('Graph stats cache set');
    } catch (error) {
      this.logger.error('Failed to set graph stats cache', { 
        error: (error as Error).message 
      });
    }
  }

  // ===== 文件分析缓存 =====
  async cacheFileAnalysis(key: string, analysis: any, ttl?: number): Promise<boolean> {
    try {
      const entry: CacheEntry<any> = {
        data: analysis,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL
      };
      this.mainCache.set(key, entry);
      this.logger.debug('File analysis cached', { key });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache file analysis', { 
        key, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  async getFileAnalysis(key: string): Promise<any | null> {
    try {
      const entry = this.mainCache.get(key);
      
      if (!entry) {
        this.misses++;
        return null;
      }

      // 检查是否过期
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.mainCache.delete(key);
        this.misses++;
        return null;
      }

      this.hits++;
      this.logger.debug('Cache hit for file analysis', { key });
      return entry.data;
    } catch (error) {
      this.logger.error('Failed to get file analysis', { 
        key, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // ===== 通用缓存功能 =====
  getFromCache<T>(key: string): T | null {
    try {
      const entry = this.mainCache.get(key);
      
      if (!entry) {
        this.misses++;
        return null;
      }

      // 检查是否过期
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.mainCache.delete(key);
        this.misses++;
        return null;
      }

      this.hits++;
      return entry.data as T;
    } catch (error) {
      this.logger.error('Failed to get from cache', { 
        key, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  setCache<T>(key: string, value: T, ttl?: number): void {
    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL
      };
      this.mainCache.set(key, entry);
      this.logger.debug('Cache set', { key, ttl: entry.ttl });
    } catch (error) {
      this.logger.error('Failed to set cache', { 
        key, 
        error: (error as Error).message 
      });
    }
  }

  invalidateCache(key: string): void {
    try {
      this.mainCache.delete(key);
      this.logger.debug('Cache invalidated', { key });
    } catch (error) {
      this.logger.error('Failed to invalidate cache', { 
        key, 
        error: (error as Error).message 
      });
    }
  }

  clearAllCache(): void {
    try {
      this.mainCache.clear();
      this.hits = 0;
      this.misses = 0;
      this.graphStatsCache = null;
      this.logger.info('All cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear cache', { 
        error: (error as Error).message 
      });
    }
  }

  // ===== 批量操作 =====
  async cacheBatch<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean> {
    try {
      for (const item of items) {
        this.setCache(item.key, item.value, item.ttl);
      }
      this.logger.debug('Batch cache completed', { itemCount: items.length });
      return true;
    } catch (error) {
      this.logger.error('Failed to cache batch', { 
        error: (error as Error).message, 
        itemCount: items.length 
      });
      return false;
    }
  }

  async getBatch<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    for (const key of keys) {
      const result = this.getFromCache<T>(key);
      results.set(key, result);
    }
    
    this.logger.debug('Batch get completed', { 
      keyCount: keys.length, 
      hitCount: Array.from(results.values()).filter(v => v !== null).length 
    });
    return results;
  }

  // ===== 统计和监控 =====
  getCacheStats(): GraphCacheStats {
    const totalAccesses = this.hits + this.misses;
    const hasSufficientData = totalAccesses >= 10;

    return {
      hits: this.hits,
      misses: this.misses,
      evictions: 0, // LRUCache 不提供驱逐统计
      sets: 0, // 需要额外跟踪
      size: this.mainCache.size(),
      hitRate: totalAccesses > 0 ? this.hits / totalAccesses : 0,
      hasSufficientData
    };
  }

  getCacheUsage(): CacheUsage {
    const cacheConfig = this.getCacheConfig();
    const total = cacheConfig.maxSize;
    const used = this.mainCache.size();
    const percentage = total > 0 ? (used / total) * 100 : 0;

    return {
      total,
      used,
      percentage
    };
  }

  isHealthy(): boolean {
    try {
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };

      this.setCache(testKey, testValue, 1000);
      const retrieved = this.getFromCache<{ timestamp: number }>(testKey);
      this.invalidateCache(testKey);

      return retrieved !== null && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      this.logger.error('Health check failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  getStatus(): string {
    try {
      const usage = this.getCacheUsage();
      const stats = this.getCacheStats();

      if (usage.percentage > 90) {
        return 'critical';
      } else if (usage.percentage > 70) {
        return 'warning';
      } else if (stats.hits + stats.misses === 0) {
        return 'idle';
      } else {
        return 'normal';
      }
    } catch (error) {
      this.logger.error('Status check failed', { 
        error: (error as Error).message 
      });
      return 'error';
    }
  }

  cleanupExpired(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      const keys = Array.from(this.mainCache.keys());
      for (const key of keys) {
        const entry = this.mainCache.get(key);
        if (entry && now - entry.timestamp > entry.ttl) {
          this.mainCache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired entries', { 
        error: (error as Error).message 
      });
    }
  }

  isNearCapacity(): boolean {
    const usage = this.getCacheUsage();
    return usage.percentage > 80;
  }

  evictOldestEntries(ratio: number = 0.2): void {
    try {
      if (!this.isNearCapacity()) {
        return;
      }

      const keys = Array.from(this.mainCache.keys());
      const entriesToRemove = Math.floor(keys.length * ratio);

      if (entriesToRemove > 0) {
        // LRUCache 会自动处理最旧的条目，这里简单清理一些条目
        for (let i = 0; i < Math.min(entriesToRemove, keys.length); i++) {
          this.mainCache.delete(keys[i]);
        }
        this.logger.debug(`Evicted ${entriesToRemove} cache entries`);
      }
    } catch (error) {
      this.logger.error('Failed to evict oldest entries', { 
        error: (error as Error).message 
      });
    }
  }

  // ===== 缓存管理 =====
  async clear(): Promise<void> {
    this.clearAllCache();
  }

  async getKeys(): Promise<string[]> {
    return Array.from(this.mainCache.keys());
  }

  async has(key: string): Promise<boolean> {
    const entry = this.mainCache.get(key);
    if (!entry) return false;

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.mainCache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.mainCache.size();
  }

  async warmup(commonKeys: string[]): Promise<void> {
    this.logger.info('Starting cache warmup', { keyCount: commonKeys.length });

    for (const key of commonKeys) {
      if (!this.has(key)) {
        this.logger.debug('Warmup: key not found', { key });
      }
    }

    this.logger.info('Cache warmup completed');
  }

  async getHealthStatus(): Promise<CacheHealthStatus> {
    const stats = this.getCacheStats();

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (stats.hitRate < 0.5 && stats.hits + stats.misses > 100) {
      status = 'critical';
    } else if (stats.hitRate < 0.7 && stats.hits + stats.misses > 50) {
      status = 'warning';
    }

    return {
      status,
      hitRate: stats.hitRate,
      size: stats.size
    };
  }
}

/**
 * 多级缓存管理器实现
 * 基于 MappingCacheManager 重构
 */
class MultiLevelCacheManager implements IMultiLevelCacheManager {
  private logger: LoggerService;
  private config: MultiLevelCacheConfig;
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0
  };
  private levelStats: Map<string, { hits: number; misses: number; size: number }> = new Map();

  constructor(
    logger: LoggerService,
    config?: Partial<MultiLevelCacheConfig>
  ) {
    this.logger = logger;

    // 默认配置：3级缓存（内存、SSD、磁盘）
    this.config = {
      levels: [
        { name: 'L1', maxSize: 1000, ttl: 300000, priority: 1 }, // 内存缓存，5分钟TTL
        { name: 'L2', maxSize: 10000, ttl: 3600000, priority: 2 }, // SSD缓存，1小时TTL
        { name: 'L3', maxSize: 100000, ttl: 86400000, priority: 3 } // 磁盘缓存，24小时TTL
      ],
      enableStats: true,
      evictionPolicy: 'LRU',
      ...config
    };

    // 初始化各级缓存
    for (const level of this.config.levels) {
      this.caches.set(level.name, new Map());
      this.levelStats.set(level.name, { hits: 0, misses: 0, size: 0 });
    }

    this.logger.info('MultiLevelCacheManager initialized', { config: this.config });
  }

  async get<T>(key: string): Promise<T | null> {
    // 从最高优先级（最快）的缓存开始查找
    for (const level of this.config.levels) {
      const levelCache = this.caches.get(level.name);
      if (!levelCache) continue;

      const entry = levelCache.get(key);

      if (entry) {
        // 检查是否过期
        if (Date.now() - entry.timestamp > entry.ttl) {
          // 过期，删除并继续查找下一级
          await this.delete(key);
          continue;
        }

        // 更新统计信息
        if (this.config.enableStats) {
          this.stats.hits++;
          const levelStat = this.levelStats.get(level.name);
          if (levelStat) {
            levelStat.hits++;
            levelStat.size = levelCache.size;
          }
        }

        this.logger.debug('Cache hit', { key, level: level.name });
        return entry.data as T;
      }
    }

    // 所有级别都未命中
    if (this.config.enableStats) {
      this.stats.misses++;
      for (const level of this.config.levels) {
        const levelStat = this.levelStats.get(level.name);
        if (levelStat) {
          levelStat.misses++;
        }
      }
    }

    this.logger.debug('Cache miss', { key });
    return null;
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<boolean> {
    // 计算数据大小（简单估算）
    const dataSize = JSON.stringify(data).length;

    // 尝试存储到最高优先级的缓存
    const firstLevel = this.config.levels[0];
    if (firstLevel) {
      return await this.setInLevel(firstLevel.name, key, data, ttl || firstLevel.ttl, dataSize);
    }

    return false;
  }

  private async setInLevel<T>(
    levelName: string,
    key: string,
    data: T,
    ttl: number,
    dataSize: number
  ): Promise<boolean> {
    const levelConfig = this.config.levels.find(l => l.name === levelName);
    if (!levelConfig) {
      this.logger.error('Cache level not found', { levelName });
      return false;
    }

    const levelCache = this.caches.get(levelName);
    if (!levelCache) {
      this.logger.error('Cache level not initialized', { levelName });
      return false;
    }

    // 检查是否需要驱逐
    if (levelCache.size >= levelConfig.maxSize) {
      await this.evictFromLevel(levelName);
    }

    // 创建缓存条目
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      level: levelConfig.priority,
      size: dataSize
    };

    levelCache.set(key, entry);

    // 更新统计信息
    if (this.config.enableStats) {
      this.stats.sets++;
      const levelStat = this.levelStats.get(levelName);
      if (levelStat) {
        levelStat.size = levelCache.size;
      }
    }

    this.logger.debug('Cache set', { key, level: levelName, size: dataSize });
    return true;
  }

  async delete(key: string): Promise<boolean> {
    let deleted = false;

    for (const level of this.config.levels) {
      const levelCache = this.caches.get(level.name);
      if (levelCache && levelCache.has(key)) {
        levelCache.delete(key);
        deleted = true;

        // 更新统计信息
        if (this.config.enableStats) {
          const levelStat = this.levelStats.get(level.name);
          if (levelStat) {
            levelStat.size = levelCache.size;
          }
        }
      }
    }

    if (deleted) {
      this.logger.debug('Cache delete', { key });
    }

    return deleted;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    for (const key of keys) {
      results.set(key, await this.get<T>(key));
    }

    return results;
  }

  async setMany<T>(entries: Array<{ key: string; data: T; ttl?: number }>): Promise<number> {
    let successCount = 0;

    for (const entry of entries) {
      const success = await this.set(entry.key, entry.data, entry.ttl);
      if (success) {
        successCount++;
      }
    }

    return successCount;
  }

  // 图特定的缓存方法
  async cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean> {
    return this.set(`${key}_nodes`, nodes, ttl);
  }

  async getNodes(key: string): Promise<GraphNode[] | null> {
    return this.get<GraphNode[]>(`${key}_nodes`);
  }

  async cacheRelationships(key: string, relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    return this.set(`${key}_relationships`, relationships, ttl);
  }

  async getRelationships(key: string): Promise<GraphRelationship[] | null> {
    return this.get<GraphRelationship[]>(`${key}_relationships`);
  }

  async cacheMappingResult(
    key: string,
    nodes: GraphNode[],
    relationships: GraphRelationship[],
    ttl?: number
  ): Promise<boolean> {
    const result = {
      nodes,
      relationships,
      timestamp: Date.now()
    };
    return this.set(key, result, ttl);
  }

  async getMappingResult(key: string): Promise<{
    nodes: GraphNode[];
    relationships: GraphRelationship[];
    timestamp: number
  } | null> {
    return this.get<{ nodes: GraphNode[]; relationships: GraphRelationship[]; timestamp: number }>(key);
  }

  async clearLevel(levelName: string): Promise<void> {
    const levelCache = this.caches.get(levelName);
    if (levelCache) {
      levelCache.clear();
      const levelStat = this.levelStats.get(levelName);
      if (levelStat) {
        levelStat.size = 0;
      }
      this.logger.info('Cleared cache level', { levelName });
    }
  }

  async clearAll(): Promise<void> {
    for (const [levelName] of this.caches) {
      await this.clearLevel(levelName);
    }

    // 重置统计信息
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
    for (const [levelName] of this.levelStats) {
      this.levelStats.set(levelName, { hits: 0, misses: 0, size: 0 });
    }

    this.logger.info('Cleared all cache levels');
  }

  async getStats(): Promise<GraphCacheStats> {
    const totalAccesses = this.stats.hits + this.stats.misses;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      sets: this.stats.sets,
      size: Array.from(this.caches.values()).reduce((sum, cache) => sum + cache.size, 0),
      hitRate,
      hasSufficientData: totalAccesses >= 10,
      levelStats: new Map(this.levelStats)
    };
  }

  async getKeys(): Promise<string[]> {
    const allKeys = new Set<string>();

    for (const cache of this.caches.values()) {
      for (const key of cache.keys()) {
        allKeys.add(key);
      }
    }

    return Array.from(allKeys);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  private async evictFromLevel(levelName: string): Promise<void> {
    const levelCache = this.caches.get(levelName);
    const levelConfig = this.config.levels.find(l => l.name === levelName);

    if (!levelCache || !levelConfig) return;

    switch (this.config.evictionPolicy) {
      case 'LRU':
        // 删除最久未使用的项（时间戳最早的）
        let oldestKey: string | null = null;
        let oldestTime = Number.MAX_VALUE;

        for (const [key, entry] of levelCache) {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          levelCache.delete(oldestKey);
          this.stats.evictions++;

          // 更新统计信息
          const levelStat = this.levelStats.get(levelName);
          if (levelStat) {
            levelStat.size = levelCache.size;
          }

          this.logger.debug('Evicted cache entry (LRU)', {
            level: levelName,
            key: oldestKey
          });
        }
        break;

      case 'FIFO':
        // 删除最先加入的项
        if (levelCache.size > 0) {
          const firstKey = levelCache.keys().next().value;
          if (firstKey) {
            levelCache.delete(firstKey);
            this.stats.evictions++;

            // 更新统计信息
            const levelStat = this.levelStats.get(levelName);
            if (levelStat) {
              levelStat.size = levelCache.size;
            }

            this.logger.debug('Evicted cache entry (FIFO)', {
              level: levelName,
              key: firstKey
            });
          }
        }
        break;

      case 'LFU':
        // 删除使用频率最低的项
        let leastFrequentKey: string | null = null;
        let leastFrequentTime = Number.MAX_VALUE;

        for (const [key, entry] of levelCache) {
          if (entry.timestamp < leastFrequentTime) {
            leastFrequentTime = entry.timestamp;
            leastFrequentKey = key;
          }
        }

        if (leastFrequentKey) {
          levelCache.delete(leastFrequentKey);
          this.stats.evictions++;

          // 更新统计信息
          const levelStat = this.levelStats.get(levelName);
          if (levelStat) {
            levelStat.size = levelCache.size;
          }

          this.logger.debug('Evicted cache entry (LFU)', {
            level: levelName,
            key: leastFrequentKey
          });
        }
        break;
    }
  }
}