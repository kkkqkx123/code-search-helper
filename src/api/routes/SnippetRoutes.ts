import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { SnippetController } from '../../controllers/SnippetController';

export class SnippetRoutes {
  private router: Router;
  private snippetController: SnippetController;

  constructor() {
    const container = DIContainer.getInstance();
    this.snippetController = container.get<SnippetController>(TYPES.SnippetController);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route GET /api/v1/snippets/search
     * @desc Search for snippets
     * @param {string} query.query.required - Search query
     * @param {string} projectId.query - Project ID to search within
     * @param {number} limit.query - Maximum number of results to return
     * @param {number} offset.query - Offset for pagination
     * @returns {object} 200 - Search results
     */
    this.router.get('/search', this.searchSnippets.bind(this));

    /**
     * @route GET /api/v1/snippets/:snippetId
     * @desc Get snippet by ID
     * @param {string} snippetId.path.required - Snippet ID
     * @param {string} projectId.query.required - Project ID
     * @returns {object} 200 - Snippet data
     */
    this.router.get('/:snippetId', this.getSnippetById.bind(this));

    /**
     * @route GET /api/v1/snippets/status/:projectId
     * @desc Get snippet processing status
     * @param {string} projectId.path.required - Project ID
     * @returns {object} 200 - Processing status
     */
    this.router.get('/status/:projectId', this.getSnippetProcessingStatus.bind(this));

    /**
     * @route POST /api/v1/snippets/check-duplicates
     * @desc Check for duplicate snippets
     * @param {string} content.body.required - Snippet content to check
     * @param {string} projectId.body.required - Project ID
     * @returns {object} 200 - Duplicate check result
     */
    this.router.post('/check-duplicates', this.checkForDuplicates.bind(this));

    /**
     * @route GET /api/v1/snippets/:snippetId/references/:projectId
     * @desc Detect cross-references between snippets
     * @param {string} snippetId.path.required - Snippet ID
     * @param {string} projectId.path.required - Project ID
     * @returns {object} 200 - Cross-reference data
     */
    this.router.get('/:snippetId/references/:projectId', this.detectCrossReferences.bind(this));

    /**
     * @route GET /api/v1/snippets/:snippetId/dependencies/:projectId
     * @desc Analyze snippet dependencies
     * @param {string} snippetId.path.required - Snippet ID
     * @param {string} projectId.path.required - Project ID
     * @returns {object} 200 - Dependency analysis
     */
    this.router.get('/:snippetId/dependencies/:projectId', this.analyzeDependencies.bind(this));

    /**
     * @route GET /api/v1/snippets/:snippetId/overlaps/:projectId
     * @desc Detect overlapping snippets
     * @param {string} snippetId.path.required - Snippet ID
     * @param {string} projectId.path.required - Project ID
     * @returns {object} 200 - Overlap detection results
     */
    this.router.get('/:snippetId/overlaps/:projectId', this.detectOverlaps.bind(this));

    /**
     * @route POST /api/v1/snippets
     * @desc Index a new snippet
     * @param {object} snippet.body.required - Snippet data to index
     * @returns {object} 200 - Indexing result
     */
    this.router.post('/', this.indexSnippet.bind(this));

    /**
     * @route PUT /api/v1/snippets/:snippetId
     * @desc Update an existing snippet
     * @param {string} snippetId.path.required - Snippet ID
     * @param {object} snippet.body.required - Updated snippet data
     * @returns {object} 200 - Update result
     */
    this.router.put('/:snippetId', this.updateSnippet.bind(this));

    /**
     * @route DELETE /api/v1/snippets/:snippetId
     * @desc Delete a snippet
     * @param {string} snippetId.path.required - Snippet ID
     * @returns {object} 200 - Deletion result
     */
    this.router.delete('/:snippetId', this.deleteSnippet.bind(this));
  }

  private async searchSnippets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, projectId, limit, offset, filters, sortBy, sortOrder } = req.query;

      // Validate required query parameter
      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Query parameter is required',
        });
        return;
      }

      const result = await this.snippetController.searchSnippets(query as string, {
        projectId: projectId as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        filters: filters ? JSON.parse(filters as string) : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getSnippetById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { snippetId } = req.params;
      const { projectId } = req.query;
      const result = await this.snippetController.getSnippetById(snippetId, projectId as string);

      // Check if snippet exists
      if (result === null) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Snippet not found',
        });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getSnippetProcessingStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const result = await this.snippetController.getSnippetProcessingStatus(projectId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async checkForDuplicates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, projectId } = req.body;
      const result = await this.snippetController.checkForDuplicates(content, projectId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async indexSnippet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Assuming there's an indexSnippet method in SnippetController
      // This is a placeholder implementation
      const result = {
        id: 'snippet_456',
        success: true,
        message: 'Snippet indexed successfully',
      };
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async updateSnippet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { snippetId } = req.params;
      // Assuming there's an updateSnippet method in SnippetController
      // This is a placeholder implementation
      const result = {
        id: snippetId,
        success: true,
        message: 'Snippet updated successfully',
      };
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async deleteSnippet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { snippetId } = req.params;
      // Assuming there's a deleteSnippet method in SnippetController
      // This is a placeholder implementation
      const result = {
        id: snippetId,
        success: true,
        message: 'Snippet deleted successfully',
      };
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async detectCrossReferences(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { snippetId, projectId } = req.params;
      const result = await this.snippetController.detectCrossReferences(snippetId, projectId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async analyzeDependencies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { snippetId, projectId } = req.params;
      const result = await this.snippetController.analyzeDependencies(snippetId, projectId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async detectOverlaps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { snippetId, projectId } = req.params;
      const result = await this.snippetController.detectOverlaps(snippetId, projectId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
