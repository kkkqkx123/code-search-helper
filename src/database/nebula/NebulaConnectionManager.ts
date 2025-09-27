import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaQueryBuilder } from './NebulaQueryBuilder';
import { TYPES } from '../../types';

// 使用社区贡献的NebulaGraph Node.js客户端
// https://github.com/nebula-contrib/nebula-node
import { createClient } from '@nebula-contrib/nebula-nodejs';
// Transaction context class to manage transaction state
export class TransactionContext {
  connection: any;
  private connectionManager: NebulaConnectionManager;
  private isCommitted: boolean = false;
  private isRolledBack: boolean = false;

  constructor(connection: any, connectionManager: NebulaConnectionManager) {
    this.connection = connection;
    this.connectionManager = connectionManager;
  }

  /**
   * Begin a new transaction
   * @returns Promise<TransactionContext> Transaction context for managing the transaction
   */
  async beginTransaction(): Promise<TransactionContext> {
    throw new Error('beginTransaction is not implemented in TransactionContext');
  }

  async execute(query: string, params?: Record<string, any>): Promise<any> {
    if (this.isCommitted || this.isRolledBack) {
      throw new Error('Transaction has already been committed or rolled back');
    }
    return await this.connection.execute(query, false, params);
  }

  async commit(): Promise<void> {
    if (this.isCommitted || this.isRolledBack) {
      throw new Error('Transaction has already been committed or rolled back');
    }
    try {
      await this.connection.execute('COMMIT', false);
      this.isCommitted = true;
    } finally {
      this.connectionManager.releaseConnection(this.connection);
    }
  }

  async rollback(): Promise<void> {
    if (this.isCommitted || this.isRolledBack) {
      throw new Error('Transaction has already been committed or rolled back');
    }
    try {
      await this.connection.execute('ROLLBACK', false);
      this.isRolledBack = true;
    } finally {
      this.connectionManager.releaseConnection(this.connection);
    }
  }
}

@injectable()
export class NebulaConnectionManager {
  private client: any | null = null;
  private isConnected: boolean = false;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private queryBuilder: NebulaQueryBuilder;
  // 存储连接超时定时器引用，以便在断开连接时清理
  private connectionTimeout: NodeJS.Timeout | null = null;
  // 存储其他可能的定时器引用
  private healthCheckInterval: NodeJS.Timeout | null = null;
  // 存储当前空间名称
  private currentSpace: string = '';
  // 连接池管理
  private connectionPool: any[] = [];
  private maxPoolSize: number = 50;  // Increased for high-concurrency scenarios
  private minPoolSize: number = 10;  // Increased for high-concurrency scenarios
  private poolInitialized: boolean = false;
  private poolStats = {
    totalConnectionsCreated: 0,
    connectionsInUse: 0,
    maxConnectionsReached: 0,
    connectionWaitTime: 0
  };

  // 性能监控统计
  private performanceStats = {
    totalQueryExecutionTime: 0,
    totalQueriesExecuted: 0,
    totalConnectionAcquisitionTime: 0,
    totalConnectionsAcquired: 0,
    slowQueryThreshold: 1000 // 慢查询阈值（毫秒）
  };

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.queryBuilder = new NebulaQueryBuilder();
  }

  async connect(): Promise<boolean> {
    try {
      // 如果已经连接，直接返回true
      if (this.isConnected) {
        return true;
      }

      const config = this.configService.getAll();

      // 记录连接配置用于调试
      this.logger.debug('NebulaGraph connection config:', {
        host: config.nebula.host,
        port: config.nebula.port,
        username: config.nebula.username,
        space: config.nebula.space,
      });

      // 保存当前空间名称
      this.currentSpace = config.nebula.space || '';

      // 初始化连接池
      await this.initializeConnectionPool();

      this.isConnected = true;
      this.logger.info('Connected to NebulaGraph successfully (connection pool initialized)');
      return true;
    } catch (error) {
      // 更详细地处理错误对象，确保能正确提取错误信息
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // 如果error是一个对象，尝试提取有用的信息
        try {
          errorMessage = JSON.stringify(error);
        } catch (stringifyError) {
          // 如果JSON.stringify失败，使用toString方法
          errorMessage = Object.prototype.toString.call(error);
        }
      } else {
        errorMessage = String(error);
      }

      this.logger.error('NebulaGraph connection failed:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        originalError: error, // 保留原始错误对象用于调试
      });
      this.errorHandler.handleError(
        new Error(`Failed to connect to NebulaGraph: ${errorMessage}`),
        { component: 'NebulaConnectionManager', operation: 'connect' }
      );
      this.isConnected = false;

      // 清理连接池
      await this.cleanupConnectionPool();

      throw new Error(`Failed to connect to NebulaGraph: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      // 清理连接超时定时器
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      // 清理连接池
      await this.cleanupConnectionPool();

      this.isConnected = false;
      this.logger.info('Disconnected from NebulaGraph successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to disconnect from NebulaGraph: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'disconnect' }
      );
    }
  }

  async executeQuery(query: string, params?: Record<string, any>): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;
    const startTime = Date.now();

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      // 使用连接执行查询
      const result = await connection.execute(query, false, params);
      
      // Track query execution time
      const executionTime = Date.now() - startTime;
      this.performanceStats.totalQueryExecutionTime += executionTime;
      this.performanceStats.totalQueriesExecuted++;
      
      // Log slow queries
      if (executionTime > this.performanceStats.slowQueryThreshold) {
        this.logger.warn('Slow query detected', {
          query,
          executionTimeMs: executionTime,
          thresholdMs: this.performanceStats.slowQueryThreshold
        });
      }
      
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to execute query: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'executeQuery' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  async getReadSession(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    // 从连接池获取连接
    return await this.getConnection();
  }

  async getWriteSession(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    // 从连接池获取连接
    return await this.getConnection();
  }

  async executeTransaction(
    queries: Array<{ query: string; params?: Record<string, any> }>
  ): Promise<any[]> {
    // NebulaGraph Node.js客户端可能没有直接的事务支持
    // 我们将逐个执行查询，并在出现错误时抛出异常
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;
    const results: any[] = [];

    try {
      // 从连接池获取连接，确保所有查询使用同一个连接
      connection = await this.getConnection();

      for (const { query, params } of queries) {
        const result = await connection.execute(query, false, params);
        results.push(result);
      }

      return results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to execute transaction: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'executeTransaction' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  async beginTransaction(): Promise<TransactionContext> {
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 从连接池获取连接，确保事务使用同一个连接
      const connection = await this.getConnection();
      
      // 执行BEGIN TRANSACTION语句
      await connection.execute('BEGIN TRANSACTION', false);
      
      // 创建并返回事务上下文
      const transactionContext = new TransactionContext(connection, this);
      return transactionContext;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to begin transaction: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'beginTransaction' }
      );
      throw error;
    }
  }

  async createNode(node: any): Promise<string> {
    // NebulaGraph使用INSERT VERTEX语句创建节点
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      // 使用查询构建器构造INSERT VERTEX语句
      // 这里假设node对象包含标签、ID和属性
      const { label, id, properties } = node;

      // 使用NebulaQueryBuilder构建查询
      const { query, params } = this.queryBuilder.insertVertex(label, id, properties);

      // 执行查询
      await connection.execute(query, false, params);
      return id;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create node: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'createNode' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  async createRelationship(relationship: any): Promise<string> {
    // NebulaGraph使用INSERT EDGE语句创建关系
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      // 使用查询构建器构造INSERT EDGE语句
      // 这里假设relationship对象包含类型、源节点ID、目标节点ID和属性
      const { type, srcId, dstId, properties } = relationship;

      // 使用NebulaQueryBuilder构建查询
      const { query, params } = this.queryBuilder.insertEdge(type, srcId, dstId, properties);

      // 执行查询
      await connection.execute(query, false, params);
      return `${srcId}->${dstId}`;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create relationship: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'createRelationship' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  async findNodesByLabel(label: string, properties?: Record<string, any>): Promise<any[]> {
    // NebulaGraph使用GO语句或MATCH语句查找节点
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      // 使用MATCH语句查找节点
      let pattern = `(n:${label})`;
      let returnClause = 'n';
      let whereClause: string | undefined;

      // 如果有属性条件，添加WHERE子句
      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.keys(properties).map(key => `n.${key} = $${key}`);
        whereClause = conditions.join(' AND ');
      }

      // 使用NebulaQueryBuilder构建查询
      const query = this.queryBuilder.match(pattern, returnClause, whereClause);

      // 执行查询
      const result = await connection.execute(query, false, properties);

      // 解析结果
      // 这里假设结果是一个包含节点数据的数组
      return result.data || [];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to find nodes by label: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'findNodesByLabel' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    // NebulaGraph使用GO语句或MATCH语句查找关系
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      // 使用MATCH语句查找关系
      let pattern = '(n1)-[r]->(n2)';
      let returnClause = 'r, n1, n2';
      let whereClause: string | undefined;

      // 如果有类型条件，添加类型过滤
      if (type) {
        pattern = `(n1)-[r:${type}]->(n2)`;
      }

      // 如果有属性条件，添加WHERE子句
      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.keys(properties).map(key => `r.${key} = $${key}`);
        whereClause = conditions.join(' AND ');
      }

      // 使用NebulaQueryBuilder构建查询
      const query = this.queryBuilder.match(pattern, returnClause, whereClause);

      // 执行查询
      const result = await connection.execute(query, false, properties);

      // 解析结果
      // 这里假设结果是一个包含关系数据的数组
      return result.data || [];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to find relationships: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'findRelationships' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  async getDatabaseStats(): Promise<any> {
    // NebulaGraph使用SHOW命令获取数据库统计信息
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      // 执行SHOW SPACES命令获取空间信息
      const spacesResult = await connection.execute('SHOW SPACES', false);

      // 执行SHOW HOSTS命令获取主机信息
      const hostsResult = await connection.execute('SHOW HOSTS', false);

      // 执行SHOW PARTS命令获取分区信息
      const partsResult = await connection.execute('SHOW PARTS', false);

      // 组合统计信息
      return {
        spaces: spacesResult.data || [],
        hosts: hostsResult.data || [],
        parts: partsResult.data || [],
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get database stats: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'getDatabaseStats' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * 获取当前活跃会话信息
   */
  async getActiveSessions(): Promise<{
    allSessions: any[];
    localSessions: any[];
    totalCount: number;
    localCount: number;
  }> {
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      // 执行SHOW SESSIONS命令获取所有活跃会话
      const sessionsResult = await connection.execute('SHOW SESSIONS', false);

      // 执行SHOW LOCAL SESSIONS命令获取本地会话
      const localSessionsResult = await connection.execute('SHOW LOCAL SESSIONS', false);

      return {
        allSessions: sessionsResult.data || [],
        localSessions: localSessionsResult.data || [],
        totalCount: sessionsResult.data ? sessionsResult.data.length : 0,
        localCount: localSessionsResult.data ? localSessionsResult.data.length : 0,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get active sessions: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'getActiveSessions' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * 清理空闲会话
   * @param maxIdleMinutes 最大空闲时间（分钟）
   */
  async cleanupIdleSessions(maxIdleMinutes: number = 10): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Not connected to NebulaGraph');
    }

    let connection: any = null;

    try {
      // 从连接池获取连接
      connection = await this.getConnection();

      const currentTime = new Date();
      const cutoffTime = new Date(currentTime.getTime() - maxIdleMinutes * 60 * 1000);

      // 获取所有会话
      const sessionsResult = await connection.execute('SHOW SESSIONS', false);

      if (!sessionsResult.data || sessionsResult.data.length === 0) {
        return 0;
      }

      let cleanedCount = 0;
      const batchSize = 50; // 批量处理，避免长时间阻塞

      // 查找并清理空闲会话
      const sessionsToKill: any[] = [];
      for (const session of sessionsResult.data) {
        const updateTime = new Date(session[4]); // UpdateTime在第五列

        if (updateTime < cutoffTime) {
          sessionsToKill.push(session[0]); // SessionId在第一列
        }
      }

      // 批量清理会话
      for (let i = 0; i < sessionsToKill.length; i += batchSize) {
        const batch = sessionsToKill.slice(i, i + batchSize);
        const killCommands = batch.map(sessionId => `KILL SESSION ${sessionId}`).join('; ');
        
        try {
          await connection.execute(killCommands, false);
          cleanedCount += batch.length;
          this.logger.debug(`Cleaned ${batch.length} idle sessions in batch`);
        } catch (killError) {
          this.logger.warn(`Failed to kill batch of sessions: ${killError}`);
          // 如果批量执行失败，逐个清理
          for (const sessionId of batch) {
            try {
              await connection.execute(`KILL SESSION ${sessionId}`, false);
              cleanedCount++;
              this.logger.debug(`Cleaned idle session: ${sessionId}`);
            } catch (singleKillError) {
              this.logger.warn(`Failed to kill session ${sessionId}: ${singleKillError}`);
            }
          }
        }
      }

      // 如果会话使用率超过阈值，清理更多会话
      const usageStats = await this.getSessionUsageStats();
      if (usageStats.usagePercentage > 85) {
        // 清理空闲超过10分钟的会话
        const aggressiveCutoffTime = new Date(currentTime.getTime() - 10 * 60 * 1000);
        const aggressiveSessionsToKill: any[] = [];
        
        for (const session of sessionsResult.data) {
          const updateTime = new Date(session[4]); // UpdateTime在第五列

          if (updateTime < aggressiveCutoffTime) {
            aggressiveSessionsToKill.push(session[0]); // SessionId在第一列
          }
        }
        
        // 批量清理会话
        for (let i = 0; i < aggressiveSessionsToKill.length; i += batchSize) {
          const batch = aggressiveSessionsToKill.slice(i, i + batchSize);
          const killCommands = batch.map(sessionId => `KILL SESSION ${sessionId}`).join('; ');
          
          try {
            await connection.execute(killCommands, false);
            cleanedCount += batch.length;
            this.logger.debug(`Aggressively cleaned ${batch.length} idle sessions in batch`);
          } catch (killError) {
            this.logger.warn(`Failed to kill aggressive batch of sessions: ${killError}`);
            // 如果批量执行失败，逐个清理
            for (const sessionId of batch) {
              try {
                await connection.execute(`KILL SESSION ${sessionId}`, false);
                cleanedCount++;
                this.logger.debug(`Aggressively cleaned idle session: ${sessionId}`);
              } catch (singleKillError) {
                this.logger.warn(`Failed to kill session ${sessionId}: ${singleKillError}`);
              }
            }
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.info(
          `Cleaned ${cleanedCount} idle sessions older than ${maxIdleMinutes} minutes (high-concurrency mode)`
        );
      }
      return cleanedCount;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to cleanup idle sessions: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaConnectionManager', operation: 'cleanupIdleSessions' }
      );
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * 获取会话使用率统计
   */
  async getSessionUsageStats(): Promise<{
    totalSessions: number;
    maxSessions: number;
    usagePercentage: number;
    hasCapacity: boolean;
  }> {
    const sessions = await this.getActiveSessions();

    // NebulaGraph默认max_sessions_per_ip_per_user=300，当前配置为1000（针对高并发优化）
    const maxSessions = 1000; // 从配置文件中读取的实际值
    const totalSessions = sessions.totalCount;
    const usagePercentage = (totalSessions / maxSessions) * 100;

    return {
      totalSessions,
      maxSessions,
      usagePercentage,
      hasCapacity: usagePercentage < 85, // 使用率低于85%认为有容量，为高并发环境提供更大缓冲
    };
  }

  // 连接池管理方法

  /**
   * 从连接池获取连接
   */
  async getConnection(): Promise<any> {
    const startTime = Date.now();
    if (this.connectionPool.length > 0) {
      const connection = this.connectionPool.pop();
      this.poolStats.connectionsInUse++;
      const acquisitionTime = Date.now() - startTime;
      this.performanceStats.totalConnectionAcquisitionTime += acquisitionTime;
      this.performanceStats.totalConnectionsAcquired++;
      this.logger.debug('Connection acquired from pool', {
        poolSize: this.connectionPool.length,
        connectionsInUse: this.poolStats.connectionsInUse,
        acquisitionTimeMs: acquisitionTime
      });
      return connection;
    }

    if (this.poolStats.totalConnectionsCreated < this.maxPoolSize) {
      const newConnection = await this.createNewConnection();
      this.poolStats.totalConnectionsCreated++;
      this.poolStats.connectionsInUse++;
      const acquisitionTime = Date.now() - startTime;
      this.performanceStats.totalConnectionAcquisitionTime += acquisitionTime;
      this.performanceStats.totalConnectionsAcquired++;
      this.logger.debug('New connection created', {
        totalConnections: this.poolStats.totalConnectionsCreated,
        connectionsInUse: this.poolStats.connectionsInUse,
        acquisitionTimeMs: acquisitionTime
      });
      return newConnection;
    }

    // For high-concurrency scenarios, we'll wait a bit for a connection to be released
    // instead of immediately throwing an error
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 10;
      const retryInterval = 50; // 50ms
      
      const tryGetConnection = () => {
        attempts++;
        if (this.connectionPool.length > 0) {
          const connection = this.connectionPool.pop();
          this.poolStats.connectionsInUse++;
          const acquisitionTime = Date.now() - startTime;
          this.performanceStats.totalConnectionAcquisitionTime += acquisitionTime;
          this.performanceStats.totalConnectionsAcquired++;
          this.logger.debug('Connection acquired from pool (after wait)', {
            poolSize: this.connectionPool.length,
            connectionsInUse: this.poolStats.connectionsInUse,
            attempts,
            acquisitionTimeMs: acquisitionTime
          });
          resolve(connection);
        } else if (attempts < maxAttempts) {
          setTimeout(tryGetConnection, retryInterval);
        } else {
          this.poolStats.maxConnectionsReached++;
          this.logger.warn('Connection pool exhausted after waiting', {
            maxPoolSize: this.maxPoolSize,
            connectionsInUse: this.poolStats.connectionsInUse,
            totalConnections: this.poolStats.totalConnectionsCreated
          });
          reject(new Error('Connection pool exhausted'));
        }
      };
      
      setTimeout(tryGetConnection, retryInterval);
    });
  }

  /**
   * 释放连接回连接池
   */
  releaseConnection(connection: any): void {
    if (this.connectionPool.length < this.maxPoolSize) {
      this.connectionPool.push(connection);
      this.poolStats.connectionsInUse--;
      this.logger.debug('Connection released to pool', {
        poolSize: this.connectionPool.length,
        connectionsInUse: this.poolStats.connectionsInUse
      });
    } else {
      // 连接池已满，关闭连接
      try {
        if (typeof connection.close === 'function') {
          connection.close();
        }
        this.poolStats.totalConnectionsCreated--;
        this.poolStats.connectionsInUse--;
        this.logger.debug('Connection closed (pool full)', {
          totalConnections: this.poolStats.totalConnectionsCreated,
          connectionsInUse: this.poolStats.connectionsInUse
        });
      } catch (error) {
        this.logger.warn('Failed to close connection', { error });
      }
    }
  }

  /**
   * 创建新连接
   */
  private async createNewConnection(): Promise<any> {
    const config = this.configService.getAll();

    const options = {
      servers: [`${config.nebula.host}:${config.nebula.port}`],
      userName: config.nebula.username,
      password: config.nebula.password,
      space: config.nebula.space,
    };

    const client = createClient(options);

    // 等待连接就绪
    await new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const readyHandler = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        client.removeListener('error', errorHandler);
        resolve();
      };

      const errorHandler = (error: any) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        client.removeListener('ready', readyHandler);
        reject(error);
      };

      client.on('ready', readyHandler);
      client.on('error', errorHandler);

      // 设置超时
      timeoutId = setTimeout(() => {
        client.removeListener('ready', readyHandler);
        client.removeListener('error', errorHandler);
        reject(new Error('Connection timeout'));
      }, 10000);
    });

    return client;
  }

  /**
   * 初始化连接池
   */
  async initializeConnectionPool(): Promise<void> {
    if (this.poolInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing connection pool with high-concurrency settings');

      // 创建最小数量的连接
      for (let i = 0; i < this.minPoolSize; i++) {
        try {
          const connection = await this.createNewConnection();
          this.connectionPool.push(connection);
          this.poolStats.totalConnectionsCreated++;
        } catch (error) {
          this.logger.warn('Failed to create initial connection', { error });
        }
      }

      this.poolInitialized = true;
      this.logger.info('Connection pool initialized with high-concurrency settings', {
        initialConnections: this.connectionPool.length,
        minPoolSize: this.minPoolSize,
        maxPoolSize: this.maxPoolSize
      });

      // 启动健康检查
      this.startHealthCheck();
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize connection pool: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'initializeConnectionPool' }
      );
      throw error;
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        this.logger.debug('Running connection pool health check');

        // 检查连接池中的连接
        const connectionsToRemove: any[] = [];

        for (const connection of this.connectionPool) {
          try {
            // 执行简单的健康检查查询
            const result = await connection.execute('SHOW HOSTS', false);

            if (!result || !result.data) {
              this.logger.warn('Connection health check failed - removing connection');
              connectionsToRemove.push(connection);
            }
          } catch (error) {
            this.logger.warn('Connection health check error - removing connection', { error });
            connectionsToRemove.push(connection);
          }
        }

        // 移除不健康的连接
        if (connectionsToRemove.length > 0) {
          this.connectionPool = this.connectionPool.filter(
            conn => !connectionsToRemove.includes(conn)
          );

          // 关闭不健康的连接
          for (const conn of connectionsToRemove) {
            try {
              if (typeof conn.close === 'function') {
                await conn.close();
              }
            } catch (closeError) {
              this.logger.debug('Error closing unhealthy connection', { closeError });
            }
          }

          this.poolStats.totalConnectionsCreated -= connectionsToRemove.length;
          this.logger.info('Removed unhealthy connections', {
            removedCount: connectionsToRemove.length,
            remainingPoolSize: this.connectionPool.length
          });

          // 补充连接池到最小大小
          await this.replenishConnectionPool();
        }

        // 记录连接池统计信息
        this.logConnectionPoolStats();

      } catch (error) {
        this.logger.error('Health check interval error', { error });
      }
    }, 30000); // 每30秒检查一次

    // 确保定时器不会阻止进程退出
    if (this.healthCheckInterval) {
      this.healthCheckInterval.unref();
    }
  }

  /**
   * 补充连接池到最小大小
   */
  private async replenishConnectionPool(): Promise<void> {
    const connectionsNeeded = this.minPoolSize - this.connectionPool.length;

    if (connectionsNeeded > 0) {
      this.logger.info('Replenishing connection pool', { connectionsNeeded });

      for (let i = 0; i < connectionsNeeded; i++) {
        if (this.poolStats.totalConnectionsCreated < this.maxPoolSize) {
          try {
            const connection = await this.createNewConnection();
            this.connectionPool.push(connection);
            this.poolStats.totalConnectionsCreated++;
          } catch (error) {
            this.logger.warn('Failed to replenish connection pool', { error });
          }
        }
      }
    }
  }

  /**
   * 记录连接池统计信息
   */
  private logConnectionPoolStats(): void {
    this.logger.debug('Connection pool statistics', {
      poolSize: this.connectionPool.length,
      connectionsInUse: this.poolStats.connectionsInUse,
      totalConnectionsCreated: this.poolStats.totalConnectionsCreated,
      maxConnectionsReached: this.poolStats.maxConnectionsReached,
      connectionWaitTime: this.poolStats.connectionWaitTime
    });
  }

  /**
   * 获取连接池统计信息
   */
  getConnectionPoolStats(): any {
    return {
      ...this.poolStats,
      poolSize: this.connectionPool.length,
      maxPoolSize: this.maxPoolSize,
      minPoolSize: this.minPoolSize,
      poolInitialized: this.poolInitialized
    };
  }

  /**
   * 清理连接池
   */
  async cleanupConnectionPool(): Promise<void> {
    this.logger.info('Cleaning up connection pool');

    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // 关闭所有连接
    const allConnections = [...this.connectionPool];
    this.connectionPool = [];

    for (const connection of allConnections) {
      try {
        if (typeof connection.close === 'function') {
          await connection.close();
        }
      } catch (error) {
        this.logger.debug('Error closing connection during cleanup', { error });
      }
    }

    this.poolStats.totalConnectionsCreated = 0;
    this.poolStats.connectionsInUse = 0;
    this.poolInitialized = false;

    this.logger.info('Connection pool cleaned up');
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): any {
    return {
      ...this.performanceStats,
      averageQueryExecutionTime: this.performanceStats.totalQueriesExecuted > 0
        ? this.performanceStats.totalQueryExecutionTime / this.performanceStats.totalQueriesExecuted
        : 0,
      averageConnectionAcquisitionTime: this.performanceStats.totalConnectionsAcquired > 0
        ? this.performanceStats.totalConnectionAcquisitionTime / this.performanceStats.totalConnectionsAcquired
        : 0
    };
  }

  /**
   * 重置性能统计信息
   */
  resetPerformanceStats(): void {
    this.performanceStats = {
      totalQueryExecutionTime: 0,
      totalQueriesExecuted: 0,
      totalConnectionAcquisitionTime: 0,
      totalConnectionsAcquired: 0,
      slowQueryThreshold: 1000
    };
  }
}
