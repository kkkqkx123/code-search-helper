import { DatabaseType, TransactionStatus, PoolStatus } from '../types';
import { IDatabaseConnection } from './DatabaseConnectionAbstractions';
import { ConnectionPoolConfig } from './ConnectionPoolConfig';

/**
 * 连接池统计信息
 */
export interface ConnectionPoolStatistics {
  totalConnectionsCreated: number;
  totalConnectionsAcquired: number;
  totalConnectionsReleased: number;
  totalConnectionsDestroyed: number;
  totalFailedConnections: number;
  totalTimeouts: number;
  averageAcquireTime: number;
  averageConnectionLifetime: number;
  lastResetTime: Date;
}

/**
 * 连接池状态扩展
 */
export interface ExtendedPoolStatus extends PoolStatus {
  createdAt: Date;
  lastActivityTime: Date;
  statistics: ConnectionPoolStatistics;
  isHealthy: boolean;
  isConfigured: boolean;
  config: ConnectionPoolConfig;
}

/**
 * 连接等待队列项
 */
export interface ConnectionQueueItem {
  id: string;
  resolve: (connection: IDatabaseConnection) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  timestamp: Date;
  databaseType: DatabaseType;
}

/**
 * 数据库连接池接口
 */
export interface IDatabaseConnectionPool {
  /**
   * 获取数据库连接
   * @param databaseType 数据库类型
   * @param timeout 可选的超时时间（毫秒）
   * @returns Promise<IDatabaseConnection> 数据库连接
   */
  getConnection(databaseType: DatabaseType, timeout?: number): Promise<IDatabaseConnection>;

  /**
   * 释放数据库连接
   * @param connection 数据库连接
   */
  releaseConnection(connection: IDatabaseConnection): Promise<void>;

  /**
   * 获取连接池状态
   * @param databaseType 数据库类型
   * @returns ExtendedPoolStatus 连接池状态
   */
  getPoolStatus(databaseType: DatabaseType): ExtendedPoolStatus;

  /**
   * 优化连接池大小
   * @param databaseType 数据库类型
   * @param loadFactor 负载因子 (0.0 - 1.0)
   */
  optimizePoolSize(databaseType: DatabaseType, loadFactor: number): Promise<void>;

  /**
   * 初始化连接池
   * @param databaseType 数据库类型
   * @param config 连接池配置
   */
  initializePool(databaseType: DatabaseType, config?: Partial<ConnectionPoolConfig>): Promise<void>;

  /**
   * 关闭连接池
   * @param databaseType 数据库类型
   * @param force 是否强制关闭
   */
  closePool(databaseType: DatabaseType, force?: boolean): Promise<void>;

  /**
   * 关闭所有连接池
   * @param force 是否强制关闭
   */
  closeAllPools(force?: boolean): Promise<void>;

  /**
   * 重置连接池统计信息
   * @param databaseType 数据库类型
   */
  resetStatistics(databaseType: DatabaseType): void;

  /**
   * 获取连接池统计信息
   * @param databaseType 数据库类型
   */
  getStatistics(databaseType: DatabaseType): ConnectionPoolStatistics;

  /**
   * 检查连接池健康状态
   * @param databaseType 数据库类型
   */
  checkHealth(databaseType: DatabaseType): Promise<boolean>;

  /**
   * 获取连接池配置
   * @param databaseType 数据库类型
   */
  getPoolConfig(databaseType: DatabaseType): ConnectionPoolConfig;

  /**
   * 更新连接池配置
   * @param databaseType 数据库类型
   * @param config 配置更新
   */
  updatePoolConfig(databaseType: DatabaseType, config: Partial<ConnectionPoolConfig>): void;

  /**
   * 获取等待队列信息
   * @param databaseType 数据库类型
   */
  getQueueInfo(databaseType: DatabaseType): {
    queueLength: number;
    averageWaitTime: number;
    longestWaitTime: number;
  };

  /**
   * 清理空闲连接
   * @param databaseType 数据库类型
   * @param maxIdleTime 最大空闲时间（毫秒）
   */
  cleanupIdleConnections(databaseType: DatabaseType, maxIdleTime?: number): Promise<number>;

  /**
   * 添加连接池事件监听器
   * @param databaseType 数据库类型
   * @param event 事件名称
   * @param listener 事件监听器
   */
  addEventListener(databaseType: DatabaseType, event: string, listener: (...args: any[]) => void): void;

  /**
   * 移除连接池事件监听器
   * @param databaseType 数据库类型
   * @param event 事件名称
   * @param listener 事件监听器
   */
  removeEventListener(databaseType: DatabaseType, event: string, listener: (...args: any[]) => void): void;
}

/**
 * 事务协调器接口
 */
export interface ITransactionCoordinator {
  beginTransaction(transactionId: string, participants: DatabaseType[]): Promise<void>;
  preparePhase(transactionId: string): Promise<Map<DatabaseType, boolean>>;
  commitPhase(transactionId: string): Promise<boolean>;
  rollback(transactionId: string): Promise<void>;
  getTransactionStatus(transactionId: string): TransactionStatus;
}

/**
 * 连接池事件类型
 */
export enum ConnectionPoolEvent {
  CONNECTION_CREATED = 'connectionCreated',
  CONNECTION_ACQUIRED = 'connectionAcquired',
  CONNECTION_RELEASED = 'connectionReleased',
  CONNECTION_DESTROYED = 'connectionDestroyed',
  CONNECTION_ERROR = 'connectionError',
  POOL_FULL = 'poolFull',
  POOL_EMPTY = 'poolEmpty',
  POOL_INITIALIZED = 'poolInitialized',
  POOL_CLOSED = 'poolClosed',
  POOL_HEALTH_CHECK_FAILED = 'poolHealthCheckFailed',
  POOL_OPTIMIZED = 'poolOptimized',
  QUEUE_TIMEOUT = 'queueTimeout',
  IDLE_CONNECTION_CLEANUP = 'idleConnectionCleanup'
}