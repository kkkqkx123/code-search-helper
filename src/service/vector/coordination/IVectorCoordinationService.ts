import {
  Vector,
  VectorOptions,
  SearchOptions,
  SearchResult,
  VectorOperation,
  BatchResult,
  EmbeddingOptions,
  BatchOptions
} from '../types/VectorTypes';

/**
 * 向量协调服务接口
 * 负责协调复杂的向量操作流程
 */
export interface IVectorCoordinationService {
  /**
   * 协调向量创建流程
   */
  coordinateVectorCreation(contents: string[], options?: VectorOptions): Promise<Vector[]>;

  /**
   * 协调向量搜索流程
   */
  coordinateVectorSearch(query: number[] | string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * 协调批量操作
   */
  coordinateBatchOperations(operations: VectorOperation[]): Promise<BatchResult>;

  /**
   * 处理嵌入生成
   */
  handleEmbeddingGeneration(contents: string[], options?: EmbeddingOptions): Promise<number[][]>;

  /**
   * 优化批处理
   */
  optimizeBatchProcessing<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: BatchOptions
  ): Promise<R[]>;
}