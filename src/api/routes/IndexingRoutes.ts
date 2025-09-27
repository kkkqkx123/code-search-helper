import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { IndexService } from '../../services/indexing/IndexService';
import { IndexCoordinator } from '../../services/indexing/IndexCoordinator';

export interface IndexingRequestBody {
  projectPath: string;
  options?: {
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
  private indexService: IndexService;
  private indexCoordinator: IndexCoordinator;

  constructor() {
    const container = DIContainer.getInstance();
    this.indexService = container.get<IndexService>(TYPES.IndexService);
    this.indexCoordinator = container.get<IndexCoordinator>(TYPES.IndexCoordinator);
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

      const result = await this.indexService.createIndex(projectPath, options);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
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

      const result = await this.indexCoordinator.createIndex(projectId, options);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
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

      const status = await this.indexService.getStatus(projectId);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  private async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // For now, return empty array until listProjects method is implemented
      const projects: never[] = [];

      res.status(200).json({
        success: true,
        data: projects,
      });
    } catch (error) {
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

      const result = await this.indexService.deleteIndex(projectId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
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

      const results = await this.indexService.search(
        searchQuery.query,
        searchQuery.projectId,
        searchQuery
      );

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
