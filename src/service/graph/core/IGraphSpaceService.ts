import {
  GraphPersistenceResult
} from './types';

/**
 * 图空间服务接口
 * 专注于图空间管理、批量操作和健康检查功能
 */
export interface IGraphSpaceService {
  /**
   * 创建空间
   * @param projectId 项目ID
   * @param config 空间配置
   * @returns 创建是否成功
   */
  createSpace(projectId: string, config?: any): Promise<boolean>;

  /**
   * 删除空间
   * @param projectId 项目ID
   * @returns 删除是否成功
   */
  dropSpace(projectId: string): Promise<boolean>;

  /**
   * 清空空间
   * @param projectId 项目ID
   * @returns 清空是否成功
   */
  clearSpace(projectId: string): Promise<boolean>;

  /**
   * 获取空间信息
   * @param projectId 项目ID
   * @returns 空间信息
   */
  getSpaceInfo(projectId: string): Promise<any>;

  /**
   * 批量插入节点
   * @param nodes 节点列表
   * @param projectId 项目ID
   * @returns 插入结果
   */
  batchInsertNodes(nodes: any[], projectId: string): Promise<GraphPersistenceResult>;

  /**
   * 批量插入边
   * @param edges 边列表
   * @param projectId 项目ID
   * @returns 插入结果
   */
  batchInsertEdges(edges: any[], projectId: string): Promise<GraphPersistenceResult>;

  /**
   * 批量删除节点
   * @param nodeIds 节点ID列表
   * @param projectId 项目ID
   * @returns 删除是否成功
   */
  batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean>;

  /**
   * 健康检查
   * @returns 是否健康
   */
  isHealthy(): Promise<boolean>;

  /**
   * 获取状态信息
   * @returns 状态信息
   */
  getStatus(): Promise<any>;
}