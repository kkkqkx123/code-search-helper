import { Router, Request, Response, NextFunction } from 'express';
import { LoggerService } from '../../utils/LoggerService.js';
import { QdrantService } from '../../database/qdrant/QdrantService.js';
import { TYPES } from '../../types.js';
import { diContainer } from '../../core/DIContainer.js';

export interface QdrantCollectionInfo {
  name: string;
  vectorsCount: number;
  vectorSize: number;
  distance: string;
  status: string;
  diskUsage?: number;
  memoryUsage?: number;
}

export interface QdrantCollectionPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

export class QdrantCollectionViewRoutes {
  private router: Router;
  private qdrantService: QdrantService;
  private logger: LoggerService;

  constructor() {
    this.qdrantService = diContainer.get<QdrantService>(TYPES.QdrantService);
    this.logger = diContainer.get<LoggerService>(TYPES.LoggerService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route GET /api/v1/qdrant/collections
     * @desc List all Qdrant collections
     * @returns {object} 200 - Collections list
     */
    this.router.get('/collections', this.listCollections.bind(this));

    /**
     * @route GET /api/v1/qdrant/collections/:collectionId/info
     * @desc Get collection information
     * @param {string} params.collectionId - Collection ID
     * @returns {object} 200 - Collection info
     */
    this.router.get('/collections/:collectionId/info', this.getCollectionInfo.bind(this));

    /**
     * @route GET /api/v1/qdrant/collections/:collectionId/points
     * @desc Scroll through collection points
     * @param {string} params.collectionId - Collection ID
     * @param {number} query.limit - Number of points to retrieve (default: 100)
     * @param {string} query.offset - Offset for pagination
     * @param {string} query.filter - JSON filter for points
     * @returns {object} 200 - Points data
     */
    this.router.get('/collections/:collectionId/points', this.getCollectionPoints.bind(this));

    /**
     * @route GET /api/v1/qdrant/collections/:collectionId/stats
     * @desc Get collection statistics
     * @param {string} params.collectionId - Collection ID
     * @returns {object} 200 - Collection stats
     */
    this.router.get('/collections/:collectionId/stats', this.getCollectionStats.bind(this));
  }

  /**
   * List all collections
   */
  private async listCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const collections = await this.qdrantService.listCollections();
      
      res.status(200).json({
        success: true,
        data: collections
      });
    } catch (error) {
      this.logger.error('Failed to list collections:', { error });
      next(error);
    }
  }

  /**
   * Get collection information
   */
  private async getCollectionInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { collectionId } = req.params;

      if (!collectionId) {
        res.status(400).json({
          success: false,
          error: 'collectionId is required'
        });
        return;
      }

      const collectionInfo = await this.qdrantService.getCollectionInfo(collectionId);
      
      if (!collectionInfo) {
        res.status(404).json({
          success: false,
          error: 'Collection not found'
        });
        return;
      }

      // 转换为前端友好的格式
      const info: QdrantCollectionInfo = {
        name: collectionInfo.name,
        vectorsCount: collectionInfo.pointsCount,
        vectorSize: collectionInfo.vectors.size,
        distance: collectionInfo.vectors.distance,
        status: collectionInfo.status
      };

      res.status(200).json({
        success: true,
        data: info
      });
    } catch (error) {
      this.logger.error('Failed to get collection info:', { error, collectionId: req.params.collectionId });
      next(error);
    }
  }

  /**
   * Get collection points
   */
  private async getCollectionPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { collectionId } = req.params;
      const { limit = 100, offset, filter } = req.query;

      if (!collectionId) {
        res.status(400).json({
          success: false,
          error: 'collectionId is required'
        });
        return;
      }

      // 解析过滤器
      let parsedFilter: any = undefined;
      if (filter && typeof filter === 'string') {
        try {
          parsedFilter = JSON.parse(filter);
        } catch (e) {
          res.status(400).json({
            success: false,
            error: 'Invalid filter JSON'
          });
          return;
        }
      }

      // 滚动浏览点
      const points = await this.qdrantService.scrollPoints(
        collectionId, 
        parsedFilter, 
        parseInt(limit as string), 
        offset
      );

      res.status(200).json({
        success: true,
        data: points
      });
    } catch (error) {
      this.logger.error('Failed to get collection points:', { error, collectionId: req.params.collectionId });
      next(error);
    }
  }

  /**
   * Get collection statistics
   */
  private async getCollectionStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { collectionId } = req.params;

      if (!collectionId) {
        res.status(400).json({
          success: false,
          error: 'collectionId is required'
        });
        return;
      }

      const stats = await this.qdrantService.getCollectionStats(collectionId);
      
      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Collection not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Failed to get collection stats:', { error, collectionId: req.params.collectionId });
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}