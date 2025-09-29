import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { IndexSyncService, IndexSyncStatus } from '../index/IndexSyncService';
import { QdrantService } from '../../database/QdrantService';
import { ConfigService } from '../../config/ConfigService';
import fs from 'fs/promises';
import path from 'path';

export interface ProjectState {
  projectId: string;
  projectPath: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'indexing' | 'error';
  createdAt: Date;
  updatedAt: Date;
  lastIndexedAt?: Date;
  indexingProgress?: number;
  totalFiles?: number;
  indexedFiles?: number;
  failedFiles?: number;
  collectionInfo?: {
    name: string;
    vectorsCount: number;
    status: string;
  };
  settings: {
    autoIndex: boolean;
    watchChanges: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    chunkSize?: number;
    chunkOverlap?: number;
  };
  metadata?: Record<string, any>;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  indexingProjects: number;
  totalVectors: number;
  totalFiles: number;
  averageIndexingProgress: number;
}

@injectable()
export class ProjectStateManager {
  private projectStates: Map<string, ProjectState> = new Map();
  private storagePath: string;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.IndexSyncService) private indexSyncService: IndexSyncService,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {
    // 设置存储路径
    this.storagePath = this.configService.get('project')?.statePath || './data/project-states.json';
  }

  /**
   * 初始化项目状态管理器
   */
  async initialize(): Promise<void> {
    try {
      // 加载项目状态
      await this.loadProjectStates();
      
      // 设置索引同步服务监听器
      this.setupIndexSyncListeners();
      
      this.isInitialized = true;
      this.logger.info('Project state manager initialized');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize project state manager: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'initialize' }
      );
      throw error;
    }
  }

  /**
   * 设置索引同步服务监听器
   */
  private setupIndexSyncListeners(): void {
    // 监听索引开始事件
    this.indexSyncService.on?.('indexingStarted', async (projectId: string) => {
      try {
        await this.updateProjectStatus(projectId, 'indexing');
      } catch (error) {
        this.logger.error('Failed to update project status to indexing', { projectId, error });
      }
    });

    // 监听索引进度更新事件
    this.indexSyncService.on?.('indexingProgress', async (projectId: string, progress: number) => {
      try {
        await this.updateProjectIndexingProgress(projectId, progress);
      } catch (error) {
        this.logger.error('Failed to update project indexing progress', { projectId, progress, error });
      }
    });

    // 监听索引完成事件
    this.indexSyncService.on?.('indexingCompleted', async (projectId: string) => {
      try {
        await this.updateProjectStatus(projectId, 'active');
        await this.updateProjectLastIndexed(projectId);
      } catch (error) {
        this.logger.error('Failed to update project status to active', { projectId, error });
        // 即使更新状态失败，也尝试更新最后索引时间
        try {
          await this.updateProjectLastIndexed(projectId);
        } catch (lastIndexedError) {
          this.logger.error('Failed to update project last indexed time', { projectId, error: lastIndexedError });
        }
      }
    });

    // 监听索引错误事件
    this.indexSyncService.on?.('indexingError', async (projectId: string, error: Error) => {
      try {
        await this.updateProjectStatus(projectId, 'error');
        await this.updateProjectMetadata(projectId, { lastError: error.message });
      } catch (updateError) {
        this.logger.error('Failed to update project status to error', { projectId, error: updateError });
        // 即使更新状态失败，也尝试更新元数据
        try {
          await this.updateProjectMetadata(projectId, { lastError: error.message });
        } catch (metadataError) {
          this.logger.error('Failed to update project metadata', { projectId, error: metadataError });
        }
      }
    });
  }

  /**
   * 加载项目状态
   */
  private async loadProjectStates(): Promise<void> {
    try {
      // 确保目录存在
      const dirPath = path.dirname(this.storagePath);
      await fs.mkdir(dirPath, { recursive: true });

      // 读取状态文件
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const states = JSON.parse(data);

      // 恢复项目状态
      this.projectStates = new Map();
      for (const state of states) {
        // 转换日期字符串回Date对象
        state.createdAt = new Date(state.createdAt);
        state.updatedAt = new Date(state.updatedAt);
        if (state.lastIndexedAt) {
          state.lastIndexedAt = new Date(state.lastIndexedAt);
        }

        this.projectStates.set(state.projectId, state);
      }

      this.logger.info(`Loaded ${this.projectStates.size} project states`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 文件不存在，初始化空状态
        this.projectStates = new Map();
        this.logger.info('Project states file does not exist, initializing empty states');
      } else {
        throw error;
      }
    }
  }

  /**
   * 保存项目状态
   */
  private async saveProjectStates(): Promise<void> {
    try {
      // 确保目录存在
      const dirPath = path.dirname(this.storagePath);
      await fs.mkdir(dirPath, { recursive: true });

      // 转换为数组并序列化
      const states = Array.from(this.projectStates.values());
      await fs.writeFile(this.storagePath, JSON.stringify(states, null, 2));

      this.logger.debug(`Saved ${states.length} project states`);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to save project states: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'saveProjectStates' }
      );
      throw error;
    }
  }

  /**
   * 创建或更新项目状态
   */
  async createOrUpdateProjectState(
    projectPath: string,
    options: {
      name?: string;
      description?: string;
      settings?: Partial<ProjectState['settings']>;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<ProjectState> {
    try {
      // 生成或获取项目ID
      const projectId = await this.projectIdManager.generateProjectId(projectPath);
      
      // 检查是否已存在状态
      let state = this.projectStates.get(projectId);
      
      if (state) {
        // 更新现有状态
        state.updatedAt = new Date();
        if (options.name) state.name = options.name;
        if (options.description !== undefined) state.description = options.description;
        if (options.settings) state.settings = { ...state.settings, ...options.settings };
        if (options.metadata) state.metadata = { ...state.metadata, ...options.metadata };
      } else {
        // 创建新状态
        state = {
          projectId,
          projectPath,
          name: options.name || path.basename(projectPath),
          description: options.description,
          status: 'inactive',
          createdAt: new Date(),
          updatedAt: new Date(),
          settings: {
            autoIndex: true,
            watchChanges: true,
            ...options.settings
          },
          metadata: options.metadata || {}
        };
      }

      // 更新集合信息
      await this.updateProjectCollectionInfo(projectId);

      // 保存状态
      this.projectStates.set(projectId, state);
      await this.saveProjectStates();

      this.logger.info(`Project state ${state ? 'updated' : 'created'} for ${projectId}`);
      return state;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to create or update project state: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'createOrUpdateProjectState', projectPath, options }
      );
      throw error;
    }
  }

  /**
   * 获取项目状态
   */
  getProjectState(projectId: string): ProjectState | null {
    return this.projectStates.get(projectId) || null;
  }

  /**
   * 获取所有项目状态
   */
  getAllProjectStates(): ProjectState[] {
    return Array.from(this.projectStates.values());
  }

  /**
   * 根据项目路径获取项目状态
   */
  getProjectStateByPath(projectPath: string): ProjectState | null {
    const projectId = this.projectIdManager.getProjectId(projectPath);
    return projectId ? this.getProjectState(projectId) : null;
  }

  /**
   * 更新项目状态
   */
  private async updateProjectStatus(projectId: string, status: ProjectState['status']): Promise<void> {
    const state = this.projectStates.get(projectId);
    if (!state) return;

    state.status = status;
    state.updatedAt = new Date();
    
    this.projectStates.set(projectId, state);
    await this.saveProjectStates();

    this.logger.debug(`Updated project status for ${projectId}: ${status}`);
  }

  /**
   * 更新项目索引进度
   */
  private async updateProjectIndexingProgress(projectId: string, progress: number): Promise<void> {
    const state = this.projectStates.get(projectId);
    if (!state) return;

    state.indexingProgress = progress;
    state.updatedAt = new Date();
    
    this.projectStates.set(projectId, state);
    await this.saveProjectStates();

    this.logger.debug(`Updated indexing progress for ${projectId}: ${progress}%`);
  }

  /**
   * 更新项目最后索引时间
   */
  private async updateProjectLastIndexed(projectId: string): Promise<void> {
    const state = this.projectStates.get(projectId);
    if (!state) return;

    state.lastIndexedAt = new Date();
    state.updatedAt = new Date();
    
    // 从索引同步服务获取索引统计信息
    const indexStatus = this.indexSyncService.getIndexStatus(projectId);
    if (indexStatus) {
      state.totalFiles = indexStatus.totalFiles;
      state.indexedFiles = indexStatus.indexedFiles;
      state.failedFiles = indexStatus.failedFiles;
    }

    this.projectStates.set(projectId, state);
    await this.saveProjectStates();

    this.logger.debug(`Updated last indexed time for ${projectId}`);
  }

  /**
   * 更新项目元数据
   */
  private async updateProjectMetadata(projectId: string, metadata: Record<string, any>): Promise<void> {
    const state = this.projectStates.get(projectId);
    if (!state) return;

    state.metadata = { ...state.metadata, ...metadata };
    state.updatedAt = new Date();
    
    this.projectStates.set(projectId, state);
    await this.saveProjectStates();

    this.logger.debug(`Updated metadata for ${projectId}`);
  }

  /**
   * 更新项目集合信息
   */
  private async updateProjectCollectionInfo(projectId: string): Promise<void> {
    const state = this.projectStates.get(projectId);
    if (!state) return;

    try {
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) return;

      const collectionInfo = await this.qdrantService.getCollectionInfoForProject(projectPath);
      if (collectionInfo) {
        state.collectionInfo = {
          name: collectionInfo.name,
          vectorsCount: collectionInfo.pointsCount,
          status: collectionInfo.status
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to update collection info for ${projectId}`, { error });
    }
  }

  /**
   * 删除项目状态
   */
  async deleteProjectState(projectId: string): Promise<boolean> {
    try {
      const state = this.projectStates.get(projectId);
      if (!state) {
        return false;
      }

      // 从映射中删除
      this.projectStates.delete(projectId);
      
      // 保存状态
      await this.saveProjectStates();

      this.logger.info(`Deleted project state for ${projectId}`);
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to delete project state: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'deleteProjectState', projectId }
      );
      return false;
    }
  }

  /**
   * 获取项目统计信息
   */
  getProjectStats(): ProjectStats {
    const states = Array.from(this.projectStates.values());
    
    const totalProjects = states.length;
    const activeProjects = states.filter(s => s.status === 'active').length;
    const indexingProjects = states.filter(s => s.status === 'indexing').length;
    const totalVectors = states.reduce((sum, s) => sum + (s.collectionInfo?.vectorsCount || 0), 0);
    const totalFiles = states.reduce((sum, s) => sum + (s.totalFiles || 0), 0);
    const averageIndexingProgress = states.length > 0 
      ? states.reduce((sum, s) => sum + (s.indexingProgress || 0), 0) / states.length 
      : 0;

    return {
      totalProjects,
      activeProjects,
      indexingProjects,
      totalVectors,
      totalFiles,
      averageIndexingProgress
    };
  }

  /**
   * 激活项目
   */
  async activateProject(projectId: string): Promise<boolean> {
    try {
      const state = this.projectStates.get(projectId);
      if (!state) {
        return false;
      }

      await this.updateProjectStatus(projectId, 'active');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to activate project: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'activateProject', projectId }
      );
      return false;
    }
  }

  /**
   * 停用项目
   */
  async deactivateProject(projectId: string): Promise<boolean> {
    try {
      const state = this.projectStates.get(projectId);
      if (!state) {
        return false;
      }

      await this.updateProjectStatus(projectId, 'inactive');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to deactivate project: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'deactivateProject', projectId }
      );
      return false;
    }
  }

  /**
   * 刷新项目状态
   */
  async refreshProjectState(projectId: string): Promise<ProjectState | null> {
    try {
      const state = this.projectStates.get(projectId);
      if (!state) {
        return null;
      }

      // 更新集合信息
      await this.updateProjectCollectionInfo(projectId);
      
      // 更新时间戳
      state.updatedAt = new Date();
      
      // 保存状态
      this.projectStates.set(projectId, state);
      await this.saveProjectStates();

      return state;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to refresh project state: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'refreshProjectState', projectId }
      );
      return null;
    }
  }

  /**
   * 刷新所有项目状态
   */
  async refreshAllProjectStates(): Promise<void> {
    try {
      const projectIds = Array.from(this.projectStates.keys());
      
      for (const projectId of projectIds) {
        await this.refreshProjectState(projectId);
      }

      this.logger.info('Refreshed all project states');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to refresh all project states: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'refreshAllProjectStates' }
      );
      throw error;
    }
  }
}