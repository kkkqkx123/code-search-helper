/**
 * 智能缓存管理器
 * 提供多级缓存策略和智能缓存键生成
 */

/**
 * 缓存条目接口
 */
export interface CacheEntry<T> {
  /** 缓存值 */
  value: T;
  /** 过期时间 */
  expiry?: number;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessed: number;
  /** 创建时间 */
  createdAt: number;
  /** 大小（字节） */
  size: number;
}

/**
 * 缓存策略枚举
 */
export enum CacheStrategy {
  LRU = 'lru',        // 最近最少使用
  LFU = 'lfu',        // 最少频繁使用
  FIFO = 'fifo',      // 先进先出
  TTL = 'ttl'         // 基于时间
}

/**
 * 缓存类型枚举
 */
export enum CacheType {
  RESULT = 'result',
  COMPLEXITY = 'complexity',
  METADATA = 'metadata',
  RELATIONSHIP = 'relationship',
  SYMBOL = 'symbol'
}

/**
 * 智能缓存管理器配置接口
 */
export interface SmartCacheManagerConfig {
  /** 默认缓存大小 */
  defaultCacheSize?: number;
  /** 每种缓存类型的大小 */
  cacheSizes?: Record<CacheType, number>;
  /** 默认TTL（毫秒） */
  defaultTTL?: number;
  /** 每种缓存类型的TTL */
  cacheTTLs?: Record<CacheType, number>;
  /** 缓存策略 */
  strategy?: CacheStrategy;
  /** 是否启用统计 */
  enableStats?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 内存限制（字节） */
  memoryLimit?: number;
}

/**
 * 缓存统计接口
 */
export interface CacheStats {
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 总访问次数 */
  totalAccesses: number;
  /** 当前缓存大小 */
  currentSize: number;
  /** 最大大小 */
  maxSize: number;
  /** 按类型统计 */
  byType: Record<CacheType, {
    hits: number;
    misses: number;
    size: number;
    count: number;
  }>;
}

/**
 * 智能缓存管理器
 */
export class SmartCacheManager {
  private caches: Map<CacheType, Map<string, CacheEntry<any>>> = new Map();
  private config: SmartCacheManagerConfig;
  private stats: CacheStats;
  private debugMode: boolean;

  constructor(config: SmartCacheManagerConfig = {}) {
    this.config = {
      defaultCacheSize: config.defaultCacheSize ?? 1000,
      cacheSizes: config.cacheSizes ?? {
        [CacheType.RESULT]: 1000,
        [CacheType.COMPLEXITY]: 5000,
        [CacheType.METADATA]: 2000,
        [CacheType.RELATIONSHIP]: 3000,
        [CacheType.SYMBOL]: 1000
      },
      defaultTTL: config.defaultTTL ?? 300000, // 5分钟
      cacheTTLs: config.cacheTTLs ?? {
        [CacheType.RESULT]: 300000,
        [CacheType.COMPLEXITY]: 600000, // 10分钟
        [CacheType.METADATA]: 300000,
        [CacheType.RELATIONSHIP]: 300000,
        [CacheType.SYMBOL]: 600000
      },
      strategy: config.strategy ?? CacheStrategy.LRU,
      enableStats: config.enableStats ?? true,
      debug: config.debug ?? false,
      memoryLimit: config.memoryLimit
    };

    this.debugMode = this.config.debug ?? false;
    this.stats = this.initializeStats();
    this.initializeCaches();
  }

  /**
   * 初始化缓存
   */
  private initializeCaches(): void {
    for (const type of Object.values(CacheType)) {
      this.caches.set(type, new Map());
    }
    this.logDebug('Caches initialized');
  }

  /**
   * 初始化统计
   */
  private initializeStats(): CacheStats {
    const byType: Record<CacheType, any> = {} as Record<CacheType, any>;
    
    for (const type of Object.values(CacheType)) {
      byType[type] = {
        hits: 0,
        misses: 0,
        size: 0,
        count: 0
      };
    }

    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalAccesses: 0,
      currentSize: 0,
      maxSize: Object.values(this.config.cacheSizes || {}).reduce((sum, size) => sum + size, 0),
      byType
    };
  }

  /**
   * 获取缓存值
   */
  get<T>(key: string, cacheType: CacheType = CacheType.RESULT): T | undefined {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      this.logWarning(`Cache type not found: ${cacheType}`);
      return undefined;
    }

    const entry = cache.get(key);
    
    // 更新统计
    this.stats.totalAccesses++;
    this.stats.byType[cacheType].hits++;

    if (!entry) {
      this.stats.misses++;
      this.stats.byType[cacheType].misses++;
      this.updateHitRate();
      this.logDebug(`Cache miss for key: ${key} in type: ${cacheType}`);
      return undefined;
    }

    // 检查过期
    if (entry.expiry && Date.now() > entry.expiry) {
      this.stats.misses++;
      this.stats.byType[cacheType].misses++;
      this.updateHitRate();
      cache.delete(key);
      this.logDebug(`Cache entry expired for key: ${key} in type: ${cacheType}`);
      return undefined;
    }

    // 更新访问统计
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.stats.hits++;
    this.updateHitRate();
    
    this.logDebug(`Cache hit for key: ${key} in type: ${cacheType}`);
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set<T>(key: string, value: T, cacheType: CacheType = CacheType.RESULT, ttl?: number): void {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      this.logWarning(`Cache type not found: ${cacheType}`);
      return;
    }

    // 计算条目大小
    const size = this.calculateSize(value);
    
    // 检查内存限制
    if (this.config.memoryLimit && this.stats.currentSize + size > this.config.memoryLimit) {
      this.logWarning('Memory limit exceeded, evicting entries');
      this.evictEntries();
    }

    // 创建缓存条目
    const entry: CacheEntry<T> = {
      value,
      accessCount: 0,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
      size
    };

    // 设置过期时间
    const cacheTTL = ttl || this.config.cacheTTLs?.[cacheType] || this.config.defaultTTL!;
    if (cacheTTL > 0) {
      entry.expiry = Date.now() + cacheTTL;
    }

    // 检查缓存大小限制
    const maxSize = this.config.cacheSizes?.[cacheType] || this.config.defaultCacheSize!;
    if (cache.size >= maxSize) {
      this.evictEntry(cacheType);
    }

    // 存储条目
    cache.set(key, entry as CacheEntry<any>);
    
    // 更新统计
    this.stats.currentSize += size;
    this.stats.byType[cacheType].size += size;
    this.stats.byType[cacheType].count = cache.size;
    
    this.logDebug(`Cache entry set for key: ${key} in type: ${cacheType}`, {
      size,
      ttl: cacheTTL
    });
  }

  /**
   * 删除缓存值
   */
  delete(key: string, cacheType: CacheType = CacheType.RESULT): boolean {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      return false;
    }

    const entry = cache.get(key);
    if (!entry) {
      return false;
    }

    // 更新统计
    this.stats.currentSize -= entry.size;
    this.stats.byType[cacheType].size -= entry.size;
    
    const deleted = cache.delete(key);
    if (deleted) {
      this.stats.byType[cacheType].count = cache.size;
      this.logDebug(`Cache entry deleted for key: ${key} in type: ${cacheType}`);
    }
    
    return deleted;
  }

  /**
   * 清空缓存
   */
  clear(cacheType?: CacheType): void {
    if (cacheType) {
      const cache = this.caches.get(cacheType);
      if (cache) {
        // 更新统计
        let sizeFreed = 0;
        for (const entry of cache.values()) {
          sizeFreed += entry.size;
        }
        
        this.stats.currentSize -= sizeFreed;
        this.stats.byType[cacheType].size = 0;
        this.stats.byType[cacheType].count = 0;
        
        cache.clear();
        this.logDebug(`Cache cleared for type: ${cacheType}`);
      }
    } else {
      // 清空所有缓存
      for (const [type, cache] of this.caches) {
        let sizeFreed = 0;
        for (const entry of cache.values()) {
          sizeFreed += entry.size;
        }
        
        this.stats.byType[type].size = 0;
        this.stats.byType[type].count = 0;
        cache.clear();
      }
      
      this.stats.currentSize = 0;
      this.logDebug('All caches cleared');
    }
  }

  /**
   * 淘汰条目
   */
  private evictEntry(cacheType: CacheType): void {
    const cache = this.caches.get(cacheType);
    if (!cache || cache.size === 0) {
      return;
    }

    let keyToEvict: string | undefined;
    let entryToEvict: CacheEntry<any> | undefined;

    switch (this.config.strategy) {
      case CacheStrategy.LRU:
        // 找到最久未访问的条目
        let oldestAccess = Infinity;
        for (const [key, entry] of cache) {
          if (entry.lastAccessed < oldestAccess) {
            oldestAccess = entry.lastAccessed;
            keyToEvict = key;
            entryToEvict = entry;
          }
        }
        break;

      case CacheStrategy.LFU:
        // 找到访问次数最少的条目
        let lowestAccessCount = Infinity;
        for (const [key, entry] of cache) {
          if (entry.accessCount < lowestAccessCount) {
            lowestAccessCount = entry.accessCount;
            keyToEvict = key;
            entryToEvict = entry;
          }
        }
        break;

      case CacheStrategy.FIFO:
        // 找到最早创建的条目
        let oldestCreation = Infinity;
        for (const [key, entry] of cache) {
          if (entry.createdAt < oldestCreation) {
            oldestCreation = entry.createdAt;
            keyToEvict = key;
            entryToEvict = entry;
          }
        }
        break;

      case CacheStrategy.TTL:
        // 找到最早过期的条目
        let earliestExpiry = Infinity;
        for (const [key, entry] of cache) {
          if (entry.expiry && entry.expiry < earliestExpiry) {
            earliestExpiry = entry.expiry;
            keyToEvict = key;
            entryToEvict = entry;
          }
        }
        break;

      default:
        // 默认使用LRU策略
        let oldest = Infinity;
        for (const [key, entry] of cache) {
          if (entry.lastAccessed < oldest) {
            oldest = entry.lastAccessed;
            keyToEvict = key;
            entryToEvict = entry;
          }
        }
        break;
    }

    if (keyToEvict && entryToEvict) {
      cache.delete(keyToEvict);
      
      // 更新统计
      this.stats.currentSize -= entryToEvict.size;
      this.stats.byType[cacheType].size -= entryToEvict.size;
      this.stats.byType[cacheType].count = cache.size;
      
      this.logDebug(`Evicted entry for key: ${keyToEvict} in type: ${cacheType}`, {
        strategy: this.config.strategy,
        size: entryToEvict.size
      });
    }
  }

  /**
   * 批量淘汰条目以释放内存
   */
  private evictEntries(): void {
    // 简单策略：按缓存类型依次淘汰
    for (const cacheType of Object.values(CacheType)) {
      this.evictEntry(cacheType);
      
      // 检查是否已释放足够内存
      if (this.config.memoryLimit && this.stats.currentSize <= this.config.memoryLimit * 0.8) {
        break;
      }
    }
  }

  /**
   * 智能缓存键生成
   */
  generateCacheKey(
    inputs: {
      queryResults?: any[];
      queryType?: string;
      language?: string;
      context?: any;
      [key: string]: any;
    }
  ): string {
    // 创建基础键
    const parts: string[] = [];
    
    if (inputs.language) {
      parts.push(`lang:${inputs.language}`);
    }
    
    if (inputs.queryType) {
      parts.push(`type:${inputs.queryType}`);
    }
    
    // 为查询结果生成哈希
    if (inputs.queryResults) {
      const contentHash = this.hashResults(inputs.queryResults);
      parts.push(`content:${contentHash}`);
    }
    
    // 添加上下文信息
    if (inputs.context) {
      const contextHash = this.hashObject(inputs.context);
      parts.push(`context:${contextHash}`);
    }
    
    // 添加其他键值对
    for (const [key, value] of Object.entries(inputs)) {
      if (!['queryResults', 'queryType', 'language', 'context'].includes(key)) {
        parts.push(`${key}:${this.hashValue(value)}`);
      }
    }
    
    return parts.join('|');
  }

  /**
   * 为查询结果生成哈希
   */
  private hashResults(queryResults: any[]): string {
    const content = queryResults
      .map(r => r?.captures?.[0]?.node?.text || JSON.stringify(r))
      .join('|');
    return this.simpleHash(content);
  }

  /**
   * 为对象生成哈希
   */
  private hashObject(obj: any): string {
    const content = JSON.stringify(obj, Object.keys(obj).sort());
    return this.simpleHash(content);
  }

  /**
   * 为值生成哈希
   */
  private hashValue(value: any): string {
    if (typeof value === 'object' && value !== null) {
      return this.hashObject(value);
    }
    return this.simpleHash(String(value));
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash >>> 0; // 转为无符号32位整数
    }
    return hash.toString(36);
  }

  /**
   * 计算值的大小
   */
  private calculateSize(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }
    
    if (typeof value === 'string') {
      return value.length * 2; // JavaScript中字符串每个字符占2字节
    }
    
    if (typeof value === 'number') {
      return 8; // JavaScript中数字占8字节
    }
    
    if (typeof value === 'boolean') {
      return 4; // 布尔值占4字节
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch (error) {
        // 如果无法序列化，返回估计值
        return 1024;
      }
    }
    
    return 0;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存信息
   */
  getCacheInfo(cacheType: CacheType): {
    size: number;
    maxSize: number;
    count: number;
    hitRate: number;
  } {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      return {
        size: 0,
        maxSize: 0,
        count: 0,
        hitRate: 0
      };
    }

    const stats = this.stats.byType[cacheType];
    const totalAccesses = stats.hits + stats.misses;
    const hitRate = totalAccesses > 0 ? stats.hits / totalAccesses : 0;

    return {
      size: stats.size,
      maxSize: this.config.cacheSizes?.[cacheType] || this.config.defaultCacheSize!,
      count: stats.count,
      hitRate
    };
  }

  /**
   * 预热缓存
   */
  prewarmCache(
    filePath: string,
    data: any,
    cacheType: CacheType = CacheType.RESULT
  ): void {
    const key = this.generateCacheKey({
      filePath,
      prewarm: true
    });
    
    this.set(key, data, cacheType);
    this.logDebug(`Cache prewarmed for file: ${filePath}`, {
      cacheType,
      key
    });
  }

  /**
   * 使缓存失效
   */
  invalidateCache(filePath: string): void {
    // 简化实现：清空所有包含文件路径的缓存条目
    for (const [cacheType, cache] of this.caches) {
      const keysToDelete: string[] = [];
      
      for (const key of cache.keys()) {
        if (key.includes(filePath)) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        const entry = cache.get(key);
        if (entry) {
          this.stats.currentSize -= entry.size;
          this.stats.byType[cacheType].size -= entry.size;
          cache.delete(key);
        }
      }
      
      this.stats.byType[cacheType].count = cache.size;
    }
    
    this.logDebug(`Cache invalidated for file: ${filePath}`);
  }

  /**
   * 导出缓存状态
   */
  exportState(): Record<string, any> {
    const state: Record<string, any> = {
      config: this.config,
      stats: this.stats,
      caches: {}
    };

    for (const [cacheType, cache] of this.caches) {
      state.caches[cacheType] = Array.from(cache.entries()).map(([key, entry]) => ({
        key,
        value: entry.value,
        expiry: entry.expiry,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        createdAt: entry.createdAt
      }));
    }

    return state;
  }

  /**
   * 导入缓存状态
   */
  importState(state: Record<string, any>): void {
    // 恢复配置
    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }

    // 恢复统计
    if (state.stats) {
      this.stats = state.stats;
    }

    // 恢复缓存
    if (state.caches) {
      for (const [cacheType, entries] of Object.entries(state.caches)) {
        const cache = this.caches.get(cacheType as CacheType);
        if (cache) {
          cache.clear();
          
          for (const entryData of entries as any[]) {
            const entry: CacheEntry<any> = {
              value: entryData.value,
              accessCount: entryData.accessCount,
              lastAccessed: entryData.lastAccessed,
              createdAt: entryData.createdAt,
              size: this.calculateSize(entryData.value)
            };
            
            if (entryData.expiry) {
              entry.expiry = entryData.expiry;
            }
            
            cache.set(entryData.key, entry);
          }
        }
      }
    }

    this.logDebug('Cache state imported');
  }

  /**
   * 健康检查
   */
  healthCheck(): { isHealthy: boolean; issues: string[] } {
    const issues: string[] = [];

    // 检查配置
    if (this.config.defaultCacheSize! <= 0) {
      issues.push('Default cache size must be greater than 0');
    }

    if (this.config.defaultTTL! < 0) {
      issues.push('Default TTL cannot be negative');
    }

    // 检查内存使用
    if (this.config.memoryLimit && this.stats.currentSize > this.config.memoryLimit) {
      issues.push(`Current cache size (${this.stats.currentSize}) exceeds memory limit (${this.config.memoryLimit})`);
    }

    // 检查各缓存类型大小
    for (const [cacheType, cache] of this.caches) {
      const maxSize = this.config.cacheSizes?.[cacheType] || this.config.defaultCacheSize!;
      if (cache.size > maxSize) {
        issues.push(`Cache size for ${cacheType} (${cache.size}) exceeds maximum (${maxSize})`);
      }
    }

    return {
      isHealthy: issues.length === 0,
      issues
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.logDebug('Cache statistics reset');
  }

  /**
   * 记录调试信息
   */
  private logDebug(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[SmartCacheManager] ${message}`, data);
    }
  }

  /**
   * 记录错误信息
   */
  private logError(message: string, error?: Error): void {
    console.error(`[SmartCacheManager] ${message}`, error);
  }

  /**
   * 记录警告信息
   */
  private logWarning(message: string, data?: any): void {
    console.warn(`[SmartCacheManager] ${message}`, data);
  }
}

/**
 * 全局智能缓存管理器实例
 */
export const globalCacheManager = new SmartCacheManager();

/**
 * 便捷函数：获取缓存值
 */
export function getCache<T>(key: string, cacheType?: CacheType): T | undefined {
  return globalCacheManager.get(key, cacheType);
}

/**
 * 便捷函数：设置缓存值
 */
export function setCache<T>(key: string, value: T, cacheType?: CacheType, ttl?: number): void {
  globalCacheManager.set(key, value, cacheType, ttl);
}

/**
 * 便捷函数：删除缓存值
 */
export function deleteCache(key: string, cacheType?: CacheType): boolean {
  return globalCacheManager.delete(key, cacheType);
}