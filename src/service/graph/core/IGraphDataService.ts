import {
  CodeGraphNode,
  CodeGraphRelationship,
  GraphPersistenceOptions,
  GraphPersistenceResult
} from './types';

/**
 * 图数据服务接口
 * 专注于数据存储、查询、节点和关系的数据操作
 */
export interface IGraphDataService {
  /**
   * 查找相关节点
   * @param nodeId 节点ID
   * @param relationshipTypes 关系类型
   * @param maxDepth 最大深度
   * @returns 相关节点列表
   */
  findRelatedNodes(
    nodeId: string,
    relationshipTypes?: string[],
    maxDepth?: number
  ): Promise<CodeGraphNode[]>;

  /**
   * 查找路径
   * @param sourceId 源节点ID
   * @param targetId 目标节点ID
   * @param maxDepth 最大深度
   * @returns 路径上的关系列表
   */
  findPath(
    sourceId: string,
    targetId: string,
    maxDepth?: number
  ): Promise<CodeGraphRelationship[]>;

  /**
   * 存储解析的文件
   * @param files 文件列表
   * @param options 存储选项
   * @returns 存储结果
   */
  storeParsedFiles(
    files: any[],
    options?: GraphPersistenceOptions
  ): Promise<GraphPersistenceResult>;

  /**
   * 存储代码块
   * @param chunks 代码块列表
   * @param options 存储选项
   * @returns 存储结果
   */
  storeChunks(
    chunks: any[],
    options?: GraphPersistenceOptions
  ): Promise<GraphPersistenceResult>;

  /**
   * 删除节点
   * @param nodeIds 节点ID列表
   * @returns 删除是否成功
   */
  deleteNodes(nodeIds: string[]): Promise<boolean>;

  /**
   * 清空图数据
   * @returns 清空是否成功
   */
  clearGraph(): Promise<boolean>;

  /**
   * 服务是否已初始化
   * @returns 初始化状态
   */
  isServiceInitialized(): boolean;

  /**
   * 关闭服务
   * @returns Promise
   */
  close(): Promise<void>;
}