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
import fs from 'fs/promises';
import path from 'path';

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

  constructor(projectIdManager: ProjectIdManager, projectLookupService: ProjectLookupService, logger: Logger) {
    this.projectIdManager = projectIdManager;
    this.projectLookupService = projectLookupService;
    this.logger = logger;
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

      // Remove project from mapping
      this.projectIdManager.removeProject(projectPath);
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

      // For now, just return a success response
      // In a real implementation, this would trigger re-indexing
      res.status(200).json({
        success: true,
        data: {
          projectId,
          success: true,
          message: 'Re-indexing started',
        },
      });
    } catch (error) {
      next(error);
    }
  }
  
  private async buildProjectResponse(projectId: string, projectPath: string): Promise<Project> {
    // Extract project name from path
    const projectName = path.basename(projectPath);

    // Get project status from IndexSyncService
    const status = this.projectLookupService.indexSyncService.getIndexStatus(projectId);
    
    // If we have status from the service, use it; otherwise use defaults
    const isIndexing = status ? status.isIndexing : false;
    const totalFiles = status ? status.totalFiles : 0;
    const indexedFiles = status ? status.indexedFiles : 0;
    const progress = status ? status.progress : 0;
    const lastIndexed = status && status.lastIndexed ? status.lastIndexed : null;

    return {
      id: projectId,
      name: projectName,
      path: projectPath,
      status: isIndexing ? 'indexing' : (totalFiles > 0 ? 'completed' : 'pending'),
      progress: progress,
      lastIndexed: lastIndexed || new Date(),
      fileCount: totalFiles,
      size: 0, // Size calculation would require additional implementation
      createdAt: new Date(),
      updatedAt: new Date(),
      configuration: {
        recursive: true,
        includePatterns: [],
        excludePatterns: [],
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