import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { GraphNode, GraphRelationship } from '../graph/mapping/IGraphDataMappingService';

export interface CacheLevel {
  name: string;
  maxSize: number;
  ttl: number; // 毫秒
  priority: number; // 数字越小优先级越高
}

export interface MultiLevelCacheConfig {
  levels: CacheLevel[];
  enableStats: boolean;
  evictionPolicy: 'LRU' | 'FIFO' | 'LFU';
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  size: number;
  hitRate: number;
  levelStats: Map<string, { hits: number; misses: number; size: number }>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  level: number;
  size: number;
}

@injectable()
export class MappingCacheManager {
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
    @inject(TYPES.LoggerService) logger: LoggerService,
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

    this.logger.info('MappingCacheManager initialized', { config: this.config });
  }

  /**
    * 获取缓存项
    */
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

  /**
   * 设置缓存项
   */
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

  /**
   * 在指定级别设置缓存项
   */
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

  /**
   * 删除缓存项
   */
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

  /**
   * 批量获取
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    for (const key of keys) {
      results.set(key, await this.get<T>(key));
    }

    return results;
  }

  /**
   * 批量设置
   */
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

  /**
   * 缓存节点数据
   */
  async cacheNodes(key: string, nodes: GraphNode[], ttl?: number): Promise<boolean> {
    return this.set(`${key}_nodes`, nodes, ttl);
  }

  /**
   * 获取缓存的节点数据
   */
  async getNodes(key: string): Promise<GraphNode[] | null> {
    return this.get<GraphNode[]>(`${key}_nodes`);
  }

  /**
   * 缓存关系数据
   */
  async cacheRelationships(key: string, relationships: GraphRelationship[], ttl?: number): Promise<boolean> {
    return this.set(`${key}_relationships`, relationships, ttl);
  }

  /**
   * 获取缓存的关系数据
   */
  async getRelationships(key: string): Promise<GraphRelationship[] | null> {
    return this.get<GraphRelationship[]>(`${key}_relationships`);
  }

  /**
    * 缓存映射结果
    */
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

  /**
   * 获取缓存的映射结果
   */
  async getMappingResult(key: string): Promise<{
    nodes: GraphNode[];
    relationships: GraphRelationship[];
    timestamp: number
  } | null> {
    return this.get<{ nodes: GraphNode[]; relationships: GraphRelationship[]; timestamp: number }>(key);
  }

  /**
   * 清空指定级别的缓存
   */
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

  /**
   * 清空所有缓存
   */
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

  /**
    * 获取统计信息
    */
  async getStats(): Promise<CacheStats> {
    const totalAccesses = this.stats.hits + this.stats.misses;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      sets: this.stats.sets,
      size: Array.from(this.caches.values()).reduce((sum, cache) => sum + cache.size, 0),
      hitRate,
      levelStats: new Map(this.levelStats)
    };
  }

  /**
   * 获取所有缓存键
   */
  async getKeys(): Promise<string[]> {
    const allKeys = new Set<string>();

    for (const cache of this.caches.values()) {
      for (const key of cache.keys()) {
        allKeys.add(key);
      }
    }

    return Array.from(allKeys);
  }

  /**
    * 驱逐指定级别的缓存项
    */
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
        let leastFrequentTime = Number.MAX_VALUE; // 这里简化为使用时间戳作为频率指标

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

  /**
   * 检查键是否存在且未过期
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }
}