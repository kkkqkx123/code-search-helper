import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { DatabaseEventType } from '../../common/DatabaseEventTypes';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { INebulaSpaceManager } from '../space/NebulaSpaceManager';
import { INebulaQueryService } from '../query/NebulaQueryService';
import { INebulaQueryBuilder } from '../query/NebulaQueryBuilder';
import { BatchVertex, BatchEdge } from '../NebulaTypes';
import { INebulaClient } from '../client/NebulaClient';
import { NebulaBaseOperations } from './NebulaBaseOperations';

export interface INebulaGraphOperations {
  insertVertex(tag: string, vertexId: string, properties: Record<string, any>): Promise<boolean>;
  insertEdge(edgeType: string, srcId: string, dstId: string, properties: Record<string, any>): Promise<boolean>;
  batchInsertVertices(vertices: BatchVertex[]): Promise<boolean>;
  batchInsertEdges(edges: BatchEdge[]): Promise<boolean>;
  updateVertex(vertexId: string, tag: string, properties: Record<string, any>): Promise<boolean>;
  updateEdge(srcId: string, dstId: string, edgeType: string, properties: Record<string, any>): Promise<boolean>;
  deleteVertex(vertexId: string, tag?: string): Promise<boolean>;
  deleteEdge(srcId: string, dstId: string, edgeType?: string): Promise<boolean>;
  getGraphStats(): Promise<{ nodeCount: number; relationshipCount: number }>;
}

/**
 * Nebula图操作服务
 * 负责底层图操作：单个节点/边的CRUD、批量操作、图统计
 */
@injectable()
export class NebulaGraphOperations extends NebulaBaseOperations implements INebulaGraphOperations {
  private queryBuilder: INebulaQueryBuilder;
  private nebulaClient: INebulaClient;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.INebulaSpaceManager) spaceManager: INebulaSpaceManager,
    @inject(TYPES.INebulaQueryService) queryService: INebulaQueryService,
    @inject(TYPES.INebulaQueryBuilder) queryBuilder: INebulaQueryBuilder,
    @inject(TYPES.INebulaClient) nebulaClient: INebulaClient
  ) {
    super(databaseLogger, errorHandler, spaceManager, queryService);
    this.queryBuilder = queryBuilder;
    this.nebulaClient = nebulaClient;
  }

  async insertVertex(tag: string, vertexId: string, properties: Record<string, any>): Promise<boolean> {
    try {
      const { query, params } = this.queryBuilder.insertVertex(tag, vertexId, properties);
      await this.nebulaClient.executeQuery(query, params);
      return true;
    } catch (error) {
      this.logError('insertVertex', { tag, vertexId }, error);
      throw error;
    }
  }

  async insertEdge(edgeType: string, srcId: string, dstId: string, properties: Record<string, any>): Promise<boolean> {
    try {
      const { query, params } = this.queryBuilder.insertEdge(edgeType, srcId, dstId, properties);
      await this.nebulaClient.executeQuery(query, params);
      return true;
    } catch (error) {
      this.logError('insertEdge', { edgeType, srcId, dstId }, error);
      throw error;
    }
  }

  async batchInsertVertices(vertices: BatchVertex[]): Promise<boolean> {
    try {
      if (vertices.length === 0) return true;
      
      const { query, params } = this.queryBuilder.batchInsertVertices(vertices);
      if (query && query.length > 0) {
        await this.nebulaClient.executeQuery(query, params);
      }
      return true;
    } catch (error) {
      this.logError('batchInsertVertices', { count: vertices.length }, error);
      throw error;
    }
  }

  async batchInsertEdges(edges: BatchEdge[]): Promise<boolean> {
    try {
      if (edges.length === 0) return true;
      
      const { query, params } = this.queryBuilder.batchInsertEdges(edges);
      if (query && query.length > 0) {
        await this.nebulaClient.executeQuery(query, params);
      }
      return true;
    } catch (error) {
      this.logError('batchInsertEdges', { count: edges.length }, error);
      throw error;
    }
  }

  async updateVertex(vertexId: string, tag: string, properties: Record<string, any>): Promise<boolean> {
    try {
      if (Object.keys(properties).length === 0) return true;

      const { query, params } = this.queryBuilder.updateVertex(vertexId, tag, properties);
      await this.nebulaClient.executeQuery(query, params);
      
      this.logSuccess('updateVertex', { vertexId, tag });
      return true;
    } catch (error) {
      this.logError('updateVertex', { vertexId, tag }, error);
      throw error;
    }
  }

  async updateEdge(srcId: string, dstId: string, edgeType: string, properties: Record<string, any>): Promise<boolean> {
    try {
      if (Object.keys(properties).length === 0) return true;

      const { query, params } = this.queryBuilder.updateEdge(srcId, dstId, edgeType, properties);
      await this.nebulaClient.executeQuery(query, params);
      
      this.logSuccess('updateEdge', { srcId, dstId, edgeType });
      return true;
    } catch (error) {
      this.logError('updateEdge', { srcId, dstId, edgeType }, error);
      throw error;
    }
  }

  async deleteVertex(vertexId: string, tag?: string): Promise<boolean> {
    try {
      const query = tag 
        ? `DELETE VERTEX "${vertexId}" TAG \`${tag}\``
        : `DELETE VERTEX "${vertexId}" WITH EDGE`;

      await this.nebulaClient.executeQuery(query);
      
      this.logSuccess('deleteVertex', { vertexId, tag });
      return true;
    } catch (error) {
      this.logError('deleteVertex', { vertexId, tag }, error);
      throw error;
    }
  }

  async deleteEdge(srcId: string, dstId: string, edgeType?: string): Promise<boolean> {
    try {
      const query = edgeType
        ? `DELETE EDGE \`${edgeType}\` "${srcId}" -> "${dstId}"`
        : `DELETE EDGE "${srcId}" -> "${dstId}"`;

      await this.nebulaClient.executeQuery(query);
      
      this.logSuccess('deleteEdge', { srcId, dstId, edgeType });
      return true;
    } catch (error) {
      this.logError('deleteEdge', { srcId, dstId, edgeType }, error);
      throw error;
    }
  }

  async getGraphStats(): Promise<{ nodeCount: number; relationshipCount: number }> {
    try {
      let totalNodeCount = 0;
      let totalRelationshipCount = 0;

      const tagsResult = await this.nebulaClient.executeQuery('SHOW TAGS');
      if (tagsResult?.data && Array.isArray(tagsResult.data)) {
        for (const tag of tagsResult.data) {
          const tagName = tag.Name || tag.name;
          if (tagName) {
            const { query, params } = this.queryBuilder.buildNodeCountQuery(tagName);
            const countResult = await this.nebulaClient.executeQuery(query, params);
            if (countResult?.data && Array.isArray(countResult.data) && countResult.data.length > 0) {
              totalNodeCount += countResult.data[0].total || 0;
            }
          }
        }
      }

      const edgesResult = await this.nebulaClient.executeQuery('SHOW EDGES');
      if (edgesResult?.data && Array.isArray(edgesResult.data)) {
        for (const edge of edgesResult.data) {
          const edgeName = edge.Name || edge.name;
          if (edgeName) {
            const { query, params } = this.queryBuilder.buildRelationshipCountQuery(edgeName);
            const countResult = await this.nebulaClient.executeQuery(query, params);
            if (countResult?.data && Array.isArray(countResult.data) && countResult.data.length > 0) {
              totalRelationshipCount += countResult.data[0].total || 0;
            }
          }
        }
      }

      return { nodeCount: totalNodeCount, relationshipCount: totalRelationshipCount };
    } catch (error) {
      this.logError('getGraphStats', {}, error);
      return { nodeCount: 0, relationshipCount: 0 };
    }
  }

  private logSuccess(operation: string, data: Record<string, any>): void {
    this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.QUERY_EXECUTED,
      source: 'nebula',
      timestamp: new Date(),
      data: { operation, ...data }
    }).catch(err => console.error('Failed to log success:', err));
  }

  private logError(operation: string, data: Record<string, any>, error: unknown): void {
    this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.ERROR_OCCURRED,
      source: 'nebula',
      timestamp: new Date(),
      data: {
        operation,
        ...data,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }).catch(err => console.error('Failed to log error:', err));
  }
}