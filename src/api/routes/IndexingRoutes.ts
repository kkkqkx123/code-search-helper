import { Router, Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger.js';
import { IndexSyncService } from '../../service/index/IndexSyncService';
import { ProjectIdManager } from '../../database/ProjectIdManager';

export interface IndexingRequestBody {
  projectPath: string;
  options?: {
    embedder?: string;
    batchSize?: number;
    maxFiles?: number;
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    chunkSize?: number;
    overlapSize?: number;
  };
}

export interface SearchQuery {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
    snippetType?: string[];
  };
  searchType?: 'semantic' | 'keyword' | 'hybrid' | 'snippet';
}

export class IndexingRoutes {
  private router: Router;
  private indexSyncService: IndexSyncService;
  private projectIdManager: ProjectIdManager;
  private logger: Logger;

  constructor(indexSyncService: IndexSyncService, projectIdManager: ProjectIdManager, logger: Logger) {
    this.indexSyncService = indexSyncService;
    this.projectIdManager = projectIdManager;
    this.logger = logger;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route POST /api/v1/indexing/create
     * @desc Create new codebase index
     * @param {string} body.projectPath - Project path to index
     * @param {object} body.options - Indexing options
     * @returns {object} 200 - Index result
     */
    this.router.post('/create', this.createIndex.bind(this));

    /**
     * @route POST /api/v1/indexing/:projectId
     * @desc Index specific project
     * @param {string} params.projectId - Project ID
     * @param {object} body - Indexing options
     * @returns {object} 200 - Index result
     */
    this.router.post('/:projectId', this.indexProject.bind(this));

    /**
     * @route GET /api/v1/indexing/status/:projectId
     * @desc Get indexing status
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Index status
     */
    this.router.get('/status/:projectId', this.getIndexStatus.bind(this));

    /**
     * @route GET /api/v1/indexing/projects
     * @desc List all indexed projects
     * @returns {object} 200 - Projects list
     */
    this.router.get('/projects', this.listProjects.bind(this));

    /**
     * @route DELETE /api/v1/indexing/:projectId
     * @desc Remove project index
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Deletion result
     */
    this.router.delete('/:projectId', this.removeIndex.bind(this));

    /**
     * @route POST /api/v1/indexing/search
     * @desc Search indexed codebase
     * @param {object} body - Search query
     * @returns {object} 200 - Search results
     */
    this.router.post('/search', this.search.bind(this));
  }

  private async createIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectPath, options }: IndexingRequestBody = req.body;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      // 转换前端选项为IndexSyncService需要的格式
      const syncOptions = {
        embedder: options?.embedder,
        batchSize: options?.batchSize,
        maxConcurrency: 3,
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        chunkSize: options?.chunkSize,
        chunkOverlap: options?.overlapSize
      };

      // 开始索引
      const projectId = await this.indexSyncService.startIndexing(projectPath, syncOptions);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          projectPath,
          message: 'Indexing started successfully'
        },
      });
    } catch (error) {
      this.logger.error('Failed to create index:', { error, projectPath: req.body.projectPath });
      next(error);
    }
  }

  private async indexProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const options = req.body;

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

      // 转换选项格式
      const syncOptions = {
        batchSize: options?.batchSize,
        maxConcurrency: 3,
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        chunkSize: options?.chunkSize,
        chunkOverlap: options?.overlapSize
      };

      // 开始索引
      await this.indexSyncService.startIndexing(projectPath, syncOptions);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          projectPath,
          message: 'Project indexing started successfully'
        },
      });
    } catch (error) {
      this.logger.error('Failed to index project:', { error, projectId: req.params.projectId });
      next(error);
    }
  }

  private async getIndexStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      const status = this.indexSyncService.getIndexStatus(projectId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Project not found or not indexed',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      this.logger.error('Failed to get index status:', { error, projectId: req.params.projectId });
      next(error);
    }
  }

  private async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 获取所有项目ID
      const projectIds = this.projectIdManager.listAllProjects();
      const projects = [];

      for (const projectId of projectIds) {
        const projectPath = this.projectIdManager.getProjectPath(projectId);
        if (projectPath) {
          const status = this.indexSyncService.getIndexStatus(projectId);
          projects.push({
            projectId,
            projectPath,
            status: status || {
              projectId,
              projectPath,
              isIndexing: false,
              lastIndexed: null,
              totalFiles: 0,
              indexedFiles: 0,
              failedFiles: 0,
              progress: 0
            }
          });
        }
      }

      res.status(200).json({
        success: true,
        data: projects,
      });
    } catch (error) {
      this.logger.error('Failed to list projects:', { error });
      next(error);
    }
  }

  private async removeIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 停止索引（如果正在进行）
      await this.indexSyncService.stopIndexing(projectId);

      // 删除项目映射
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (projectPath) {
        this.projectIdManager.removeProject(projectPath);
        await this.projectIdManager.saveMapping();
      }

      res.status(200).json({
        success: true,
        data: {
          projectId,
          message: 'Project index removed successfully'
        },
      });
    } catch (error) {
      this.logger.error('Failed to remove index:', { error, projectId: req.params.projectId });
      next(error);
    }
  }

  private async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const searchQuery: SearchQuery = req.body;

      if (!searchQuery.query || !searchQuery.projectId) {
        res.status(400).json({
          success: false,
          error: 'query and projectId are required',
        });
        return;
      }

      // 检查项目是否存在
      const projectPath = this.projectIdManager.getProjectPath(searchQuery.projectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 暂时返回模拟搜索结果
      // 在实际实现中，这里应该调用搜索服务
      const results = {
        query: searchQuery.query,
        projectId: searchQuery.projectId,
        results: [],
        total: 0,
        searchType: searchQuery.searchType || 'semantic'
      };

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      this.logger.error('Failed to search:', { error, query: req.body.query });
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}