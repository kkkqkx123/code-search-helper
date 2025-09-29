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

  /**
   * 格式化日期为ISO字符串
   */
  private formatDate(date: Date): string {
    return date.toISOString();
  }

  /**
   * 解析ISO字符串为Date对象
   */
  private parseDate(dateString: string): Date {
    return new Date(dateString);
  }

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
      this.logger.info('Project state manager initialized', {
        projectCount: this.projectStates.size,
        projects: Array.from(this.projectStates.keys())
      });
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
      const rawStates = JSON.parse(data);

      // 验证和恢复项目状态
      this.projectStates = new Map();
      let validStateCount = 0;
      let invalidStateCount = 0;

      for (const rawState of rawStates) {
        try {
          const validatedState = this.validateAndNormalizeProjectState(rawState);
          this.projectStates.set(validatedState.projectId, validatedState);
          validStateCount++;
        } catch (validationError) {
          this.logger.warn(`Skipping invalid project state: ${validationError instanceof Error ? validationError.message : String(validationError)}`, { rawState });
          invalidStateCount++;
        }
      }

      this.logger.info(`Loaded ${validStateCount} valid project states, skipped ${invalidStateCount} invalid states`);
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
      const jsonData = JSON.stringify(states, null, 2);

      // 使用临时文件+重命名的方式实现原子写入
      const tempPath = `${this.storagePath}.tmp`;
      await fs.writeFile(tempPath, jsonData);
      
      // 原子性重命名
      await fs.rename(tempPath, this.storagePath);

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

      this.logger.info(`Project state ${state ? 'updated' : 'created'} for ${projectId}`, {
        projectId,
        projectPath,
        status: state.status,
        hasIndexingProgress: !!state.indexingProgress,
        hasLastIndexedAt: !!state.lastIndexedAt
      });
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

    await this.updateProjectCollectionInfoWithRetry(projectId);
  }

  /**
   * 带重试机制的集合信息更新
   */
  private async updateProjectCollectionInfoWithRetry(projectId: string, maxRetries: number = 3): Promise<void> {
    const state = this.projectStates.get(projectId);
    if (!state) return;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        
        // 成功则退出重试循环
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          // 最后一次尝试仍然失败，记录警告
          this.logger.warn(`Failed to update collection info for ${projectId} after ${maxRetries} attempts`, { error });
          return;
        }
        
        // 指数退避等待
        const waitTime = Math.pow(2, attempt) * 1000;
        this.logger.debug(`Retrying collection info update for ${projectId}, attempt ${attempt + 1}/${maxRetries}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
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

  /**
   * 清理无效的项目状态
   */
  async cleanupInvalidStates(): Promise<number> {
    try {
      const initialCount = this.projectStates.size;
      const validStates: ProjectState[] = [];

      for (const state of this.projectStates.values()) {
        const isValid = await this.isProjectStateValid(state);
        if (isValid) {
          validStates.push(state);
        } else {
          this.logger.info(`Removing invalid project state: ${state.projectId} at ${state.projectPath}`);
        }
      }

      // 重建状态映射
      this.projectStates = new Map(validStates.map(state => [state.projectId, state]));
      
      // 保存清理后的状态
      await this.saveProjectStates();

      const removedCount = initialCount - this.projectStates.size;
      this.logger.info(`Cleaned up ${removedCount} invalid project states, ${this.projectStates.size} states remaining`);
      
      return removedCount;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to cleanup invalid project states: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectStateManager', operation: 'cleanupInvalidStates' }
      );
      throw error;
    }
  }

  /**
   * 检查项目状态是否有效
   */
  private async isProjectStateValid(state: ProjectState): Promise<boolean> {
    try {
      // 检查项目路径是否存在
      await fs.access(state.projectPath);
      return true;
    } catch (error) {
      // 路径不存在，状态无效
      return false;
    }
  }

  /**
   * 验证和规范化项目状态数据
   */
  private validateAndNormalizeProjectState(rawState: any): ProjectState {
    // 验证必需字段
    if (!rawState.projectId || typeof rawState.projectId !== 'string') {
      throw new Error('Invalid or missing projectId');
    }
    
    if (!rawState.projectPath || typeof rawState.projectPath !== 'string') {
      throw new Error('Invalid or missing projectPath');
    }
    
    if (!rawState.name || typeof rawState.name !== 'string') {
      throw new Error('Invalid or missing name');
    }
    
    if (!rawState.status || !['active', 'inactive', 'indexing', 'error'].includes(rawState.status)) {
      throw new Error('Invalid or missing status');
    }
    
    if (!rawState.createdAt || !rawState.updatedAt) {
      throw new Error('Missing timestamp fields');
    }

    // 验证settings对象
    if (!rawState.settings || typeof rawState.settings !== 'object') {
      throw new Error('Invalid or missing settings');
    }

    // 构建规范化的项目状态
    const normalizedState: ProjectState = {
      projectId: rawState.projectId,
      projectPath: rawState.projectPath,
      name: rawState.name,
      description: rawState.description || undefined,
      status: rawState.status,
      createdAt: this.parseDate(rawState.createdAt),
      updatedAt: this.parseDate(rawState.updatedAt),
      lastIndexedAt: rawState.lastIndexedAt ? this.parseDate(rawState.lastIndexedAt) : undefined,
      indexingProgress: typeof rawState.indexingProgress === 'number' ? rawState.indexingProgress : undefined,
      totalFiles: typeof rawState.totalFiles === 'number' ? rawState.totalFiles : undefined,
      indexedFiles: typeof rawState.indexedFiles === 'number' ? rawState.indexedFiles : undefined,
      failedFiles: typeof rawState.failedFiles === 'number' ? rawState.failedFiles : undefined,
      collectionInfo: rawState.collectionInfo ? {
        name: rawState.collectionInfo.name,
        vectorsCount: typeof rawState.collectionInfo.vectorsCount === 'number' ? rawState.collectionInfo.vectorsCount : 0,
        status: rawState.collectionInfo.status || 'unknown'
      } : undefined,
      settings: {
        autoIndex: typeof rawState.settings.autoIndex === 'boolean' ? rawState.settings.autoIndex : true,
        watchChanges: typeof rawState.settings.watchChanges === 'boolean' ? rawState.settings.watchChanges : true,
        includePatterns: Array.isArray(rawState.settings.includePatterns) ? rawState.settings.includePatterns : undefined,
        excludePatterns: Array.isArray(rawState.settings.excludePatterns) ? rawState.settings.excludePatterns : undefined,
        chunkSize: typeof rawState.settings.chunkSize === 'number' ? rawState.settings.chunkSize : undefined,
        chunkOverlap: typeof rawState.settings.chunkOverlap === 'number' ? rawState.settings.chunkOverlap : undefined,
      },
      metadata: rawState.metadata && typeof rawState.metadata === 'object' ? rawState.metadata : {}
    };

    return normalizedState;
  }
}