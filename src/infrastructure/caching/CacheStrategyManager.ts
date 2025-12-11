import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { CacheService } from './CacheService';
import { TYPES } from '../../types';

export interface CacheStrategy {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

export interface CacheKeyGenerator {
  forParser(content: string, language: string, filePath: string): string;
  forContext(projectPath: string, filePath: string, language: string): string;
  forVectorIndex(projectId: string, fileId: string): string;
  forGraphIndex(projectId: string, nodeId: string): string;
}

/**
 * 缓存策略管理器 - 集中管理不同模块的缓存策略
 */
@injectable()
export class CacheStrategyManager {
  private logger: LoggerService;
  private cacheService: CacheService;
  private cacheStrategies: Map<string, CacheStrategy> = new Map();
  private keyGenerator: CacheKeyGenerator;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheService) cacheService: CacheService
  ) {
    this.logger = logger;
    this.cacheService = cacheService;
    this.keyGenerator = new DefaultCacheKeyGenerator();
    this.initializeStrategies();
  }

  /**
   * 初始化缓存策略
   */
  private initializeStrategies(): void {
    this.cacheStrategies.set('parser', new ParserCacheStrategy(this.cacheService, this.keyGenerator));
    this.cacheStrategies.set('vector', new VectorCacheStrategy(this.cacheService, this.keyGenerator));
    this.cacheStrategies.set('graph', new GraphCacheStrategy(this.cacheService, this.keyGenerator));
    this.cacheStrategies.set('query', new QueryCacheStrategy(this.cacheService, this.keyGenerator));
    this.cacheStrategies.set('default', new DefaultCacheStrategy(this.cacheService, this.keyGenerator));
  }

  /**
   * 获取缓存策略
   */
  getStrategy(module: string): CacheStrategy {
    const strategy = this.cacheStrategies.get(module);
    if (!strategy) {
      this.logger.warn(`Cache strategy not found for module: ${module}, using default`);
      return this.cacheStrategies.get('default')!;
    }
    return strategy;
  }

  /**
   * 统一的缓存获取
   */
  async get<T>(key: string): Promise<T | null> {
    const strategy = this.determineStrategy(key);
    return strategy.get<T>(key);
  }

  /**
   * 统一的缓存设置
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const strategy = this.determineStrategy(key);
    await strategy.set(key, value, ttl);
  }

  /**
   * 批量失效
   */
  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    
    for (const [module, strategy] of this.cacheStrategies) {
      try {
        await strategy.invalidate(pattern);
      } catch (error) {
        this.logger.warn(`Failed to invalidate cache for module ${module}:`, error);
      }
    }
  }

  /**
   * 跨模块缓存协调
   */
  async coordinateWithOtherModules(
    key: string, 
    operation: 'set' | 'delete' | 'invalidate',
    modules: string[]
  ): Promise<void> {
    for (const module of modules) {
      try {
        const strategy = this.getStrategy(module);
        
        switch (operation) {
          case 'set':
            // 对于set操作，我们需要获取值，这里简化处理
            break;
          case 'delete':
            await strategy.invalidate(key);
            break;
          case 'invalidate':
            await strategy.invalidate(key);
            break;
        }
      } catch (error) {
        this.logger.warn(`Failed to coordinate cache operation for module ${module}:`, error);
      }
    }
  }

  /**
   * 智能预加载
   */
  async preloadRelatedData(key: string): Promise<void> {
    // 基于访问模式预加载相关数据
    const relatedKeys = this.getRelatedKeys(key);
    
    for (const relatedKey of relatedKeys) {
      if (!this.cacheService.hasKey(relatedKey)) {
        // 这里可以触发异步预加载逻辑
        // 目前作为占位符
        this.logger.debug(`Preloading related data for key: ${relatedKey}`);
      }
    }
  }

  /**
   * 确定缓存策略
   */
  private determineStrategy(key: string): CacheStrategy {
    if (key.startsWith('parser:')) {
      return this.cacheStrategies.get('parser')!;
    } else if (key.startsWith('vector:')) {
      return this.cacheStrategies.get('vector')!;
    } else if (key.startsWith('graph:')) {
      return this.cacheStrategies.get('graph')!;
    } else if (key.startsWith('query:')) {
      return this.cacheStrategies.get('query')!;
    }
    
    return this.cacheStrategies.get('default')!;
  }

  /**
   * 获取相关键
   */
  private getRelatedKeys(key: string): string[] {
    const relatedKeys: string[] = [];
    
    if (key.startsWith('parser:')) {
      // Parser相关的键可能需要上下文数据
      const contextKey = key.replace('parser:', 'context:');
      relatedKeys.push(contextKey);
    } else if (key.startsWith('context:')) {
      // 上下文相关的键可能需要Parser结果
      const parserKey = key.replace('context:', 'parser:');
      relatedKeys.push(parserKey);
    }
    
    return relatedKeys;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    totalEntries: number;
    moduleStats: Map<string, { entries: number; hitRate: number }>;
  } {
    const stats = this.cacheService.getCacheStats();
    const moduleStats = new Map();
    
    // Parser统计
    const parserStats = this.cacheService.getParserCacheStats();
    moduleStats.set('parser', {
      entries: parserStats.parserEntries,
      hitRate: parserStats.hitRate
    });
    
    // 其他模块统计可以在这里添加
    
    return {
      totalEntries: stats.totalEntries,
      moduleStats
    };
  }
}

/**
 * 默认缓存键生成器
 */
class DefaultCacheKeyGenerator implements CacheKeyGenerator {
  forParser(content: string, language: string, filePath: string): string {
    const contentHash = this.hashContent(content);
    return `parser:${language}:${filePath}:${contentHash}`;
  }

  forContext(projectPath: string, filePath: string, language: string): string {
    return `context:${projectPath}:${filePath}:${language}`;
  }

  forVectorIndex(projectId: string, fileId: string): string {
    return `vector:${projectId}:${fileId}`;
  }

  forGraphIndex(projectId: string, nodeId: string): string {
    return `graph:${projectId}:${nodeId}`;
  }

  private hashContent(content: string): string {
    // 简单的哈希实现，实际项目中可以使用更复杂的哈希算法
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Parser缓存策略
 */
class ParserCacheStrategy implements CacheStrategy {
  constructor(
    private cacheService: CacheService,
    private keyGenerator: CacheKeyGenerator
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return this.cacheService.getParserResult<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheService.setParserResult(key, value, ttl);
  }

  async invalidate(pattern: string): Promise<void> {
    await this.cacheService.invalidateModuleCache('parser');
  }
}

/**
 * 向量缓存策略
 */
class VectorCacheStrategy implements CacheStrategy {
  constructor(
    private cacheService: CacheService,
    private keyGenerator: CacheKeyGenerator
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const cacheKey = `vector:${key}`;
    const result = this.cacheService.getFromCache<T>(cacheKey);
    return result || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const cacheKey = `vector:${key}`;
    const effectiveTTL = ttl || 300000; // 5分钟
    this.cacheService.setCache(cacheKey, value, effectiveTTL);
  }

  async invalidate(pattern: string): Promise<void> {
    await this.cacheService.invalidateModuleCache('vector');
  }
}

/**
 * 图缓存策略
 */
class GraphCacheStrategy implements CacheStrategy {
  constructor(
    private cacheService: CacheService,
    private keyGenerator: CacheKeyGenerator
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const cacheKey = `graph:${key}`;
    const result = this.cacheService.getFromCache<T>(cacheKey);
    return result || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const cacheKey = `graph:${key}`;
    const effectiveTTL = ttl || 600000; // 10分钟
    this.cacheService.setCache(cacheKey, value, effectiveTTL);
  }

  async invalidate(pattern: string): Promise<void> {
    await this.cacheService.invalidateModuleCache('graph');
  }
}

/**
 * 默认缓存策略
 */
class DefaultCacheStrategy implements CacheStrategy {
  constructor(
    private cacheService: CacheService,
    private keyGenerator: CacheKeyGenerator
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const result = this.cacheService.getFromCache<T>(key);
    return result || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || 300000;
    this.cacheService.setCache(key, value, effectiveTTL);
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keys = this.cacheService.getKeysByPattern(regex);
    
    for (const key of keys) {
      this.cacheService.deleteFromCache(key);
    }
  }
}

/**
 * 查询缓存策略
 */
class QueryCacheStrategy implements CacheStrategy {
  constructor(
    private cacheService: CacheService,
    private keyGenerator: CacheKeyGenerator
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return this.cacheService.getFromCache<T>(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || 300000; // 5分钟默认TTL
    this.cacheService.setCache(key, value, effectiveTTL);
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keys = this.cacheService.getKeysByPattern(regex);
    
    for (const key of keys) {
      this.cacheService.deleteFromCache(key);
    }
  }
}