/**
 * 缓存管理工具类
 * 用于处理图搜索服务的缓存逻辑
 */

import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import { ConfigService } from '../../../config/ConfigService';
import { LoggerService } from '../../../utils/LoggerService';
import { GraphSearchResult } from '../core/types';
import { CACHE_CONSTANTS } from '../constants/GraphSearchConstants';

export class CacheManager {
  constructor(
    private cacheService: ICacheService,
    private performanceMonitor: IPerformanceMonitor,
    private configService: ConfigService,
    private logger: LoggerService
  ) {}

  /**
   * 生成缓存键
   */
  generateCacheKey(type: string, identifier: string, options: any = {}): string {
    const { KEY_PREFIXES } = CACHE_CONSTANTS;
    const prefix = KEY_PREFIXES[type.toUpperCase() as keyof typeof KEY_PREFIXES] || KEY_PREFIXES.GRAPH_SEARCH;
    return `${prefix}_${identifier}_${JSON.stringify(options)}`;
  }

  /**
   * 尝试从缓存获取结果
   */
  getCachedResult<T>(cacheKey: string): T | null {
    const cachedResult = this.cacheService.getFromCache<T>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      this.logger.debug('从缓存中检索到结果', { cacheKey });
      return cachedResult;
    }
    return null;
  }

  /**
   * 缓存结果
   */
  cacheResult(cacheKey: string, result: any): void {
    const cacheTTL = this.configService.get('caching').defaultTTL || CACHE_CONSTANTS.DEFAULT_TTL;
    this.cacheService.setCache(cacheKey, result, cacheTTL);
    this.performanceMonitor.updateCacheHitRate(false);
  }

  /**
   * 执行带缓存的搜索操作
   */
  async executeWithCache<T>(
    cacheKey: string,
    searchOperation: () => Promise<T>,
    formatResult?: (result: any) => T
  ): Promise<T> {
    // 首先尝试从缓存中获取结果
    const cachedResult = this.getCachedResult<T>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // 执行搜索操作
    const result = await searchOperation();
    
    // 格式化结果（如果提供了格式化函数）
    const formattedResult = formatResult ? formatResult(result) : result;
    
    // 缓存结果
    this.cacheResult(cacheKey, formattedResult);
    
    return formattedResult;
  }

  /**
   * 生成搜索缓存键
   */
  generateSearchCacheKey(query: string, options: any): string {
    return this.generateCacheKey('GRAPH_SEARCH', query, options);
  }

  /**
   * 生成节点类型搜索缓存键
   */
  generateNodeTypeCacheKey(nodeType: string, options: any): string {
    return this.generateCacheKey('NODE_TYPE', nodeType, options);
  }

  /**
   * 生成关系类型搜索缓存键
   */
  generateRelationshipTypeCacheKey(relationshipType: string, options: any): string {
    return this.generateCacheKey('RELATIONSHIP_TYPE', relationshipType, options);
  }

  /**
   * 生成路径搜索缓存键
   */
  generatePathCacheKey(sourceId: string, targetId: string, options: any): string {
    const identifier = `${sourceId}_${targetId}`;
    return this.generateCacheKey('PATH', identifier, options);
  }

  /**
   * 创建标准化的搜索结果
   */
  createSearchResult(
    nodes: any[] = [],
    relationships: any[] = [],
    executionTime: number,
    includeNodes: boolean = true,
    includeRelationships: boolean = true
  ): GraphSearchResult {
    return {
      nodes: includeNodes ? nodes : [],
      relationships: includeRelationships ? relationships : [],
      total: (includeNodes ? nodes.length : 0) + (includeRelationships ? relationships.length : 0),
      executionTime
    };
  }

  /**
   * 创建空结果
   */
  createEmptyResult(executionTime: number): GraphSearchResult {
    return {
      nodes: [],
      relationships: [],
      total: 0,
      executionTime
    };
  }
}