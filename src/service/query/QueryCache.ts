import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { CacheManager } from '../cache/CacheManager';
import { CacheInterface } from '../cache/CacheInterface';

export interface QueryRequest {
  query: string;
  projectId: string;
  options?: {
    limit?: number;
    threshold?: number;
    includeGraph?: boolean;
    filters?: {
      language?: string[];
      fileType?: string[];
      path?: string[];
    };
    searchType?: 'semantic' | 'hybrid' | 'graph';
  };
}

export interface QueryResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
}

interface QueryCacheEntry {
  results: QueryResult[];
  timestamp: number;
  metadata: {
    query: string;
    projectId: string;
    options: any;
    resultCount: number;
  };
}

@injectable()
export class QueryCache {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private cacheManager: CacheManager;
  private cache!: CacheInterface;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.CacheManager) cacheManager: CacheManager
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.cacheManager = cacheManager;
  }

  private async getCache(): Promise<CacheInterface> {
    if (!this.cache) {
      this.cache = await this.cacheManager.getSearchCache();
    }
    return this.cache;
  }

  async get(request: QueryRequest): Promise<QueryResult[] | null> {
    try {
      const cache = await this.getCache();
      const key = this.generateCacheKey(request);

      const entry = await cache.get<QueryCacheEntry>(key);
      if (!entry) {
        return null;
      }

      this.logger.debug('Cache hit', {
        key,
        resultCount: entry.results.length,
      });

      return entry.results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get from cache: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCache', operation: 'get' }
      );
      return null;
    }
  }

  async set(request: QueryRequest, results: QueryResult[]): Promise<void> {
    try {
      const cache = await this.getCache();
      const key = this.generateCacheKey(request);
      const config = this.configService.get('redis') || {};
      const redisConfig = config as any;

      const ttl = redisConfig.ttl?.search || 3600; // 使用Redis配置的TTL

      const entry: QueryCacheEntry = {
        results,
        timestamp: Date.now(),
        metadata: {
          query: request.query,
          projectId: request.projectId,
          options: request.options,
          resultCount: results.length,
        },
      };

      await cache.set(key, entry, { ttl });

      this.logger.debug('Cache entry created', {
        key,
        ttl,
        resultCount: results.length,
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to set cache: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QueryCache', operation: 'set' }
      );
    }
  }

  async invalidate(request?: QueryRequest | string): Promise<void> {
    try {
      const cache = await this.getCache();

      if (typeof request === 'string') {
        // 使用Redis通配符模式删除
        const keys = await this.findKeysByPattern(request);
        await Promise.all(keys.map(key => cache.del(key)));
        this.logger.debug('Cache invalidated with pattern', {
          pattern: request,
          keysRemoved: keys.length,
        });
      } else if (request) {
        const key = this.generateCacheKey(request);
        await cache.del(key);
        this.logger.debug('Cache entry invalidated', { key });
      } else {
        await cache.clear();
        this.logger.debug('Cache cleared');
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to invalidate cache: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCache', operation: 'invalidate' }
      );
    }
  }

  async invalidateByProject(projectId: string): Promise<void> {
    try {
      const pattern = `*"projectId":"${projectId}"*`;
      const keys = await this.findKeysByPattern(pattern);

      const cache = await this.getCache();
      await Promise.all(keys.map(key => cache.del(key)));

      this.logger.info('Cache entries invalidated by project', {
        projectId,
        keysRemoved: keys.length,
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to invalidate cache by project: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCache', operation: 'invalidateByProject' }
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const cache = await this.getCache();
      await cache.clear();

      this.logger.info('Cache cleared');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCache', operation: 'clear' }
      );
    }
  }

  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    avgEntrySize: number;
  }> {
    try {
      const cache = await this.getCache();
      const stats = await cache.getStats();

      return {
        totalEntries: stats.size,
        totalSize: stats.memoryUsage || 0,
        hitRate: stats.hitRate || 0,
        avgEntrySize: stats.size > 0 ? (stats.memoryUsage || 0) / stats.size : 0,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get cache stats: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCache', operation: 'getStats' }
      );
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        avgEntrySize: 0,
      };
    }
  }

  async preloadCache(queries: QueryRequest[], results: QueryResult[][]): Promise<void> {
    this.logger.info('Preloading cache', { queryCount: queries.length });

    for (let i = 0; i < queries.length; i++) {
      try {
        await this.set(queries[i], results[i]);
      } catch (error) {
        this.logger.warn('Failed to preload cache entry', {
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('Cache preloading completed', {
      successCount: queries.length,
    });
  }

  private generateCacheKey(request: QueryRequest): string {
    const keyData = {
      query: request.query.trim().toLowerCase(),
      projectId: request.projectId,
      options: request.options,
    };

    return `query:${JSON.stringify(keyData)}`;
  }

  private async findKeysByPattern(pattern: string): Promise<string[]> {
    try {
      const cache = await this.getCache();

      // 这是一个简化实现，实际应该通过Redis的KEYS命令或SCAN命令
      // 这里我们使用getStats来获取所有键，然后过滤
      // 注意：对于生产环境，应该使用Redis的原生命令

      this.logger.warn('findKeysByPattern is a simplified implementation for Redis migration');
      return [];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to find keys by pattern: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCache', operation: 'findKeysByPattern' }
      );
      return [];
    }
  }

  dispose(): void {
    this.logger.info('QueryCache disposed');
  }

  async exportCache(): Promise<string> {
    try {
      const cache = await this.getCache();
      const stats = await this.getStats();

      const exportData = {
        exportTime: Date.now(),
        stats,
        version: '2.0.0',
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to export cache: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCache', operation: 'exportCache' }
      );
      return JSON.stringify({ error: 'Failed to export cache' });
    }
  }

  async importCache(data: string): Promise<void> {
    this.logger.warn('Cache import is deprecated in v2.0.0. Use Redis persistence instead.');
  }
}
