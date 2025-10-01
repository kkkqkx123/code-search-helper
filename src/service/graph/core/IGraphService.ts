import { GraphAnalysisOptions, GraphAnalysisResult, CodeGraphNode, CodeGraphRelationship, GraphPersistenceOptions, GraphPersistenceResult } from './types';

export interface IGraphService {
  analyzeCodebase(projectPath: string, options?: GraphAnalysisOptions): Promise<{
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

  findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth?: number): Promise<CodeGraphNode[]>;

  findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<CodeGraphRelationship[]>;

  storeParsedFiles(files: any[], options?: GraphPersistenceOptions): Promise<GraphPersistenceResult>;

  storeChunks(chunks: any[], options?: GraphPersistenceOptions): Promise<GraphPersistenceResult>;

  deleteNodes(nodeIds: string[]): Promise<boolean>;

  clearGraph(): Promise<boolean>;

  isServiceInitialized(): boolean;

  close(): Promise<void>;
}