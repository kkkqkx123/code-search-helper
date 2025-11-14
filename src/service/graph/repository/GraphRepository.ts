import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { INebulaDataOperations } from '../../../database/nebula/operation/NebulaDataOperations';
import { INebulaGraphOperations } from '../../../database/nebula/operation/NebulaGraphOperations';
import { INebulaQueryService } from '../../../database/nebula/query/NebulaQueryService';
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
    @inject(TYPES.INebulaQueryService) private queryService: INebulaQueryService
  ) {}

  async createNode(node: GraphNodeData): Promise<string> {
    try {
      await this.graphOps.insertVertex(node.label, node.id, node.properties);
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
      return nodes.map(n => n.id);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'createNodes', count: nodes.length });
      throw error;
    }
  }

  async getNodeById(nodeId: string): Promise<GraphNodeData | null> {
    try {
      const result = await this.queryService.executeQuery(
        `FETCH PROP ON * "${nodeId}" YIELD vertex AS node`
      );
      return result?.data?.[0] || null;
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
      return await this.graphOps.updateVertex(nodeId, '', properties);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'updateNode', nodeId });
      return false;
    }
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    try {
      return await this.graphOps.deleteVertex(nodeId);
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
    try {
      const maxDepth = options?.maxDepth || 3;
      const edgeTypes = options?.edgeTypes || [];
      return await this.graphOps.findRelatedNodes(nodeId, edgeTypes, maxDepth);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findRelatedNodes', nodeId });
      return [];
    }
  }

  async findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<GraphNodeData[][]> {
    try {
      const result = await this.graphOps.findPath(sourceId, targetId, maxDepth);
      return [result];
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findPath', sourceId, targetId });
      return [];
    }
  }

  async findShortestPath(sourceId: string, targetId: string, edgeTypes?: string[], maxDepth?: number): Promise<GraphNodeData[]> {
    try {
      return await this.graphOps.findShortestPath(sourceId, targetId, edgeTypes, maxDepth);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { component: 'GraphRepository', operation: 'findShortestPath', sourceId, targetId });
      return [];
    }
  }

  async executeTraversal(startId: string, options: GraphTraversalOptions): Promise<GraphNodeData[]> {
    try {
      return await this.graphOps.executeComplexTraversal(startId, options.edgeTypes || [], options);
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