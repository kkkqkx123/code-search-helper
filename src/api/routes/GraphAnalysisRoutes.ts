import { Router, Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { IGraphService } from '../../service/graph/core/IGraphService';
import { GraphSearchServiceNew } from '../../service/graph/core/GraphSearchService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../utils/LoggerService';

@injectable()
export class GraphAnalysisRoutes {
  private router: Router;
  private graphService: IGraphService;
  private graphSearchService: GraphSearchServiceNew;
  private performanceMonitor: GraphPerformanceMonitor;
  private logger: LoggerService;

  constructor(
    @inject(TYPES.GraphService) graphService: IGraphService,
    @inject(TYPES.GraphSearchServiceNew) graphSearchService: GraphSearchServiceNew,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.graphService = graphService;
    this.graphSearchService = graphSearchService;
    this.performanceMonitor = performanceMonitor;
    this.logger = logger;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 依赖分析路由
    this.router.post('/analysis/dependencies', this.analyzeDependencies.bind(this));
    this.router.get('/analysis/circular/:projectId', this.detectCircularDependencies.bind(this));

    // 调用图分析路由
    this.router.post('/analysis/callgraph', this.analyzeCallGraph.bind(this));
    this.router.post('/analysis/impact', this.analyzeImpact.bind(this));

    // 代码结构分析路由
    this.router.get('/analysis/overview/:projectId', this.getProjectOverview.bind(this));
    this.router.get('/analysis/metrics/:projectId', this.getStructureMetrics.bind(this));
  }

  /**
   * 文件依赖分析端点
   */
  private async analyzeDependencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath, projectId, includeTransitive, includeCircular } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'File path is required'
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.analyzeDependencies(filePath, projectId, {
        includeTransitive,
        includeCircular
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Analyzed dependencies for file: ${filePath}`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error analyzing dependencies', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 循环依赖检测端点
   */
  private async detectCircularDependencies(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const result = await this.graphService.detectCircularDependencies(projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Detected circular dependencies for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error detecting circular dependencies', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 函数调用图分析端点
   */
  private async analyzeCallGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { functionName, projectId, depth, direction } = req.body;

      if (!functionName) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Function name is required'
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.analyzeCallGraph(functionName, projectId, {
        depth,
        direction
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Analyzed call graph for function: ${functionName}`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error analyzing call graph', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 影响范围分析端点
   */
  private async analyzeImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodeIds, projectId, depth } = req.body;

      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Node IDs array is required and cannot be empty'
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.analyzeImpact(nodeIds, projectId, { depth });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Analyzed impact for ${nodeIds.length} nodes`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error analyzing impact', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 项目概览端点
   */
  private async getProjectOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const result = await this.graphService.getProjectOverview(projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Retrieved project overview for: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error getting project overview', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 结构指标端点
   */
  private async getStructureMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const result = await this.graphService.getStructureMetrics(projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Retrieved structure metrics for: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error getting structure metrics', { error: (error as Error).message });
      next(error);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}