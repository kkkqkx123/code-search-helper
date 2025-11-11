import { IndexSyncOptions } from './IndexService';

/**
 * 统一的索引服务接口
 * 支持向量索引和图索引的统一操作
 */
export interface IIndexService {
  /**
   * 开始索引项目
   * @param projectPath 项目路径
   * @param options 索引选项
   * @returns 项目ID
   */
  startIndexing(projectPath: string, options?: IndexSyncOptions): Promise<string>;
  
  /**
   * 停止索引项目
   * @param projectId 项目ID
   * @returns 是否成功停止
   */
  stopIndexing(projectId: string): Promise<boolean>;
  
  /**
   * 获取索引状态
   * @param projectId 项目ID
   * @returns 索引状态
   */
  getIndexStatus(projectId: string): any;
  
  /**
   * 重新索引项目
   * @param projectPath 项目路径
   * @param options 索引选项
   * @returns 项目ID
   */
  reindexProject(projectPath: string, options?: IndexSyncOptions): Promise<string>;
}

/**
 * 索引服务类型枚举
 */
export enum IndexServiceType {
  VECTOR = 'vector',
  GRAPH = 'graph'
}

/**
 * 索引状态接口
 */
export interface IndexStatus {
  projectId: string;
  projectPath: string;
  isIndexing: boolean;
  lastIndexed: Date | null;
  totalFiles: number;
  indexedFiles: number;
  failedFiles: number;
  progress: number;
  serviceType: IndexServiceType;
  error?: string;
}

/**
 * 索引选项接口
 */
export interface IndexOptions extends IndexSyncOptions {
  serviceType?: IndexServiceType;
  enableVectorIndex?: boolean;
  enableGraphIndex?: boolean;
}