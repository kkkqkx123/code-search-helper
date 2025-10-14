
import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { ProjectStateStorageUtils } from './utils/ProjectStateStorageUtils';
import { ProjectStateValidator } from './utils/ProjectStateValidator';
import { ProjectStateListenerManager } from './listeners/ProjectStateListenerManager';
import { CoreStateService } from './services/CoreStateService';
import { StorageStateService } from './services/StorageStateService';

export interface ProjectState {
  projectId: string;
  projectPath: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'indexing' | 'error';

  // 分离的状态管理
  vectorStatus: StorageStatus;
  graphStatus: StorageStatus;

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

// 新增存储状态接口
export interface StorageStatus {
  status: 'pending' | 'indexing' | 'completed' | 'error' | 'partial';
  progress: number; // 0-100
  totalFiles?: number;
  processedFiles?: number;
  failedFiles?: number;
  lastUpdated: Date;
  lastCompleted?: Date;
  error?: string;
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
  private listenerManager: ProjectStateListenerManager;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.CoreStateService) private coreStateService: CoreStateService,
    @inject(TYPES.StorageStateService) private storageStateService: StorageStateService
  ) {
    // 存储路径将在initialize方法中设置
    this.storagePath = './data/project-states.json'; // 默认路径

    // 初始化监听器管理器 - 将在 initialize 方法中设置
    this.listenerManager = null as any;
  }

  /**
   * 初始化项目状态管理器
   */
  async initialize(): Promise<void> {
    try {
      // 从配置中获取存储路径
      try {
        const projectConfig = this.configService.get('project');
        if (projectConfig?.statePath) {
          this.storagePath = projectConfig.statePath;
        }
      } catch (configError) {
        this.logger.warn('Failed to get project config, using default storage path', {
          error: configError instanceof Error ? configError.message : String(configError),
          defaultPath: this.storagePath
        });
      }

      // 加载项目状态
      await this.loadProjectStates();

      // 初始化监听器管理器
      this.listenerManager = new ProjectStateListenerManager(
        this.logger,
        this.coreStateService['indexService'], // 通过反射访问私有属性
        this.projectStates,
        (projectId: string, status: ProjectState['status']) => this.updateProjectStatus(projectId, status),
        (projectId: string, progress: number) => this.updateProjectIndexingProgress(projectId, progress),
        (projectId: string) => this.updateProjectLastIndexed(projectId),
        (projectId: string, metadata: Record<string, any>) => this.updateProjectMetadata(projectId, metadata),
        (projectId: string, status: Partial<any>) => this.updateVectorStatus(projectId, status),
        (projectId: string, status: Partial<any>) => this.updateGraphStatus(projectId, status)
      );
      // 设置索引同步服务监听器
      this.listenerManager.setupIndexSyncListeners();

      this.isInitialized = true;
      this.logger.info('Project state manager initialized', {
        projectCount: this.projectStates.size,
        projects: Array.from(this.projectStates.keys()),
        storagePath: this.storagePath
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize project state

 manager: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'initialize' }
      );
      throw error;
    }
  }

  /**
   * 加载项目状态
   */
  private async loadProjectStates(): Promise<void> {
    this.projectStates = await ProjectStateStorageUtils.loadProjectStates(
      this.storagePath,
      this.logger,
      (rawState: any) => ProjectStateValidator.validateAndNormalizeProjectState(rawState)
    );
  }

  /**
   * 保存项目状态
   */
  private async saveProjectStates(): Promise<void> {
    await ProjectStateStorageUtils.saveProjectStates(
      this.projectStates,
      this.storagePath,
      this.logger,
      this.errorHandler
    );
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
      allowReindex?: boolean;
    } = {}
  ): Promise<ProjectState> {
    const state = await this.coreStateService.createOrUpdateProjectState(
      this.projectStates,
      projectPath,
      this.storagePath,
      options
    );

    // 保存状态
    await this.saveProjectStates();

    // 更新监听器管理器的项目状态引用
    if (this.listenerManager) {
      this.listenerManager.updateProjectStatesReference(this.projectStates);
    }

    return state;
  }

  /**
   * 获取项目状态
   */
  getProjectState(projectId: string): ProjectState | null {
    return this.coreStateService.getProjectState(this.projectStates, projectId);
  }

  /**
   * 获取所有项目状态
   */
  getAllProjectStates(): ProjectState[] {
    return this.coreStateService.getAllProjectStates(this.projectStates);
  }

  /**
   * 根据项目路径获取项目状态
   */
  getProjectStateByPath(projectPath: string): ProjectState | null {
    return this.coreStateService.getProjectStateByPath(this.projectStates, projectPath);
  }

  /**
   * 更新项目状态
   */
  private async updateProjectStatus(projectId: string, status: ProjectState['status']): Promise<void> {
    await this.coreStateService.updateProjectStatus(this.projectStates, projectId, status, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 更新项目索引进度
   */
  private async updateProjectIndexingProgress(projectId: string, progress: number): Promise<void> {
    await this.coreStateService.updateProjectIndexingProgress(this.projectStates, projectId, progress, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 更新项目最后索引时间
   */
  private async updateProjectLastIndexed(projectId: string): Promise<void> {
    await this.coreStateService.updateProjectLastIndexed(this.projectStates, projectId, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 更新项目元数据
   */
  private async updateProjectMetadata(projectId: string, metadata: Record<string, any>): Promise<void> {
    await this.coreStateService.updateProjectMetadata(this.projectStates, projectId, metadata, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 删除项目状态
   */
  async deleteProjectState(projectId: string): Promise<boolean> {
    const result = await this.coreStateService.deleteProjectState(this.projectStates, projectId, this.storagePath);
    if (result) {
      await this.saveProjectStates();
      // 更新监听器管理器的项目状态引用
      if (this.listenerManager) {
        this.listenerManager.updateProjectStatesReference(this.projectStates);
      }
    }
    return result;
  }

  /**
   * 获取项目统计信息
   */
  getProjectStats(): ProjectStats {
    return this.coreStateService.getProjectStats(this.projectStates);
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
        this.logger.warn(`Project state not found for deactivation: ${projectId}`);
        return false;
      }

      // 更新状态，但即使保存失败也返回true（因为状态已经更新在内存中）
      try {
        await this.updateProjectStatus(projectId, 'inactive');
      } catch (saveError) {
        this.logger.warn(`Failed to save project state during deactivation, but status was updated in memory: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
        // 即使保存失败，状态已经在内存中更新，所以返回true
      }

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
    const state = await this.coreStateService.refreshProjectState(this.projectStates, projectId, this.storagePath);
    if (state) {
      await this.saveProjectStates();
    }
    return state;
  }

  /**
   * 刷新所有项目状态
   */
  async refreshAllProjectStates(): Promise<void> {
    await this.coreStateService.refreshAllProjectStates(this.projectStates, this.storagePath);
    await this.saveProjectStates();
    // 更新监听器管理器的项目状态引用
    if (this.listenerManager) {
      this.listenerManager.updateProjectStatesReference(this.projectStates);
    }
  }

  /**
   * 清理无效的项目状态
   */
  async cleanupInvalidStates(): Promise<number> {
    const removedCount = await this.coreStateService.cleanupInvalidStates(this.projectStates, this.storagePath);
    if (removedCount > 0) {
      await this.saveProjectStates();
      // 更新监听器管理器的项目状态引用
      if (this.listenerManager) {
        this.listenerManager.updateProjectStatesReference(this.projectStates);
      }
    }
    return removedCount;
  }

  /**
   * 更新向量存储状态
   */
  async updateVectorStatus(projectId: string, status: Partial<StorageStatus>): Promise<void> {
    await this.storageStateService.updateVectorStatus(this.projectStates, projectId, status, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 更新图存储状态
   */
  async updateGraphStatus(projectId: string, status: Partial<StorageStatus>): Promise<void> {
    await this.storageStateService.updateGraphStatus(this.projectStates, projectId, status, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 获取向量存储状态
   */
  getVectorStatus(projectId: string): StorageStatus | null {
    return this.storageStateService.getVectorStatus(this.projectStates, projectId);
  }

  /**
   * 获取图存储状态
   */
  getGraphStatus(projectId: string): StorageStatus | null {
    return this.storageStateService.getGraphStatus(this.projectStates, projectId);
  }

  /**
   * 重置向量存储状态
   */
  async resetVectorStatus(projectId: string): Promise<void> {
    await this.storageStateService.resetVectorStatus(this.projectStates, projectId, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 重置图存储状态
   */
  async resetGraphStatus(projectId: string): Promise<void> {
    await this.storageStateService.resetGraphStatus(this.projectStates, projectId, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 开始向量索引
   */
  async startVectorIndexing(projectId: string, totalFiles?: number): Promise<void> {
    await this.storageStateService.startVectorIndexing(this.projectStates, projectId, totalFiles, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 开始图索引
   */
  async startGraphIndexing(projectId: string, totalFiles?: number): Promise<void> {
    await this.storageStateService.startGraphIndexing(this.projectStates, projectId, totalFiles, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 更新向量索引进度
   */
  async updateVectorIndexingProgress(projectId: string, progress: number, processedFiles?: number, failedFiles?: number): Promise<void> {
    await this.storageStateService.updateVectorIndexingProgress(this.projectStates, projectId, progress, processedFiles, failedFiles, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 更新图索引进度
   */
  async updateGraphIndexingProgress(projectId: string, progress: number, processedFiles?: number, failedFiles?: number): Promise<void> {
    await this.storageStateService.updateGraphIndexingProgress(this.projectStates, projectId, progress, processedFiles, failedFiles, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 完成向量索引
   */
  async completeVectorIndexing(projectId: string): Promise<void> {
    await this.storageStateService.completeVectorIndexing(this.projectStates, projectId, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 完成图索引
   */
  async completeGraphIndexing(projectId: string): Promise<void> {
    await this.storageStateService.completeGraphIndexing(this.projectStates, projectId, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 向量索引出错
   */
  async failVectorIndexing(projectId: string, error: string): Promise<void> {
    await this.storageStateService.failVectorIndexing(this.projectStates, projectId, error, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 图索引出错
   */
  async failGraphIndexing(projectId: string, error: string): Promise<void> {
    await this.storageStateService.failGraphIndexing(this.projectStates, projectId, error, this.storagePath);
    await this.saveProjectStates();
  }

  /**
   * 获取所有已知项目的路径
   */
  async getAllProjects(): Promise<string[]> {
    try {
      const allStates = this.getAllProjectStates();
      return allStates.map(state => state.projectPath);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get all projects: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'getAllProjects' }
      );
      return [];
    }
  }

  /**
   * 根据项目路径获取项目ID
   */
  getProjectId(projectPath: string): string | null {
    try {
      return this.coreStateService['projectIdManager'].getProjectId(projectPath);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get project ID for path: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'getProjectId', projectPath }
      );
      return null;
    }
  }