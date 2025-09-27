import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../core/LoggerService';
import { ConfigService } from '../../../config/ConfigService';
import { CacheManager } from '../../cache/CacheManager';
import { CacheInterface } from '../../cache/CacheInterface';

export interface GraphCacheConfig {
  maxCacheSize: number;
  defaultCacheTTL: number;
  cleanupInterval: number;
}

@injectable()
export class GraphCacheService {
  private queryCache!: CacheInterface;
  private nodeExistenceCache!: CacheInterface;
  private graphStatsCache!: CacheInterface;

  constructor(
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.CacheManager) private cacheManager: CacheManager
  ) {}

  private async getQueryCache(): Promise<CacheInterface> {
    if (!this.queryCache) {
      this.queryCache = await this.cacheManager.getCache('graph-query');
    }
    return this.queryCache;
  }

  private async getNodeExistenceCache(): Promise<CacheInterface> {
    if (!this.nodeExistenceCache) {
      this.nodeExistenceCache = await this.cacheManager.getCache('graph-node-existence');
    }
    return this.nodeExistenceCache;
  }

  private async getGraphStatsCacheInstance(): Promise<CacheInterface> {
    if (!this.graphStatsCache) {
      this.graphStatsCache = await this.cacheManager.getCache('graph-stats');
    }
    return this.graphStatsCache;
  }

  async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cache = await this.getQueryCache();
      return await cache.get<T>(key);
    } catch (error) {
      this.logger.error('Error getting from graph query cache', { error, key });
      return null;
    }
  }

  async setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const cache = await this.getQueryCache();
      const config = this.configService.get('redis') || { ttl: { graph: 300 } };
      const defaultTTL = ttl || config.ttl?.graph || 300; // 默认5分钟

      await cache.set(key, data, { ttl: defaultTTL });
    } catch (error) {
      this.logger.error('Error setting graph query cache', { error, key });
    }
  }

  async hasNodeInCache(nodeId: string): Promise<boolean> {
    try {
      const cache = await this.getNodeExistenceCache();
      const result = await cache.get<boolean>(nodeId);
      return result !== null;
    } catch (error) {
      this.logger.error('Error checking node existence cache', { error, nodeId });
      return false;
    }
  }

  async cacheNodeExistence(nodeId: string, exists: boolean, ttl?: number): Promise<void> {
    try {
      const cache = await this.getNodeExistenceCache();
      const config = this.configService.get('redis') || { ttl: { graph: 300 } };
      const defaultTTL = ttl || config.ttl?.graph || 300; // 默认5分钟

      await cache.set(nodeId, exists, { ttl: defaultTTL });
    } catch (error) {
      this.logger.error('Error caching node existence', { error, nodeId });
    }
  }

  async getGraphStatsCache(): Promise<any> {
    try {
      const cache = await this.getGraphStatsCacheInstance();
      return await cache.get('graph-stats');
    } catch (error) {
      this.logger.error('Error getting graph stats cache', { error });
      return null;
    }
  }

  async setGraphStatsCache(stats: any, ttl?: number): Promise<void> {
    try {
      const cache = await this.getGraphStatsCacheInstance();
      const config = this.configService.get('redis') || { ttl: { graph: 300 } };
      const defaultTTL = ttl || config.ttl?.graph || 300; // 默认5分钟

      await cache.set('graph-stats', stats, { ttl: defaultTTL });
    } catch (error) {
      this.logger.error('Error setting graph stats cache', { error });
    }
  }

  async getCacheStats(): Promise<{
    queryCacheSize: number;
    nodeExistenceCacheSize: number;
    graphStatsCache: boolean;
    totalEntries: number;
  }> {
    try {
      const queryCache = await this.getQueryCache();
      const nodeExistenceCache = await this.getNodeExistenceCache();
      const graphStatsCache = await this.getGraphStatsCache();

      const [queryStats, nodeStats, statsStats] = await Promise.all([
        queryCache.getStats(),
        nodeExistenceCache.getStats(),
        graphStatsCache.getStats(),
      ]);

      return {
        queryCacheSize: queryStats.size,
        nodeExistenceCacheSize: nodeStats.size,
        graphStatsCache: (await graphStatsCache.get('graph-stats')) !== null,
        totalEntries: queryStats.size + nodeStats.size,
      };
    } catch (error) {
      this.logger.error('Error getting graph cache stats', { error });
      return {
        queryCacheSize: 0,
        nodeExistenceCacheSize: 0,
        graphStatsCache: false,
        totalEntries: 0,
      };
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const queryCache = await this.getQueryCache();
      const nodeExistenceCache = await this.getNodeExistenceCache();
      const graphStatsCache = await this.getGraphStatsCache();

      await Promise.all([queryCache.clear(), nodeExistenceCache.clear(), graphStatsCache.clear()]);

      this.logger.info('All graph caches cleared');
    } catch (error) {
      this.logger.error('Error clearing graph caches', { error });
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Graph cache service stopped');
  }
}
