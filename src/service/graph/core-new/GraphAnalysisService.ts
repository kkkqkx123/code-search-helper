import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { GraphDatabaseService } from '../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../database/query/GraphQueryBuilder';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import {
  GraphAnalysisOptions,
  GraphAnalysisResult,
  GraphNode,
  GraphEdge,
  CodeGraphNode,
  CodeGraphRelationship
} from '../core/types';

@injectable()
export class GraphAnalysisService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private graphDatabase: GraphDatabaseService;
  private queryBuilder: GraphQueryBuilder;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.GraphDatabaseService) graphDatabase: GraphDatabaseService,
    @inject(TYPES.GraphQueryBuilder) queryBuilder: GraphQueryBuilder,
    @inject(TYPES.GraphCacheService) cacheService: ICacheService,
    @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.graphDatabase = graphDatabase;
    this.queryBuilder = queryBuilder;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph analysis service');

      // Ensure the graph database is initialized
      if (!this.graphDatabase.isDatabaseConnected()) {
        const initialized = await this.graphDatabase.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize graph database');
        }
      }

      this.isInitialized = true;
      this.logger.info('Graph analysis service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph analysis service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphAnalysisService', operation: 'initialize' }
      );
      return false;
    }
  }

  async analyzeCodebase(
    projectPath: string,
    options: GraphAnalysisOptions = {}
  ): Promise<{
    result: GraphAnalysisResult;
    formattedResult: any;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const cacheKey = `analysis_${projectPath}_${JSON.stringify(options)}`;

    // Check cache first
    const cachedResult = this.cacheService.getFromCache<{
      result: GraphAnalysisResult;
      formattedResult: any;
    }>(cacheKey);
    if (cachedResult) {
      this.performanceMonitor.updateCacheHitRate(true);
      this.logger.info('Returning cached codebase analysis result', { projectPath });
      return cachedResult;
    }

    try {
      this.logger.info('Starting codebase analysis', {
        projectPath,
        options,
      });

      // Build the analysis query
      const query = this.queryBuilder.buildCodeAnalysisQuery(projectPath, options);
      const result = await this.graphDatabase.executeReadQuery(query.nGQL, query.parameters);

      const processedResult = await this.processAnalysisResult(result, options);
      const formattedResult = this.formatForLLM(processedResult);

      // Cache the result
      this.cacheService.setCache(cacheKey, { result: processedResult, formattedResult }, 300000); // 5 minutes
      this.performanceMonitor.updateCacheHitRate(false);

      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(executionTime);

      this.logger.info('Codebase analysis completed', {
        projectPath,
        nodeCount: processedResult.nodes.length,
        edgeCount: processedResult.edges.length,
        executionTime,
      });

      return {
        result: processedResult,
        formattedResult,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(executionTime);

      this.errorHandler.handleError(
        new Error(
          `Codebase analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphAnalysisService', operation: 'analyzeCodebase' }
      );
      throw error;
    }
  }

  async findDependencies(
    filePath: string,
    options: { direction?: 'incoming' | 'outgoing'; depth?: number } = {}
  ): Promise<{
    direct: CodeGraphRelationship[];
    transitive: CodeGraphRelationship[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Finding dependencies', { filePath, options });

      const fileId = this.generateFileId(filePath);
      const direction = options.direction || 'outgoing';
      const depth = options.depth || 3;

      // Build the dependency query
      const query = this.queryBuilder.buildDependencyQuery(fileId, direction, depth);
      const result = await this.graphDatabase.executeReadQuery(query.nGQL, query.parameters);

      return this.processDependencyResult(result, direction, depth);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Dependency analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphAnalysisService', operation: 'findDependencies' }
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
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Finding impact', { filePath, options });

      const fileId = this.generateFileId(filePath);
      const maxDepth = options.maxDepth || 3;

      // Build impact analysis query
      const query = `
        GO ${maxDepth} STEPS FROM "${fileId}" OVER IMPORTS, CALLS, CONTAINS REVERSE
        YIELD dst(edge) AS affectedNodeId
        | FETCH PROP ON * $-.affectedNodeId YIELD vertex AS affectedNode
        LIMIT 100
      `;

      const result = await this.graphDatabase.executeReadQuery(query);

      if (result && result.data) {
        const affectedFiles = result.data
          .filter((record: any) => record.affectedNode?.tag === 'File')
          .map((record: any) => record.affectedNode.properties.path);

        const affectedComponents = result.data
          .filter((record: any) =>
            record.affectedNode?.tag === 'Function' ||
            record.affectedNode?.tag === 'Class'
          )
          .map((record: any) => record.affectedNode.properties.name);

        // Calculate impact score based on number of affected items
        const impactScore = Math.min(
          (affectedFiles.length * 2 + affectedComponents.length) / 10,
          10
        );

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (impactScore > 7) riskLevel = 'critical';
        else if (impactScore > 5) riskLevel = 'high';
        else if (impactScore > 3) riskLevel = 'medium';

        return {
          affectedFiles,
          riskLevel,
          impactScore,
          affectedComponents,
        };
      }

      return {
        affectedFiles: [],
        riskLevel: 'low',
        impactScore: 0,
        affectedComponents: [],
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphAnalysisService', operation: 'findImpact' }
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
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Getting graph statistics', { projectPath });

      // Build queries for each node type
      const fileCountQuery = this.queryBuilder.buildNodeCountQuery('File');
      const functionCountQuery = this.queryBuilder.buildNodeCountQuery('Function');
      const classCountQuery = this.queryBuilder.buildNodeCountQuery('Class');
      const importCountQuery = this.queryBuilder.buildNodeCountQuery('Import');

      // Execute queries in parallel
      const [
        fileResult,
        functionResult,
        classResult,
        importResult,
      ] = await Promise.all([
        this.graphDatabase.executeReadQuery(fileCountQuery.nGQL, fileCountQuery.parameters),
        this.graphDatabase.executeReadQuery(functionCountQuery.nGQL, functionCountQuery.parameters),
        this.graphDatabase.executeReadQuery(classCountQuery.nGQL, classCountQuery.parameters),
        this.graphDatabase.executeReadQuery(importCountQuery.nGQL, importCountQuery.parameters),
      ]);

      const totalFiles = this.extractCount(fileResult);
      const totalFunctions = this.extractCount(functionResult);
      const totalClasses = this.extractCount(classResult);
      const totalImports = this.extractCount(importResult);

      // Calculate complexity score (simplified)
      const complexityScore = Math.min(
        (totalFunctions * 2 + totalClasses * 3 + totalImports) / 10,
        100
      );

      // Calculate maintainability index (simplified)
      const maintainabilityIndex = Math.max(
        100 - complexityScore - (totalImports * 0.5),
        0
      );

      // Detect cyclic dependencies (simplified)
      const cyclicDependencies = await this.detectCyclicDependencies();

      return {
        totalFiles,
        totalFunctions,
        totalClasses,
        totalImports,
        complexityScore,
        maintainabilityIndex,
        cyclicDependencies,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Graph stats calculation failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphAnalysisService', operation: 'getGraphStats' }
      );
      throw error;
    }
  }

  async exportGraph(projectPath: string, format: 'json' | 'graphml' | 'dot'): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Exporting graph', { projectPath, format });

      // Get all nodes and edges
      const nodesQuery = 'MATCH (n) RETURN n LIMIT 1000';
      const edgesQuery = 'MATCH ()-[e]->() RETURN e LIMIT 1000';

      const [nodesResult, edgesResult] = await Promise.all([
        this.graphDatabase.executeReadQuery(nodesQuery),
        this.graphDatabase.executeReadQuery(edgesQuery),
      ]);

      const nodes = nodesResult?.data || [];
      const edges = edgesResult?.data || [];

      const exportData = {
        nodes: nodes.map((record: any) => ({
          id: record.n.id,
          label: record.n.properties.name || record.n.id,
          type: record.n.tag,
          properties: record.n.properties,
        })),
        edges: edges.map((record: any) => ({
          id: record.e.id,
          source: record.e.src,
          target: record.e.dst,
          type: record.e.type,
          properties: record.e.properties,
        })),
        metadata: {
          projectPath,
          exportedAt: new Date().toISOString(),
          format,
        },
      };

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else if (format === 'graphml') {
        return this.convertToGraphML(exportData);
      } else if (format === 'dot') {
        return this.convertToDOT(exportData);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Graph export failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphAnalysisService', operation: 'exportGraph' }
      );
      throw error;
    }
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph analysis service');

      // Close the graph database service
      await this.graphDatabase.close();

      this.isInitialized = false;
      this.logger.info('Graph analysis service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to close graph analysis service: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphAnalysisService', operation: 'close' }
      );
      throw error;
    }
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
    direct: CodeGraphRelationship[];
    transitive: CodeGraphRelationship[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  } {
    const allEdges: CodeGraphRelationship[] = [];

    if (result && result.data) {
      for (const row of result.data) {
        if (row.edgeProps) {
          allEdges.push(this.convertToCodeGraphRelationship(row.edgeProps));
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
        criticalPath: this.extractCriticalPathForCodeGraph(allEdges),
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

  private convertToCodeGraphRelationship(edgeData: any): CodeGraphRelationship {
    return {
      id: edgeData.id || `${edgeData.src}_${edgeData.dst}`,
      type: edgeData.type || 'RELATED',
      sourceId: edgeData.src || '',
      targetId: edgeData.dst || '',
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

  private extractCriticalPathForCodeGraph(relationships: CodeGraphRelationship[]): string[] {
    // Simple heuristic: find the path with most connections
    const path: string[] = [];
    const edgeCount = new Map<string, number>();

    for (const relationship of relationships) {
      edgeCount.set(relationship.sourceId, (edgeCount.get(relationship.sourceId) || 0) + 1);
      edgeCount.set(relationship.targetId, (edgeCount.get(relationship.targetId) || 0) + 1);
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

  private formatForLLM(result: GraphAnalysisResult): any {
    // Format the graph analysis result for LLM consumption
    return {
      nodes: result.nodes.map(node => ({
        id: node.id,
        label: node.label,
        type: node.type,
        properties: node.properties
      })),
      edges: result.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        properties: edge.properties
      })),
      metrics: result.metrics,
      summary: result.summary,
      insights: this.generateInsights(result)
    };
  }

  private generateInsights(result: GraphAnalysisResult): string[] {
    const insights: string[] = [];

    if (result.metrics.averageDegree > 5) {
      insights.push("The codebase has a high connectivity, which may indicate tight coupling between components.");
    }

    if (result.summary.externalDependencies > result.summary.projectFiles * 0.5) {
      insights.push("The project has a high ratio of external dependencies to project files, which may increase maintenance complexity.");
    }

    if (result.metrics.componentCount < 5) {
      insights.push("The project has few connected components, which may indicate a monolithic architecture.");
    }

    return insights;
  }

  private extractCount(result: any): number {
    if (result && result.data && result.data.length > 0) {
      return result.data[0].total || 0;
    }
    return 0;
  }

  private async detectCyclicDependencies(): Promise<number> {
    try {
      // Simplified cyclic dependency detection
      const query = `
        MATCH (f1:File)-[:IMPORTS]->(f2:File)-[:IMPORTS*]->(f1)
        RETURN count(*) AS cycles
      `;

      const result = await this.graphDatabase.executeReadQuery(query);
      return this.extractCount(result);
    } catch (error) {
      this.logger.warn('Failed to detect cyclic dependencies', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  private convertToGraphML(data: any): string {
    // Simplified GraphML conversion
    let graphml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    graphml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    graphml += '<key id="label" for="node" attr.name="label" attr.type="string"/>\n';
    graphml += '<key id="type" for="node" attr.name="type" attr.type="string"/>\n';
    graphml += '<graph id="G" edgedefault="directed">\n';

    // Add nodes
    for (const node of data.nodes) {
      graphml += `  <node id="${node.id}">\n`;
      graphml += `    <data key="label">${node.label}</data>\n`;
      graphml += `    <data key="type">${node.type}</data>\n`;
      graphml += '  </node>\n';
    }

    // Add edges
    for (const edge of data.edges) {
      graphml += `  <edge source="${edge.source}" target="${edge.target}">\n`;
      graphml += `    <data key="type">${edge.type}</data>\n`;
      graphml += '  </edge>\n';
    }

    graphml += '</graph>\n';
    graphml += '</graphml>';

    return graphml;
  }

  private convertToDOT(data: any): string {
    // Simplified DOT conversion
    let dot = 'digraph G {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n';

    // Add nodes
    for (const node of data.nodes) {
      dot += `  "${node.id}" [label="${node.label}"];\n`;
    }

    // Add edges
    for (const edge of data.edges) {
      dot += `  "${edge.source}" -> "${edge.target}";\n`;
    }

    dot += '}';

    return dot;
  }
}