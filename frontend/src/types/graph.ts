/**
 * 图节点类型
 */
export interface GraphNode {
  id: string;
  label: string;
  type: NodeType; // 'file' | 'function' | 'class' | 'import'
  properties: Record<string, any>;
}

/**
 * 图边类型
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType; // 'BELONGS_TO' | 'CONTAINS' | 'IMPORTS' | 'CALLS' | 'EXTENDS' | 'IMPLEMENTS'
  properties: Record<string, any>;
}

/**
 * 图查询类型
 */
export interface GraphQuery {
  type: QueryType; // 'RELATED_NODES' | 'PATH' | 'TRAVERSAL' | 'STATS'
  parameters: Record<string, any>;
  options?: QueryOptions;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  relationshipTypes?: string[];
  maxDepth?: number;
}

/**
 * 节点类型
 */
export type NodeType = 'file' | 'function' | 'class' | 'import' | 'variable' | 'module';

/**
 * 边类型
 */
export type EdgeType = 
  | 'BELONGS_TO' 
  | 'CONTAINS' 
  | 'IMPORTS' 
  | 'CALLS' 
  | 'EXTENDS' 
  | 'IMPLEMENTS'
  | 'REFERENCES'
  | 'MODIFIES'
  | 'USES';

/**
 * 查询类型
 */
export type QueryType = 
  | 'RELATED_NODES' 
  | 'PATH' 
  | 'TRAVERSAL' 
  | 'STATS'
  | 'SEARCH'
  | 'ANALYSIS';

/**
 * 查询选项
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  direction?: 'asc' | 'desc';
  includeProperties?: boolean;
}

/**
 * 图结果
 */
export interface GraphResult {
  success: boolean;
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats?: GraphStats;
    executionTime?: number;
  };
  message?: string;
}

/**
 * 图统计信息
 */
export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  projectCount: number;
  indexSize: number;
  storageSize: number;
  lastUpdated: string;
  healthStatus: 'healthy' | 'warning' | 'error';
}

/**
 * 路径搜索结果
 */
export interface PathResult {
  success: boolean;
  data: {
    paths: Array<{
      nodes: GraphNode[];
      edges: GraphEdge[];
      length: number;
      weight?: number;
    }>;
    stats: GraphStats;
  };
  executionTime: number;
}

/**
 * 空间操作类型
 */
export type SpaceOperation = 'create' | 'delete' | 'clear' | 'info';

/**
 * 空间操作结果
 */
export interface SpaceOperationResult {
  success: boolean;
  data: {
    operation: SpaceOperation;
    projectId: string;
    result: any;
    executionTime: number;
  };
  message?: string;
}

/**
 * 路径搜索选项
 */
export interface PathSearchOptions {
  maxDepth?: number;
  direction?: 'in' | 'out' | 'both';
  relationshipTypes?: string[];
  maxPaths?: number;
  withWeight?: boolean;
}