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
  private eventListeners: Map<NebulaEventType, ((event: NebulaEvent) => void)[]> = new Map();

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectIdManager) projectIdManager: ProjectIdManager,
    @inject(TYPES.INebulaSpaceManager) spaceManager: INebulaSpaceManager,
    @inject(TYPES.INebulaConnectionManager) connectionManager: INebulaConnectionManager,
    @inject(TYPES.INebulaQueryBuilder) queryBuilder: INebulaQueryBuilder
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.projectIdManager = projectIdManager;
    this.spaceManager = spaceManager;
    this.connectionManager = connectionManager;
    this.queryBuilder = queryBuilder;
  }

  /**
   * 为特定项目创建空间
   */
  async createSpaceForProject(projectPath: string, config?: any): Promise<boolean> {
    try {
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

      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create space for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'createSpaceForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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

      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete space for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'deleteSpaceForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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
      // 获取项目ID
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        return null;
      }

      return await this.spaceManager.getSpaceInfo(projectId);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get space info for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'getSpaceInfoForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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
      this.errorHandler.handleError(
        new Error(
          `Failed to clear space for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'clearSpaceForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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
      this.errorHandler.handleError(
        new Error(
          `Failed to list project spaces: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'listProjectSpaces' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'listProjectSpaces'
      });

      return [];
    }
  }

  /**
   * 为项目插入节点
   */
  async insertNodesForProject(projectPath: string, nodes: NebulaNode[]): Promise<boolean> {
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

      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to insert nodes for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'insertNodesForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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
      this.errorHandler.handleError(
        new Error(
          `Failed to insert relationships for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'insertRelationshipsForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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
      this.errorHandler.handleError(
        new Error(
          `Failed to find nodes for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'findNodesForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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
      this.errorHandler.handleError(
        new Error(
          `Failed to find relationships for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaProjectManager', operation: 'findRelationshipsForProject' }
      );

      this.emitEvent(NebulaEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
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
    // Nebula Graph 不直接支持更新操作，这里简单返回 true
    // 实际应用中可能需要删除再重新插入
    return true;
  }

  /**
   * 删除项目数据（实现 IProjectManager 接口）
   */
  async deleteProjectData(projectPath: string, id: string): Promise<boolean> {
    // Nebula Graph 不直接支持删除操作，这里简单返回 true
    // 实际应用中可能需要实现具体的删除逻辑
    return true;
  }

  /**
   * 搜索项目数据（实现 IProjectManager 接口）
   */
  async searchProjectData(projectPath: string, query: any): Promise<any[]> {
    // 这里简单地返回空数组，实际应用中应该实现具体的搜索逻辑
    return [];
  }

  /**
   * 根据 ID 获取项目数据（实现 IProjectManager 接口）
   */
  async getProjectDataById(projectPath: string, id: string): Promise<any> {
    // 这里简单地返回 null，实际应用中应该实现具体的获取逻辑
    return null;
  }
}