import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { HybridSearchService } from '../../services/search/HybridSearchService';
import { SemanticSearchService } from '../../services/search/SemanticSearchService';
import { SearchCoordinator } from '../../services/search/SearchCoordinator';

export interface HybridSearchParams {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
  };
  weights?: {
    semantic?: number;
    keyword?: number;
    fuzzy?: number;
    structural?: number;
  };
  searchStrategies?: ('semantic' | 'keyword' | 'fuzzy' | 'structural')[];
}

export interface SemanticSearchParams {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
  };
}

export interface KeywordSearchParams {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
  };
  fuzzy?: boolean;
}

export interface SearchSuggestParams {
  query: string;
  projectId: string;
  limit?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
  };
}

export class SearchRoutes {
  private router: Router;
  private hybridSearchService: HybridSearchService;
  private semanticSearchService: SemanticSearchService;
  private searchCoordinator: SearchCoordinator;

  constructor() {
    const container = DIContainer.getInstance();
    this.hybridSearchService = container.get<HybridSearchService>(TYPES.HybridSearchService);
    this.semanticSearchService = container.get<SemanticSearchService>(TYPES.SemanticSearchService);
    this.searchCoordinator = container.get<SearchCoordinator>(TYPES.SearchCoordinator);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route POST /api/v1/search/hybrid
     * @desc Hybrid semantic + keyword search
     * @param {string} body.query - Search query
     * @param {string} body.projectId - Project ID
     * @param {number} body.limit - Result limit
     * @param {number} body.threshold - Similarity threshold
     * @param {object} body.filters - Search filters
     * @param {object} body.weights - Search strategy weights
     * @param {array} body.searchStrategies - Search strategies to use
     * @returns {object} 200 - Search results
     */
    this.router.post('/hybrid', this.hybridSearch.bind(this));

    /**
     * @route POST /api/v1/search/semantic
     * @desc Pure semantic search
     * @param {string} body.query - Search query
     * @param {string} body.projectId - Project ID
     * @param {number} body.limit - Result limit
     * @param {number} body.threshold - Similarity threshold
     * @param {object} body.filters - Search filters
     * @returns {object} 200 - Search results
     */
    this.router.post('/semantic', this.semanticSearch.bind(this));

    /**
     * @route POST /api/v1/search/keyword
     * @desc Keyword-based search
     * @param {string} body.query - Search query
     * @param {string} body.projectId - Project ID
     * @param {number} body.limit - Result limit
     * @param {number} body.threshold - Similarity threshold
     * @param {object} body.filters - Search filters
     * @param {boolean} body.fuzzy - Enable fuzzy matching
     * @returns {object} 200 - Search results
     */
    this.router.post('/keyword', this.keywordSearch.bind(this));

    /**
     * @route GET /api/v1/search/suggest
     * @desc Search suggestions
     * @param {string} query.query - Search query
     * @param {string} query.projectId - Project ID
     * @param {number} query.limit - Suggestion limit
     * @param {object} query.filters - Suggestion filters
     * @returns {object} 200 - Search suggestions
     */
    this.router.get('/suggest', this.suggestions.bind(this));

    /**
     * @route GET /api/v1/search/history
     * @desc Search history
     * @param {string} query.projectId - Project ID
     * @param {number} query.limit - History limit
     * @returns {object} 200 - Search history
     */
    this.router.get('/history', this.history.bind(this));

    /**
     * @route POST /api/v1/search/advanced
     * @desc Advanced search with multiple strategies
     * @param {object} body - Advanced search parameters
     * @returns {object} 200 - Advanced search results
     */
    this.router.post('/advanced', this.advancedSearch.bind(this));
  }

  private async hybridSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params: HybridSearchParams = req.body;

      if (!params.query || !params.projectId) {
        res.status(400).json({
          success: false,
          error: 'query and projectId are required',
        });
        return;
      }

      const results = await this.hybridSearchService.search(params);

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  private async semanticSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params: SemanticSearchParams = req.body;

      if (!params.query || !params.projectId) {
        res.status(400).json({
          success: false,
          error: 'query and projectId are required',
        });
        return;
      }

      const results = await this.searchCoordinator.performSemanticSearch(params.query, params);

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  private async keywordSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params: KeywordSearchParams = req.body;

      if (!params.query || !params.projectId) {
        res.status(400).json({
          success: false,
          error: 'query and projectId are required',
        });
        return;
      }

      // For now, use the general search method with keyword focus
      const searchParams = {
        text: params.query,
        filters: {
          projectId: params.projectId,
          ...params.filters,
        },
        options: {
          limit: params.limit,
          threshold: params.threshold,
          searchType: 'general' as const,
        },
      };
      const results = await this.searchCoordinator.search(searchParams);

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  private async suggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, projectId, limit = 5, filters } = req.query;

      if (!query || !projectId) {
        res.status(400).json({
          success: false,
          error: 'query and projectId are required',
        });
        return;
      }

      const suggestions = await this.searchCoordinator.getRealTimeSuggestions(
        query as string,
        projectId as string
      );

      res.status(200).json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }

  private async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, limit = 10 } = req.query;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // For now, return empty array until getSearchHistory method is implemented
      const history: never[] = [];

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  private async advancedSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const advancedParams = req.body;

      if (!advancedParams.query || !advancedParams.projectId) {
        res.status(400).json({
          success: false,
          error: 'query and projectId are required',
        });
        return;
      }

      // For now, use the general search method
      const searchParams = {
        text: advancedParams.query,
        filters: {
          projectId: advancedParams.projectId,
          ...advancedParams.filters,
        },
        options: {
          limit: advancedParams.limit,
          threshold: advancedParams.threshold,
          searchType: 'general' as const,
        },
      };
      const results = await this.searchCoordinator.search(searchParams);

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
