import { injectable, inject } from 'inversify';
import { DatabaseLoggerService } from '../common/DatabaseLoggerService';
import { DatabaseEventType } from '../common/DatabaseEventTypes';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { TYPES } from '../../types';
import { ProjectIdManager } from '../ProjectIdManager';
import { INebulaSpaceManager } from './space/NebulaSpaceManager';
import { INebulaConnectionManager } from './NebulaConnectionManager';
import { INebulaQueryBuilder } from './NebulaQueryBuilder';
import { IProjectManager } from '../common/IDatabaseService';
import { DatabaseError, DatabaseErrorType } from '../common/DatabaseError';
import { DatabaseServiceValidator } from '../common/DatabaseServiceValidator';
import { PerformanceMonitor } from '../common/PerformanceMonitor';
import {
  NebulaNode,
  NebulaRelationship,
  NebulaSpaceInfo,
  ProjectSpaceInfo,
  NebulaEventType,
  NebulaEvent
} from './NebulaTypes';

/**
 * Nebula 项目管理器接口
 */
export interface INebulaProjectManager extends IProjectManager {
  createSpaceForProject(projectPath: string, config?: any): Promise<boolean>;
  deleteSpaceForProject(projectPath: string): Promise<boolean>;
  getSpaceInfoForProject(projectPath: string): Promise<NebulaSpaceInfo | null>;
  clearSpaceForProject(projectPath: string): Promise<boolean>;
  listProjectSpaces(): Promise<ProjectSpaceInfo[]>;
  insertNodesForProject(projectPath: string, nodes: NebulaNode[]): Promise<boolean>;
  insertRelationshipsForProject(projectPath: string, relationships: NebulaRelationship[]): Promise<boolean>;
  findNodesForProject(projectPath: string, label: string, filter?: any): Promise<any[]>;
  findRelationshipsForProject(projectPath: string, type?: string, filter?: any): Promise<any[]>;
  addEventListener(type: NebulaEventType, listener: (event: NebulaEvent) => void): void;
  removeEventListener(type: NebulaEventType, listener: (event: NebulaEvent) => void): void;
}

/**
 * Nebula 项目管理器实现
 * 
 * 负责项目相关的空间操作、项目ID管理、项目特定的图数据操作
 */
@injectable()
export class NebulaProjectManager implements INebulaProjectManager {
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private projectIdManager: ProjectIdManager;
  private spaceManager: INebulaSpaceManager;
 private connectionManager: INebulaConnectionManager;
  private queryBuilder: INebulaQueryBuilder;
  private performanceMonitor: PerformanceMonitor;
  private eventListeners: Map<NebulaEventType, ((event: NebulaEvent) => void)[]> = new Map();

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectIdManager) projectIdManager: ProjectIdManager,
    @inject(TYPES.INebulaSpaceManager) spaceManager: INebulaSpaceManager,
    @inject(TYPES.INebulaConnectionManager) connectionManager: INebulaConnectionManager,
    @inject(TYPES.INebulaQueryBuilder) queryBuilder: INebulaQueryBuilder,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.projectIdManager = projectIdManager;
    this.spaceManager = spaceManager;
    this.connectionManager = connectionManager;
    this.queryBuilder = queryBuilder;
    this.performanceMonitor = performanceMonitor;
 }

  /**
   * 为特定项目创建空间
   */
  async createSpaceForProject(projectPath: string, config?: any): Promise<boolean> {
    const startTime = Date.now();
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      DatabaseServiceValidator.validateConfig(config);
      
      // 生成项目ID并获取空间名称
      const projectId = await this.projectIdManager.generateProjectId(projectPath);
      const spaceName = this.projectIdManager.getSpaceName(projectId);

      if (!spaceName) {
        throw new Error(`Failed to generate space name for project: ${projectPath}`);
      }

      const success = await this.spaceManager.createSpace(projectId, config);

      if (success) {
        this.emitEvent(NebulaEventType.SPACE_CREATED, {
          projectPath,
          projectId,
          spaceName,
          config
        });
      }

      // 记录性能指标
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordOperation('createSpaceForProject', duration, {
        projectPath,
        config: !!config
      });

      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'createSpaceForProject',
          details: { projectPath, config }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'createSpaceForProject',
        projectPath
      });

      return false;
    }
 }

  /**
   * 删除项目的空间
   */
  async deleteSpaceForProject(projectPath: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }

      const success = await this.spaceManager.deleteSpace(projectId);

      if (success) {
        // 删除项目ID映射
        this.projectIdManager.removeProject(projectPath);

        this.emitEvent(NebulaEventType.SPACE_DELETED, {
          projectPath,
          projectId,
          spaceName
        });
      }

      // 记录性能指标
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordOperation('deleteSpaceForProject', duration, {
        projectPath
      });

      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'deleteSpaceForProject',
          details: { projectPath }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'deleteSpaceForProject',
        projectPath
      });

      return false;
    }
  }

  /**
   * 获取项目的空间信息
   */
  async getSpaceInfoForProject(projectPath: string): Promise<NebulaSpaceInfo | null> {
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      
      // 获取项目ID
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        return null;
      }

      return await this.spaceManager.getSpaceInfo(projectId);
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'getSpaceInfoForProject',
          details: { projectPath }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'getSpaceInfoForProject',
        projectPath
      });

      return null;
    }
  }

  /**
   * 清空项目的空间
   */
  async clearSpaceForProject(projectPath: string): Promise<boolean> {
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      
      // 获取项目ID
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }

      const success = await this.spaceManager.clearSpace(projectId);

      if (success) {
        this.emitEvent(NebulaEventType.SPACE_DELETED, {
          projectPath,
          projectId,
          spaceName,
          cleared: true
        });
      }

      return success;
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'clearSpaceForProject',
          details: { projectPath }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'clearSpaceForProject',
        projectPath
      });

      return false;
    }
  }

  /**
   * 列出所有项目空间
   */
  async listProjectSpaces(): Promise<ProjectSpaceInfo[]> {
    try {
      const projectPaths = this.projectIdManager.listAllProjectPaths();
      const projectSpaces: ProjectSpaceInfo[] = [];
      const seenSpaceNames = new Set<string>(); // 防止重复的空间

      for (const projectPath of projectPaths) {
        const projectId = this.projectIdManager.getProjectId(projectPath);
        if (!projectId) {
          continue;
        }

        const spaceName = this.projectIdManager.getSpaceName(projectId);
        if (!spaceName || seenSpaceNames.has(spaceName)) {
          continue; // 跳过无效或已处理的空间名称
        }

        const spaceInfo = await this.spaceManager.getSpaceInfo(projectId);
        if (spaceInfo) {
          seenSpaceNames.add(spaceName); // 标记空间名称为已处理
          projectSpaces.push({
            projectPath,
            spaceName,
            spaceInfo,
            createdAt: this.projectIdManager.getProjectsByUpdateTime().find(
              p => p.projectId === projectId
            )?.updateTime || new Date(),
            updatedAt: new Date()
          });
        }
      }

      return projectSpaces;
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'listProjectSpaces',
          details: {}
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'listProjectSpaces'
      });

      return [];
    }
  }

  /**
   * 为项目插入节点
   */
  async insertNodesForProject(projectPath: string, nodes: NebulaNode[]): Promise<boolean> {
    const startTime = Date.now();
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      DatabaseServiceValidator.validateNodes(nodes);
      
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      // 为所有节点添加项目ID（如果尚未存在）
      const nodesWithProjectId = nodes.map(node => ({
        ...node,
        properties: {
          ...node.properties,
          projectId
        }
      }));

      // 按标签分组节点
      const nodesByLabel = nodesWithProjectId.reduce((acc, node) => {
        if (!acc[node.label]) {
          acc[node.label] = [];
        }
        acc[node.label].push(node);
        return acc;
      }, {} as Record<string, NebulaNode[]>);

      // 为每个标签创建批量插入语句
      const queries: Array<{ query: string; params: Record<string, any> }> = [];

      for (const [label, labelNodes] of Object.entries(nodesByLabel)) {
        const query = `
          INSERT VERTEX ${label}(${Object.keys(labelNodes[0].properties).join(', ')})
          VALUES ${labelNodes.map(node =>
          `"${node.id}": (${Object.values(node.properties).map(val =>
            typeof val === 'string' ? `"${val}"` : val
          ).join(', ')})`
        ).join(', ')}
        `;

        queries.push({ query, params: {} });
      }

      // 在项目空间中执行事务，先USE空间，然后执行查询
      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      const results = await Promise.all(queries.map(q =>
        this.connectionManager.executeQuery(q.query, q.params)
      ));
      const success = results.every(result => !result.error);

      if (success) {
        this.emitEvent(NebulaEventType.NODE_INSERTED, {
          projectPath,
          projectId,
          spaceName,
          nodeCount: nodes.length
        });
      }

      // 记录性能指标
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordOperation('insertNodesForProject', duration, {
        projectPath,
        nodeCount: nodes.length,
        queryCount: queries.length
      });

      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'insertNodesForProject',
          details: { projectPath, nodeCount: nodes.length }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'insertNodesForProject',
        projectPath
      });

      return false;
    }
  }

  /**
   * 为项目插入关系
   */
  async insertRelationshipsForProject(projectPath: string, relationships: NebulaRelationship[]): Promise<boolean> {
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      DatabaseServiceValidator.validateRelationships(relationships);
      
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      // 为所有关系添加项目ID（如果尚未存在）
      const relationshipsWithProjectId = relationships.map(rel => ({
        ...rel,
        properties: {
          ...rel.properties,
          projectId
        }
      }));

      // 按类型分组关系
      const relationshipsByType = relationshipsWithProjectId.reduce((acc, relationship) => {
        if (!acc[relationship.type]) {
          acc[relationship.type] = [];
        }
        acc[relationship.type].push(relationship);
        return acc;
      }, {} as Record<string, NebulaRelationship[]>);

      // 为每个类型创建批量插入语句
      const queries: Array<{ query: string; params: Record<string, any> }> = [];

      for (const [type, typeRelationships] of Object.entries(relationshipsByType)) {
        const query = `
          INSERT EDGE ${type}(${typeRelationships[0].properties ? Object.keys(typeRelationships[0].properties).join(', ') : ''})
          VALUES ${typeRelationships.map(rel =>
          `"${rel.sourceId}" -> "${rel.targetId}": ${rel.properties ?
            `(${Object.values(rel.properties).map(val =>
              typeof val === 'string' ? `"${val}"` : val
            ).join(', ')})` : '()'
          }`
        ).join(', ')}
        `;

        queries.push({ query, params: {} });
      }

      // 在项目空间中执行事务，先USE空间，然后执行查询
      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      const results = await Promise.all(queries.map(q =>
        this.connectionManager.executeQuery(q.query, q.params)
      ));
      const success = results.every(result => !result.error);

      if (success) {
        this.emitEvent(NebulaEventType.RELATIONSHIP_INSERTED, {
          projectPath,
          projectId,
          spaceName,
          relationshipCount: relationships.length
        });
      }

      return success;
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'insertRelationshipsForProject',
          details: { projectPath, relationshipCount: relationships.length }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'insertRelationshipsForProject',
        projectPath
      });

      return false;
    }
  }

  /**
   * 在项目中查找节点
   */
  async findNodesForProject(projectPath: string, label: string, filter?: any): Promise<any[]> {
    try {
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      // 构建查询
      let query = `MATCH (v:${label}) WHERE v.projectId == "${projectId}" RETURN v`;

      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) =>
          `v.${key} == ${typeof value === 'string' ? `"${value}"` : value}`
        ).join(' AND ');
        query += ` AND ${conditions}`;
      }

      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      const result = await this.connectionManager.executeQuery(query);

      this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
        projectPath,
        projectId,
        spaceName,
        query,
        resultsCount: result.data?.length || 0
      });

      return result.data || [];
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'findNodesForProject',
          details: { projectPath, label, filter }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'findNodesForProject',
        projectPath
      });

      return [];
    }
  }

  /**
   * 在项目中查找关系
   */
  async findRelationshipsForProject(projectPath: string, type?: string, filter?: any): Promise<any[]> {
    try {
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      // 构建查询
      let query = `MATCH () -[e${type ? `:${type}` : ''}]-> () WHERE e.projectId == "${projectId}" RETURN e`;

      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) =>
          `e.${key} == ${typeof value === 'string' ? `"${value}"` : value}`
        ).join(' AND ');
        query += ` AND ${conditions}`;
      }

      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      const result = await this.connectionManager.executeQuery(query);

      this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
        projectPath,
        projectId,
        spaceName,
        query,
        resultsCount: result.data?.length || 0
      });

      return result.data || [];
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'findRelationshipsForProject',
          details: { projectPath, type, filter }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'findRelationshipsForProject',
        projectPath
      });

      return [];
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(type: NebulaEventType, listener: (event: NebulaEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: NebulaEventType, listener: (event: NebulaEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发射事件
   */
  private emitEvent(type: NebulaEventType, data?: any, error?: Error): void {
    const event: NebulaEvent = {
      type,
      timestamp: new Date(),
      data,
      error
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          // 使用 DatabaseLoggerService 记录事件监听器中的错误
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.ERROR_OCCURRED,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: 'Error in event listener',
              eventType: type,
              error: err instanceof Error ? err.message : String(err)
            }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log event listener error:', error);
          });
        }
      });
    }
  }

  /**
   * 创建项目空间（实现 IProjectManager 接口）
   */
  async createProjectSpace(projectPath: string, config?: any): Promise<boolean> {
    return this.createSpaceForProject(projectPath, config);
  }

  /**
   * 删除项目空间（实现 IProjectManager 接口）
   */
  async deleteProjectSpace(projectPath: string): Promise<boolean> {
    return this.deleteSpaceForProject(projectPath);
  }

  /**
   * 获取项目空间信息（实现 IProjectManager 接口）
   */
  async getProjectSpaceInfo(projectPath: string): Promise<any> {
    return this.getSpaceInfoForProject(projectPath);
  }

  /**
   * 清空项目空间（实现 IProjectManager 接口）
   */
  async clearProjectSpace(projectPath: string): Promise<boolean> {
    return this.clearSpaceForProject(projectPath);
  }

  /**
   * 插入项目数据（实现 IProjectManager 接口）
   */
  async insertProjectData(projectPath: string, data: any): Promise<boolean> {
    // 这里假设 data 包含节点和关系数据
    if (data.nodes && Array.isArray(data.nodes)) {
      const success = await this.insertNodesForProject(projectPath, data.nodes);
      if (!success) return false;
    }

    if (data.relationships && Array.isArray(data.relationships)) {
      return this.insertRelationshipsForProject(projectPath, data.relationships);
    }

    return true;
  }

  /**
   * 更新项目数据（实现 IProjectManager 接口）
   */
  async updateProjectData(projectPath: string, id: string, data: any): Promise<boolean> {
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      DatabaseServiceValidator.validateId(id);
      DatabaseServiceValidator.validateData(data);
      
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      // 检查ID是否对应节点或关系
      // 首先尝试查找节点
      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      let result = await this.connectionManager.executeQuery(`MATCH (v) WHERE id(v) == "${id}" RETURN v LIMIT 1`);
      
      if (result.data && result.data.length > 0) {
        // 这是一个节点，需要更新节点属性
        const updateProperties = Object.entries(data.properties || data)
          .map(([key, value]) => `${key} = ${typeof value === 'string' ? `"${value}"` : value}`)
          .join(', ');
        
        if (updateProperties) {
          const updateQuery = `UPDATE VERTEX "${id}" SET ${updateProperties}`;
          await this.connectionManager.executeQuery(updateQuery);
        }
        
        this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
          projectPath,
          projectId,
          spaceName,
          nodeId: id,
          updatedProperties: data.properties || data,
          operation: 'node_update'
        });
        
        return true;
      } else {
        // 尝试查找关系
        result = await this.connectionManager.executeQuery(
          `MATCH ()-[e]->() WHERE id(e) == "${id}" RETURN e LIMIT 1`
        );
        
        if (result.data && result.data.length > 0) {
          // 这是一个关系，需要更新关系属性
          const updateProperties = Object.entries(data.properties || data)
            .map(([key, value]) => `${key} = ${typeof value === 'string' ? `"${value}"` : value}`)
            .join(', ');
          
          if (updateProperties) {
            const updateQuery = `UPDATE EDGE "${id}" SET ${updateProperties}`;
            await this.connectionManager.executeQuery(updateQuery);
          }
          
          this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
            projectPath,
            projectId,
            spaceName,
            edgeId: id,
            updatedProperties: data.properties || data,
            operation: 'relationship_update'
          });
          
          return true;
        } else {
          // 未找到指定ID的节点或关系
          throw new Error(`Node or relationship with ID ${id} not found in project ${projectPath}`);
        }
      }
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'updateProjectData',
          details: { projectPath, id, data }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'updateProjectData',
        projectPath,
        id
      });

      return false;
    }
  }

  /**
   * 删除项目数据（实现 IProjectManager 接口）
   */
  async deleteProjectData(projectPath: string, id: string): Promise<boolean> {
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      DatabaseServiceValidator.validateId(id);
      
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      
      // 检查ID是否对应节点或关系
      // 首先尝试查找节点
      let result = await this.connectionManager.executeQuery(`MATCH (v) WHERE id(v) == "${id}" RETURN v LIMIT 1`);
      
      if (result.data && result.data.length > 0) {
        // 这是一个节点，删除节点及其关联的关系
        const deleteQuery = `DELETE VERTEX "${id}" WITH EDGE`;
        await this.connectionManager.executeQuery(deleteQuery);
        
        this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
          projectPath,
          projectId,
          spaceName,
          nodeId: id,
          operation: 'node_delete'
        });
        
        return true;
      } else {
        // 尝试查找关系
        result = await this.connectionManager.executeQuery(
          `MATCH ()-[e]->() WHERE id(e) == "${id}" RETURN e LIMIT 1`
        );
        
        if (result.data && result.data.length > 0) {
          // 这是一个关系，删除关系
          const deleteQuery = `DELETE EDGE "${id}"`;
          await this.connectionManager.executeQuery(deleteQuery);
          
          this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
            projectPath,
            projectId,
            spaceName,
            edgeId: id,
            operation: 'relationship_delete'
          });
          
          return true;
        } else {
          // 未找到指定ID的节点或关系
          throw new Error(`Node or relationship with ID ${id} not found in project ${projectPath}`);
        }
      }
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'deleteProjectData',
          details: { projectPath, id }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'deleteProjectData',
        projectPath,
        id
      });

      return false;
    }
  }

  /**
   * 搜索项目数据（实现 IProjectManager 接口）
   */
  async searchProjectData(projectPath: string, query: any): Promise<any[]> {
    const startTime = Date.now();
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      DatabaseServiceValidator.validateQuery(query);
      
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      
      // 根据查询类型构建不同的搜索语句
      let searchQuery = '';
      let params = {};
      
      if (typeof query === 'string') {
        // 如果是字符串查询，直接执行
        searchQuery = query;
      } else if (query.type === 'node') {
        // 搜索节点
        const label = query.label || '*';
        const filter = query.filter || {};
        
        searchQuery = `MATCH (v${label !== '*' ? `:${label}` : ''}) WHERE v.projectId == "${projectId}"`;
        
        const conditions = [];
        for (const [key, value] of Object.entries(filter)) {
          conditions.push(`v.${key} == ${typeof value === 'string' ? `"${value}"` : value}`);
        }
        
        if (conditions.length > 0) {
          searchQuery += ` AND ${conditions.join(' AND ')}`;
        }
        
        searchQuery += ' RETURN v';
      } else if (query.type === 'relationship') {
        // 搜索关系
        const type = query.relationshipType || '*';
        const filter = query.filter || {};
        
        searchQuery = `MATCH ()-[e${type !== '*' ? `:${type}` : ''}]->() WHERE e.projectId == "${projectId}"`;
        
        const conditions = [];
        for (const [key, value] of Object.entries(filter)) {
          conditions.push(`e.${key} == ${typeof value === 'string' ? `"${value}"` : value}`);
        }
        
        if (conditions.length > 0) {
          searchQuery += ` AND ${conditions.join(' AND ')}`;
        }
        
        searchQuery += ' RETURN e';
      } else if (query.type === 'graph') {
        // 图遍历查询
        const startNode = query.startNode || null;
        const pathLength = query.pathLength || 1;
        const direction = query.direction || 'BOTH';
        
        if (startNode) {
          searchQuery = `MATCH (start) WHERE id(start) == "${startNode}" `;
          searchQuery += `MATCH p = (start)-[:*${direction} ${pathLength}]->(end) `;
          searchQuery += `WHERE ANY(n IN nodes(p) WHERE n.projectId == "${projectId}") `;
          searchQuery += 'RETURN p';
        } else {
          searchQuery = `MATCH (n) WHERE n.projectId == "${projectId}" `;
          searchQuery += `MATCH p = (n)-[:*${direction} ${pathLength}]->(m) `;
          searchQuery += 'RETURN p';
        }
      } else {
        // 默认搜索：查找项目中的所有节点和关系
        searchQuery = `MATCH (v) WHERE v.projectId == "${projectId}" RETURN v`;
      }

      const result = await this.connectionManager.executeQuery(searchQuery, params);
      
      // 记录性能指标
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordOperation('searchProjectData', duration, {
        projectPath,
        queryType: typeof query === 'object' ? query.type : 'string',
        resultsCount: result.data?.length || 0
      });
      
      this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
        projectPath,
        projectId,
        spaceName,
        query,
        resultsCount: result.data?.length || 0,
        operation: 'search',
        duration
      });

      return result.data || [];
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'searchProjectData',
          details: { projectPath, query }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'searchProjectData',
        projectPath
      });

      return [];
    }
 }

  /**
   * 根据 ID 获取项目数据（实现 IProjectManager 接口）
   */
  async getProjectDataById(projectPath: string, id: string): Promise<any> {
    try {
      // 验证输入参数
      DatabaseServiceValidator.validateProjectPath(projectPath);
      DatabaseServiceValidator.validateId(id);
      
      // 获取项目ID和空间名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }

      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) {
        throw new Error(`Space name not found for project: ${projectPath}`);
      }
      
      // 验证空间名称的有效性
      if (spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Invalid space name for project: ${projectPath}`);
      }

      await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      
      // 首先尝试查找节点
      let result = await this.connectionManager.executeQuery(`MATCH (v) WHERE id(v) == "${id}" RETURN v LIMIT 1`);
      
      if (result.data && result.data.length > 0) {
        // 找到了节点
        this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
          projectPath,
          projectId,
          spaceName,
          id,
          resultType: 'node',
          operation: 'get_by_id'
        });
        
        return result.data[0];
      } else {
        // 尝试查找关系
        result = await this.connectionManager.executeQuery(
          `MATCH ()-[e]->() WHERE id(e) == "${id}" RETURN e LIMIT 1`
        );
        
        if (result.data && result.data.length > 0) {
          // 找到了关系
          this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
            projectPath,
            projectId,
            spaceName,
            id,
            resultType: 'relationship',
            operation: 'get_by_id'
          });
          
          return result.data[0];
        } else {
          // 未找到指定ID的节点或关系
          this.emitEvent(NebulaEventType.QUERY_EXECUTED, {
            projectPath,
            projectId,
            spaceName,
            id,
            resultType: 'not_found',
            operation: 'get_by_id'
          });
          
          return null;
        }
      }
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'NebulaProjectManager',
          operation: 'getProjectDataById',
          details: { projectPath, id }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: dbError,
        operation: 'getProjectDataById',
        projectPath,
        id
      });

      return null;
    }
  }
}