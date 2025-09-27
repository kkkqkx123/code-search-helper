import { GraphNode, GraphEdge } from '../../models/IndexTypes';

export interface GraphOptions {
  depth?: number;
  focus?: 'dependencies' | 'imports' | 'classes' | 'functions';
  includeExternal?: boolean;
}

export interface GraphAnalysisResult {
  nodes: GraphNode[];
  relationships: GraphEdge[];
  metrics: GraphMetrics;
}

export interface GraphMetrics {
  totalNodes: number;
  totalEdges: number;
  averageDegree: number;
  cyclomaticComplexity: number;
  cohesion: number;
  coupling: number;
}

export interface IGraphService {
  analyzeCodebase(projectPath: string, options?: GraphOptions): Promise<GraphAnalysisResult>;
  queryGraph(query: string): Promise<GraphQueryResult>;
  findDependencies(filePath: string): Promise<DependencyResult>;
  findCallGraph(functionName: string): Promise<CallGraphResult>;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  query: string;
  executionTime: number;
}

export interface DependencyResult {
  direct: GraphEdge[];
  transitive: GraphEdge[];
  circular: GraphEdge[];
}

export interface CallGraphResult {
  callers: GraphNode[];
  callees: GraphNode[];
  depth: number;
}
