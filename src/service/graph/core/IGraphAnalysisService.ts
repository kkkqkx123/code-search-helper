import { GraphAnalysisOptions, GraphAnalysisResult, CodeGraphRelationship } from './types';

export interface IGraphAnalysisService {
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

  isServiceInitialized(): boolean;

  close(): Promise<void>;
}