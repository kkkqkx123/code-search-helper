import { Router, Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { IGraphService } from '../../service/graph/core/IGraphService';
import { GraphCacheService } from '../../service/graph/cache/GraphCacheService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../utils/LoggerService';

@injectable()
export class GraphStatsRoutes {
  private router: Router;
  private graphService: IGraphService;
  private graphCacheService: GraphCacheService;
  private performanceMonitor: GraphPerformanceMonitor;
  private logger: LoggerService;

  constructor(
    @inject(TYPES.GraphServiceNewAdapter) graphService: IGraphService,
    @inject(TYPES.GraphCacheService) graphCacheService: GraphCacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.graphService = graphService;
    this.graphCacheService = graphCacheService;
    this.performanceMonitor = performanceMonitor;
    this.logger = logger;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 图统计信息路由
    this.router.get('/stats/:projectId', this.getGraphStats.bind(this));
    this.router.get('/stats/cache', this.getCacheStats.bind(this));
    this.router.get('/stats/performance', this.getPerformanceStats.bind(this));

    // 监控端点路由
    this.router.get('/stats/health', this.healthCheck.bind(this));
    this.router.get('/stats/status', this.getServiceStatus.bind(this));
  }

  /**
    * 获取图统计信息端点
    */
  private async getGraphStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.getGraphStats(projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Retrieved graph stats for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error getting graph stats', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 获取缓存统计端点
   */
  private async getCacheStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now();
      const result = this.graphCacheService.getCacheStats();
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info('Retrieved cache stats', { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error getting cache stats', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 获取性能指标端点
   */
  private async getPerformanceStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now();
      const result = this.performanceMonitor.getMetrics();
      const executionTime = Date.now() - startTime;

      this.logger.info('Retrieved performance stats', { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error getting performance stats', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 健康检查端点
   */
  private async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now();

      // 检查各种服务的健康状态
      const graphServiceHealthy = await this.graphService.isHealthy();
      const cacheHealthy = this.graphCacheService.isHealthy();
      const performanceMonitorHealthy = this.performanceMonitor.isHealthy();

      const executionTime = Date.now() - startTime;

      const isHealthy = graphServiceHealthy && cacheHealthy && performanceMonitorHealthy;

      res.status(isHealthy ? 200 : 503).json({
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          services: {
            graphService: graphServiceHealthy,
            cacheService: cacheHealthy,
            performanceMonitor: performanceMonitorHealthy
          },
          executionTime
        }
      });
    } catch (error) {
      this.logger.error('Error performing health check', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 服务状态端点
   */
  private async getServiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now();

      // 获取各种服务的状态
      const graphServiceStatus = await this.graphService.getStatus();
      const cacheStatus = this.graphCacheService.getStatus();
      const performanceStatus = this.performanceMonitor.getStatus();

      const executionTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          services: {
            graphService: graphServiceStatus,
            cacheService: cacheStatus,
            performanceMonitor: performanceStatus
          },
          executionTime
        }
      });
    } catch (error) {
      this.logger.error('Error getting service status', { error: (error as Error).message });
      next(error);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}