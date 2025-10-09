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

  constructor(
    projectIdManager: ProjectIdManager,
    projectLookupService: ProjectLookupService,
    logger: Logger,
    projectStateManager: ProjectStateManager,
    indexSyncService: IndexService,
    vectorIndexService: VectorIndexService,
    graphIndexService: GraphIndexService
  ) {
    this.projectIdManager = projectIdManager;
    this.projectLookupService = projectLookupService;
    this.logger = logger;
    this.projectStateManager = projectStateManager;
    this.indexSyncService = indexSyncService;
    this.vectorIndexService = vectorIndexService;
    this.graphIndexService = graphIndexService;
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
  }

  private async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Refresh mapping from persistent storage to ensure we have the latest projects
      await this.projectIdManager.refreshMapping();

      // Get all project IDs from ProjectIdManager
      const projectIds = this.projectIdManager.listAllProjects();
      const projects: Project[] = [];

      for (const projectId of projectIds) {
        const projectPath = this.projectIdManager.getProjectPath(projectId);
        if (projectPath) {
          const project = await this.buildProjectResponse(projectId, projectPath);
          projects.push(project);
        }
      }

      this.logger.debug('Retrieved projects list', {
        projectCount: projects.length,
        projectIds: projectIds.slice(0, 5), // 只记录前5个项目ID以避免日志过长
        hasPendingProjects: projects.some(p => p.status === 'pending'),
        hasCompletedProjects: projects.some(p => p.status === 'completed')
      });

      res.status(200).json({
        success: true,
        data: projects,
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
      const deleted = await this.projectStateManager.deleteProjectState(projectId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

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

  private async buildProjectResponse(projectId: string, projectPath: string): Promise<Project> {
    // Extract project name from path
    const projectName = path.basename(projectPath);

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

  getRouter(): Router {
    return this.router;
  }
}