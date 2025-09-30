import { injectable, inject } from 'inversify';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { TYPES } from '../types';
import { ProjectIdManager } from './ProjectIdManager';
import { IQdrantCollectionManager } from './QdrantCollectionManager';
import { IQdrantVectorOperations } from './QdrantVectorOperations';
import { IQdrantQueryUtils } from './QdrantQueryUtils';
import { 
  VectorPoint, 
  CollectionInfo, 
  SearchOptions, 
  SearchResult 
} from './IVectorStore';
import { 
  VectorDistance,
  ProjectInfo,
  ERROR_MESSAGES,
  QdrantEventType,
  QdrantEvent
} from './QdrantTypes';

/**
 * Qdrant 项目管理器接口
 */
export interface IQdrantProjectManager {
  createCollectionForProject(projectPath: string, vectorSize: number, distance?: VectorDistance): Promise<boolean>;
  upsertVectorsForProject(projectPath: string, vectors: VectorPoint[]): Promise<boolean>;
  searchVectorsForProject(projectPath: string, query: number[], options?: SearchOptions): Promise<SearchResult[]>;
  getCollectionInfoForProject(projectPath: string): Promise<CollectionInfo | null>;
  deleteCollectionForProject(projectPath: string): Promise<boolean>;
  getProjectInfo(projectPath: string): Promise<ProjectInfo | null>;
  listProjects(): Promise<ProjectInfo[]>;
  deleteVectorsForProject(projectPath: string, vectorIds: string[]): Promise<boolean>;
  clearProject(projectPath: string): Promise<boolean>;
  addEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void;
  removeEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void;
}

/**
 * Qdrant 项目管理器实现
 * 
 * 负责项目相关的集合操作、项目ID管理、项目特定的向量操作
 */
@injectable()
export class QdrantProjectManager implements IQdrantProjectManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private projectIdManager: ProjectIdManager;
  private collectionManager: IQdrantCollectionManager;
  private vectorOperations: IQdrantVectorOperations;
  private queryUtils: IQdrantQueryUtils;
  private eventListeners: Map<QdrantEventType, ((event: QdrantEvent) => void)[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectIdManager) projectIdManager: ProjectIdManager,
    @inject(TYPES.IQdrantCollectionManager) collectionManager: IQdrantCollectionManager,
    @inject(TYPES.IQdrantVectorOperations) vectorOperations: IQdrantVectorOperations,
    @inject(TYPES.IQdrantQueryUtils) queryUtils: IQdrantQueryUtils
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.projectIdManager = projectIdManager;
    this.collectionManager = collectionManager;
    this.vectorOperations = vectorOperations;
    this.queryUtils = queryUtils;
  }

  /**
   * 为特定项目创建集合
   */
  async createCollectionForProject(
    projectPath: string, 
    vectorSize: number, 
    distance: VectorDistance = 'Cosine'
  ): Promise<boolean> {
    try {
      // 生成项目ID并获取集合名称
      const projectId = await this.projectIdManager.generateProjectId(projectPath);
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      
      if (!collectionName) {
        throw new Error(`Failed to generate collection name for project: ${projectPath}`);
      }

      const success = await this.collectionManager.createCollection(collectionName, vectorSize, distance);
      
      if (success) {
        this.emitEvent(QdrantEventType.COLLECTION_CREATED, {
          projectPath,
          projectId,
          collectionName,
          vectorSize,
          distance
        });
      }
      
      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create collection for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'createCollectionForProject' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'createCollectionForProject',
        projectPath
      });
      
      return false;
    }
  }

  /**
   * 为特定项目插入或更新向量
   */
  async upsertVectorsForProject(projectPath: string, vectors: VectorPoint[]): Promise<boolean> {
    try {
      // 获取项目ID和集合名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }
      
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectPath}`);
      }

      // 为所有向量添加项目ID（如果尚未存在）
      const vectorsWithProjectId = vectors.map(vector => ({
        ...vector,
        payload: {
          ...vector.payload,
          projectId
        }
      }));

      const success = await this.vectorOperations.upsertVectors(collectionName, vectorsWithProjectId);
      
      if (success) {
        this.emitEvent(QdrantEventType.VECTORS_UPSERTED, {
          projectPath,
          projectId,
          collectionName,
          vectorCount: vectors.length
        });
      }
      
      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to upsert vectors for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'upsertVectorsForProject' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'upsertVectorsForProject',
        projectPath
      });
      
      return false;
    }
  }

  /**
   * 在特定项目的集合中搜索向量
   */
  async searchVectorsForProject(
    projectPath: string, 
    query: number[], 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // 获取项目ID和集合名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }
      
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectPath}`);
      }

      // 确保应用projectId过滤器
      const searchFilter = {
        ...options.filter,
        projectId
      };
      
      const searchOptions = {
        ...options,
        filter: this.queryUtils.buildFilter(searchFilter)
      };

      const results = await this.vectorOperations.searchVectors(collectionName, query, searchOptions);
      
      this.emitEvent(QdrantEventType.VECTORS_SEARCHED, {
        projectPath,
        projectId,
        collectionName,
        queryLength: query.length,
        resultsCount: results.length,
        searchOptions
      });
      
      return results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to search vectors for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'searchVectorsForProject' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'searchVectorsForProject',
        projectPath
      });
      
      return [];
    }
  }

  /**
   * 获取特定项目的集合信息
   */
  async getCollectionInfoForProject(projectPath: string): Promise<CollectionInfo | null> {
    try {
      // 获取项目ID和集合名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }
      
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectPath}`);
      }

      return await this.collectionManager.getCollectionInfo(collectionName);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get collection info for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'getCollectionInfoForProject' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'getCollectionInfoForProject',
        projectPath
      });
      
      return null;
    }
  }

  /**
   * 删除特定项目的集合
   */
  async deleteCollectionForProject(projectPath: string): Promise<boolean> {
    try {
      // 获取项目ID和集合名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }
      
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectPath}`);
      }

      const success = await this.collectionManager.deleteCollection(collectionName);
      
      if (success) {
        // 删除项目ID映射
        this.projectIdManager.removeProject(projectPath);
        
        this.emitEvent(QdrantEventType.COLLECTION_DELETED, {
          projectPath,
          projectId,
          collectionName
        });
      }
      
      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete collection for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'deleteCollectionForProject' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'deleteCollectionForProject',
        projectPath
      });
      
      return false;
    }
  }

  /**
   * 获取项目信息
   */
  async getProjectInfo(projectPath: string): Promise<ProjectInfo | null> {
    try {
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        return null;
      }
      
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        return null;
      }

      const collectionInfo = await this.collectionManager.getCollectionInfo(collectionName);
      
      return {
        id: projectId,
        path: projectPath,
        collectionName,
        vectorSize: collectionInfo?.vectors.size,
        distance: collectionInfo?.vectors.distance
      };
    } catch (error) {
      this.logger.warn('Failed to get project info', {
        projectPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 列出所有项目
   */
  async listProjects(): Promise<ProjectInfo[]> {
    try {
      const projectPaths = this.projectIdManager.listAllProjectPaths();
      const projects: ProjectInfo[] = [];

      for (const projectPath of projectPaths) {
        const projectInfo = await this.getProjectInfo(projectPath);
        if (projectInfo) {
          projects.push(projectInfo);
        }
      }

      return projects;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'listProjects' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'listProjects'
      });
      
      return [];
    }
  }

  /**
   * 删除项目中的特定向量
   */
  async deleteVectorsForProject(projectPath: string, vectorIds: string[]): Promise<boolean> {
    try {
      // 获取项目ID和集合名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }
      
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectPath}`);
      }

      const success = await this.vectorOperations.deletePoints(collectionName, vectorIds);
      
      if (success) {
        this.emitEvent(QdrantEventType.POINTS_DELETED, {
          projectPath,
          projectId,
          collectionName,
          deletedCount: vectorIds.length,
          vectorIds
        });
      }
      
      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete vectors for project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'deleteVectorsForProject' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'deleteVectorsForProject',
        projectPath
      });
      
      return false;
    }
  }

  /**
   * 清空项目
   */
  async clearProject(projectPath: string): Promise<boolean> {
    try {
      // 获取项目ID和集合名称
      const projectId = await this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
      }
      
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectPath}`);
      }

      const success = await this.vectorOperations.clearCollection(collectionName);
      
      if (success) {
        this.emitEvent(QdrantEventType.POINTS_DELETED, {
          projectPath,
          projectId,
          collectionName,
          cleared: true
        });
      }
      
      return success;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to clear project ${projectPath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantProjectManager', operation: 'clearProject' }
      );
      
      this.emitEvent(QdrantEventType.ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'clearProject',
        projectPath
      });
      
      return false;
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void {
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
  private emitEvent(type: QdrantEventType, data?: any, error?: Error): void {
    const event: QdrantEvent = {
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
          this.logger.error('Error in event listener', {
            eventType: type,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      });
    }
  }
}