import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { DatabaseLoggerService } from './DatabaseLoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { DatabaseEventType } from './DatabaseEventTypes';
import { DatabaseError, DatabaseErrorType } from './DatabaseError';

/**
 * 连接池配置接口
 */
export interface ConnectionPoolConfig {
  minConnections?: number;
  maxConnections?: number;
  idleTimeout?: number; // 空闲超时时间（毫秒）
  acquireTimeout?: number; // 获取连接超时时间（毫秒）
  maxRetries?: number; // 最大重试次数
  retryDelay?: number; // 重试延迟（毫秒）
}

/**
 * 数据库连接接口
 */
export interface IDbConnection {
  id: string;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  executeQuery(query: string, params?: any): Promise<any>;
  getConnectionId(): string;
  getLastUsed(): Date;
  setLastUsed(date: Date): void;
}

/**
 * 连接池条目接口
 */
interface IConnectionPoolEntry {
  connection: IDbConnection;
  borrowed: boolean;
  borrowedAt?: Date;
  lastUsed: Date;
}

/**
 * 数据库连接池
 * 管理数据库连接的创建、复用和回收
 */
@injectable()
export class DatabaseConnectionPool {
  private pool: Map<string, IConnectionPoolEntry> = new Map();
  private availableConnections: string[] = [];
  private borrowedConnections: Set<string> = new Set();
  private config: ConnectionPoolConfig;
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private connectionFactory: ((id: string) => Promise<IDbConnection>) | null = null;
  private isInitialized = false;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    config?: ConnectionPoolConfig
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.config = {
      minConnections: config?.minConnections || 2,
      maxConnections: config?.maxConnections || 10,
      idleTimeout: config?.idleTimeout || 300000, // 5分钟
      acquireTimeout: config?.acquireTimeout || 10000, // 10秒
      maxRetries: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 1000, // 1秒
      ...config
    };
  }

  /**
   * 初始化连接池
   */
  async initialize(connectionFactory: (id: string) => Promise<IDbConnection>): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.connectionFactory = connectionFactory;

    try {
      // 创建最小连接数
      for (let i = 0; i < this.config.minConnections!; i++) {
        await this.createConnection();
      }

      this.isInitialized = true;

      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.POOL_INITIALIZED,
        source: 'common',
        timestamp: new Date(),
        data: {
          message: 'Connection pool initialized',
          minConnections: this.config.minConnections,
          maxConnections: this.config.maxConnections
        }
      });

      // 启动连接池维护任务
      this.startPoolMaintenance();
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        { 
          component: 'DatabaseConnectionPool', 
          operation: 'initialize'
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);
      throw dbError;
    }
  }

 /**
   * 获取连接
   */
  async acquireConnection(): Promise<IDbConnection> {
    if (!this.isInitialized) {
      throw DatabaseError.internalError(
        'Connection pool not initialized',
        { 
          component: 'DatabaseConnectionPool', 
          operation: 'acquireConnection'
        }
      );
    }

    const startTime = Date.now();
    let retries = 0;

    while (retries < this.config.maxRetries!) {
      // 尝试获取可用连接
      const connectionId = this.availableConnections.shift();

      if (connectionId) {
        const entry = this.pool.get(connectionId);

        if (entry && !entry.borrowed) {
          // 检查连接是否仍然有效
          if (await this.validateConnection(entry.connection)) {
            entry.borrowed = true;
            entry.borrowedAt = new Date();
            this.borrowedConnections.add(connectionId);

            await this.databaseLogger.logDatabaseEvent({
              type: DatabaseEventType.CONNECTION_ACQUIRED,
              source: 'common',
              timestamp: new Date(),
              data: {
                message: `Connection acquired: ${connectionId}`,
                connectionId,
                waitTime: Date.now() - startTime
              }
            });

            return entry.connection;
          } else {
            // 连接无效，移除它并尝试下一个
            await this.removeConnection(connectionId);
          }
        }
      } else {
        // 没有可用连接，检查是否可以创建新连接
        if (this.pool.size < this.config.maxConnections!) {
          try {
            const newConnection = await this.createConnection();
            const newEntry = this.pool.get(newConnection.getConnectionId());
            
            if (newEntry && !newEntry.borrowed) {
              newEntry.borrowed = true;
              newEntry.borrowedAt = new Date();
              this.borrowedConnections.add(newConnection.getConnectionId());

              await this.databaseLogger.logDatabaseEvent({
                type: DatabaseEventType.CONNECTION_ACQUIRED,
                source: 'common',
                timestamp: new Date(),
                data: {
                  message: `New connection acquired: ${newConnection.getConnectionId()}`,
                  connectionId: newConnection.getConnectionId(),
                  waitTime: Date.now() - startTime
                }
              });

              return newConnection;
            }
          } catch (error) {
            // 创建连接失败，记录错误并重试
            await this.databaseLogger.logDatabaseEvent({
              type: DatabaseEventType.ERROR_OCCURRED,
              source: 'common',
              timestamp: new Date(),
              data: {
                message: 'Failed to create new connection',
                error: error instanceof Error ? error.message : String(error)
              }
            });
          }
        }
      }

      // 等待一段时间后重试
      await this.delay(this.config.retryDelay!);
      retries++;
    }

    // 所有重试都失败了
    const dbError = DatabaseError.timeoutError(
      `Failed to acquire connection after ${this.config.maxRetries} retries`,
      { 
        component: 'DatabaseConnectionPool', 
        operation: 'acquireConnection',
        details: { maxRetries: this.config.maxRetries }
      }
    );

    this.errorHandler.handleError(dbError, dbError.context);
    throw dbError;
  }

  /**
   * 释放连接
   */
  async releaseConnection(connection: IDbConnection): Promise<void> {
    if (!this.isInitialized) {
      throw DatabaseError.internalError(
        'Connection pool not initialized',
        { 
          component: 'DatabaseConnectionPool', 
          operation: 'releaseConnection'
        }
      );
    }

    const connectionId = connection.getConnectionId();
    const entry = this.pool.get(connectionId);

    if (!entry) {
      // 连接不在池中，可能是已移除的连接
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_ERROR,
        source: 'common',
        timestamp: new Date(),
        data: {
          message: `Attempted to release connection not in pool: ${connectionId}`,
          connectionId
        }
      });
      return;
    }

    if (!entry.borrowed) {
      // 连接未被借用
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_ERROR,
        source: 'common',
        timestamp: new Date(),
        data: {
          message: `Attempted to release connection that was not borrowed: ${connectionId}`,
          connectionId
        }
      });
      return;
    }

    // 更新最后使用时间
    entry.lastUsed = new Date();
    entry.borrowed = false;
    delete entry.borrowedAt;
    
    // 将连接放回可用列表
    this.availableConnections.push(connectionId);
    this.borrowedConnections.delete(connectionId);

    await this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.CONNECTION_RELEASED,
      source: 'common',
      timestamp: new Date(),
      data: {
        message: `Connection released: ${connectionId}`,
        connectionId
      }
    });
  }

  /**
   * 创建新连接
   */
  private async createConnection(): Promise<IDbConnection> {
    if (!this.connectionFactory) {
      throw DatabaseError.internalError(
        'Connection factory not set',
        { 
          component: 'DatabaseConnectionPool', 
          operation: 'createConnection'
        }
      );
    }

    const connectionId = this.generateConnectionId();
    const connection = await this.connectionFactory(connectionId);

    // 尝试连接
    let connected = false;
    let retries = 0;
    
    while (!connected && retries < this.config.maxRetries!) {
      try {
        connected = await connection.connect();
      } catch (error) {
        retries++;
        if (retries >= this.config.maxRetries!) {
          throw error;
        }
        await this.delay(this.config.retryDelay!);
      }
    }

    if (!connected) {
      throw DatabaseError.connectionError(
        `Failed to connect after ${this.config.maxRetries} retries`,
        { 
          component: 'DatabaseConnectionPool', 
          operation: 'createConnection',
          details: { connectionId, maxRetries: this.config.maxRetries }
        }
      );
    }

    const entry: IConnectionPoolEntry = {
      connection,
      borrowed: false,
      lastUsed: new Date()
    };

    this.pool.set(connectionId, entry);
    this.availableConnections.push(connectionId);

    await this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.CONNECTION_CREATED,
      source: 'common',
      timestamp: new Date(),
      data: {
        message: `Connection created: ${connectionId}`,
        connectionId
      }
    });

    return connection;
  }

  /**
   * 移除连接
   */
  private async removeConnection(connectionId: string): Promise<void> {
    const entry = this.pool.get(connectionId);
    
    if (entry) {
      try {
        await entry.connection.disconnect();
      } catch (error) {
        // 断开连接时出错，记录但继续
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_ERROR,
          source: 'common',
          timestamp: new Date(),
          data: {
            message: `Error disconnecting connection: ${connectionId}`,
            connectionId,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }

      this.pool.delete(connectionId);
      const availableIndex = this.availableConnections.indexOf(connectionId);
      if (availableIndex !== -1) {
        this.availableConnections.splice(availableIndex, 1);
      }
      this.borrowedConnections.delete(connectionId);

      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_REMOVED,
        source: 'common',
        timestamp: new Date(),
        data: {
          message: `Connection removed: ${connectionId}`,
          connectionId
        }
      });
    }
  }

  /**
   * 验证连接是否有效
   */
  private async validateConnection(connection: IDbConnection): Promise<boolean> {
    try {
      if (!connection.isConnected()) {
        return false;
      }

      // 执行一个简单的查询来验证连接
      await connection.executeQuery('RETURN 1');
      return true;
    } catch (error) {
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_ERROR,
        source: 'common',
        timestamp: new Date(),
        data: {
          message: `Connection validation failed: ${connection.getConnectionId()}`,
          connectionId: connection.getConnectionId(),
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  /**
   * 启动连接池维护任务
   */
  private startPoolMaintenance(): void {
    // 定期检查和清理空闲连接
    setInterval(async () => {
      await this.maintainPool();
    }, 60000); // 每分钟检查一次
  }

  /**
   * 维护连接池（清理空闲连接等）
   */
  private async maintainPool(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const now = new Date();
    const idleTimeout = this.config.idleTimeout!;

    // 检查可用连接中的空闲连接
    for (const connectionId of [...this.availableConnections]) {
      const entry = this.pool.get(connectionId);
      
      if (entry) {
        const idleTime = now.getTime() - entry.lastUsed.getTime();
        
        // 如果连接空闲时间超过阈值，移除它（但保持最小连接数）
        if (idleTime > idleTimeout && this.pool.size > this.config.minConnections!) {
          await this.removeConnection(connectionId);
        }
      }
    }

    // 检查借用的连接是否超时
    for (const connectionId of this.borrowedConnections) {
      const entry = this.pool.get(connectionId);
      
      if (entry && entry.borrowedAt) {
        const borrowTime = now.getTime() - entry.borrowedAt.getTime();
        
        // 如果连接被借用时间过长，可能发生了泄漏
        if (borrowTime > this.config.acquireTimeout! * 2) {
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.CONNECTION_ERROR,
            source: 'common',
            timestamp: new Date(),
            data: {
              message: `Connection potentially leaked: ${connectionId}`,
              connectionId,
              borrowTime
            }
          });
          
          // 强制释放连接
          entry.borrowed = false;
          delete entry.borrowedAt;
          this.borrowedConnections.delete(connectionId);
          this.availableConnections.push(connectionId);
        }
      }
    }

    // 如果可用连接少于最小值，创建新连接
    const availableCount = this.availableConnections.length;
    const borrowedCount = this.borrowedConnections.size;
    const totalCount = availableCount + borrowedCount;

    if (totalCount < this.config.minConnections!) {
      const needed = this.config.minConnections! - totalCount;
      
      for (let i = 0; i < needed; i++) {
        if (totalCount + i < this.config.maxConnections!) {
          try {
            await this.createConnection();
          } catch (error) {
            await this.databaseLogger.logDatabaseEvent({
              type: DatabaseEventType.ERROR_OCCURRED,
              source: 'common',
              timestamp: new Date(),
              data: {
                message: 'Failed to create connection during maintenance',
                error: error instanceof Error ? error.message : String(error)
              }
            });
            break; // 停止尝试创建更多连接
          }
        }
      }
    }
  }

  /**
   * 获取池统计信息
   */
  getPoolStats(): {
    totalConnections: number;
    availableConnections: number;
    borrowedConnections: number;
    minConnections: number;
    maxConnections: number;
  } {
    return {
      totalConnections: this.pool.size,
      availableConnections: this.availableConnections.length,
      borrowedConnections: this.borrowedConnections.size,
      minConnections: this.config.minConnections!,
      maxConnections: this.config.maxConnections!
    };
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // 断开所有连接
    for (const [connectionId, entry] of this.pool.entries()) {
      try {
        await entry.connection.disconnect();
      } catch (error) {
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.ERROR_OCCURRED,
          source: 'common',
          timestamp: new Date(),
          data: {
            message: `Error disconnecting connection during pool close: ${connectionId}`,
            connectionId,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }

    this.pool.clear();
    this.availableConnections = [];
    this.borrowedConnections.clear();
    this.isInitialized = false;

    await this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.POOL_CLOSED,
      source: 'common',
      timestamp: new Date(),
      data: {
        message: 'Connection pool closed'
      }
    });
  }

  /**
   * 生成连接ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}