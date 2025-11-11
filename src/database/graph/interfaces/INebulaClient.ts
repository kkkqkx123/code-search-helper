import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult } from '../../nebula/NebulaTypes';

// 查询批次接口
export interface QueryBatch {
  query: string;
  params?: Record<string, any>;
}

// 查询选项接口
export interface QueryOptions {
  timeout?: number;
  retryAttempts?: number;
  useCache?: boolean;
}

/**
 * NebulaClient 底层客户端接口
 * 职责：连接管理、查询执行、基本事件
 */
export interface INebulaClient {
  // 基础操作
  initialize(config?: NebulaConfig): Promise<boolean>;
  isConnected(): boolean;
  isInitialized(): boolean;
  close(): Promise<void>;
  reconnect(): Promise<boolean>;

  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // 查询执行
  execute(query: string, params?: Record<string, any>, options?: QueryOptions): Promise<NebulaQueryResult>;
  executeQuery(query: string, params?: Record<string, any>, options?: QueryOptions): Promise<NebulaQueryResult>;
  executeBatch(queries: QueryBatch[]): Promise<NebulaQueryResult[]>;

  // 统计信息
  getStats(): any;

  // 配置管理
  updateConfig(config: Partial<NebulaConfig>): void;
  getConfig(): NebulaConfig;

  // 事件订阅
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  emit(event: string, ...args: any[]): boolean;

  // 健康检查
  healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: any;
    error?: string;
  }>;
}