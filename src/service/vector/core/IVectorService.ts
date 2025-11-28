import {
  Vector,
  VectorOptions,
  SearchOptions,
  SearchResult,
  VectorOperation,
  BatchResult,
  ProjectOptions,
  VectorStats,
  PerformanceMetrics,
  ServiceStatus,
  VectorPoint
} from '../types/VectorTypes';

/**
 * 向量服务核心接口
 * 提供统一的向量操作API
 */
export interface IVectorService {
  /**
   * 初始化服务
   */
  initialize(): Promise<boolean>;

  /**
   * 关闭服务
   */
  close(): Promise<void>;

  /**
   * 检查服务是否健康
   */
  isHealthy(): Promise<boolean>;

  /**
   * 获取服务状态
   */
  getStatus(): Promise<ServiceStatus>;

  // === 向量管理 ===

  /**
   * 创建向量
   */
  createVectors(content: string[], options?: VectorOptions): Promise<Vector[]>;

  /**
   * 删除向量
   */
  deleteVectors(vectorIds: string[]): Promise<boolean>;

  // === 向量搜索 ===

  /**
   * 搜索相似向量
   */
  searchSimilarVectors(query: number[], options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * 按内容搜索相似向量
   */
  searchByContent(content: string, options?: SearchOptions): Promise<SearchResult[]>;

  // === 批量操作 ===

  /**
   * 批量处理向量操作
   */
  batchProcess(operations: VectorOperation[]): Promise<BatchResult>;

  // === 项目管理 ===

  /**
   * 创建项目索引
   */
  createProjectIndex(projectId: string, options?: ProjectOptions): Promise<boolean>;

  /**
   * 删除项目索引
   */
  deleteProjectIndex(projectId: string): Promise<boolean>;

  // === 统计和监控 ===

  /**
   * 获取向量统计信息
   */
  getVectorStats(projectId?: string): Promise<VectorStats>;

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): Promise<PerformanceMetrics>;

  // === 文件处理 ===

  /**
   * 处理文件并生成向量点
   */
  processFileForEmbedding(filePath: string, projectPath: string): Promise<VectorPoint[]>;
}