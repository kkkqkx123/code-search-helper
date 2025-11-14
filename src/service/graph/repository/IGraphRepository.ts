/**
 * 图数据仓库接口
 * 职责: 提供数据访问抽象层，隔离服务层和数据库层
 */

export interface GraphNodeData {
  id: string;
  label: string;
  properties: Record<string, any>;
}

export interface GraphRelationshipData {
  id?: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties?: Record<string, any>;
}

export interface GraphQueryOptions {
  limit?: number;
  offset?: number;
  timeout?: number;
  useCache?: boolean;
}

export interface GraphTraversalOptions {
  maxDepth?: number;
  edgeTypes?: string[];
  direction?: 'incoming' | 'outgoing' | 'both';
  filterConditions?: string[];
}

export interface IGraphRepository {
  // === 节点操作 ===
  /**
   * 创建单个节点
   */
  createNode(node: GraphNodeData): Promise<string>;

  /**
   * 批量创建节点
   */
  createNodes(nodes: GraphNodeData[]): Promise<string[]>;

  /**
   * 根据ID获取节点
   */
  getNodeById(nodeId: string): Promise<GraphNodeData | null>;

  /**
   * 根据标签查询节点
   */
  findNodesByLabel(label: string, properties?: Record<string, any>, options?: GraphQueryOptions): Promise<GraphNodeData[]>;

  /**
   * 更新节点
   */
  updateNode(nodeId: string, properties: Record<string, any>): Promise<boolean>;

  /**
   * 删除节点
   */
  deleteNode(nodeId: string): Promise<boolean>;

  // === 关系操作 ===
  /**
   * 创建单个关系
   */
  createRelationship(relationship: GraphRelationshipData): Promise<void>;

  /**
   * 批量创建关系
   */
  createRelationships(relationships: GraphRelationshipData[]): Promise<void>;

  /**
   * 根据类型查询关系
   */
  findRelationshipsByType(type: string, properties?: Record<string, any>, options?: GraphQueryOptions): Promise<GraphRelationshipData[]>;

  /**
   * 更新关系
   */
  updateRelationship(relationshipId: string, properties: Record<string, any>): Promise<boolean>;

  /**
   * 删除关系
   */
  deleteRelationship(relationshipId: string): Promise<boolean>;

  // === 图遍历操作 ===
  /**
   * 查找相关节点
   */
  findRelatedNodes(nodeId: string, options?: GraphTraversalOptions): Promise<GraphNodeData[]>;

  /**
   * 查找两节点间的路径
   */
  findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<GraphNodeData[][]>;

  /**
   * 查找最短路径
   */
  findShortestPath(sourceId: string, targetId: string, edgeTypes?: string[], maxDepth?: number): Promise<GraphNodeData[]>;

  /**
   * 复杂图遍历
   */
  executeTraversal(startId: string, options: GraphTraversalOptions): Promise<GraphNodeData[]>;

  // === 统计操作 ===
  /**
   * 获取节点数量
   */
  getNodeCount(label?: string): Promise<number>;

  /**
   * 获取关系数量
   */
  getRelationshipCount(type?: string): Promise<number>;

  /**
   * 获取图统计信息
   */
  getGraphStats(): Promise<{ nodeCount: number; relationshipCount: number }>;

  // === 查询操作 ===
  /**
   * 执行原生查询
   */
  executeQuery(query: string, params?: Record<string, any>): Promise<any>;

  /**
   * 批量执行查询
   */
  executeBatchQuery(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<any[]>;
}