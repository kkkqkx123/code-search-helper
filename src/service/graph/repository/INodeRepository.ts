/**
 * 节点仓库接口
 * 职责: 专门处理节点相关的数据访问操作
 */

import { GraphNodeData, GraphQueryOptions } from './IGraphRepository';

export interface INodeRepository {
  /**
   * 创建节点
   */
  create(node: GraphNodeData): Promise<string>;

  /**
   * 批量创建节点
   */
  createBatch(nodes: GraphNodeData[]): Promise<string[]>;

  /**
   * 根据ID获取节点
   */
  findById(nodeId: string): Promise<GraphNodeData | null>;

  /**
   * 根据标签查询节点
   */
  findByLabel(label: string, properties?: Record<string, any>, options?: GraphQueryOptions): Promise<GraphNodeData[]>;

  /**
   * 更新节点
   */
  update(nodeId: string, properties: Record<string, any>): Promise<boolean>;

  /**
   * 删除节点
   */
  delete(nodeId: string): Promise<boolean>;

  /**
   * 检查节点是否存在
   */
  exists(nodeId: string): Promise<boolean>;

  /**
   * 获取节点数量
   */
  count(label?: string): Promise<number>;
}