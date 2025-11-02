import { Router, Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { IGraphService } from '../../service/graph/core/IGraphService';
import { ProjectLookupService } from '../../database/ProjectLookupService';
import { GraphQueryValidator } from '../../service/graph/query/GraphQueryValidator';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../utils/LoggerService';

@injectable()
export class GraphRoutes {
  private router: Router;
  private graphService: IGraphService;
  private projectLookupService: ProjectLookupService;
  private validator: GraphQueryValidator;
  private performanceMonitor: GraphPerformanceMonitor;
  private logger: LoggerService;

  constructor(
    @inject(TYPES.GraphService) graphService: IGraphService,
    @inject(TYPES.ProjectLookupService) projectLookupService: ProjectLookupService,
    @inject(TYPES.GraphQueryValidator) validator: GraphQueryValidator,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.graphService = graphService;
    this.projectLookupService = projectLookupService;
    this.validator = validator;
    this.performanceMonitor = performanceMonitor;
    this.logger = logger;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 项目空间管理路由
    this.router.post('/space/:projectId/create', this.createSpace.bind(this));
    this.router.post('/space/:projectId/delete', this.deleteSpace.bind(this));
    this.router.post('/space/:projectId/clear', this.clearSpace.bind(this));
    this.router.get('/space/:projectId/info', this.getSpaceInfo.bind(this));

    // 图数据操作路由
    this.router.post('/nodes', this.insertNodes.bind(this));
    this.router.post('/edges', this.insertEdges.bind(this));
    this.router.delete('/nodes', this.deleteNodes.bind(this));
  }

  /**
   * 创建项目空间端点
   */
  private async createSpace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { partitionNum, replicaFactor, vidType } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.createSpace(projectId, {
        partitionNum,
        replicaFactor,
        vidType
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Created space for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error creating space', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 删除项目空间端点
   */
  private async deleteSpace(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const result = await this.graphService.dropSpace(projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Deleted space for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error deleting space', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 清空项目空间端点
   */
  private async clearSpace(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const result = await this.graphService.clearSpace(projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Cleared space for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error clearing space', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 获取空间信息端点
   */
  private async getSpaceInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const result = await this.graphService.getSpaceInfo(projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Retrieved space info for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error getting space info', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 批量插入节点端点
   */
  private async insertNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodes, projectId } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      if (!Array.isArray(nodes) || nodes.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Nodes array is required and cannot be empty'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.batchInsertNodes(nodes, projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Inserted ${nodes.length} nodes for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error inserting nodes', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 批量插入边端点
   */
  private async insertEdges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { edges, projectId } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      if (!Array.isArray(edges) || edges.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Edges array is required and cannot be empty'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.batchInsertEdges(edges, projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Inserted ${edges.length} edges for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error inserting edges', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 批量删除节点端点
   */
  private async deleteNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodeIds, projectId } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Node IDs array is required and cannot be empty'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphService.batchDeleteNodes(nodeIds, projectId);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQueryExecution(executionTime);
      this.logger.info(`Deleted ${nodeIds.length} nodes for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error deleting nodes', { error: (error as Error).message });
      next(error);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}