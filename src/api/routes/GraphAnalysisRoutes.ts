import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import {
  IGraphService,
  GraphOptions,
  GraphQueryResult,
  DependencyResult,
  CallGraphResult,
} from '../../services/graph/IGraphService';
import { ProjectLookupService } from '../../database/ProjectLookupService';

export interface GraphAnalysisRequest {
  projectId: string;
  options?: GraphOptions;
}

export interface GraphQueryRequest {
  query: string;
  projectId: string;
}

export interface DependencyAnalysisRequest {
  filePath: string;
  projectId: string;
  includeTransitive?: boolean;
  includeCircular?: boolean;
}

export interface CallGraphRequest {
  functionName: string;
  projectId: string;
  depth?: number;
}

export class GraphAnalysisRoutes {
  private router: Router;
  private graphService: IGraphService;
  private projectLookupService: ProjectLookupService;

  constructor() {
    const container = DIContainer.getInstance();
    this.graphService = container.get<IGraphService>(TYPES.GraphService);
    this.projectLookupService = container.get<ProjectLookupService>(TYPES.ProjectLookupService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Analyze codebase structure
    this.router.post('/analyze', this.analyzeCodebase.bind(this));

    // Query graph with custom query
    this.router.post('/query', this.queryGraph.bind(this));

    // Find dependencies for a file
    this.router.post('/dependencies', this.findDependencies.bind(this));

    // Get call graph for a function
    this.router.post('/callgraph', this.findCallGraph.bind(this));

    // Get project graph overview
    this.router.get('/overview/:projectId', this.getProjectOverview.bind(this));

    // Find circular dependencies
    this.router.get('/circular/:projectId', this.findCircularDependencies.bind(this));

    // Get graph metrics
    this.router.get('/metrics/:projectId', this.getGraphMetrics.bind(this));

    // Find impacted nodes (files that would be affected by changes)
    this.router.post('/impact', this.findImpactedNodes.bind(this));
  }

  private async analyzeCodebase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, options } = req.body as GraphAnalysisRequest;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required',
        });
        return;
      }

      // Handle "default-project" by using the project with latest update time
      let resolvedProjectId = projectId;
      if (projectId === 'default-project') {
        const latestProjectId = await this.projectLookupService.getLatestUpdatedProjectId();
        if (latestProjectId) {
          resolvedProjectId = latestProjectId;
        } else {
          // If no projects exist, return an appropriate error
          res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'No projects available. Please index a project first.',
          });
          return;
        }
      }

      // 将projectId转换为projectPath
      const projectPath = await this.projectLookupService.getProjectPathByProjectId(resolvedProjectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Project path not found for project ID: ${resolvedProjectId}`,
        });
        return;
      }

      const result = await this.graphService.analyzeCodebase(projectPath, options);

      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          projectId: resolvedProjectId,
          projectPath,
          analysisOptions: options,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
 }

  private async queryGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, projectId } = req.body as GraphQueryRequest;

      if (!query || !projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Query and project ID are required',
        });
        return;
      }

      const result: GraphQueryResult = await this.graphService.queryGraph(query);

      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          projectId,
          query,
          executionTime: result.executionTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async findDependencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        filePath,
        projectId,
        includeTransitive = true,
        includeCircular = true,
      } = req.body as DependencyAnalysisRequest;

      if (!filePath || !projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'File path and project ID are required',
        });
        return;
      }

      const result: DependencyResult = await this.graphService.findDependencies(filePath);

      const filteredResult = {
        direct: result.direct,
        transitive: includeTransitive ? result.transitive : [],
        circular: includeCircular ? result.circular : [],
      };

      res.status(200).json({
        success: true,
        data: filteredResult,
        metadata: {
          projectId,
          filePath,
          includeTransitive,
          includeCircular,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async findCallGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { functionName, projectId, depth = 3 } = req.body as CallGraphRequest;

      if (!functionName || !projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Function name and project ID are required',
        });
        return;
      }

      const result: CallGraphResult = await this.graphService.findCallGraph(functionName);

      res.status(200).json({
        success: true,
        data: {
          ...result,
          requestedDepth: depth,
        },
        metadata: {
          projectId,
          functionName,
          depth,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getProjectOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required',
        });
        return;
      }

      // Handle "default-project" by using the project with latest update time
      let resolvedProjectId = projectId;
      if (projectId === 'default-project') {
        const latestProjectId = await this.projectLookupService.getLatestUpdatedProjectId();
        if (latestProjectId) {
          resolvedProjectId = latestProjectId;
        } else {
          // If no projects exist, return an appropriate error
          res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'No projects available. Please index a project first.',
          });
          return;
        }
      }

      // 将projectId转换为projectPath
      const projectPath = await this.projectLookupService.getProjectPathByProjectId(resolvedProjectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Project path not found for project ID: ${resolvedProjectId}`,
        });
        return;
      }

      const result = await this.graphService.analyzeCodebase(projectPath, {
        depth: 2,
        includeExternal: false,
      });

      const overview = {
        nodes: result.nodes.slice(0, 100), // Limit for overview
        relationships: result.relationships.slice(0, 200), // Limit for overview
        metrics: result.metrics,
        summary: {
          totalFiles: result.nodes.filter(n => n.type === 'file').length,
          totalFunctions: result.nodes.filter(n => n.type === 'function').length,
          totalClasses: result.nodes.filter(n => n.type === 'class').length,
          totalImports: result.nodes.filter(n => n.type === 'import').length,
        },
      };

      res.status(200).json({
        success: true,
        data: overview,
        metadata: {
          projectId: resolvedProjectId,
          projectPath,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async findCircularDependencies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required',
        });
        return;
      }

      // Handle "default-project" by using the project with latest update time
      let resolvedProjectId = projectId;
      if (projectId === 'default-project') {
        const latestProjectId = await this.projectLookupService.getLatestUpdatedProjectId();
        if (latestProjectId) {
          resolvedProjectId = latestProjectId;
        } else {
          // If no projects exist, return an appropriate error
          res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'No projects available. Please index a project first.',
          });
          return;
        }
      }

      // 将projectId转换为projectPath
      const projectPath = await this.projectLookupService.getProjectPathByProjectId(resolvedProjectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Project path not found for project ID: ${resolvedProjectId}`,
        });
        return;
      }

      // Analyze all files in project to find circular dependencies
      const result = await this.graphService.analyzeCodebase(projectPath);

      // Filter for circular dependencies
      const circularDependencies = result.relationships.filter(
        edge => edge.type === 'circular_dependency'
      );

      res.status(200).json({
        success: true,
        data: {
          circularDependencies,
          count: circularDependencies.length,
          affectedFiles: [
            ...new Set(circularDependencies.flatMap(dep => [dep.source, dep.target])),
          ],
        },
        metadata: {
          projectId: resolvedProjectId,
          projectPath,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getGraphMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required',
        });
        return;
      }

      // Handle "default-project" by using the project with latest update time
      let resolvedProjectId = projectId;
      if (projectId === 'default-project') {
        const latestProjectId = await this.projectLookupService.getLatestUpdatedProjectId();
        if (latestProjectId) {
          resolvedProjectId = latestProjectId;
        } else {
          // If no projects exist, return an appropriate error
          res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'No projects available. Please index a project first.',
          });
          return;
        }
      }

      // 将projectId转换为projectPath
      const projectPath = await this.projectLookupService.getProjectPathByProjectId(resolvedProjectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Project path not found for project ID: ${resolvedProjectId}`,
        });
        return;
      }

      const result = await this.graphService.analyzeCodebase(projectPath);

      res.status(200).json({
        success: true,
        data: result.metrics,
        metadata: {
          projectId: resolvedProjectId,
          projectPath,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

   private async findImpactedNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
     try {
       const {
         nodeIds,
         projectId,
         depth = 2,
       } = req.body as {
         nodeIds: string[];
         projectId: string;
         depth?: number;
       };
 
       if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0 || !projectId) {
         res.status(400).json({
           success: false,
           error: 'Bad Request',
           message: 'Node IDs array and project ID are required',
         });
         return;
       }
 
       // Handle "default-project" by using the project with latest update time
       let resolvedProjectId = projectId;
       if (projectId === 'default-project') {
         const latestProjectId = await this.projectLookupService.getLatestUpdatedProjectId();
         if (latestProjectId) {
           resolvedProjectId = latestProjectId;
         } else {
           // If no projects exist, return an appropriate error
           res.status(404).json({
             success: false,
             error: 'Not Found',
             message: 'No projects available. Please index a project first.',
           });
           return;
         }
       }
 
       // Find all nodes that depend on the given nodes
       const impactedNodes: string[] = [];
       const processedNodes = new Set<string>();
 
       for (const nodeId of nodeIds) {
         if (!processedNodes.has(nodeId)) {
           // Query for nodes that depend on this node
           const query = `MATCH (n)-[:DEPENDS_ON*1..${depth}]->(m {id: "${nodeId}"}) RETURN n`;
           const result = await this.graphService.queryGraph(query);
 
           result.nodes.forEach(node => {
             if (!processedNodes.has(node.id)) {
               impactedNodes.push(node.id);
               processedNodes.add(node.id);
             }
           });
         }
       }
 
       res.status(200).json({
         success: true,
         data: {
           impactedNodes,
           impactDepth: depth,
           totalImpacted: impactedNodes.length,
         },
         metadata: {
           projectId: resolvedProjectId,
           sourceNodes: nodeIds,
           depth,
           timestamp: new Date().toISOString(),
         },
       });
     } catch (error) {
       next(error);
     }
   }

  public getRouter(): Router {
    return this.router;
  }
}
