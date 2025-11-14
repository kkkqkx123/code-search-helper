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