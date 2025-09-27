import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { IndexService } from '../../services/indexing/IndexService';
import { IndexCoordinator } from '../../services/indexing/IndexCoordinator';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { ProjectLookupService } from '../../database/ProjectLookupService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { HashUtils } from '../../utils/HashUtils';
import fs from 'fs/promises';
import path from 'path';

export interface ProjectCreateRequest {
  name: string;
  path: string;
  options?: {
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    chunkSize?: number;
    overlapSize?: number;
  };
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
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
}

export interface PathValidationRequest {
  path: string;
}

export interface PathValidationResult {
  isValid: boolean;
  exists: boolean;
  isDirectory: boolean;
  fileCount?: number;
  size?: number;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  progress: number;
  lastIndexed: Date;
  fileCount: number;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  configuration?: {
    recursive: boolean;
    includePatterns: string[];
    excludePatterns: string[];
    maxFileSize: number;
    fileTypes: string[];
    encoding?: string;
    followSymlinks?: boolean;
    respectGitignore?: boolean;
  };
}

export interface IndexingProgress {
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  startTime: Date;
  error?: string;
}

export interface IndexingStats {
  processingRate: number;
  averageFileSize: number;
  totalSizeProcessed: number;
  errors: number;
}

export class ProjectRoutes {
  private router: Router;
  private indexService: IndexService;
  private indexCoordinator: IndexCoordinator;
  private projectIdManager: ProjectIdManager;
  private projectLookupService: ProjectLookupService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;

  constructor() {
    const container = DIContainer.getInstance();
    this.indexService = container.get<IndexService>(TYPES.IndexService);
    this.indexCoordinator = container.get<IndexCoordinator>(TYPES.IndexCoordinator);
    this.projectIdManager = container.get<ProjectIdManager>(TYPES.ProjectIdManager);
    this.projectLookupService = container.get<ProjectLookupService>(TYPES.ProjectLookupService);
    this.logger = container.get<LoggerService>(TYPES.LoggerService);
    this.errorHandler = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
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
     * @route POST /api/v1/projects
     * @desc Create a new project
     * @param {object} body - Project creation data
     * @returns {object} 200 - Project creation response
     */
    this.router.post('/', this.createProject.bind(this));

    /**
     * @route GET /api/v1/projects/:projectId
     * @desc Get project details
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Project details
     */
    this.router.get('/:projectId', this.getProjectDetails.bind(this));

    /**
     * @route PUT /api/v1/projects/:projectId
     * @desc Update a project
     * @param {string} params.projectId - Project ID
     * @param {object} body - Project update data
     * @returns {object} 200 - Updated project
     */
    this.router.put('/:projectId', this.updateProject.bind(this));

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

    /**
     * @route GET /api/v1/projects/:projectId/progress
     * @desc Get indexing progress for a project
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Indexing progress
     */
    this.router.get('/:projectId/progress', this.getIndexingProgress.bind(this));

    /**
     * @route GET /api/v1/projects/:projectId/stats
     * @desc Get indexing statistics for a project
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Indexing statistics
     */
    this.router.get('/:projectId/stats', this.getIndexingStats.bind(this));

    /**
     * @route POST /api/v1/projects/validate-path
     * @desc Validate a project path
     * @param {object} body - Path validation data
     * @returns {object} 20 - Path validation result
     */
    this.router.post('/validate-path', this.validateProjectPath.bind(this));
    
    /**
     * @route GET /api/v1/projects/latest-updated
     * @desc Get the project with the latest update time
     * @returns {object} 200 - Latest updated project ID
     */
    this.router.get('/latest-updated', this.getLatestUpdatedProject.bind(this));
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

  private async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, path: projectPath, options }: ProjectCreateRequest = req.body;

      if (!name || !projectPath) {
        res.status(400).json({
          success: false,
          error: 'name and path are required',
        });
        return;
      }

      // Check if project already exists
      if (this.projectIdManager.hasProject(projectPath)) {
        res.status(400).json({
          success: false,
          error: 'Project already exists',
        });
        return;
      }

      // Generate project ID
      const projectId = await this.projectIdManager.generateProjectId(projectPath);

      // Save project mapping
      await this.projectIdManager.saveMapping();

      // Create index for the project
      const indexResult = await this.indexService.createIndex(projectPath, options);

      if (!indexResult.success) {
        // Rollback project creation if indexing fails
        this.projectIdManager.removeProject(projectPath);
        await this.projectIdManager.saveMapping();

        res.status(400).json({
          success: false,
          error: 'Failed to create project index',
          details: indexResult.errors,
        });
        return;
      }

      const project = await this.buildProjectResponse(projectId, projectPath);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          project,
        },
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

  private async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const updateData: ProjectUpdateRequest = req.body;

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

      // For now, we'll just update the project in memory
      // In a real implementation, you would persist this data
      const project = await this.buildProjectResponse(projectId, projectPath);

      // Update fields if provided
      if (updateData.name) {
        project.name = updateData.name;
      }
      if (updateData.description) {
        project.description = updateData.description;
      }
      if (updateData.configuration) {
        project.configuration = {
          ...project.configuration,
          ...updateData.configuration,
          recursive: updateData.configuration?.recursive ?? project.configuration?.recursive ?? true,
          includePatterns: updateData.configuration?.includePatterns ?? project.configuration?.includePatterns ?? [],
          excludePatterns: updateData.configuration?.excludePatterns ?? project.configuration?.excludePatterns ?? [],
          maxFileSize: updateData.configuration?.maxFileSize ?? project.configuration?.maxFileSize ?? 10485760,
          fileTypes: updateData.configuration?.fileTypes ?? project.configuration?.fileTypes ?? [],
        };
      }

      project.updatedAt = new Date();

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

      // Delete index
      const indexDeleted = await this.indexService.deleteIndex(projectPath);
      if (!indexDeleted) {
        res.status(400).json({
          success: false,
          error: 'Failed to delete project index',
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

      // Re-index the project
      const indexResult = await this.indexService.createIndex(projectPath);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          success: indexResult.success,
          filesProcessed: indexResult.filesProcessed,
          chunksCreated: indexResult.chunksCreated,
          processingTime: indexResult.processingTime,
          errors: indexResult.errors,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getIndexingProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // Get index status
      const indexStatus = await this.indexService.getStatus(projectId);

      const progress: IndexingProgress = {
        projectId,
        status: indexStatus.isIndexing ? 'running' : indexStatus.status === 'completed' ? 'completed' : 'pending',
        totalFiles: indexStatus.fileCount,
        processedFiles: indexStatus.isIndexing ? Math.floor(indexStatus.fileCount * 0.7) : indexStatus.fileCount,
        startTime: indexStatus.lastIndexed || new Date(),
        error: indexStatus.status === 'error' ? 'Indexing failed' : undefined,
      };

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  }

  private async getIndexingStats(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // Get project status from storage coordinator
      const storageCoordinator = this.indexCoordinator.getStorageCoordinator();
      const projectStatus = await storageCoordinator.getProjectStatus(projectId);

      const stats: IndexingStats = {
        processingRate: (projectStatus as any).processingRate || 0,
        averageFileSize: (projectStatus as any).averageFileSize || 0,
        totalSizeProcessed: (projectStatus as any).totalSize || 0,
        errors: (projectStatus as any).errors || 0,
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  private async validateProjectPath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { path: projectPath }: PathValidationRequest = req.body;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'path is required',
        });
        return;
      }

      const result: PathValidationResult = await this.validatePath(projectPath);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  private async validatePath(projectPath: string): Promise<PathValidationResult> {
    try {
      const stats = await fs.stat(projectPath);
      
      if (!stats.isDirectory()) {
        return {
          isValid: false,
          exists: true,
          isDirectory: false,
          error: 'Path is not a directory',
        };
      }

      // Count files and calculate size
      const files = await fs.readdir(projectPath);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        try {
          const filePath = path.join(projectPath, file);
          const fileStats = await fs.stat(filePath);
          if (fileStats.isFile()) {
            totalSize += fileStats.size;
            fileCount++;
          }
        } catch (error) {
          // Ignore files that can't be accessed
        }
      }

      return {
        isValid: true,
        exists: true,
        isDirectory: true,
        fileCount,
        size: totalSize,
      };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return {
          isValid: false,
          exists: false,
          isDirectory: false,
          error: 'Path does not exist',
        };
      }

      return {
        isValid: false,
        exists: false,
        isDirectory: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getLatestUpdatedProject(req: Request, res: Response, next: NextFunction): Promise<void> {
   try {
     const latestProjectId = await this.projectLookupService.getLatestUpdatedProjectId();
     
     if (!latestProjectId) {
       res.status(404).json({
         success: false,
         error: 'No projects available',
       });
       return;
     }
     
     res.status(200).json({
       success: true,
       projectId: latestProjectId,
     });
   } catch (error) {
     next(error);
   }
 }
 
 private async buildProjectResponse(projectId: string, projectPath: string): Promise<Project> {
   // Get index status
   const indexStatus = await this.indexService.getStatus(projectId);
   
   // Get project status from storage coordinator
   const storageCoordinator = this.indexCoordinator.getStorageCoordinator();
   const projectStatus = await storageCoordinator.getProjectStatus(projectId);

   // Extract project name from path
   const projectName = path.basename(projectPath);

   return {
     id: projectId,
     name: projectName,
     path: projectPath,
     status: indexStatus.isIndexing ? 'indexing' : indexStatus.status === 'completed' ? 'completed' : 'pending',
     progress: indexStatus.isIndexing ? 70 : indexStatus.status === 'completed' ? 100 : 0,
     lastIndexed: indexStatus.lastIndexed || new Date(),
     fileCount: (projectStatus as any).totalFiles || indexStatus.fileCount,
     size: (projectStatus as any).totalSize || 0,
     createdAt: indexStatus.lastIndexed || new Date(),
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