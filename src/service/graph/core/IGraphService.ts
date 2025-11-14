/**
 * 统一的图服务接口
 * 职责：提供图数据操作的核心接口，直接使用 database/nebula 层组件
 */
export interface IGraphService {
  // 初始化和连接管理
  initialize(): Promise<boolean>;
  close(): Promise<void>;
  isDatabaseConnected(): boolean;

  // 查询执行
  executeReadQuery(query: string, parameters?: Record<string, any>): Promise<any>;
  executeWriteQuery(query: string, parameters?: Record<string, any>): Promise<any>;
  executeBatch(queries: Array<{ nGQL: string; parameters?: Record<string, any> }>): Promise<any>;

  // 空间管理
  useSpace(spaceName: string): Promise<void>;
  createSpace(spaceName: string, options?: any): Promise<boolean>;
  deleteSpace(spaceName: string): Promise<boolean>;
  spaceExists(spaceName: string): Promise<boolean>;
  getCurrentSpace(): string | null;

  // 批处理操作
  batchInsertNodes(nodes: any[], projectId: string): Promise<any>;
  batchInsertEdges(edges: any[], projectId: string): Promise<any>;
  batchDeleteNodes(nodeIds: string[], projectId: string): Promise<boolean>;

  // 空间管理扩展
  clearSpace(projectId: string): Promise<boolean>;
  getSpaceInfo(projectId: string): Promise<any>;

  // 统计和监控
  getDatabaseStats(): Promise<any>;

  // 分析方法
  analyzeDependencies(filePath: string, projectId: string, options?: any): Promise<any>;
  detectCircularDependencies(projectId: string): Promise<any>;
  analyzeCallGraph(functionName: string, projectId: string, options?: any): Promise<any>;
  analyzeImpact(nodeIds: string[], projectId: string, options?: any): Promise<any>;
  getProjectOverview(projectId: string): Promise<any>;
  getStructureMetrics(projectId: string): Promise<any>;
  getGraphStats(projectId: string): Promise<any>;

  // 查询方法
  executeRawQuery(query: string, parameters?: Record<string, any>): Promise<any>;
  findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth?: number): Promise<any>;
  findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<any>;
  search(query: string, options?: any): Promise<any>;
  getSearchSuggestions(query: string): Promise<string[]>;

  // 健康检查
  isHealthy(): Promise<boolean>;
  getStatus(): Promise<any>;

  // 空间管理扩展
  dropSpace(projectId: string): Promise<boolean>;
}

/**
 * 图查询接口
 */
export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}

/**
 * 图服务配置接口
 */
export interface GraphServiceConfig {
  defaultSpace: string;
  enableCaching: boolean;
  cacheTTL: number;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
  healthCheckInterval: number;
}

/**
 * 批处理结果接口
 */
export interface BatchResult {
  success: boolean;
  insertedCount: number;
  failedCount: number;
  errors: string[];
  executionTime?: number;
}