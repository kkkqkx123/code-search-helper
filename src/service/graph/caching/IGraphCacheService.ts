/**
 * 图缓存服务接口
 * 简化的图缓存服务接口定义
 */

import { GraphData, CacheOptions, CacheItem, CacheStats } from './types';

/**
 * 图缓存服务接口
 * 提供图数据的缓存功能
 */
export interface IGraphCacheService {
  /**
   * 缓存图数据
   * @param key 缓存键
   * @param data 图数据
   * @param options 缓存选项
   * @returns 是否成功
   */
  set(key: string, data: GraphData, options?: CacheOptions): Promise<boolean>;

  /**
   * 获取图数据
   * @param key 缓存键
   * @returns 图数据或null
   */
  get(key: string): Promise<GraphData | null>;

  /**
   * 删除缓存
   * @param key 缓存键
   * @returns 是否成功
   */
  delete(key: string): Promise<boolean>;

  /**
   * 批量缓存图数据
   * @param items 缓存项列表
   * @returns 成功缓存的数量
   */
  setBatch(items: CacheItem[]): Promise<number>;

  /**
   * 批量获取图数据
   * @param keys 缓存键列表
   * @returns 键值映射
   */
  getBatch(keys: string[]): Promise<Map<string, GraphData | null>>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;

  /**
   * 获取缓存大小
   * @returns 缓存条目数量
   */
  size(): number;

  /**
   * 获取所有缓存键
   * @returns 缓存键列表
   */
  keys(): string[];

  /**
   * 获取缓存统计信息
   * @returns 统计信息
   */
  getStats(): CacheStats;

  /**
   * 检查缓存是否健康
   * @returns 是否健康
   */
  isHealthy(): boolean;
}