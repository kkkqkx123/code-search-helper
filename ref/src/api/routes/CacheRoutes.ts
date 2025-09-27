import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { CacheController } from '../../controllers/CacheController';

export class CacheRoutes {
  private router: Router;
  private cacheController: CacheController;

  constructor() {
    const container = DIContainer.getInstance();
    this.cacheController = container.get<CacheController>(TYPES.CacheController);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route GET /api/v1/cache/stats
     * @desc Get statistics for all cache instances
     * @returns {object} 200 - Cache statistics
     */
    this.router.get('/stats', this.getStats.bind(this));

    /**
     * @route GET /api/v1/cache/health
     * @desc Get health status of cache system
     * @returns {object} 200 - Health status
     */
    this.router.get('/health', this.getHealth.bind(this));

    /**
     * @route GET /api/v1/cache/list
     * @desc List available cache instances
     * @returns {object} 200 - List of caches
     */
    this.router.get('/list', this.listCaches.bind(this));

    /**
     * @route DELETE /api/v1/cache/:cacheName
     * @desc Clear specific cache instance
     * @param {string} cacheName.path - Cache name
     * @returns {object} 200 - Clear result
     */
    this.router.delete('/:cacheName', this.clearCache.bind(this));

    /**
     * @route DELETE /api/v1/cache
     * @desc Clear all cache instances
     * @returns {object} 200 - Clear result
     */
    this.router.delete('/', this.clearAllCaches.bind(this));

    /**
     * @route GET /api/v1/cache/:cacheName/value
     * @desc Get value from specific cache
     * @param {string} cacheName.path - Cache name
     * @param {string} key.query - Cache key
     * @returns {object} 200 - Cache value
     */
    this.router.get('/:cacheName/value', this.getValue.bind(this));

    /**
     * @route POST /api/v1/cache/:cacheName/value
     * @desc Set value in specific cache
     * @param {string} cacheName.path - Cache name
     * @body {object} request body
     * @property {string} key.required - Cache key
     * @property {any} value.required - Cache value
     * @property {number} ttl.optional - TTL in seconds
     * @returns {object} 200 - Set result
     */
    this.router.post('/:cacheName/value', this.setValue.bind(this));

    /**
     * @route DELETE /api/v1/cache/:cacheName/value
     * @desc Delete key from specific cache
     * @param {string} cacheName.path - Cache name
     * @param {string} key.query - Cache key
     * @returns {object} 200 - Delete result
     */
    this.router.delete('/:cacheName/value', this.deleteKey.bind(this));

    /**
     * @route GET /api/v1/cache/:cacheName/exists
     * @desc Check if key exists in cache
     * @param {string} cacheName.path - Cache name
     * @param {string} key.query - Cache key
     * @returns {object} 200 - Existence check result
     */
    this.router.get('/:cacheName/exists', this.keyExists.bind(this));
  }

  private async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.getStats(req, res, next);
  }

  private async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.getHealth(req, res, next);
  }

  private async listCaches(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.listCaches(req, res, next);
  }

  private async clearCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.clearCache(req, res, next);
  }

  private async clearAllCaches(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.clearAllCaches(req, res, next);
  }

  private async getValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.getValue(req, res, next);
  }

  private async setValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.setValue(req, res, next);
  }

  private async deleteKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.deleteKey(req, res, next);
  }

  private async keyExists(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.cacheController.keyExists(req, res, next);
  }

  public getRouter(): Router {
    return this.router;
  }
}