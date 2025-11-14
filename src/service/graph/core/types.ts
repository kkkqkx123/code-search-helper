/**
 * 图服务核心类型定义
 * 职责：定义图服务相关的数据传输对象(DTO)
 */

// 图节点类型定义
export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, any>;
  type: 'file' | 'function' | 'class' | 'variable' | 'import' | 'project' | string;
}

// 图边类型定义
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

// 代码图节点类型定义
export interface CodeGraphNode {
  id: string;
  type: 'File' | 'Function' | 'Class' | 'Interface' | 'Import' | 'Project' | string;
  name: string;
  properties: Record<string, any>;
}

// 代码图关系类型定义
export interface CodeGraphRelationship {
  id: string;
  type: 'CONTAINS' | 'CALLS' | 'EXTENDS' | 'IMPLEMENTS' | 'IMPORTS' | 'BELONGS_TO' | string;
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
}

// 图搜索选项类型定义
export interface GraphSearchOptions {
  limit?: number;
  depth?: number;
  includeProperties?: boolean;
  relationshipTypes?: string[];
  nodeTypes?: string[];
  fuzzyMatch?: boolean;
  searchType?: 'keyword' | 'exact' | 'neighbor' | 'path' | 'schema';
}

// 图搜索结果类型定义
export interface GraphSearchResult {
  nodes: CodeGraphNode[];
  relationships: CodeGraphRelationship[];
  total: number;
  executionTime: number;
}

// 图分析选项类型定义
export interface GraphAnalysisOptions {
  depth?: number;
  focus?: 'dependencies' | 'imports' | 'classes' | 'functions' | 'variables';
  includeFiles?: boolean;
  includeExternal?: boolean;
  maxResults?: number;
}

// 图分析结果类型定义
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

// 图持久化选项类型定义
export interface GraphPersistenceOptions {
  projectId?: string;
  overwriteExisting?: boolean;
  createRelationships?: boolean;
  batchSize?: number;
  useCache?: boolean;
  cacheTTL?: number;
  limit?: number;
  type?: string;
}

// 图持久化结果类型定义
export interface GraphPersistenceResult {
  success: boolean;
  nodesCreated: number;
  relationshipsCreated: number;
  nodesUpdated: number;
  processingTime: number;
  errors: string[];
}

// 缓存条目类型定义
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// 搜索请求类型定义
export interface SearchRequest {
  query: string;
  options?: GraphSearchOptions;
}

// 搜索响应类型定义
export interface SearchResponse {
  results: GraphSearchResult;
  suggestions?: string[];
  stats?: {
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  };
}

// 分析请求类型定义
export interface AnalysisRequest {
  projectPath: string;
  options?: GraphAnalysisOptions;
}

// 分析响应类型定义
export interface AnalysisResponse {
  result: GraphAnalysisResult;
  formattedResult: any;
  insights?: string[];
}

// 映射请求类型定义
export interface MappingRequest {
  filePath: string;
  data: any[];
  options?: GraphPersistenceOptions;
}

// 映射响应类型定义
export interface MappingResponse {
  nodes: GraphNode[];
  relationships: GraphEdge[];
  stats: {
    nodesCreated: number;
    relationshipsCreated: number;
    processingTime: number;
  };
}