import { injectable, inject } from 'inversify';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { NebulaConnectionManager } from './nebula/NebulaConnectionManager';
import { NebulaQueryBuilder } from './nebula/NebulaQueryBuilder';
import { NebulaSpaceManager } from './nebula/NebulaSpaceManager';
import { NebulaGraphOperations } from './nebula/NebulaGraphOperations';
import { TYPES } from '../types';

/**
 * 社区发现算法选项
 */
export interface CommunityDetectionOptions {
  limit?: number;
  minCommunitySize?: number;
  maxIterations?: number;
}

/**
 * 社区发现结果
 */
export interface CommunityResult {
  communityId: string;
  members: string[];
  size: number;
}

/**
 * PageRank算法选项
 */
export interface PageRankOptions {
  limit?: number;
  iterations?: number;
  dampingFactor?: number;
}

/**
 * PageRank结果
 */
export interface PageRankResult {
  nodeId: string;
  score: number;
  rank: number;
}

/**
 * 最短路径选项
 */
export interface ShortestPathOptions {
  sourceId: string;
  targetId: string;
  maxDepth?: number;
  edgeTypes?: string[];
}

/**
 * 最短路径结果
 */
export interface ShortestPathResult {
  path: string[];
  distance: number;
  edges: Array<{ source: string; target: string; type: string }>;
}

@injectable()
export class NebulaService {
  private nebulaConnection: NebulaConnectionManager;
  private nebulaQueryBuilder: NebulaQueryBuilder;
  private nebulaSpaceManager: NebulaSpaceManager;
  private nebulaGraphOperations: NebulaGraphOperations;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.INebulaConnectionManager) nebulaConnection: NebulaConnectionManager,
    @inject(TYPES.INebulaQueryBuilder) nebulaQueryBuilder: NebulaQueryBuilder,
    @inject(TYPES.INebulaSpaceManager) nebulaSpaceManager: NebulaSpaceManager,
    @inject(TYPES.INebulaGraphOperations) nebulaGraphOperations: NebulaGraphOperations
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.nebulaConnection = nebulaConnection;
    this.nebulaQueryBuilder = nebulaQueryBuilder;
    this.nebulaSpaceManager = nebulaSpaceManager;
    this.nebulaGraphOperations = nebulaGraphOperations;
  }

  async initialize(): Promise<boolean> {
    try {
      const connected = await this.nebulaConnection.connect();
      if (connected) {
        this.logger.info('NebulaGraph service initialized successfully');
        return true;
      }
      throw new Error('Failed to connect to NebulaGraph');
    } catch (error) {
      // 更详细地处理错误对象，确保能正确提取错误信息
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // 如果error是一个对象，尝试提取有用的信息
        try {
          errorMessage = JSON.stringify(error);
        } catch (stringifyError) {
          // 如果JSON.stringify失败，使用toString方法
          errorMessage = Object.prototype.toString.call(error);
        }
      } else {
        errorMessage = String(error);
      }

      this.errorHandler.handleError(
        new Error(`Failed to initialize NebulaGraph service: ${errorMessage}`),
        { component: 'NebulaService', operation: 'initialize' }
      );
      throw new Error(`Failed to initialize NebulaGraph service: ${errorMessage}`);
    }
  }

  async executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return this.nebulaConnection.executeQuery(nGQL, parameters);
  }

  async executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return this.nebulaConnection.executeQuery(nGQL, parameters);
  }

  async useSpace(spaceName: string): Promise<void> {
    // 切换到指定的空间
    await this.nebulaConnection.executeQuery(`USE \`${spaceName}\``);
  }

  async getCurrentSpace(): Promise<string> {
    // 获取当前空间名称
    const result = await this.nebulaConnection.executeQuery('SHOW SPACES');
    // 这里需要根据实际返回结果解析当前空间
    // 由于NebulaGraph的特性，可能需要通过其他方式获取当前空间
    return '';
  }

  async executeTransaction(
    queries: Array<{ nGQL: string; parameters?: Record<string, any> }>
  ): Promise<any[]> {
    // 使用NebulaConnectionManager执行事务
    const formattedQueries = queries.map(q => ({
      query: q.nGQL,
      params: q.parameters,
    }));

    return this.nebulaConnection.executeTransaction(
      formattedQueries.map(q => ({
        query: q.query,
        params: q.params ?? {},
      }))
    );
  }

  async createNode(node: { label: string; properties: Record<string, any> }): Promise<string> {
    // 使用NebulaConnectionManager创建节点
    return this.nebulaConnection.createNode(node);
  }

  async createRelationship(relationship: {
    type: string;
    sourceId: string;
    targetId: string;
    properties?: Record<string, any>;
  }): Promise<void> {
    // 使用NebulaConnectionManager创建关系
    await this.nebulaConnection.createRelationship(relationship);
  }

  async findNodes(label?: string, properties?: Record<string, any>): Promise<any[]> {
    // 使用NebulaConnectionManager查找节点
    if (label) {
      return this.nebulaConnection.findNodesByLabel(label, properties);
    } else {
      // 如果没有指定标签，需要实现一个通用的节点查找方法
      // 这里暂时抛出未实现错误，因为NebulaGraph的实现可能与Neo4j不同
      throw new Error('General node finding not implemented for NebulaGraph');
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    // 使用NebulaConnectionManager查找关系
    return this.nebulaConnection.findRelationships(type, properties);
  }

  async getDatabaseStats(): Promise<any> {
    // 使用NebulaConnectionManager获取数据库统计信息
    return this.nebulaConnection.getDatabaseStats();
  }

  isConnected(): boolean {
    return this.nebulaConnection.isConnected();
  }

  async close(): Promise<void> {
    await this.nebulaConnection.disconnect();
  }

  /**
   * 创建优化索引
   * 根据graph-search-capability-analysis.md中的建议创建索引
   */
  async createOptimizedIndexes(): Promise<void> {
    const indexes = [
      'CREATE TAG INDEX IF NOT EXISTS node_name_index ON Function(name)',
      'CREATE TAG INDEX IF NOT EXISTS node_type_index ON Function(type)',
      'CREATE EDGE INDEX IF NOT EXISTS rel_type_index ON CALLS(type)',
      'CREATE TAG INDEX IF NOT EXISTS file_path_index ON File(path)',
    ];

    // 循环创建所有优化索引，确保每个都成功
    for (const indexQuery of indexes) {
      await this.createOptimizedIndexWithRetry(indexQuery);
    }

    this.logger.info('All optimized indexes created successfully');
  }

  /**
   * 创建优化索引并带有重试机制和错误处理
   */
  private async createOptimizedIndexWithRetry(indexQuery: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.executeWriteQuery(indexQuery);
        this.logger.info(`Successfully created optimized index: ${indexQuery}`);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // 检查是否是"已存在"错误
        if (errorMessage.includes('already exists') || errorMessage.includes('existed')) {
          this.logger.debug(`Optimized index already exists: ${indexQuery}`);
          return;
        }

        if (attempt === maxRetries) {
          this.logger.error(`Failed to create optimized index after ${maxRetries} attempts: ${indexQuery}`, error);
          throw new Error(`Failed to create optimized index: ${indexQuery}. Error: ${errorMessage}`);
        }

        this.logger.warn(`Attempt ${attempt} failed to create optimized index: ${indexQuery}. Retrying...`, error);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * 优化数据分区
   * 根据项目ID创建不同分区配置的SPACE
   */
  async optimizeDataPartitioning(): Promise<void> {
    // 按项目ID进行数据分区
    const partitionQueries = [
      'CREATE SPACE IF NOT EXISTS project_1 (partition_num=5, replica_factor=1)',
      'CREATE SPACE IF NOT EXISTS project_2 (partition_num=3, replica_factor=1)',
      // 更多分区配置...
    ];

    for (const query of partitionQueries) {
      try {
        await this.executeWriteQuery(query);
        this.logger.info(`Created space: ${query}`);
      } catch (error) {
        this.logger.warn(`Failed to create space: ${query}`, { error });
      }
    }
  }

  /**
   * 社区发现算法 - Louvain方法
   */
  async communityDetection(options: CommunityDetectionOptions = {}): Promise<CommunityResult[]> {
    const { limit = 10, minCommunitySize = 2, maxIterations = 10 } = options;

    // NebulaGraph 3.x 社区发现查询
    const query = `
      GET SUBGRAPH WITH PROP FROM ${minCommunitySize} 
      STEPS FROM "*" 
      YIELD VERTICES AS nodes, EDGES AS relationships
      | FIND SHORTEST PATH FROM nodes.community_id OVER * 
      YIELD path AS community_path
      | GROUP BY community_path.community_id 
      YIELD community_path.community_id AS communityId, 
             COLLECT(community_path.vertex_id) AS members
      ORDER BY SIZE(members) DESC
      LIMIT ${limit}
    `;

    try {
      const result = await this.executeReadQuery(query);
      return this.transformCommunityResults(result);
    } catch (error) {
      this.logger.error('Community detection failed', { error });
      throw new Error(`Community detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
    * PageRank算法
    */
  async pageRank(options: PageRankOptions = {}): Promise<PageRankResult[]> {
    const { limit = 10, iterations = 20, dampingFactor = 0.85 } = options;

    // NebulaGraph 3.x PageRank查询
    const query = `
      GET SUBGRAPH FROM "*" 
      YIELD VERTICES AS nodes
      | FIND SHORTEST PATH FROM nodes.rank OVER * 
      YIELD path AS rank_path
      | GROUP BY rank_path.vertex_id 
      YIELD rank_path.vertex_id AS nodeId, 
             SUM(1.0 / LENGTH(rank_path)) AS score
      ORDER BY score DESC
      LIMIT ${limit}
    `;

    try {
      const result = await this.executeReadQuery(query);
      return this.transformPageRankResults(result, limit);
    } catch (error) {
      this.logger.error('PageRank calculation failed', { error });
      throw new Error(`PageRank calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 查找最短路径
   */
  async findShortestPath(options: ShortestPathOptions): Promise<ShortestPathResult> {
    const { sourceId, targetId, maxDepth = 10, edgeTypes = ['*'] } = options;

    const edgeTypeClause = edgeTypes.join(',');

    const query = `
      FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" 
      OVER ${edgeTypeClause} 
      UPTO ${maxDepth} STEPS
      YIELD path AS shortest_path
    `;

    try {
      const result = await this.executeReadQuery(query);
      return this.transformShortestPathResult(result);
    } catch (error) {
      this.logger.error('Shortest path finding failed', { error });
      throw new Error(`Shortest path finding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 转换社区发现结果
   */
  private transformCommunityResults(result: any): CommunityResult[] {
    if (!result || !Array.isArray(result)) {
      return [];
    }

    return result.map((item: any, index: number) => ({
      communityId: item.communityId || `community_${index}`,
      members: Array.isArray(item.members) ? item.members : [],
      size: Array.isArray(item.members) ? item.members.length : 0
    }));
  }

  /**
   * 转换PageRank结果
   */
  private transformPageRankResults(result: any, limit: number): PageRankResult[] {
    if (!result || !Array.isArray(result)) {
      return [];
    }

    return result.map((item: any, index: number) => ({
      nodeId: item.nodeId || `node_${index}`,
      score: typeof item.score === 'number' ? item.score : 0,
      rank: index + 1
    })).slice(0, limit);
  }

  /**
   * 转换最短路径结果
   */
  private transformShortestPathResult(result: any): ShortestPathResult {
    if (!result || !Array.isArray(result) || result.length === 0) {
      return {
        path: [],
        distance: Infinity,
        edges: []
      };
    }

    const firstResult = result[0];
    const path = firstResult.shortest_path || [];

    return {
      path: Array.isArray(path) ? path : [],
      distance: Array.isArray(path) ? path.length - 1 : Infinity,
      edges: this.extractEdgesFromPath(path)
    };
  }

  /**
   * 从路径中提取边信息
   */
  private extractEdgesFromPath(path: any[]): Array<{ source: string; target: string; type: string }> {
    if (!Array.isArray(path) || path.length < 2) {
      return [];
    }

    const edges = [];
    for (let i = 0; i < path.length - 1; i++) {
      edges.push({
        source: path[i],
        target: path[i + 1],
        type: 'unknown'
      });
    }

    return edges;
  }

  // 代理到NebulaSpaceManager的方法
  async createSpace(projectId: string, config?: any): Promise<boolean> {
    return this.nebulaSpaceManager.createSpace(projectId, config);
  }

  async deleteSpace(projectId: string): Promise<boolean> {
    return this.nebulaSpaceManager.deleteSpace(projectId);
  }

  async listSpaces(): Promise<string[]> {
    return this.nebulaSpaceManager.listSpaces();
  }

  async getSpaceInfo(projectId: string): Promise<any> {
    return this.nebulaSpaceManager.getSpaceInfo(projectId);
  }

  async checkSpaceExists(projectId: string): Promise<boolean> {
    return this.nebulaSpaceManager.checkSpaceExists(projectId);
  }

  async clearSpace(projectId: string): Promise<boolean> {
    return this.nebulaSpaceManager.clearSpace(projectId);
  }

  // 代理到NebulaGraphOperations的方法
  async insertVertex(tag: string, vertexId: string, properties: Record<string, any>): Promise<boolean> {
    return this.nebulaGraphOperations.insertVertex(tag, vertexId, properties);
  }

  async insertEdge(edgeType: string, srcId: string, dstId: string, properties: Record<string, any>): Promise<boolean> {
    return this.nebulaGraphOperations.insertEdge(edgeType, srcId, dstId, properties);
  }

  async batchInsertVertices(vertices: any[]): Promise<boolean> {
    return this.nebulaGraphOperations.batchInsertVertices(vertices);
  }

  async batchInsertEdges(edges: any[]): Promise<boolean> {
    return this.nebulaGraphOperations.batchInsertEdges(edges);
  }

  async findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth?: number): Promise<any[]> {
    return this.nebulaGraphOperations.findRelatedNodes(nodeId, relationshipTypes, maxDepth);
  }

  async findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<any[]> {
    return this.nebulaGraphOperations.findPath(sourceId, targetId, maxDepth);
  }

  async updateVertex(vertexId: string, tag: string, properties: Record<string, any>): Promise<boolean> {
    return this.nebulaGraphOperations.updateVertex(vertexId, tag, properties);
  }

  async updateEdge(srcId: string, dstId: string, edgeType: string, properties: Record<string, any>): Promise<boolean> {
    return this.nebulaGraphOperations.updateEdge(srcId, dstId, edgeType, properties);
  }

  async deleteVertex(vertexId: string, tag?: string): Promise<boolean> {
    return this.nebulaGraphOperations.deleteVertex(vertexId, tag);
  }

  async deleteEdge(srcId: string, dstId: string, edgeType?: string): Promise<boolean> {
    return this.nebulaGraphOperations.deleteEdge(srcId, dstId, edgeType);
  }

  async executeComplexTraversal(startId: string, edgeTypes: string[], options?: any): Promise<any[]> {
    return this.nebulaGraphOperations.executeComplexTraversal(startId, edgeTypes, options);
  }

  async getGraphStats(): Promise<{ nodeCount: number; relationshipCount: number }> {
    return this.nebulaGraphOperations.getGraphStats();
  }
}