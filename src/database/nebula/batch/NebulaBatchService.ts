import { injectable, inject } from 'inversify';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { TYPES } from '../../../types';
import { INebulaQueryService } from '../query/NebulaQueryService';
import { INebulaDataOperations } from '../operation/NebulaDataOperations';
import { NebulaNode, NebulaRelationship } from '../NebulaTypes';
import { DatabaseEventType } from '../../common/DatabaseEventTypes';
import { NebulaDataService } from '../data/NebulaDataService';

export interface INebulaBatchService {
  batchInsertNodes(nodes: NebulaNode[]): Promise<void>;
  insertNodes(nodes: NebulaNode[]): Promise<boolean>;
  insertRelationships(relationships: NebulaRelationship[]): Promise<boolean>;
  groupNodesByLabel(nodes: NebulaNode[]): Record<string, NebulaNode[]>;
  groupRelationshipsByType(relationships: NebulaRelationship[]): Record<string, NebulaRelationship[]>;
  formatValue(value: any): string;
}

@injectable()
export class NebulaBatchService implements INebulaBatchService {
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private queryService: INebulaQueryService;
  private dataOperations: INebulaDataOperations;
  private dataService: NebulaDataService;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaQueryService) queryService: INebulaQueryService,
    @inject(TYPES.NebulaDataOperations) dataOperations: INebulaDataOperations,
    @inject(TYPES.NebulaDataService) dataService: NebulaDataService
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.queryService = queryService;
    this.dataOperations = dataOperations;
    this.dataService = dataService;
  }

  /**
   * 批量插入节点（优化版本）
   */
  async batchInsertNodes(nodes: NebulaNode[]): Promise<void> {
    if (!nodes || nodes.length === 0) {
      return;
    }

    try {
      // 按标签分组节点
      const nodesByLabel = this.groupNodesByLabel(nodes);

      // 为每个标签批量插入
      for (const [label, labelNodes] of Object.entries(nodesByLabel)) {
        const queries = labelNodes.map(node => ({
          query: `INSERT VERTEX ${label} (${Object.keys(node.properties).join(', ')}) VALUES ${node.id}: (${Object.values(node.properties).map(v => this.formatValue(v)).join(', ')})`,
          params: {}
        }));

        // 执行批量插入
        for (const query of queries) {
          await this.queryService.executeQuery(query.query, query.params);
        }
      }

      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_INSERTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Successfully batch inserted ${nodes.length} nodes`, nodeCount: nodes.length }
      });
    } catch (error) {
      // 使用 DatabaseLoggerService 记录错误事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_ERROR,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Failed to batch insert nodes` },
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * 插入节点
   */
  async insertNodes(nodes: NebulaNode[]): Promise<boolean> {
    if (!nodes || nodes.length === 0) {
      return true; // 没有节点需要插入，视为成功
    }

    try {
      const startTime = Date.now();

      // 从第一个节点的属性中获取projectId，如果不存在则尝试获取当前空间的相关信息
      let projectId = nodes[0].properties?.projectId;
      if (!projectId) {
        // 尝试获取当前空间信息以确定projectId
        const spaceResult = await this.queryService.executeQuery('SHOW SPACES');
        if (spaceResult && spaceResult.data && spaceResult.data.length > 0) {
          const currentSpace = spaceResult.data[0];
          projectId = currentSpace.Name || currentSpace.name;
        }
      }

      if (!projectId) {
        throw new Error('Unable to determine project ID for node insertion');
      }

      // 为所有节点添加项目ID（如果尚未存在）
      const nodesWithProjectId = nodes.map(node => ({
        ...node,
        properties: {
          ...node.properties,
          projectId
        }
      }));

      // 使用dataOperations服务进行批量插入
      const result = await this.dataOperations.insertNodes(
        projectId,
        this.generateSpaceNameFromPath(projectId),
        nodesWithProjectId
      );

      const duration = Date.now() - startTime;
      // 使用 DatabaseLoggerService 记录节点插入事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_INSERTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Inserted ${nodes.length} nodes`, nodeCount: nodes.length }
      });
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'NebulaBatchService', operation: 'insertNodes' }
      );
      return false;
    }
  }

  /**
   * 插入关系
   */
  async insertRelationships(relationships: NebulaRelationship[]): Promise<boolean> {
    if (!relationships || relationships.length === 0) {
      return true; // 没有关系需要插入，视为成功
    }

    try {
      const startTime = Date.now();

      // 从第一个关系的属性中获取projectId，如果不存在则尝试获取当前空间的相关信息
      let projectId = relationships[0].properties?.projectId;
      if (!projectId) {
        // 尝试获取当前空间信息以确定projectId
        const spaceResult = await this.queryService.executeQuery('SHOW SPACES');
        if (spaceResult && spaceResult.data && spaceResult.data.length > 0) {
          const currentSpace = spaceResult.data[0];
          projectId = currentSpace.Name || currentSpace.name;
        }
      }

      if (!projectId) {
        throw new Error('Unable to determine project ID for relationship insertion');
      }

      // 为所有关系添加项目ID（如果尚未存在）
      const relationshipsWithProjectId = relationships.map(rel => ({
        ...rel,
        properties: {
          ...rel.properties,
          projectId
        }
      }));

      // 使用dataOperations服务进行批量插入
      const result = await this.dataOperations.insertRelationships(
        projectId,
        this.generateSpaceNameFromPath(projectId),
        relationshipsWithProjectId
      );

      const duration = Date.now() - startTime;
      // 使用 DatabaseLoggerService 记录关系插入事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_INSERTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Inserted ${relationships.length} relationships`, relationshipCount: relationships.length }
      });
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        { component: 'NebulaBatchService', operation: 'insertRelationships' }
      );
      return false;
    }
  }

  /**
   * 按标签分组节点
   */
  groupNodesByLabel(nodes: NebulaNode[]): Record<string, NebulaNode[]> {
    return nodes.reduce((acc, node) => {
      if (!acc[node.label]) {
        acc[node.label] = [];
      }
      acc[node.label].push(node);
      return acc;
    }, {} as Record<string, NebulaNode[]>);
  }

  /**
   * 按类型分组关系
   */
  groupRelationshipsByType(relationships: NebulaRelationship[]): Record<string, NebulaRelationship[]> {
    return relationships.reduce((acc, relationship) => {
      if (!acc[relationship.type]) {
        acc[relationship.type] = [];
      }
      acc[relationship.type].push(relationship);
      return acc;
    }, {} as Record<string, NebulaRelationship[]>);
  }

  /**
   * 格式化值为Nebula可接受的格式
   */
  formatValue(value: any): string {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    } else if (value === null || value === undefined) {
      return 'NULL';
    } else if (Array.isArray(value)) {
      return `[${value.map(v => this.formatValue(v)).join(',')}]`;
    } else if (typeof value === 'object') {
      // 对于对象，将其转换为JSON字符串
      return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
    } else {
      return `"${String(value)}"`;
    }
  }

  /**
   * 从项目路径生成空间名称
   */
  private generateSpaceNameFromPath(projectPath: string): string {
    // 将路径转换为有效的空间名称
    return projectPath
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }
}