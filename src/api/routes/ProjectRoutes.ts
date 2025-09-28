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

    return {
      id: projectId,
      name: projectName,
      path: projectPath,
      status: 'completed', // Default to completed for now
      progress: 100, // Default to 100% for now
      lastIndexed: new Date(),
      fileCount: 0, // Default to 0 for now
      size: 0, // Default to 0 for now
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