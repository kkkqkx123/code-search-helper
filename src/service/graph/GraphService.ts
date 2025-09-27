import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { HashUtils } from '../../utils/HashUtils';
import { NebulaService } from '../../database/NebulaService';
import { GraphPersistenceService } from '../storage/graph/GraphPersistenceService';
import { NebulaQueryBuilder } from '../../database/nebula/NebulaQueryBuilder';
import { ResultFormatter } from '../query/ResultFormatter';

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, any>;
  type: 'file' | 'function' | 'class' | 'variable' | 'import' | 'project';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphAnalysisOptions {
  depth?: number;
  focus?: 'dependencies' | 'imports' | 'classes' | 'functions';
  includeFiles?: boolean;
  includeExternal?: boolean;
}

export interface GraphAnalysisResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics: {
    totalNodes: number;
    totalEdges: number;
    averageDegree: number;
    maxDepth: number;
    componentCount: number;
  };
  summary: {
    projectFiles: number;
    functions: number;
    classes: number;
    imports: number;
    externalDependencies: number;
  };
}

@injectable()
export class GraphService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private nebulaService: NebulaService;
  private graphPersistenceService: GraphPersistenceService;
  private nebulaQueryBuilder: NebulaQueryBuilder;
  private resultFormatter: ResultFormatter;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.GraphPersistenceService) graphPersistenceService: GraphPersistenceService,
    @inject(TYPES.NebulaQueryBuilder) nebulaQueryBuilder: NebulaQueryBuilder,
    @inject(TYPES.ResultFormatter) resultFormatter: ResultFormatter
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.nebulaService = nebulaService;
    this.graphPersistenceService = graphPersistenceService;
    this.nebulaQueryBuilder = nebulaQueryBuilder;
    this.resultFormatter = resultFormatter;
  }

  async analyzeCodebase(
    projectPath: string,
    options: GraphAnalysisOptions = {}
  ): Promise<{
    result: GraphAnalysisResult;
    formattedResult: any;
  }> {
    const startTime = Date.now();
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Starting codebase analysis', {
      projectPath,
      projectId: projectId.hash,
      options,
    });

    try {
      // Use real NebulaGraph traversal queries
      const analysisQuery = this.buildAnalysisQuery(projectId.hash, options);
      const result = await this.nebulaService.executeReadQuery(
        analysisQuery.query,
        analysisQuery.params
      );

      const processedResult = await this.processAnalysisResult(result, options);

      this.logger.info('Codebase analysis completed', {
        projectId: projectId.hash,
        nodeCount: processedResult.nodes.length,
        edgeCount: processedResult.edges.length,
        duration: Date.now() - startTime,
      });

      return {
        result: processedResult,
        formattedResult: await this.resultFormatter.formatForLLM(processedResult),
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Codebase analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphService', operation: 'analyzeCodebase' }
      );
      throw error;
    }
  }

  async findDependencies(
    filePath: string,
    options: { direction?: 'incoming' | 'outgoing'; depth?: number } = {}
  ): Promise<{
    direct: GraphEdge[];
    transitive: GraphEdge[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  }> {
    this.logger.info('Finding dependencies', { filePath, options });

    try {
      const fileId = this.generateFileId(filePath);
      const direction = options.direction || 'outgoing';
      const depth = options.depth || 3;

      // Use NebulaGraph's GO statement for dependency traversal
      const dependencyQuery = this.buildDependencyQuery(fileId, direction, depth);
      const result = await this.nebulaService.executeReadQuery(
        dependencyQuery.query,
        dependencyQuery.params
      );

      return this.processDependencyResult(result, direction, depth);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Dependency analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphService', operation: 'findDependencies' }
      );
      throw error;
    }
  }

  async findImpact(
    filePath: string,
    options: { maxDepth?: number; includeTests?: boolean } = {}
  ): Promise<{
    affectedFiles: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    impactScore: number;
    affectedComponents: string[];
  }> {
    this.logger.info('Finding impact', { filePath, options });

    try {
      // Simulate impact analysis
      await this.simulateImpactAnalysis(filePath, options);

      return {
        affectedFiles: [
          'src/components/Button.tsx',
          'src/components/Button.test.tsx',
          'src/pages/Home.tsx',
          'src/App.tsx',
        ],
        riskLevel: 'medium',
        impactScore: 7.5,
        affectedComponents: ['Button', 'Home', 'App'],
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphService', operation: 'findImpact' }
      );
      throw error;
    }
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
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Getting graph statistics', { projectPath, projectId: projectId.hash });

    try {
      // Simulate stats calculation
      await this.simulateStatsCalculation();

      return {
        totalFiles: 45,
        totalFunctions: 67,
        totalClasses: 23,
        totalImports: 89,
        complexityScore: 72.5,
        maintainabilityIndex: 85.3,
        cyclicDependencies: 2,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Graph stats calculation failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphService', operation: 'getGraphStats' }
      );
      throw error;
    }
  }

  async exportGraph(projectPath: string, format: 'json' | 'graphml' | 'dot'): Promise<string> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Exporting graph', { projectPath, projectId: projectId.hash, format });

    try {
      // Simulate export process
      await this.simulateExport(format);

      const mockData = {
        nodes: this.generateMockNodes(),
        edges: this.generateMockEdges(),
        metadata: {
          projectPath,
          exportedAt: new Date().toISOString(),
          format,
        },
      };

      return JSON.stringify(mockData, null, 2);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Graph export failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphService', operation: 'exportGraph' }
      );
      throw error;
    }
  }

  private generateMockNodes(): GraphNode[] {
    return [
      {
        id: 'file_1',
        label: 'Button.tsx',
        properties: { path: 'src/components/Button.tsx', type: 'file', language: 'typescript' },
        type: 'file',
      },
      {
        id: 'function_1',
        label: 'Button',
        properties: { name: 'Button', file: 'src/components/Button.tsx', line: 15 },
        type: 'function',
      },
      {
        id: 'class_1',
        label: 'AuthService',
        properties: { name: 'AuthService', file: 'src/services/AuthService.ts', line: 8 },
        type: 'class',
      },
    ];
  }

  private generateMockEdges(): GraphEdge[] {
    return [
      {
        id: 'edge_1',
        source: 'file_1',
        target: 'function_1',
        type: 'CONTAINS',
        properties: { relationship: 'contains' },
      },
      {
        id: 'edge_2',
        source: 'function_1',
        target: 'class_1',
        type: 'IMPORTS',
        properties: { module: 'AuthService' },
      },
    ];
  }

  private async simulateAnalysis(
    projectPath: string,
    options: GraphAnalysisOptions
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2500));
  }

  private async simulateDependencyAnalysis(filePath: string, options: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  }

  private async simulateImpactAnalysis(filePath: string, options: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));
  }

  private async simulateStatsCalculation(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  }

  private async simulateExport(format: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600));
  }

  // Helper methods for real NebulaGraph integration
  private buildAnalysisQuery(
    projectId: string,
    options: GraphAnalysisOptions
  ): { query: string; params: Record<string, any> } {
    const depth = options.depth || 3;
    const focus = options.focus;

    let edgeTypes: string[] = [];
    switch (focus) {
      case 'dependencies':
        edgeTypes = ['IMPORTS', 'CALLS'];
        break;
      case 'imports':
        edgeTypes = ['IMPORTS'];
        break;
      case 'classes':
        edgeTypes = ['EXTENDS', 'CONTAINS'];
        break;
      case 'functions':
        edgeTypes = ['CALLS', 'CONTAINS'];
        break;
      default:
        edgeTypes = ['IMPORTS', 'CALLS', 'EXTENDS', 'CONTAINS', 'BELONGS_TO'];
    }

    const query = `
      GO ${depth} STEPS FROM $projectId OVER ${edgeTypes.join(',')} 
      YIELD dst(edge) AS destination, properties(edge) AS edgeProps
      | FETCH PROP ON * $-.destination YIELD vertex AS node, $-.edgeProps AS edgeProps
      LIMIT 1000
    `;

    return { query, params: { projectId } };
  }

  private buildDependencyQuery(
    fileId: string,
    direction: 'incoming' | 'outgoing',
    depth: number
  ): { query: string; params: Record<string, any> } {
    const edgeTypes =
      direction === 'outgoing' ? ['IMPORTS', 'CALLS'] : ['IMPORTS_REVERSE', 'CALLS_REVERSE'];

    const query = `
      GO ${depth} STEPS FROM $fileId OVER ${edgeTypes.join(',')} 
      YIELD dst(edge) AS dependency, properties(edge) AS edgeProps
      | FETCH PROP ON * $-.dependency YIELD vertex AS node, $-.edgeProps AS edgeProps
    `;

    return { query, params: { fileId } };
  }

  private async processAnalysisResult(
    result: any,
    options: GraphAnalysisOptions
  ): Promise<GraphAnalysisResult> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Process NebulaGraph result and convert to GraphNode/GraphEdge format
    if (result && result.data) {
      for (const row of result.data) {
        if (row.node) {
          nodes.push(this.convertToGraphNode(row.node));
        }
        if (row.edgeProps) {
          edges.push(this.convertToGraphEdge(row.edgeProps));
        }
      }
    }

    // Calculate metrics
    const metrics = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      averageDegree: edges.length / Math.max(nodes.length, 1),
      maxDepth: options.depth || 3,
      componentCount: this.calculateComponentCount(nodes, edges),
    };

    // Calculate summary
    const summary = this.calculateSummary(nodes);

    return { nodes, edges, metrics, summary };
  }

  private processDependencyResult(
    result: any,
    direction: string,
    depth: number
  ): {
    direct: GraphEdge[];
    transitive: GraphEdge[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  } {
    const allEdges: GraphEdge[] = [];

    if (result && result.data) {
      for (const row of result.data) {
        if (row.edgeProps) {
          allEdges.push(this.convertToGraphEdge(row.edgeProps));
        }
      }
    }

    // Split into direct and transitive dependencies
    const direct = allEdges.slice(0, 5); // First 5 as direct
    const transitive = allEdges.slice(0, 15); // First 15 as transitive

    return {
      direct,
      transitive,
      summary: {
        directCount: direct.length,
        transitiveCount: transitive.length,
        criticalPath: this.extractCriticalPath(allEdges),
      },
    };
  }

  private convertToGraphNode(nodeData: any): GraphNode {
    return {
      id: nodeData.id || nodeData.name || '',
      label: nodeData.name || nodeData.label || '',
      properties: nodeData.properties || {},
      type: this.determineNodeType(nodeData),
    };
  }

  private convertToGraphEdge(edgeData: any): GraphEdge {
    return {
      id: edgeData.id || `${edgeData.src}_${edgeData.dst}`,
      source: edgeData.src || '',
      target: edgeData.dst || '',
      type: edgeData.type || 'RELATED',
      properties: edgeData.properties || {},
    };
  }

  private determineNodeType(
    nodeData: any
  ): 'file' | 'function' | 'class' | 'variable' | 'import' | 'project' {
    if (nodeData.label && nodeData.label.includes('.')) return 'file';
    if (nodeData.type === 'function') return 'function';
    if (nodeData.type === 'class') return 'class';
    if (nodeData.type === 'variable') return 'variable';
    if (nodeData.type === 'import') return 'import';
    return 'project';
  }

  private calculateComponentCount(nodes: GraphNode[], edges: GraphEdge[]): number {
    // Simple connected component calculation
    const visited = new Set<string>();
    let components = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.dfs(node.id, nodes, edges, visited);
        components++;
      }
    }

    return components;
  }

  private dfs(nodeId: string, nodes: GraphNode[], edges: GraphEdge[], visited: Set<string>): void {
    visited.add(nodeId);

    for (const edge of edges) {
      if (edge.source === nodeId && !visited.has(edge.target)) {
        this.dfs(edge.target, nodes, edges, visited);
      }
      if (edge.target === nodeId && !visited.has(edge.source)) {
        this.dfs(edge.source, nodes, edges, visited);
      }
    }
  }

  private calculateSummary(nodes: GraphNode[]): {
    projectFiles: number;
    functions: number;
    classes: number;
    imports: number;
    externalDependencies: number;
  } {
    const summary = {
      projectFiles: 0,
      functions: 0,
      classes: 0,
      imports: 0,
      externalDependencies: 0,
    };

    for (const node of nodes) {
      switch (node.type) {
        case 'file':
          summary.projectFiles++;
          break;
        case 'function':
          summary.functions++;
          break;
        case 'class':
          summary.classes++;
          break;
        case 'import':
          summary.imports++;
          if (node.properties.external) {
            summary.externalDependencies++;
          }
          break;
      }
    }

    return summary;
  }

  private extractCriticalPath(edges: GraphEdge[]): string[] {
    // Simple heuristic: find the path with most connections
    const path: string[] = [];
    const edgeCount = new Map<string, number>();

    for (const edge of edges) {
      edgeCount.set(edge.source, (edgeCount.get(edge.source) || 0) + 1);
      edgeCount.set(edge.target, (edgeCount.get(edge.target) || 0) + 1);
    }

    // Sort by connection count and take top 3
    const sortedNodes = Array.from(edgeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nodeId]) => nodeId);

    return sortedNodes;
  }

  private generateFileId(filePath: string): string {
    // Simple hash-based file ID generation
    return `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
}
