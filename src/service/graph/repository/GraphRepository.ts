import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { INebulaDataOperations } from '../../../database/nebula/operation/NebulaDataOperations';
import { INebulaGraphOperations } from '../../../database/nebula/operation/NebulaGraphOperations';
import { INebulaQueryService } from '../../../database/nebula/query/NebulaQueryService';
import { ICacheService } from '../../../infrastructure/caching/types';
import { 
  IGraphRepository, 
  GraphNodeData, 
  GraphRelationshipData, 
  GraphQueryOptions,
  GraphTraversalOptions 
} from './IGraphRepository';

/**
 * 图数据仓库实现
 * 职责: 封装数据库层操作，为服务层提供统一的数据访问接口
 */
@injectable()
export class GraphRepository implements IGraphRepository {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.INebulaDataOperations) private dataOps: INebulaDataOperations,
    @inject(TYPES.INebulaGraphOperations) private graphOps: INebulaGraphOperations,
    @inject(TYPES.INebulaQueryService) private queryService: INebulaQueryService,
    @inject(TYPES.CacheService) private cache: ICacheService
  ) {}

  async createNode(node: GraphNodeData): Promise<string> {
    try {
      await this.graphOps.insertVertex(node.label, node.id, node.properties);
      
      // 失效相关缓存
      this.cache.deleteFromCache(`graph:node:${node.id}`);
      this.invalidateRelatedCaches(node.id);
      
      return node.id;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'createNode', nodeId: node.id });
      throw error;
    }
  }

  async createNodes(nodes: GraphNodeData[]): Promise<string[]> {
    try {
      const vertices = nodes.map(n => ({ id: n.id, tag: n.label, properties: n.properties }));
      await this.graphOps.batchInsertVertices(vertices);
      
      // 失效所有新创建节点的缓存
      nodes.forEach(node => {
        this.cache.deleteFromCache(`graph:node:${node.id}`);
        this.invalidateRelatedCaches(node.id);
      });
      
      return nodes.map(n => n.id);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'createNodes', count: nodes.length });
      throw error;
    }
  }

  async getNodeById(nodeId: string): Promise<GraphNodeData | null> {
    const cacheKey = `graph:node:${nodeId}`;
    
    // 尝试从缓存获取
    const cached = this.cache.getFromCache<GraphNodeData>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for node', { nodeId });
      return cached;
    }
    
    try {
      const result = await this.queryService.executeQuery(
        `FETCH PROP ON * "${nodeId}" YIELD vertex AS node`
      );
      const node = result?.data?.[0] || null;
      
      // 缓存结果（5分钟TTL）
      if (node) {
        this.cache.setCache(cacheKey, node, 300000);
      }
      
      return node;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'getNodeById', nodeId });
      return null;
    }
  }

  async findNodesByLabel(label: string, properties?: Record<string, any>, options?: GraphQueryOptions): Promise<GraphNodeData[]> {
    try {
      const limit = options?.limit || 100;
      let query = `LOOKUP ON \`${label}\``;
      
      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.entries(properties).map(([k, v]) => `${k} == "${v}"`).join(' AND ');
        query += ` WHERE ${conditions}`;
      }
      
      query += ` YIELD vertex AS node LIMIT ${limit}`;
      
      const result = await this.queryService.executeQuery(query);
      return result?.data || [];
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findNodesByLabel', label });
      return [];
    }
  }

  async updateNode(nodeId: string, properties: Record<string, any>): Promise<boolean> {
    try {
      const result = await this.graphOps.updateVertex(nodeId, '', properties);
      
      // 失效相关缓存
      if (result) {
        this.cache.deleteFromCache(`graph:node:${nodeId}`);
        this.invalidateRelatedCaches(nodeId);
      }
      
      return result;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'updateNode', nodeId });
      return false;
    }
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    try {
      const result = await this.graphOps.deleteVertex(nodeId);
      
      // 失效相关缓存
      if (result) {
        this.cache.deleteFromCache(`graph:node:${nodeId}`);
        this.invalidateRelatedCaches(nodeId);
      }
      
      return result;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'deleteNode', nodeId });
      return false;
    }
  }

  async createRelationship(relationship: GraphRelationshipData): Promise<void> {
    try {
      await this.graphOps.insertEdge(
        relationship.type,
        relationship.sourceId,
        relationship.targetId,
        relationship.properties || {}
      );
      
      // 失效相关节点的缓存
      this.invalidateRelatedCaches(relationship.sourceId);
      this.invalidateRelatedCaches(relationship.targetId);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'createRelationship', type: relationship.type });
      throw error;
    }
  }

  async createRelationships(relationships: GraphRelationshipData[]): Promise<void> {
    try {
      const edges = relationships.map(r => ({
        type: r.type,
        srcId: r.sourceId,
        dstId: r.targetId,
        properties: r.properties || {}
      }));
      await this.graphOps.batchInsertEdges(edges);
      
      // 失效所有相关节点的缓存
      const affectedNodes = new Set<string>();
      relationships.forEach(r => {
        affectedNodes.add(r.sourceId);
        affectedNodes.add(r.targetId);
      });
      affectedNodes.forEach(nodeId => this.invalidateRelatedCaches(nodeId));
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'createRelationships', count: relationships.length });
      throw error;
    }
  }

  async findRelationshipsByType(type: string, properties?: Record<string, any>, options?: GraphQueryOptions): Promise<GraphRelationshipData[]> {
    try {
      const limit = options?.limit || 100;
      const query = `LOOKUP ON \`${type}\` YIELD edge AS rel LIMIT ${limit}`;
      const result = await this.queryService.executeQuery(query);
      return result?.data || [];
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findRelationshipsByType', type });
      return [];
    }
  }

  async updateRelationship(relationshipId: string, properties: Record<string, any>): Promise<boolean> {
    try {
      const [srcId, dstId, edgeType] = relationshipId.split('->');
      return await this.graphOps.updateEdge(srcId, dstId, edgeType, properties);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'updateRelationship', relationshipId });
      return false;
    }
  }

  async deleteRelationship(relationshipId: string): Promise<boolean> {
    try {
      const [srcId, dstId, edgeType] = relationshipId.split('->');
      return await this.graphOps.deleteEdge(srcId, dstId, edgeType);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'deleteRelationship', relationshipId });
      return false;
    }
  }

  async findRelatedNodes(nodeId: string, options?: GraphTraversalOptions): Promise<GraphNodeData[]> {
    const cacheKey = `graph:related:${nodeId}:${JSON.stringify(options || {})}`;
    
    // 尝试从缓存获取
    const cached = this.cache.getFromCache<GraphNodeData[]>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for related nodes', { nodeId });
      return cached;
    }
    
    try {
      const maxDepth = options?.maxDepth || 3;
      const edgeTypes = options?.edgeTypes && options.edgeTypes.length > 0 
        ? options.edgeTypes.join(',') 
        : '*';
      
      const query = `
        GO ${maxDepth} STEPS FROM "${nodeId}" OVER ${edgeTypes}
        YIELD dst(edge) AS relatedNodeId
        | FETCH PROP ON * $-.relatedNodeId YIELD vertex AS relatedNode
        LIMIT 100
      `;
      
      const result = await this.queryService.executeQuery(query);
      const nodes = result?.data?.map((record: any) => record.relatedNode) || [];
      
      // 缓存结果（1分钟TTL，因为遍历结果可能变化较快）
      if (nodes.length > 0) {
        this.cache.setCache(cacheKey, nodes, 60000);
      }
      
      return nodes;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findRelatedNodes', nodeId });
      return [];
    }
  }

  async findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<GraphNodeData[][]> {
    try {
      const depth = maxDepth || 5;
      const query = `
        FIND ALL PATH FROM "${sourceId}" TO "${targetId}" OVER * UPTO ${depth} STEPS
        YIELD path AS p
      `;
      
      const result = await this.queryService.executeQuery(query);
      return result?.data ? [result.data] : [];
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findPath', sourceId, targetId });
      return [];
    }
  }

  async findShortestPath(sourceId: string, targetId: string, edgeTypes?: string[], maxDepth?: number): Promise<GraphNodeData[]> {
    try {
      const depth = maxDepth || 10;
      const edgeTypesClause = edgeTypes && edgeTypes.length > 0 
        ? `OVER ${edgeTypes.join(',')}` 
        : 'OVER *';
      
      const query = `
        FIND SHORTEST PATH FROM "${sourceId}" TO "${targetId}" ${edgeTypesClause} UPTO ${depth} STEPS
        YIELD path AS p
      `;
      
      const result = await this.queryService.executeQuery(query);
      return result?.data || [];
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findShortestPath', sourceId, targetId });
      return [];
    }
  }

  async executeTraversal(startId: string, options: GraphTraversalOptions): Promise<GraphNodeData[]> {
    try {
      const maxDepth = options.maxDepth || 3;
      const edgeTypes = options.edgeTypes && options.edgeTypes.length > 0 
        ? options.edgeTypes.join(',') 
        : '*';
      
      const query = `
        GO ${maxDepth} STEPS FROM "${startId}" OVER ${edgeTypes}
        YIELD dst(edge) AS nodeId
        | FETCH PROP ON * $-.nodeId YIELD vertex AS node
      `;
      
      const result = await this.queryService.executeQuery(query);
      return result?.data?.map((record: any) => record.node) || [];
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'executeTraversal', startId });
      return [];
    }
  }

  async getNodeCount(label?: string): Promise<number> {
    try {
      const query = label 
        ? `LOOKUP ON \`${label}\` YIELD vertex AS node | YIELD count($-.node) AS total`
        : `MATCH (n) RETURN count(n) AS total`;
      const result = await this.queryService.executeQuery(query);
      return result?.data?.[0]?.total || 0;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'getNodeCount', label });
      return 0;
    }
  }

  /**
   * 失效与节点相关的所有缓存
   */
  private invalidateRelatedCaches(nodeId: string): void {
    // 失效相关节点缓存
    this.cache.deleteByPattern(new RegExp(`graph:related:${nodeId}:`));
    // 失效遍历缓存
    this.cache.deleteByPattern(new RegExp(`graph:traversal:.*${nodeId}`));
  }
  async getRelationshipCount(type?: string): Promise<number> {
    try {
      const query = type
        ? `LOOKUP ON \`${type}\` YIELD edge AS rel | YIELD count($-.rel) AS total`
        : `MATCH ()-[r]->() RETURN count(r) AS total`;
      const result = await this.queryService.executeQuery(query);
      return result?.data?.[0]?.total || 0;
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'getRelationshipCount', type });
      return 0;
    }
  }

  async getGraphStats(): Promise<{ nodeCount: number; relationshipCount: number }> {
    try {
      return await this.graphOps.getGraphStats();
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'getGraphStats' });
      return { nodeCount: 0, relationshipCount: 0 };
    }
  }

  async executeQuery(query: string, params?: Record<string, any>): Promise<any> {
    try {
      return await this.queryService.executeQuery(query, params);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'executeQuery', query });
      throw error;
    }
  }

  async executeBatchQuery(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<any[]> {
    try {
      return await Promise.all(queries.map(q => this.queryService.executeQuery(q.query, q.params)));
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'executeBatchQuery', count: queries.length });
      throw error;
    }
  }
}