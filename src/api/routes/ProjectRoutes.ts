import { Router, Request, Response, NextFunction } from 'express';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { ProjectLookupService } from '../../database/ProjectLookupService';
import { Logger } from '../../utils/logger.js';
import {
  Project,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  PathValidationRequest,
  PathValidationResult,
  IndexingProgress,
  IndexingStats
} from '../../types/project';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectStateManager } from '../../service/project/ProjectStateManager';
import { ProjectState } from '../../service/project/ProjectStateManager';
import { IndexService } from '../../service/index/IndexService';
import { VectorIndexService } from '../../service/index/VectorIndexService';
import { GraphIndexService } from '../../service/index/GraphIndexService';
import { HotReloadConfigService } from '../../service/filesystem/HotReloadConfigService';
import { ProjectPathMappingService } from '../../database/ProjectPathMappingService';

export interface ProjectCreateBody {
  projectPath: string;
  options?: {
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    fileTypes?: string[];
    encoding?: string;
    followSymlinks?: boolean;
    respectGitignore?: boolean;
  };
}

export interface ProjectUpdateBody {
  projectId: string;
  updates: {
    name?: string;
    path?: string;
    configuration?: {
      recursive?: boolean;
      includePatterns?: string[];
      excludePatterns?: string[];
      maxFileSize?: number;
      fileTypes?: string[];
      encoding?: string;
      followSymlinks?: boolean;
      respectGitignore?: boolean;
    };
  };
}

export interface PathValidationBody {
  path: string;
}

export class ProjectRoutes {
  private router: Router;
  private projectIdManager: ProjectIdManager;
  private projectLookupService: ProjectLookupService;
  private logger: Logger;
  private projectStateManager: ProjectStateManager;
  private indexSyncService: IndexService;
  private vectorIndexService: VectorIndexService;
  private graphIndexService: GraphIndexService;
  private hotReloadConfigService: HotReloadConfigService;
  private projectPathMappingService: ProjectPathMappingService;

  constructor(
    projectIdManager: ProjectIdManager,
    projectLookupService: ProjectLookupService,
    logger: Logger,
    projectStateManager: ProjectStateManager,
    indexSyncService: IndexService,
    vectorIndexService: VectorIndexService,
    graphIndexService: GraphIndexService,
    hotReloadConfigService: HotReloadConfigService,
    projectPathMappingService: ProjectPathMappingService
  ) {
    this.projectIdManager = projectIdManager;
    this.projectLookupService = projectLookupService;
    this.logger = logger;
    this.projectStateManager = projectStateManager;
    this.indexSyncService = indexSyncService;
    this.vectorIndexService = vectorIndexService;
    this.graphIndexService = graphIndexService;
    this.hotReloadConfigService = hotReloadConfigService;
    this.projectPathMappingService = projectPathMappingService;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route GET /api/v1/projects
     * @desc Get all projects
     * @returns {object} 200 - Projects list
     */
    this.router.get('/', this.getProjects.bind(this));

    /**
     * @route GET /api/v1/projects/:projectId
     * @desc Get project details
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Project details
     */
    this.router.get('/:projectId', this.getProjectDetails.bind(this));

    /**
     * @route DELETE /api/v1/projects/:projectId
     * @desc Delete a project
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Deletion response
     */
    this.router.delete('/:projectId', this.deleteProject.bind(this));

    /**
     * @route POST /api/v1/projects/:projectId/reindex
     * @desc Re-index a project
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Re-indexing response
     */
    this.router.post('/:projectId/reindex', this.reindexProject.bind(this));

    // 向量嵌入相关端点
    this.router.post('/:projectId/index-vectors', this.indexVectors.bind(this));
    this.router.get('/:projectId/vector-status', this.getVectorStatus.bind(this));

    // 图存储相关端点
    this.router.post('/:projectId/index-graph', this.indexGraph.bind(this));
    this.router.get('/:projectId/graph-status', this.getGraphStatus.bind(this));

    // 批量操作端点
    this.router.post('/batch-index-vectors', this.batchIndexVectors.bind(this));
    this.router.post('/batch-index-graph', this.batchIndexGraph.bind(this));

    // 热更新配置端点
    this.router.get('/:projectId/hot-reload', this.getProjectHotReloadConfig.bind(this));
    this.router.put('/:projectId/hot-reload', this.updateProjectHotReloadConfig.bind(this));
    this.router.post('/:projectId/hot-reload/toggle', this.toggleProjectHotReload.bind(this));

    // 项目名称映射端点
    this.router.get('/mapping', this.getProjectNameMapping.bind(this));
    this.router.get('/mapping/:hash', this.getProjectNameByHash.bind(this));
  }

  private async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = req.query.search as string || '';
      const status = req.query.status as string || '';
      const sortBy = req.query.sortBy as string || 'name';
      const sortOrder = req.query.sortOrder as string || 'asc';

      // Validate pagination parameters
      if (page < 1) {
        res.status(400).json({
          success: false,
          error: 'Page must be greater than 0',
        });
        return;
      }

      if (pageSize < 1 || pageSize > 100) {
        res.status(400).json({
          success: false,
          error: 'Page size must be between 1 and 100',
        });
        return;
      }

      // Refresh mapping from persistent storage to ensure we have the latest projects
      await this.projectIdManager.refreshMapping();

      // Get all project IDs from ProjectIdManager
      const projectIds = this.projectIdManager.listAllProjects();
      let projects: Project[] = [];

      // Build all projects first (we'll optimize this later if needed)
      for (const projectId of projectIds) {
        const projectPath = this.projectIdManager.getProjectPath(projectId);
        if (projectPath) {
          const project = await this.buildProjectResponse(projectId, projectPath);
          projects.push(project);
        }
      }

      // Apply search filter
      if (search) {
        projects = projects.filter(project => 
          project.name.toLowerCase().includes(search.toLowerCase()) ||
          project.path.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Apply status filter
      if (status) {
        projects = projects.filter(project => project.status === status);
      }

      // Apply sorting
      projects.sort((a, b) => {
        let aValue: any = a[sortBy as keyof Project];
        let bValue: any = b[sortBy as keyof Project];

        // Handle nested properties
        if (sortBy === 'vectorStatus') {
          aValue = a.vectorStatus?.status || '';
          bValue = b.vectorStatus?.status || '';
        } else if (sortBy === 'graphStatus') {
          aValue = a.graphStatus?.status || '';
          bValue = b.graphStatus?.status || '';
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue as string).toLowerCase();
        }

        if (sortOrder === 'desc') {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      // Calculate pagination
      const totalItems = projects.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedProjects = projects.slice(startIndex, endIndex);

      this.logger.debug('Retrieved projects list', {
        page,
        pageSize,
        totalItems,
        totalPages,
        search,
        status,
        sortBy,
        sortOrder,
        projectCount: paginatedProjects.length,
        projectIds: projectIds.slice(0, 5), // 只记录前5个项目ID以避免日志过长
        hasPendingProjects: projects.some(p => p.status === 'pending'),
        hasCompletedProjects: projects.some(p => p.status === 'completed')
      });

      res.status(200).json({
        success: true,
        data: paginatedProjects,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      next(error);
    }
  }

  private async getProjectDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      const project = await this.buildProjectResponse(projectId, projectPath);

      res.status(200).json({
        success: true,
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  private async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 删除项目状态（这会同时删除Qdrant collection和Nebula Graph space）
      await this.projectStateManager.deleteProjectState(projectId);

      // 确保从ProjectIdManager中删除映射
      await this.projectIdManager.removeProject(projectPath);
      
      // 删除项目名称映射
      try {
        await this.projectPathMappingService.deleteMapping(projectId);
      } catch (mappingError) {
        this.logger.warn('Failed to delete project name mapping', { projectId, error: mappingError });
        // 不阻止删除操作，只记录警告
      }
      
      // 保存映射更改
      await this.projectIdManager.saveMapping();

      res.status(200).json({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  private async reindexProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 更新项目状态以允许重新索引
      await this.projectStateManager.createOrUpdateProjectState(projectPath, { allowReindex: true });

      // 调用 IndexSyncService 的 reindexProject 方法
      const reindexProjectId = await this.indexSyncService.reindexProject(projectPath);

      res.status(200).json({
        success: true,
        data: {
          projectId: reindexProjectId,
          success: true,
          message: 'Re-indexing started',
        },
      });
    } catch (error) {
      this.logger.error('Failed to reindex project', { error, projectId: req.params.projectId });
      next(error);
    }
  }

  /**
   * 执行向量嵌入
   */
  private async indexVectors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { options } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 调用向量索引服务
      const result = await this.vectorIndexService.indexVectors(projectId, options);

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取向量状态
   */
  private async getVectorStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 调用向量索引服务获取状态
      const vectorStatus = await this.vectorIndexService.getVectorStatus(projectId);

      res.status(200).json({
        success: true,
        data: vectorStatus,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 提取项目名称，处理各种路径分隔符
   */
  private extractProjectName(projectPath: string): string {
    if (!projectPath) return 'unknown';
    // 处理各种路径分隔符，包括Windows和Unix风格
    return projectPath.split(/[/\\]/).filter(Boolean).pop() || 'unknown';
  }

  /**
   * 执行图存储
   */
  private async indexGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { options } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 调用图索引服务
      const result = await this.graphIndexService.indexGraph(projectId, options);

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取图状态
   */
  private async getGraphStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 调用图索引服务获取状态
      const graphStatus = await this.graphIndexService.getGraphStatus(projectId);

      res.status(200).json({
        success: true,
        data: graphStatus,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量向量嵌入
   */
  private async batchIndexVectors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectIds, options } = req.body;

      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'projectIds array is required and cannot be empty',
        });
        return;
      }

      // 调用向量索引服务进行批量处理
      const result = await this.vectorIndexService.batchIndexVectors(projectIds, options);

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量图存储
   */
  private async batchIndexGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectIds, options } = req.body;

      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'projectIds array is required and cannot be empty',
        });
        return;
      }

      // 调用图索引服务进行批量处理
      const result = await this.graphIndexService.batchIndexGraph(projectIds, options);

      res.status(200).json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Maps ProjectState status to Project status
   * @param projectStateStatus The status from ProjectState
   * @returns The corresponding status for Project
   */
  private mapProjectStateStatusToProjectStatus(
    projectStateStatus: ProjectState['status']
  ): Project['status'] {
    switch (projectStateStatus) {
      case 'active':
        return 'completed';
      case 'inactive':
        return 'pending';
      case 'indexing':
        return 'indexing';
      case 'error':
        return 'error';
      default:
        // For any unexpected status, default to 'pending'
        return 'pending';
    }
  }

  /**
   * Maps StorageStatus to Project status
   * @param storageStatus The status from StorageStatus
   * @returns The corresponding status for Project
   */
  private mapStorageStatusToProjectStatus(
    storageStatus: StorageStatus['status']
  ): Project['status'] {
    switch (storageStatus) {
      case 'completed':
        return 'completed';
      case 'indexing':
        return 'indexing';
      case 'pending':
        return 'pending';
      case 'error':
        return 'error';
      case 'partial':
        return 'completed'; // Partial completion is still considered completed
      case 'disabled':
        return 'pending'; // Disabled is treated as pending
      default:
        return 'pending';
    }
  }

  private async buildProjectResponse(projectId: string, projectPath: string): Promise<Project> {
    // Extract project name from path with better handling
    const projectName = this.extractProjectName(projectPath);

    // Get project state from ProjectStateManager
    const projectState: ProjectState | null = this.projectStateManager.getProjectState(projectId);

    // Check if the project has been indexed by looking at the collection info
    let hasBeenIndexed = false;
    if (projectState && projectState.collectionInfo) {
      hasBeenIndexed = projectState.collectionInfo.vectorsCount > 0;
    }

    // If we have state from the manager, use it; otherwise use defaults
    const status = projectState
      ? this.mapProjectStateStatusToProjectStatus(projectState.status)
      : 'pending';

    // If there's no project state but the project exists in the mapping,
    // check if it has been indexed by checking collection info
    const effectiveStatus = projectState ? status : 'pending';

    const progress = projectState ? (projectState.indexingProgress || 0) : 0;
    const totalFiles = projectState ? (projectState.totalFiles || 0) : 0;
    const lastIndexed = projectState && projectState.lastIndexedAt ? projectState.lastIndexedAt : new Date();

    // 获取向量和图的状态信息
    const vectorStatus = projectState ? projectState.vectorStatus : undefined;
    const graphStatus = projectState ? projectState.graphStatus : undefined;

    return {
      id: projectId,
      name: projectName,
      path: projectPath,
      status: effectiveStatus,
      progress: progress,
      lastIndexed: lastIndexed,
      fileCount: totalFiles,
      size: 0, // Size calculation would require additional implementation
      createdAt: projectState ? projectState.createdAt : new Date(),
      updatedAt: projectState ? projectState.updatedAt : new Date(),
      vectorStatus: vectorStatus ? {
        status: vectorStatus.status,
        progress: vectorStatus.progress || 0
      } : {
        status: 'pending',
        progress: 0
      },
      graphStatus: graphStatus ? {
        status: graphStatus.status,
        progress: graphStatus.progress || 0
      } : {
        status: 'pending',
        progress: 0
      },
      configuration: {
        recursive: projectState ? projectState.settings.autoIndex : true,
        includePatterns: projectState ? (projectState.settings.includePatterns || []) : [],
        excludePatterns: projectState ? (projectState.settings.excludePatterns || []) : [],
        maxFileSize: 10485760, // 10MB
        fileTypes: [],
        encoding: 'utf-8',
        followSymlinks: false,
        respectGitignore: true,
      },
    };
  }

  /**
   * 获取项目热更新配置
   */
  private async getProjectHotReloadConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 获取项目状态
      const projectState = this.projectStateManager.getProjectState(projectId);
      if (!projectState) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 从项目状态获取热更新配置
      const hotReloadConfig = this.hotReloadConfigService.getProjectConfigFromState(projectState);
      const hotReloadStatus = this.hotReloadConfigService.getProjectHotReloadStatus(projectState);

      res.status(200).json({
        success: true,
        data: {
          config: hotReloadConfig,
          status: hotReloadStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新项目热更新配置
   */
  private async updateProjectHotReloadConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const configUpdate = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 获取项目状态
      const projectState = this.projectStateManager.getProjectState(projectId);
      if (!projectState) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 验证配置
      const validation = this.hotReloadConfigService.validateProjectStateConfig(configUpdate);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: validation.errors,
        });
        return;
      }

      // 更新项目状态中的热更新配置
      this.hotReloadConfigService.updateProjectStateConfig(projectState, configUpdate);

      // 保存项目状态
      await this.projectStateManager.createOrUpdateProjectState(projectState.projectPath, {
        hotReload: projectState.hotReload,
      });

      // 获取更新后的配置
      const updatedConfig = this.hotReloadConfigService.getProjectConfigFromState(projectState);
      const updatedStatus = this.hotReloadConfigService.getProjectHotReloadStatus(projectState);

      res.status(200).json({
        success: true,
        data: {
          config: updatedConfig,
          status: updatedStatus,
        },
        message: 'Hot reload configuration updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 切换项目热更新状态
   */
  private async toggleProjectHotReload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { enabled } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'enabled must be a boolean value',
        });
        return;
      }

      // 获取项目状态
      const projectState = this.projectStateManager.getProjectState(projectId);
      if (!projectState) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 更新热更新启用状态
      this.hotReloadConfigService.updateProjectStateConfig(projectState, { enabled });

      // 保存项目状态
      await this.projectStateManager.createOrUpdateProjectState(projectState.projectPath, {
        hotReload: projectState.hotReload,
      });

      // 获取更新后的状态
      const updatedStatus = this.hotReloadConfigService.getProjectHotReloadStatus(projectState);

      res.status(200).json({
        success: true,
        data: {
          enabled: updatedStatus.enabled,
          status: updatedStatus,
        },
        message: `Hot reload ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取项目哈希值到名称的映射
   */
  private async getProjectNameMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 获取所有项目的哈希值与名称映射
      const mappings = await this.projectPathMappingService.getAllMappings();
      
      // 转换为哈希值到项目名称的映射
      const nameMapping: { [hash: string]: string } = {};
      mappings.forEach(mapping => {
        // 从原始路径中提取项目名称
        const projectName = path.basename(mapping.originalPath);
        nameMapping[mapping.hash] = projectName;
      });
      
      res.status(200).json({
        success: true,
        data: nameMapping,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 根据哈希值获取项目名称
   */
  private async getProjectNameByHash(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hash } = req.params;
      
      if (!hash) {
        res.status(400).json({
          success: false,
          error: 'Hash is required',
        });
        return;
      }
      
      // 获取原始路径
      const originalPath = await this.projectPathMappingService.getOriginalPath(hash);
      
      if (!originalPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }
      
      // 从原始路径中提取项目名称
      const projectName = path.basename(originalPath);
      
      res.status(200).json({
        success: true,
        data: {
          hash,
          projectName,
          originalPath,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}