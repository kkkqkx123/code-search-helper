import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { HashUtils } from '../../../utils/HashUtils';
import { IGraphService } from '../core/IGraphService';
import { GraphNode, GraphEdge, GraphAnalysisOptions, GraphAnalysisResult, CodeGraphNode, CodeGraphRelationship, GraphPersistenceOptions, GraphPersistenceResult, GraphSearchOptions, GraphSearchResult } from './types';
import { IGraphAnalysisService } from './IGraphAnalysisService';
import { IGraphDataService } from './IGraphDataService';
import { IGraphTransactionService } from './IGraphTransactionService';
import { IGraphSearchService } from './GraphSearchServiceNew';

@injectable()
export class GraphServiceAdapter implements IGraphService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private graphAnalysisService: IGraphAnalysisService;
  private graphDataService: IGraphDataService;
  private graphTransactionService: IGraphTransactionService;
  private graphSearchService: IGraphSearchService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.GraphAnalysisService) graphAnalysisService: IGraphAnalysisService,
    @inject(TYPES.GraphDataService) graphDataService: IGraphDataService,
    @inject(TYPES.GraphTransactionService) graphTransactionService: IGraphTransactionService,
    @inject(TYPES.GraphSearchServiceNew) graphSearchService: IGraphSearchService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.graphAnalysisService = graphAnalysisService;
    this.graphDataService = graphDataService;
    this.graphTransactionService = graphTransactionService;
    this.graphSearchService = graphSearchService;
  }

  async analyzeCodebase(
    projectPath: string,
    options: GraphAnalysisOptions = {}
  ): Promise<{
    result: GraphAnalysisResult;
    formattedResult: any;
  }> {
    return this.graphAnalysisService.analyzeCodebase(projectPath, options);
  }

  async findDependencies(
    filePath: string,
    options?: { direction?: 'incoming' | 'outgoing'; depth?: number }
  ): Promise<{
    direct: CodeGraphRelationship[];
    transitive: CodeGraphRelationship[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  }> {
    return this.graphAnalysisService.findDependencies(filePath, options);
  }

  async findImpact(
    filePath: string,
    options?: { maxDepth?: number; includeTests?: boolean }
  ): Promise<{
    affectedFiles: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    impactScore: number;
    affectedComponents: string[];
  }> {
    return this.graphAnalysisService.findImpact(filePath, options);
  }

  async getGraphStats(projectPath: string): Promise<{
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalImports: number;
    complexityScore: number;
    maintainabilityIndex: number;
    cyclicDependencies: number;
  }> {
    return this.graphAnalysisService.getGraphStats(projectPath);
  }

  async exportGraph(projectPath: string, format: 'json' | 'graphml' | 'dot'): Promise<string> {
    return this.graphAnalysisService.exportGraph(projectPath, format);
  }

  async findRelatedNodes(
    nodeId: string,
    relationshipTypes?: string[],
    maxDepth?: number
  ): Promise<CodeGraphNode[]> {
    return this.graphDataService.findRelatedNodes(nodeId, relationshipTypes, maxDepth);
  }

  async findPath(
    sourceId: string,
    targetId: string,
    maxDepth?: number
  ): Promise<CodeGraphRelationship[]> {
    return this.graphDataService.findPath(sourceId, targetId, maxDepth);
  }

  async storeParsedFiles(
    files: any[],
    options?: GraphPersistenceOptions
  ): Promise<GraphPersistenceResult> {
    return this.graphDataService.storeParsedFiles(files, options);
  }

  async storeChunks(
    chunks: any[],
    options?: GraphPersistenceOptions
  ): Promise<GraphPersistenceResult> {
    return this.graphDataService.storeChunks(chunks, options);
  }

  async deleteNodes(nodeIds: string[]): Promise<boolean> {
    return this.graphDataService.deleteNodes(nodeIds);
  }

  async clearGraph(): Promise<boolean> {
    return this.graphDataService.clearGraph();
  }

  isServiceInitialized(): boolean {
    // Check if all underlying services are initialized
    return (
      this.graphAnalysisService.isServiceInitialized() &&
      this.graphDataService.isServiceInitialized()
    );
  }

  async close(): Promise<void> {
    // Close all underlying services
    await Promise.all([
      this.graphAnalysisService.close(),
      this.graphDataService.close(),
      this.graphTransactionService.close(),
      this.graphSearchService.close()
    ]);
  }

  // Additional methods from IGraphService interface

  async analyzeDependencies(
    filePath: string,
    projectId: string,
    options?: { includeTransitive?: boolean; includeCircular?: boolean }
  ): Promise<any> {
    // For now, we'll implement a basic version that uses existing functionality
    // In a full implementation, this would use more sophisticated analysis
    this.logger.info('Analyzing dependencies', { filePath, projectId, options });

    try {
      // Find dependencies of the specified file
      const dependencies = await this.findDependencies(filePath, {
        direction: 'outgoing',
        depth: options?.includeTransitive ? 5 : 1
      });

      const result = {
        directDependencies: dependencies.direct,
        transitiveDependencies: options?.includeTransitive ? dependencies.transitive : [],
        circularDependencies: [] as string[], // Would require more complex analysis
        summary: {
          directCount: dependencies.direct.length,
          transitiveCount: options?.includeTransitive ? dependencies.transitive.length : 0,
          circularCount: 0
        }
      };

      // If circular dependency check is requested, perform a basic check
      if (options?.includeCircular) {
        result.circularDependencies = await this.detectCircularDependencies(projectId);
      }

      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Dependency analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphServiceAdapter', operation: 'analyzeDependencies' }
      );
      throw error;
    }
  }

  async detectCircularDependencies(projectId: string): Promise<string[]> {
    // For now, we'll return an empty array
    // In a full implementation, this would use graph algorithms to detect cycles
    this.logger.info('Detecting circular dependencies', { projectId });

    // This is a simplified implementation
    // A complete implementation would traverse the graph to find cycles
    return [];
  }

  async analyzeCallGraph(
    functionName: string,
    projectId: string,
    options?: { depth?: number; direction?: 'in' | 'out' | 'both' }
  ): Promise<any> {
    // For now, we'll return a basic implementation
    // In a full implementation, this would use call relationship data
    this.logger.info('Analyzing call graph', { functionName, projectId, options });

    // This would typically use the graph database to find function call relationships
    return {
      callers: [],
      callees: [],
      callGraph: [],
      summary: {
        callerCount: 0,
        calleeCount: 0,
        depth: options?.depth || 3
      }
    };
  }

  async analyzeImpact(
    nodeIds: string[],
    projectId: string,
    options?: { depth?: number }
  ): Promise<any> {
    // For now, we'll return a basic implementation
    // In a full implementation, this would use graph traversal to find impacted nodes
    this.logger.info('Analyzing impact', { nodeIds, projectId, options });

    // This would typically use the graph database to find nodes reachable from the given nodes
    return {
      affectedNodes: [],
      impactPaths: [],
      summary: {
        affectedCount: 0,
        maxDepth: options?.depth || 3,
        riskLevel: 'low'
      }
    };
  }

  async getProjectOverview(projectId: string): Promise<any> {
    // For now, we'll return a basic implementation
    // In a full implementation, this would aggregate project data
    this.logger.info('Getting project overview', { projectId });

    // This would typically gather information about the project from the graph
    return {
      projectInfo: {
        id: projectId,
        name: projectId,
        fileCount: 0,
        directoryCount: 0
      },
      graphStats: {
        nodeCount: 0,
        edgeCount: 0,
        componentCount: 0
      },
      analysisSummary: {
        lastAnalyzed: new Date().toISOString(),
        issues: 0,
        warnings: 0
      }
    };
  }

  async getStructureMetrics(projectId: string): Promise<any> {
    // For now, we'll return a basic implementation
    // In a full implementation, this would calculate detailed metrics
    this.logger.info('Getting structure metrics', { projectId });

    // This would typically calculate detailed metrics about the project structure
    return {
      fileMetrics: {
        totalFiles: 0,
        codeFiles: 0,
        testFiles: 0,
        configFiles: 0
      },
      codeMetrics: {
        linesOfCode: 0,
        functions: 0,
        classes: 0,
        modules: 0
      },
      dependencyMetrics: {
        totalDependencies: 0,
        externalDependencies: 0,
        circularDependencies: 0
      },
      complexityMetrics: {
        averageComplexity: 0,
        maxComplexity: 0,
        highlyComplexFiles: 0
      }
    };
  }

  async getGraphStatsByProject(projectId: string): Promise<any> {
    // This method is likely a duplicate of getGraphStats but for a specific project
    // We'll implement it by calling getGraphStats with a dummy path and extending with project-specific data
    this.logger.info('Getting graph stats by project', { projectId });

    // For now, we'll return a basic implementation
    return {
      nodeCount: 0,
      edgeCount: 0,
      nodeTypes: {},
      relationshipTypes: {},
      projectSpecificMetrics: {
        id: projectId,
        name: projectId
      }
    };
  }

  async isHealthy(): Promise<boolean> {
    // Check if all underlying services are healthy
    try {
      return (
        this.graphAnalysisService.isServiceInitialized() &&
        this.graphDataService.isServiceInitialized() &&
        this.graphTransactionService.isServiceInitialized() &&
        this.graphSearchService.isServiceInitialized()
      );
    } catch (error) {
      this.logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async getStatus(): Promise<any> {
    // Return status information for all underlying services
    return {
      status: 'running',
      uptime: process.uptime(),
      version: '1.0.0',
      services: {
        analysis: this.graphAnalysisService.isServiceInitialized(),
        data: this.graphDataService.isServiceInitialized(),
        transaction: this.graphTransactionService.isServiceInitialized(),
        search: this.graphSearchService.isServiceInitialized()
      }
    };
  }

  // Search methods

  async search(query: string, options?: GraphSearchOptions): Promise<GraphSearchResult> {
    return this.graphSearchService.search(query, options);
  }

  async searchByNodeType(nodeType: string, options?: GraphSearchOptions): Promise<GraphSearchResult> {
    return this.graphSearchService.searchByNodeType(nodeType, options);
  }

  async searchByRelationshipType(relationshipType: string, options?: GraphSearchOptions): Promise<GraphSearchResult> {
    return this.graphSearchService.searchByRelationshipType(relationshipType, options);
  }

  async searchByPath(sourceId: string, targetId: string, options?: GraphSearchOptions): Promise<GraphSearchResult> {
    return this.graphSearchService.searchByPath(sourceId, targetId, options);
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    return this.graphSearchService.getSearchSuggestions(query);
  }

  async getSearchStats(): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  }> {
    return this.graphSearchService.getSearchStats();
  }
}