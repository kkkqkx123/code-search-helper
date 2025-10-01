import { Router, Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { GraphSearchService } from '../../service/graph/core/GraphSearchService';
import { GraphPersistenceService } from '../../service/graph/core/GraphPersistenceService';
import { GraphQueryValidator } from '../../service/graph/validation/GraphQueryValidator';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { LoggerService } from '../../utils/LoggerService';

@injectable()
export class GraphQueryRoutes {
  private router: Router;
  private graphSearchService: GraphSearchService;
  private graphPersistenceService: GraphPersistenceService;
  private validator: GraphQueryValidator;
  private performanceMonitor: GraphPerformanceMonitor;
  private logger: LoggerService;

  constructor(
    @inject(TYPES.GraphSearchService) graphSearchService: GraphSearchService,
    @inject(TYPES.GraphPersistenceService) graphPersistenceService: GraphPersistenceService,
    @inject(TYPES.GraphQueryValidator) validator: GraphQueryValidator,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(TYPES.LoggerService) logger: LoggerService
 ) {
    this.graphSearchService = graphSearchService;
    this.graphPersistenceService = graphPersistenceService;
    this.validator = validator;
    this.performanceMonitor = performanceMonitor;
    this.logger = logger;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 自定义查询路由
    this.router.post('/query', this.executeQuery.bind(this));

    // 关系查询路由
    this.router.post('/related', this.findRelatedNodes.bind(this));

    // 路径搜索路由
    this.router.post('/path/shortest', this.findShortestPath.bind(this));
    this.router.post('/path/all', this.findAllPaths.bind(this));

    // 图遍历查询
    this.router.post('/traversal', this.traverseGraph.bind(this));

    // 搜索查询
    this.router.post('/search', this.graphSearch.bind(this));
    this.router.get('/search/suggestions', this.getSearchSuggestions.bind(this));
  }

  /**
   * 执行自定义查询端点
   */
 private async executeQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, projectId, parameters } = req.body;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Query is required'
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

      // 验证查询安全性
      const validation = this.validator.validateQuery(query);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid Query',
          message: validation.error
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphSearchService.executeCustomQuery(query, projectId, parameters);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQuery(executionTime, true);
      this.logger.info(`Executed custom query for project: ${projectId}`, { executionTime, queryLength: query.length });

      res.status(200).json({
        success: true,
        data: result,
        executionTime
      });
    } catch (error) {
      this.logger.error('Error executing query', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 查询相关节点端点
   */
  private async findRelatedNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodeId, projectId, relationshipTypes, maxDepth, limit } = req.body;

      if (!nodeId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Node ID is required'
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
      const result = await this.graphSearchService.findRelatedNodes(nodeId, projectId, {
        relationshipTypes,
        maxDepth,
        limit
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQuery(executionTime, true);
      this.logger.info(`Found related nodes for node: ${nodeId}`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        nodes: result.nodes,
        relationships: result.relationships
      });
    } catch (error) {
      this.logger.error('Error finding related nodes', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 最短路径搜索端点
   */
  private async findShortestPath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceId, targetId, projectId, edgeTypes, maxDepth } = req.body;

      if (!sourceId || !targetId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Source ID and Target ID are required'
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
      const result = await this.graphSearchService.findShortestPath(sourceId, targetId, projectId, {
        edgeTypes,
        maxDepth
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQuery(executionTime, true);
      this.logger.info(`Found shortest path from ${sourceId} to ${targetId}`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error finding shortest path', { error: (error as Error).message });
      next(error);
    }
 }

  /**
   * 所有路径搜索端点
   */
  private async findAllPaths(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceId, targetId, projectId, maxDepth } = req.body;

      if (!sourceId || !targetId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Source ID and Target ID are required'
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
      const result = await this.graphSearchService.findAllPaths(sourceId, targetId, projectId, {
        maxDepth
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQuery(executionTime, true);
      this.logger.info(`Found all paths from ${sourceId} to ${targetId}`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error finding all paths', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 图遍历查询端点
   */
  private async traverseGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startNode, projectId, traversalType, depth, filters } = req.body;

      if (!startNode) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Start node is required'
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
      const result = await this.graphSearchService.traverseGraph(startNode, projectId, {
        traversalType,
        depth,
        filters
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQuery(executionTime, true);
      this.logger.info(`Traversed graph from node: ${startNode}`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error traversing graph', { error: (error as Error).message });
      next(error);
    }
 }

  /**
   * 图语义搜索端点
   */
  private async graphSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, projectId, limit, filters } = req.body;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Search query is required'
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
      const result = await this.graphSearchService.semanticSearch(query, projectId, {
        limit,
        filters
      });
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQuery(executionTime, true);
      this.logger.info(`Performed graph search for query: ${query}`, { executionTime, projectId });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error performing graph search', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * 搜索建议端点
   */
  private async getSearchSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, queryPrefix } = req.query;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required'
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.graphSearchService.getSearchSuggestions(projectId as string, queryPrefix as string);
      const executionTime = Date.now() - startTime;

      this.performanceMonitor.recordQuery(executionTime, true);
      this.logger.info(`Retrieved search suggestions for project: ${projectId}`, { executionTime });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error getting search suggestions', { error: (error as Error).message });
      next(error);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}