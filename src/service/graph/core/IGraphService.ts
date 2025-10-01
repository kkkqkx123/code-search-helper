import {
  GraphNode,
  GraphEdge,
  GraphAnalysisOptions,
  GraphAnalysisResult,
  CodeGraphNode,
  CodeGraphRelationship,
  GraphPersistenceOptions,
  GraphPersistenceResult,
  GraphSearchOptions,
  GraphSearchResult
} from './types';

export interface IGraphService {
  // Analysis methods
  analyzeCodebase(
    projectPath: string,
    options?: GraphAnalysisOptions
  ): Promise<{
    result: GraphAnalysisResult;
    formattedResult: any;
  }>;

  findDependencies(
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
  }>;

  findImpact(
    filePath: string,
    options?: { maxDepth?: number; includeTests?: boolean }
  ): Promise<{
    affectedFiles: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    impactScore: number;
    affectedComponents: string[];
  }>;

  getGraphStats(projectPath: string): Promise<{
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalImports: number;
    complexityScore: number;
    maintainabilityIndex: number;
    cyclicDependencies: number;
  }>;

  exportGraph(projectPath: string, format: 'json' | 'graphml' | 'dot'): Promise<string>;

  // Data service methods
  findRelatedNodes(
    nodeId: string,
    relationshipTypes?: string[],
    maxDepth?: number
  ): Promise<CodeGraphNode[]>;

  findPath(
    sourceId: string,
    targetId: string,
    maxDepth?: number
  ): Promise<CodeGraphRelationship[]>;

  storeParsedFiles(
    files: any[],
    options?: GraphPersistenceOptions
  ): Promise<GraphPersistenceResult>;

  storeChunks(
    chunks: any[],
    options?: GraphPersistenceOptions
  ): Promise<GraphPersistenceResult>;

  deleteNodes(nodeIds: string[]): Promise<boolean>;

  clearGraph(): Promise<boolean>;

  // Service lifecycle methods
  isServiceInitialized(): boolean;
  close(): Promise<void>;

  // Additional analysis methods
  analyzeDependencies(
    filePath: string,
    projectId: string,
    options?: { includeTransitive?: boolean; includeCircular?: boolean }
  ): Promise<any>;

  analyzeCallGraph(
    functionName: string,
    projectId: string,
    options?: { depth?: number; direction?: 'in' | 'out' | 'both' }
  ): Promise<any>;

  analyzeImpact(
    nodeIds: string[],
    projectId: string,
    options?: { depth?: number }
  ): Promise<any>;

  getProjectOverview(projectId: string): Promise<any>;

  getStructureMetrics(projectId: string): Promise<any>;

  detectCircularDependencies(projectId: string): Promise<any>;

  getGraphStatsByProject(projectId: string): Promise<any>;

  // Health and status methods
  isHealthy(): Promise<boolean>;
  getStatus(): Promise<any>;

  // Search methods
  search(query: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  searchByNodeType(nodeType: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  searchByRelationshipType(relationshipType: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  searchByPath(sourceId: string, targetId: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  getSearchSuggestions(query: string): Promise<string[]>;
  getSearchStats(): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  }>;

  // Space management methods
  createSpace(projectId: string, config?: any): Promise<boolean>;
  dropSpace(projectId: string): Promise<boolean>;
  clearSpace(projectId: string): Promise<boolean>;
  getSpaceInfo(projectId: string): Promise<any>;
  batchInsertNodes(nodes: any[], projectId: string): Promise<GraphPersistenceResult>;
  batchInsertEdges(edges: any[], projectId: string): Promise<GraphPersistenceResult>;
  batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean>;
}