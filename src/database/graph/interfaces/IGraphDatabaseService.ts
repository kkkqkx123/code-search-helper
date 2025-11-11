import { INebulaClient } from './INebulaClient';

export interface GraphDatabaseConfig {
  defaultSpace: string;
  enableTransactions: boolean;
  enableCaching: boolean;
  cacheTTL: number;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
  healthCheckInterval: number;
}

export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}

/**
 * GraphDatabaseService 高层服务接口
 * 职责：缓存管理、性能监控、批处理优化、空间管理
 */
export interface IGraphDatabaseService {
  // 初始化和连接管理
  initialize(): Promise<boolean>;
  close(): Promise<void>;
  isDatabaseConnected(): boolean;

  // 查询执行（带缓存和监控）
  executeReadQuery(query: string, parameters?: Record<string, any>): Promise<any>;
  executeWriteQuery(query: string, parameters?: Record<string, any>): Promise<any>;
  executeBatch(queries: GraphQuery[]): Promise<any>;

  // 空间管理
  useSpace(spaceName: string): Promise<void>;
  createSpace(spaceName: string, options?: any): Promise<boolean>;
  deleteSpace(spaceName: string): Promise<boolean>;
  spaceExists(spaceName: string): Promise<boolean>;
  getCurrentSpace(): string | null;

  // 配置管理
  updateConfig(config: Partial<GraphDatabaseConfig>): void;
  getConfig(): GraphDatabaseConfig;

  // 统计和监控
  getDatabaseStats(): Promise<any>;

  // 获取底层客户端（用于高级操作）
  getNebulaClient(): INebulaClient;
}