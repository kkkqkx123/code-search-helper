/**
 * 关系仓库接口
 * 职责: 专门处理关系相关的数据访问操作
 */

import { GraphRelationshipData, GraphQueryOptions } from './IGraphRepository';

export interface IRelationshipRepository {
  /**
   * 创建关系
   */
  create(relationship: GraphRelationshipData): Promise<void>;

  /**
   * 批量创建关系
   */
  createBatch(relationships: GraphRelationshipData[]): Promise<void>;

  /**
   * 根据类型查询关系
   */
  findByType(type: string, properties?: Record<string, any>, options?: GraphQueryOptions): Promise<GraphRelationshipData[]>;

  /**
   * 查询节点的所有关系
   */
  findByNode(nodeId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<GraphRelationshipData[]>;

  /**
   * 更新关系
   */
  update(relationshipId: string, properties: Record<string, any>): Promise<boolean>;

  /**
   * 删除关系
   */
  delete(relationshipId: string): Promise<boolean>;

  /**
   * 获取关系数量
   */
  count(type?: string): Promise<number>;
}