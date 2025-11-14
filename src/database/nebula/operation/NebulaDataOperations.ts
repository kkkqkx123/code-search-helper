import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { INebulaSpaceManager } from '../space/NebulaSpaceManager';
import { INebulaQueryService } from '../query/NebulaQueryService';
import { INebulaQueryBuilder } from '../query/NebulaQueryBuilder';
import { NebulaNode, NebulaRelationship } from '../NebulaTypes';
import { NebulaBaseOperations } from './NebulaBaseOperations';

/**
 * Nebula数据操作服务接口
 */
export interface INebulaDataOperations {
  insertNodes(projectId: string, spaceName: string, nodes: NebulaNode[]): Promise<boolean>;
  insertRelationships(projectId: string, spaceName: string, relationships: NebulaRelationship[]): Promise<boolean>;
  updateNode(projectId: string, spaceName: string, nodeId: string, data: any): Promise<boolean>;
  updateRelationship(projectId: string, spaceName: string, edgeId: string, data: any): Promise<boolean>;
  deleteNode(projectId: string, spaceName: string, nodeId: string): Promise<boolean>;
  deleteRelationship(projectId: string, spaceName: string, edgeId: string): Promise<boolean>;
  findNodesByLabel(projectId: string, spaceName: string, label: string, filter?: any): Promise<any[]>;
  findRelationshipsByType(projectId: string, spaceName: string, type?: string, filter?: any): Promise<any[]>;
  getDataById(projectId: string, spaceName: string, id: string): Promise<any>;
  search(projectId: string, spaceName: string, query: any): Promise<any[]>;
}

/**
 * Nebula数据操作服务实现
 * 负责高级数据操作：批量插入、复杂查询、搜索功能
 */
@injectable()
export class NebulaDataOperations extends NebulaBaseOperations implements INebulaDataOperations {
  private queryBuilder: INebulaQueryBuilder;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.INebulaSpaceManager) spaceManager: INebulaSpaceManager,
    @inject(TYPES.INebulaQueryService) queryService: INebulaQueryService,
    @inject(TYPES.INebulaQueryBuilder) queryBuilder: INebulaQueryBuilder
  ) {
    super(databaseLogger, errorHandler, spaceManager, queryService);
    this.queryBuilder = queryBuilder;
  }

  async insertNodes(projectId: string, spaceName: string, nodes: NebulaNode[]): Promise<boolean> {
    try {
      this.validateRequiredParams({ projectId, spaceName, nodes }, ['projectId', 'spaceName', 'nodes']);
      if (nodes.length === 0) throw new Error('Nodes array cannot be empty');

      await this.ensureSpaceAndSwitch(projectId, spaceName);
      
      const nodesWithProjectId = this.addProjectId(nodes, projectId);
      const nodesByLabel = this.groupByLabel(nodesWithProjectId);

      const queries = Object.entries(nodesByLabel).map(([label, labelNodes]) => 
        this.queryBuilder.batchInsertVertices(labelNodes.map(n => ({
          tag: label,
          id: n.id,
          properties: n.properties
        })))
      );

      const results = await Promise.all(queries.map(q => 
        this.queryService.executeQuery(q.query, q.params)
      ));

      return results.every(result => !result || !result.error);
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'insertNodes', 
        { projectId, spaceName, nodeCount: nodes.length });
    }
  }

  async insertRelationships(projectId: string, spaceName: string, relationships: NebulaRelationship[]): Promise<boolean> {
    try {
      this.validateRequiredParams({ projectId, spaceName, relationships }, ['projectId', 'spaceName', 'relationships']);
      if (relationships.length === 0) throw new Error('Relationships array cannot be empty');

      await this.ensureSpaceAndSwitch(projectId, spaceName);
      
      const relationshipsWithProjectId = this.addProjectId(relationships, projectId);
      const relationshipsByType = this.groupByType(relationshipsWithProjectId);

      const queries = Object.entries(relationshipsByType).map(([type, typeRels]) =>
        this.queryBuilder.batchInsertEdges(typeRels.map(r => ({
          type: type,
          srcId: r.sourceId,
          dstId: r.targetId,
          properties: r.properties || {}
        })))
      );

      const results = await Promise.all(queries.map(q =>
        this.queryService.executeQuery(q.query, q.params)
      ));

      return results.every(result => !result || !result.error);
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'insertRelationships',
        { projectId, spaceName, relationshipCount: relationships.length });
    }
  }

  async updateNode(projectId: string, spaceName: string, nodeId: string, data: any): Promise<boolean> {
    try {
      this.validateRequiredParams({ projectId, spaceName, nodeId }, ['projectId', 'spaceName', 'nodeId']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      const nodeResult = await this.queryService.executeQuery(
        `MATCH (v) WHERE id(v) == "${nodeId}" RETURN v LIMIT 1`
      );

      if (nodeResult?.data && nodeResult.data.length > 0) {
        const properties = data.properties || data;
        if (Object.keys(properties).length > 0) {
          const updateQuery = this.buildUpdateQuery('VERTEX', nodeId, properties);
          await this.queryService.executeQuery(updateQuery);
        }
        return true;
      }

      const relResult = await this.queryService.executeQuery(
        `MATCH ()-[e]->() WHERE id(e) == "${nodeId}" RETURN e LIMIT 1`
      );

      if (relResult?.data && relResult.data.length > 0) {
        const properties = data.properties || data;
        if (Object.keys(properties).length > 0) {
          const updateQuery = this.buildUpdateQuery('EDGE', nodeId, properties);
          await this.queryService.executeQuery(updateQuery);
        }
        return true;
      }

      throw new Error(`Node or relationship with ID ${nodeId} not found`);
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'updateNode',
        { projectId, spaceName, nodeId });
    }
  }

  async updateRelationship(projectId: string, spaceName: string, edgeId: string, data: any): Promise<boolean> {
    try {
      this.validateRequiredParams({ projectId, spaceName, edgeId }, ['projectId', 'spaceName', 'edgeId']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      const relResult = await this.queryService.executeQuery(
        `MATCH ()-[e]->() WHERE id(e) == "${edgeId}" RETURN e LIMIT 1`
      );

      if (relResult?.data && relResult.data.length > 0) {
        const properties = data.properties || data;
        if (Object.keys(properties).length > 0) {
          const updateQuery = this.buildUpdateQuery('EDGE', edgeId, properties);
          await this.queryService.executeQuery(updateQuery);
        }
        return true;
      }

      throw new Error(`Relationship with ID ${edgeId} not found`);
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'updateRelationship',
        { projectId, spaceName, edgeId });
    }
  }

  async deleteNode(projectId: string, spaceName: string, nodeId: string): Promise<boolean> {
    try {
      this.validateRequiredParams({ projectId, spaceName, nodeId }, ['projectId', 'spaceName', 'nodeId']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      const nodeResult = await this.queryService.executeQuery(
        `MATCH (v) WHERE id(v) == "${nodeId}" RETURN v LIMIT 1`
      );

      if (nodeResult?.data && nodeResult.data.length > 0) {
        await this.queryService.executeQuery(`DELETE VERTEX "${nodeId}" WITH EDGE`);
        return true;
      }

      const relResult = await this.queryService.executeQuery(
        `MATCH ()-[e]->() WHERE id(e) == "${nodeId}" RETURN e LIMIT 1`
      );

      if (relResult?.data && relResult.data.length > 0) {
        await this.queryService.executeQuery(`DELETE EDGE "${nodeId}"`);
        return true;
      }

      throw new Error(`Node or relationship with ID ${nodeId} not found`);
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'deleteNode',
        { projectId, spaceName, nodeId });
    }
  }

  async deleteRelationship(projectId: string, spaceName: string, edgeId: string): Promise<boolean> {
    try {
      this.validateRequiredParams({ projectId, spaceName, edgeId }, ['projectId', 'spaceName', 'edgeId']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      const relResult = await this.queryService.executeQuery(
        `MATCH ()-[e]->() WHERE id(e) == "${edgeId}" RETURN e LIMIT 1`
      );

      if (relResult?.data && relResult.data.length > 0) {
        await this.queryService.executeQuery(`DELETE EDGE "${edgeId}"`);
        return true;
      }

      throw new Error(`Relationship with ID ${edgeId} not found`);
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'deleteRelationship',
        { projectId, spaceName, edgeId });
    }
  }

  async findNodesByLabel(projectId: string, spaceName: string, label: string, filter?: any): Promise<any[]> {
    try {
      this.validateRequiredParams({ projectId, spaceName, label }, ['projectId', 'spaceName', 'label']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      let query = `MATCH (v:${label}) WHERE v.projectId == "${projectId}"`;
      
      if (filter) {
        const conditions = Object.entries(filter)
          .map(([key, value]) => `v.${key} == ${this.formatValue(value)}`)
          .join(' AND ');
        query += ` AND ${conditions}`;
      }
      
      query += ' RETURN v';

      const result = await this.queryService.executeQuery(query);
      return result.data || [];
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'findNodesByLabel',
        { projectId, spaceName, label, filter });
    }
  }

  async findRelationshipsByType(projectId: string, spaceName: string, type?: string, filter?: any): Promise<any[]> {
    try {
      this.validateRequiredParams({ projectId, spaceName }, ['projectId', 'spaceName']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      let query = `MATCH ()-[e${type ? `:${type}` : ''}]->() WHERE e.projectId == "${projectId}"`;
      
      if (filter) {
        const conditions = Object.entries(filter)
          .map(([key, value]) => `e.${key} == ${this.formatValue(value)}`)
          .join(' AND ');
        query += ` AND ${conditions}`;
      }
      
      query += ' RETURN e';

      const result = await this.queryService.executeQuery(query);
      return result.data || [];
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'findRelationshipsByType',
        { projectId, spaceName, type, filter });
    }
  }

  async getDataById(projectId: string, spaceName: string, id: string): Promise<any> {
    try {
      this.validateRequiredParams({ projectId, spaceName, id }, ['projectId', 'spaceName', 'id']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      const nodeResult = await this.queryService.executeQuery(
        `MATCH (v) WHERE id(v) == "${id}" RETURN v LIMIT 1`
      );

      if (nodeResult?.data && nodeResult.data.length > 0) {
        return nodeResult.data[0];
      }

      const relResult = await this.queryService.executeQuery(
        `MATCH ()-[e]->() WHERE id(e) == "${id}" RETURN e LIMIT 1`
      );

      return (relResult?.data && relResult.data.length > 0) ? relResult.data[0] : null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      this.handleOperationError(error, 'NebulaDataOperations', 'getDataById',
        { projectId, spaceName, id });
    }
  }

  async search(projectId: string, spaceName: string, query: any): Promise<any[]> {
    try {
      this.validateRequiredParams({ projectId, spaceName }, ['projectId', 'spaceName']);
      await this.ensureSpaceAndSwitch(projectId, spaceName);

      const searchQuery = typeof query === 'string' 
        ? query 
        : this.buildSearchQuery(projectId, query);

      const result = await this.queryService.executeQuery(searchQuery);
      return result?.data || [];
    } catch (error) {
      this.handleOperationError(error, 'NebulaDataOperations', 'search',
        { projectId, spaceName, query });
    }
  }

  private groupByLabel(nodes: NebulaNode[]): Record<string, NebulaNode[]> {
    return nodes.reduce((acc, node) => {
      if (!acc[node.label]) acc[node.label] = [];
      acc[node.label].push(node);
      return acc;
    }, {} as Record<string, NebulaNode[]>);
  }

  private groupByType(relationships: NebulaRelationship[]): Record<string, NebulaRelationship[]> {
    return relationships.reduce((acc, rel) => {
      if (!acc[rel.type]) acc[rel.type] = [];
      acc[rel.type].push(rel);
      return acc;
    }, {} as Record<string, NebulaRelationship[]>);
  }

  private buildUpdateQuery(entityType: 'VERTEX' | 'EDGE', id: string, properties: Record<string, any>): string {
    const setClause = Object.entries(properties)
      .map(([key, value]) => `${key} = ${this.formatValue(value)}`)
      .join(', ');
    return `UPDATE ${entityType} "${id}" SET ${setClause}`;
  }

  private buildSearchQuery(projectId: string, query: any): string {
    if (query.type === 'node') {
      const label = query.label || '*';
      let q = `MATCH (v${label !== '*' ? `:${label}` : ''}) WHERE v.projectId == "${projectId}"`;
      
      if (query.filter) {
        const conditions = Object.entries(query.filter)
          .map(([key, value]) => `v.${key} == ${this.formatValue(value)}`)
          .join(' AND ');
        q += ` AND ${conditions}`;
      }
      
      return q + ' RETURN v';
    }

    if (query.type === 'relationship') {
      const type = query.relationshipType || '*';
      let q = `MATCH ()-[e${type !== '*' ? `:${type}` : ''}]->() WHERE e.projectId == "${projectId}"`;
      
      if (query.filter) {
        const conditions = Object.entries(query.filter)
          .map(([key, value]) => `e.${key} == ${this.formatValue(value)}`)
          .join(' AND ');
        q += ` AND ${conditions}`;
      }
      
      return q + ' RETURN e';
    }

    if (query.type === 'graph') {
      const { startNode, pathLength = 1, direction = 'BOTH' } = query;
      
      if (startNode) {
        return `MATCH (start) WHERE id(start) == "${startNode}" ` +
               `MATCH p = (start)-[:*${direction} ${pathLength}]->(end) ` +
               `WHERE ANY(n IN nodes(p) WHERE n.projectId == "${projectId}") RETURN p`;
      }
      
      return `MATCH (n) WHERE n.projectId == "${projectId}" ` +
             `MATCH p = (n)-[:*${direction} ${pathLength}]->(m) RETURN p`;
    }

    return `MATCH (v) WHERE v.projectId == "${projectId}" RETURN v`;
  }

  private formatValue(value: any): string {
    return typeof value === 'string' ? `"${value}"` : String(value);
  }
}