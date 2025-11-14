import {
  Vector,
  SearchOptions,
  SearchResult,
  VectorFilter,
  VectorStats,
  IndexOptions
} from '../types/VectorTypes';

/**
 * 向量仓库接口
 * 提供数据访问抽象层
 */
export interface IVectorRepository {
  // === 基础CRUD操作 ===

  /**
   * 创建单个向量
   */
  create(vector: Vector): Promise<string>;

  /**
   * 批量创建向量
   */
  createBatch(vectors: Vector[]): Promise<string[]>;

  /**
   * 根据ID查找向量
   */
  findById(id: string): Promise<Vector | null>;

  /**
   * 根据ID数组查找向量
   */
  findByIds(ids: string[]): Promise<Vector[]>;

  /**
   * 更新向量
   */
  update(id: string, vector: Partial<Vector>): Promise<boolean>;

  /**
   * 删除向量
   */
  delete(id: string): Promise<boolean>;

  /**
   * 批量删除向量
   */
  deleteBatch(ids: string[]): Promise<boolean>;

  // === 搜索操作 ===

  /**
   * 按向量搜索
   */
  searchByVector(query: number[], options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * 按条件过滤搜索
   */
  searchByFilter(filter: VectorFilter, options?: SearchOptions): Promise<Vector[]>;

  // === 聚合操作 ===

  /**
   * 统计向量数量
   */
  count(filter?: VectorFilter): Promise<number>;

  /**
   * 获取统计信息
   */
  getStats(projectId?: string): Promise<VectorStats>;

  // === 索引管理 ===

  /**
   * 创建索引
   */
  createIndex(projectId: string, options?: IndexOptions): Promise<boolean>;

  /**
   * 删除索引
   */
  deleteIndex(projectId: string): Promise<boolean>;

  /**
   * 检查索引是否存在
   */
  indexExists(projectId: string): Promise<boolean>;
}