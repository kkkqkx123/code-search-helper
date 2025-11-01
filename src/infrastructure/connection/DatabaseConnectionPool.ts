import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import {
  IDatabaseConnectionPool,
  ConnectionPoolEvent,
  ConnectionPoolStatistics,
  ExtendedPoolStatus,
  ConnectionQueueItem
} from './types';
import { DatabaseConnectionFactory } from './DatabaseConnections';
import {
  IDatabaseConnection,
  AbstractDatabaseConnection
} from './DatabaseConnectionAbstractions';
import {
  ConnectionPoolConfig,
  globalConnectionPoolConfigManager
} from './ConnectionPoolConfig';
import { PoolStatus } from '../types';
import { ConnectionPoolHealthChecker } from './ConnectionPoolHealthChecker';
import { ConnectionPoolMonitor } from './ConnectionPoolMonitor';
import { ConnectionPoolStatisticsCollector } from './ConnectionPoolStatisticsCollector';
import { ConnectionPoolEventEmitter } from './ConnectionPoolEventEmitter';

/**
 * 连接池信息
 */
export interface PoolInfo {
  config: ConnectionPoolConfig;
  idleConnections: IDatabaseConnection[];
  activeConnections: Set<IDatabaseConnection>;
  waitQueue: ConnectionQueueItem[];
  statistics: ConnectionPoolStatistics;
  createdAt: Date;
  lastActivityTime: Date;
  eventListeners: Map<string, Set<Function>>;
  healthCheckInterval?: NodeJS.Timeout;
  monitoringInterval?: NodeJS.Timeout;
  statisticsInterval?: NodeJS.Timeout;
  isInitialized: boolean;
  isClosing: boolean;
}

@injectable()
export class DatabaseConnectionPool implements IDatabaseConnectionPool {
  private logger: LoggerService;
  private pools: Map<DatabaseType, PoolInfo> = new Map();
  private connectionConfigs: Map<DatabaseType, any> = new Map();
  private healthChecker: ConnectionPoolHealthChecker;
  private monitor: ConnectionPoolMonitor;
  private statisticsCollector: ConnectionPoolStatisticsCollector;
  private eventEmitter: ConnectionPoolEventEmitter;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConnectionPoolHealthChecker) healthChecker: ConnectionPoolHealthChecker,
    @inject(TYPES.ConnectionPoolMonitor) monitor: ConnectionPoolMonitor,
    @inject(TYPES.ConnectionPoolStatisticsCollector) statisticsCollector: ConnectionPoolStatisticsCollector,
    @inject(TYPES.ConnectionPoolEventEmitter) eventEmitter: ConnectionPoolEventEmitter
  ) {
    this.logger = logger;
    this.healthChecker = healthChecker;
    this.monitor = monitor;
    this.statisticsCollector = statisticsCollector;
    this.eventEmitter = eventEmitter;
  }

  /**
   * 初始化连接池
   */
  async initializePool(databaseType: DatabaseType, config?: Partial<ConnectionPoolConfig>): Promise<void> {
    if (this.pools.has(databaseType)) {
      this.logger.warn(`Connection pool for ${databaseType} is already initialized`);
      return;
    }

    try {
      // 获取或创建配置
      const poolConfig = globalConnectionPoolConfigManager.getConfig(databaseType);
      if (config) {
        globalConnectionPoolConfigManager.updateConfig(databaseType, config);
      }

      // 创建连接池信息
      const poolInfo: PoolInfo = {
        config: poolConfig,
        idleConnections: [],
        activeConnections: new Set(),
        waitQueue: [],
        statistics: this.statisticsCollector.createInitialStatistics(),
        createdAt: new Date(),
        lastActivityTime: new Date(),
        eventListeners: new Map(),
        isInitialized: true,
        isClosing: false
      };

      this.pools.set(databaseType, poolInfo);

      this.logger.info(`Initializing connection pool for ${databaseType}`, {
        minConnections: poolInfo.config.minConnections,
        maxConnections: poolInfo.config.maxConnections,
        acquireTimeout: poolInfo.config.acquireTimeout,
        healthCheckInterval: poolInfo.config.healthCheckInterval
      });

      // 创建初始连接
      await this.createInitialConnections(databaseType);

      // 启动健康检查
      this.healthChecker.startHealthCheck(databaseType, poolInfo, (dbType) => this.checkHealth(dbType));

      // 启动监控
      this.monitor.startMonitoring(databaseType, poolInfo, (dbType) => this.getPoolStatus(dbType), (dbType) => this.autoOptimizePool(dbType));

      // 启动统计收集
      this.statisticsCollector.startStatisticsCollection(databaseType, poolInfo, (dbType) => this.getPoolStatus(dbType));

      // 触发事件
      this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.POOL_INITIALIZED, { databaseType });

      this.logger.info(`Connection pool initialized for ${databaseType}`, {
        minConnections: poolConfig.minConnections,
        maxConnections: poolConfig.maxConnections
      });
    } catch (error) {
      this.logger.error(`Failed to initialize connection pool for ${databaseType}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // 确保清理部分创建的资源
      if (this.pools.has(databaseType)) {
        const poolInfo = this.pools.get(databaseType)!;
        this.healthChecker.stopTimers(databaseType, poolInfo);
        this.monitor.stopMonitoring(databaseType, poolInfo);
        this.statisticsCollector.stopStatisticsCollection(databaseType, poolInfo);
        this.pools.delete(databaseType);
      }
      
      throw error;
    }
 }

  /**
   * 获取数据库连接
   */
  async getConnection(databaseType: DatabaseType, timeout?: number): Promise<IDatabaseConnection> {
    const poolInfo = this.getPoolInfo(databaseType);
    const acquireTimeout = timeout || poolInfo.config.acquireTimeout;
    const startTime = Date.now();

    // 更新活动时间
    poolInfo.lastActivityTime = new Date();

    try {
      // 检查是否有可用连接
      if (poolInfo.idleConnections.length > 0) {
        const connection = poolInfo.idleConnections.pop()!;
        
        // 检查连接是否健康
        const isHealthy = await connection.isHealthy();
        if (!isHealthy) {
          // 连接不健康，尝试重连
          const reconnected = await this.attemptReconnection(connection);
          if (!reconnected) {
            // 重连失败，销毁并创建新连接
            await this.destroyConnection(connection);
            return this.createNewConnection(databaseType);
          }
        }

        poolInfo.activeConnections.add(connection);
        poolInfo.statistics.totalConnectionsAcquired++;
        
        // 更新平均获取时间统计
        const acquireTime = Date.now() - startTime;
        if (poolInfo.statistics.totalConnectionsAcquired > 1) {
          // 使用滑动平均
          poolInfo.statistics.averageAcquireTime =
            (poolInfo.statistics.averageAcquireTime * (poolInfo.statistics.totalConnectionsAcquired - 1) + acquireTime)
            / poolInfo.statistics.totalConnectionsAcquired;
        } else {
          poolInfo.statistics.averageAcquireTime = acquireTime;
        }
        
        this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.CONNECTION_ACQUIRED, {
          connectionId: connection.getId(),
          databaseType
        });

        this.logger.debug('Connection acquired from pool', {
          databaseType,
          connectionId: connection.getId(),
          acquireTime: acquireTime
        });

        return connection;
      }

      // 检查是否可以创建新连接
      if (this.canCreateNewConnection(databaseType)) {
        const connection = await this.createNewConnection(databaseType);
        poolInfo.activeConnections.add(connection);
        poolInfo.statistics.totalConnectionsAcquired++;
        
        // 更新平均获取时间统计
        const acquireTime = Date.now() - startTime;
        if (poolInfo.statistics.totalConnectionsAcquired > 1) {
          poolInfo.statistics.averageAcquireTime =
            (poolInfo.statistics.averageAcquireTime * (poolInfo.statistics.totalConnectionsAcquired - 1) + acquireTime)
            / poolInfo.statistics.totalConnectionsAcquired;
        } else {
          poolInfo.statistics.averageAcquireTime = acquireTime;
        }
        
        this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.CONNECTION_ACQUIRED, {
          connectionId: connection.getId(),
          databaseType
        });

        this.logger.debug('New connection acquired', {
          databaseType,
          connectionId: connection.getId(),
          acquireTime: acquireTime
        });

        return connection;
      }

      // 没有可用连接，加入等待队列
      this.logger.debug('No available connections, adding to wait queue', {
        databaseType,
        queueLength: poolInfo.waitQueue.length + 1
      });
      
      return await this.addToWaitQueue(databaseType, acquireTimeout);
    } catch (error) {
      this.logger.error('Error getting connection from pool', {
        databaseType,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 释放数据库连接
   */
  async releaseConnection(connection: IDatabaseConnection): Promise<void> {
    const databaseType = connection.getType();
    const poolInfo = this.getPoolInfo(databaseType);

    // 更新活动时间
    poolInfo.lastActivityTime = new Date();

    // 检查连接是否在活跃连接中
    if (!poolInfo.activeConnections.has(connection)) {
      this.logger.warn('Attempted to release connection not in active pool', {
        databaseType,
        connectionId: connection.getId()
      });
      return;
    }

    // 从活跃连接中移除
    poolInfo.activeConnections.delete(connection);
    poolInfo.statistics.totalConnectionsReleased++;

    // 检查连接是否健康
    const isHealthy = await connection.isHealthy();
    if (!isHealthy) {
      // 连接不健康，尝试重连
      const reconnected = await this.attemptReconnection(connection);
      if (!reconnected) {
        // 重连失败，销毁连接
        await this.destroyConnection(connection);
        this.logger.debug('Unhealthy connection destroyed after failed reconnection', {
          databaseType,
          connectionId: connection.getId()
        });
        return;
      }
    }

    // 检查是否可以放回池中
    if (this.canReturnToPool(databaseType)) {
      poolInfo.idleConnections.push(connection);
      this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.CONNECTION_RELEASED, {
        connectionId: connection.getId(),
        databaseType
      });
      
      this.logger.debug('Connection returned to pool', {
        databaseType,
        connectionId: connection.getId()
      });
    } else {
      // 池已满，销毁连接
      await this.destroyConnection(connection);
      this.logger.debug('Connection destroyed (pool full)', {
        databaseType,
        connectionId: connection.getId()
      });
    }

    // 处理等待队列
    this.processWaitQueue(databaseType);
  }

  /**
   * 获取连接池状态
   */
  getPoolStatus(databaseType: DatabaseType): ExtendedPoolStatus {
    const poolInfo = this.getPoolInfo(databaseType);
    const totalConnections = poolInfo.idleConnections.length + poolInfo.activeConnections.size;
    
    return {
      activeConnections: poolInfo.activeConnections.size,
      idleConnections: poolInfo.idleConnections.length,
      pendingRequests: poolInfo.waitQueue.length,
      maxConnections: poolInfo.config.maxConnections,
      createdAt: poolInfo.createdAt,
      lastActivityTime: poolInfo.lastActivityTime,
      statistics: { ...poolInfo.statistics },
      isHealthy: this.healthChecker.isPoolHealthy(databaseType, poolInfo),
      isConfigured: poolInfo.isInitialized,
      config: { ...poolInfo.config }
    };
  }

  /**
   * 优化连接池大小
   */
  async optimizePoolSize(databaseType: DatabaseType, loadFactor: number): Promise<void> {
    const poolInfo = this.getPoolInfo(databaseType);
    const currentSize = poolInfo.idleConnections.length + poolInfo.activeConnections.size;
    
    // 计算目标大小
    const minSize = poolInfo.config.minConnections;
    const maxSize = poolInfo.config.maxConnections;
    const targetSize = Math.round(minSize + (maxSize - minSize) * loadFactor);
    
    if (targetSize > currentSize) {
      // 需要增加连接
      const connectionsToAdd = Math.min(targetSize - currentSize, maxSize - currentSize);
      for (let i = 0; i < connectionsToAdd; i++) {
        try {
          const connection = await this.createNewConnection(databaseType);
          poolInfo.idleConnections.push(connection);
        } catch (error) {
          this.logger.error('Failed to create connection during optimization', {
            databaseType,
            error
          });
        }
      }
    } else if (targetSize < currentSize) {
      // 需要减少连接
      const connectionsToRemove = currentSize - targetSize;
      const connectionsToClose = Math.min(connectionsToRemove, poolInfo.idleConnections.length);
      
      for (let i = 0; i < connectionsToClose; i++) {
        if (poolInfo.idleConnections.length > 0) {
          const connection = poolInfo.idleConnections.pop()!;
          await this.destroyConnection(connection);
        }
      }
    }

    this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.POOL_OPTIMIZED, {
      databaseType,
      oldSize: currentSize,
      newSize: targetSize,
      loadFactor
    });

    this.logger.info('Connection pool size optimized', {
      databaseType,
      oldSize: currentSize,
      newSize: targetSize,
      loadFactor
    });
  }

  /**
   * 根据性能指标自动优化连接池大小
   */
  private async autoOptimizePool(databaseType: DatabaseType): Promise<void> {
    const poolInfo = this.getPoolInfo(databaseType);
    const poolStatus = this.getPoolStatus(databaseType);
    
    // 计算负载因子
    const utilization = poolStatus.activeConnections / poolStatus.maxConnections;
    const queueLength = poolStatus.pendingRequests;
    const timeoutRate = poolStatus.statistics.totalConnectionsAcquired > 0
      ? poolStatus.statistics.totalTimeouts / poolStatus.statistics.totalConnectionsAcquired
      : 0;
    
    // 根据利用率、队列长度和超时率计算负载因子
    let loadFactor = utilization;
    
    // 如果队列长度较长，增加负载因子
    if (queueLength > 0) {
      loadFactor = Math.min(1.0, loadFactor + (queueLength * 0.1));
    }
    
    // 如果超时率较高，增加负载因子
    if (timeoutRate > 0.05) { // 超过5%的超时率
      loadFactor = Math.min(1.0, loadFactor + 0.2);
    }
    
    // 如果利用率过低且有大量空闲连接，减少负载因子
    if (utilization < 0.2 && poolStatus.idleConnections > poolInfo.config.minConnections) {
      loadFactor = Math.max(0.1, loadFactor - 0.2);
    }
    
    // 限制负载因子在合理范围内
    loadFactor = Math.max(0.1, Math.min(1.0, loadFactor));
    
    // 只有在负载因子变化较大时才进行优化
    const sizeRatio = (poolStatus.activeConnections + poolStatus.idleConnections) / poolInfo.config.maxConnections;
    if (Math.abs(sizeRatio - loadFactor) > 0.2 || timeoutRate > 0.05) {
      await this.optimizePoolSize(databaseType, loadFactor);
    }
  }

  /**
   * 关闭连接池
   */
  async closePool(databaseType: DatabaseType, force: boolean = false): Promise<void> {
    const poolInfo = this.getPoolInfo(databaseType);
    
    if (poolInfo.isClosing) {
      this.logger.warn(`Connection pool for ${databaseType} is already closing`);
      return;
    }

    poolInfo.isClosing = true;

    try {
      this.logger.info('Starting connection pool close operation', {
        databaseType,
        force
      });

      // 停止定时器
      this.healthChecker.stopTimers(databaseType, poolInfo);
      this.monitor.stopMonitoring(databaseType, poolInfo);
      this.statisticsCollector.stopStatisticsCollection(databaseType, poolInfo);

      if (force) {
        // 强制关闭所有连接
        await this.forceCloseAllConnections(databaseType);
      } else {
        // 优雅关闭
        await this.gracefulCloseAllConnections(databaseType);
      }

      // 清理等待队列
      this.rejectAllWaitQueue(databaseType, new Error(`Connection pool for ${databaseType} is closing`));

      // 从池映射中移除
      this.pools.delete(databaseType);

      // 触发事件
      this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.POOL_CLOSED, { databaseType });

      this.logger.info(`Connection pool closed for ${databaseType}`, { force });
    } catch (error) {
      this.logger.error(`Failed to close connection pool for ${databaseType}`, { error });
      // 即使出现错误，也要确保标记为已关闭并清理资源
      this.pools.delete(databaseType);
      throw error;
    } finally {
      // 确保标记被重置
      if (this.pools.has(databaseType)) {
        const updatedPoolInfo = this.getPoolInfo(databaseType);
        updatedPoolInfo.isClosing = false;
      }
    }
  }

  /**
   * 关闭所有连接池
   */
  async closeAllPools(force: boolean = false): Promise<void> {
    const closePromises = Array.from(this.pools.keys()).map(databaseType => 
      this.closePool(databaseType, force)
    );
    
    await Promise.all(closePromises);
    this.logger.info('All connection pools closed', { force });
  }

  /**
   * 重置连接池统计信息
   */
  resetStatistics(databaseType: DatabaseType): void {
    const poolInfo = this.getPoolInfo(databaseType);
    poolInfo.statistics = this.statisticsCollector.createInitialStatistics();
    poolInfo.statistics.lastResetTime = new Date();
    
    this.logger.info('Connection pool statistics reset', { databaseType });
  }

  /**
   * 获取连接池统计信息
   */
  getStatistics(databaseType: DatabaseType): ConnectionPoolStatistics {
    const poolInfo = this.getPoolInfo(databaseType);
    return { ...poolInfo.statistics };
  }

  /**
   * 检查连接池健康状态
   */
  async checkHealth(databaseType: DatabaseType): Promise<boolean> {
    const poolInfo = this.getPoolInfo(databaseType);
    return this.healthChecker.isPoolHealthy(databaseType, poolInfo);
  }

  /**
   * 获取连接池配置
   */
  getPoolConfig(databaseType: DatabaseType): ConnectionPoolConfig {
    const poolInfo = this.getPoolInfo(databaseType);
    return { ...poolInfo.config };
  }

  /**
   * 更新连接池配置
   */
  updatePoolConfig(databaseType: DatabaseType, config: Partial<ConnectionPoolConfig>): void {
    globalConnectionPoolConfigManager.updateConfig(databaseType, config);
    const poolInfo = this.getPoolInfo(databaseType);
    poolInfo.config = globalConnectionPoolConfigManager.getConfig(databaseType);
    
    this.logger.info('Connection pool configuration updated', { databaseType, config });
  }

  /**
   * 获取等待队列信息
   */
  getQueueInfo(databaseType: DatabaseType) {
    const poolInfo = this.getPoolInfo(databaseType);
    const now = Date.now();
    
    if (poolInfo.waitQueue.length === 0) {
      return {
        queueLength: 0,
        averageWaitTime: 0,
        longestWaitTime: 0
      };
    }

    const waitTimes = poolInfo.waitQueue.map(item => now - item.timestamp.getTime());
    const totalWaitTime = waitTimes.reduce((sum, time) => sum + time, 0);
    const averageWaitTime = totalWaitTime / waitTimes.length;
    const longestWaitTime = Math.max(...waitTimes);

    return {
      queueLength: poolInfo.waitQueue.length,
      averageWaitTime,
      longestWaitTime
    };
  }

  /**
   * 清理空闲连接
   */
  async cleanupIdleConnections(databaseType: DatabaseType, maxIdleTime?: number): Promise<number> {
    const poolInfo = this.getPoolInfo(databaseType);
    const maxIdle = maxIdleTime || poolInfo.config.maxIdleTime;
    const now = Date.now();
    let cleanedCount = 0;

    // 保留最小连接数
    const minIdleToKeep = poolInfo.config.minConnections;
    const connectionsToCheck = poolInfo.idleConnections.filter((_, index) => 
      index >= minIdleToKeep
    );

    for (const connection of connectionsToCheck) {
      const lastActivity = connection.getLastActivityTime().getTime();
      if (now - lastActivity > maxIdle) {
        poolInfo.idleConnections = poolInfo.idleConnections.filter(c => c !== connection);
        await this.destroyConnection(connection);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.IDLE_CONNECTION_CLEANUP, {
        databaseType,
        cleanedCount,
        maxIdleTime
      });

      this.logger.info('Idle connections cleaned up', {
        databaseType,
        cleanedCount,
        maxIdleTime
      });
    }

    return cleanedCount;
  }

  /**
   * 添加事件监听器
   */
  addEventListener(databaseType: DatabaseType, event: string, listener: (...args: any[]) => void): void {
    const poolInfo = this.getPoolInfo(databaseType);
    
    if (!poolInfo.eventListeners.has(event)) {
      poolInfo.eventListeners.set(event, new Set());
    }
    
    poolInfo.eventListeners.get(event)!.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(databaseType: DatabaseType, event: string, listener: (...args: any[]) => void): void {
    const poolInfo = this.getPoolInfo(databaseType);
    const listeners = poolInfo.eventListeners.get(event);
    
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        poolInfo.eventListeners.delete(event);
      }
    }
  }

  /**
   * 获取连接池信息
   */
  private getPoolInfo(databaseType: DatabaseType): PoolInfo {
    const poolInfo = this.pools.get(databaseType);
    if (!poolInfo) {
      throw new Error(`Connection pool not found for database type: ${databaseType}`);
    }
    return poolInfo;
  }


  /**
   * 创建初始连接
   */
  private async createInitialConnections(databaseType: DatabaseType): Promise<void> {
    const poolInfo = this.getPoolInfo(databaseType);
    const minConnections = poolInfo.config.minConnections;

    for (let i = 0; i < minConnections; i++) {
      try {
        const connection = await this.createNewConnection(databaseType);
        poolInfo.idleConnections.push(connection);
      } catch (error) {
        this.logger.error('Failed to create initial connection', {
          databaseType,
          error,
          connectionIndex: i
        });
        throw error;
      }
    }
  }

  /**
   * 创建新连接
   */
  private async createNewConnection(databaseType: DatabaseType): Promise<IDatabaseConnection> {
    const poolInfo = this.getPoolInfo(databaseType);
    const connectionConfig = this.connectionConfigs.get(databaseType);
    
    const startTime = Date.now();
    
    try {
      this.logger.debug('Creating new connection', {
        databaseType,
        attemptTime: startTime
      });

      const connection = DatabaseConnectionFactory.createConnection(databaseType);
      await connection.connect(connectionConfig);
      
      const connectionTime = Date.now() - startTime;
      poolInfo.statistics.totalConnectionsCreated++;
      
      this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.CONNECTION_CREATED, {
        connectionId: connection.getId(),
        databaseType
      });

      this.logger.info('New connection created successfully', {
        databaseType,
        connectionId: connection.getId(),
        connectionTime: connectionTime
      });

      return connection;
    } catch (error) {
      poolInfo.statistics.totalFailedConnections++;
      
      this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.CONNECTION_ERROR, {
        connectionId: 'unknown',
        databaseType,
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('Failed to create new connection', {
        databaseType,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        connectionTime: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 销毁连接
   */
  private async destroyConnection(connection: IDatabaseConnection): Promise<void> {
    const databaseType = connection.getType();
    const poolInfo = this.getPoolInfo(databaseType);

    try {
      await connection.disconnect();
      poolInfo.statistics.totalConnectionsDestroyed++;
      
      this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.CONNECTION_DESTROYED, {
        connectionId: connection.getId(),
        databaseType
      });
    } catch (error) {
      this.logger.error('Failed to destroy connection', {
        databaseType,
        connectionId: connection.getId(),
        error
      });
    }
  }

  /**
   * 检查是否可以创建新连接
   */
  private canCreateNewConnection(databaseType: DatabaseType): boolean {
    const poolInfo = this.getPoolInfo(databaseType);
    const totalConnections = poolInfo.idleConnections.length + poolInfo.activeConnections.size;
    return totalConnections < poolInfo.config.maxConnections;
  }

  /**
   * 检查是否可以将连接放回池中
   */
  private canReturnToPool(databaseType: DatabaseType): boolean {
    const poolInfo = this.getPoolInfo(databaseType);
    return poolInfo.idleConnections.length < poolInfo.config.maxConnections;
  }

  /**
   * 添加到等待队列
   */
  private addToWaitQueue(databaseType: DatabaseType, timeout: number): Promise<IDatabaseConnection> {
    const poolInfo = this.getPoolInfo(databaseType);
    
    return new Promise((resolve, reject) => {
      const queueItem: ConnectionQueueItem = {
        id: `${databaseType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resolve,
        reject,
        timeout: setTimeout(() => {
          // 超时处理
          const index = poolInfo.waitQueue.findIndex(item => item.id === queueItem.id);
          if (index !== -1) {
            poolInfo.waitQueue.splice(index, 1);
            poolInfo.statistics.totalTimeouts++;
            
            this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.QUEUE_TIMEOUT, {
              queueItemId: queueItem.id,
              databaseType
            });

            this.logger.debug('Connection acquisition timed out', {
              databaseType,
              queueItemId: queueItem.id,
              timeout: timeout
            });

            reject(new Error(`Connection acquisition timeout for ${databaseType} after ${timeout}ms`));
          }
        }, timeout),
        timestamp: new Date(),
        databaseType
      };

      poolInfo.waitQueue.push(queueItem);
      
      this.logger.debug('Added connection request to wait queue', {
        databaseType,
        queueLength: poolInfo.waitQueue.length,
        timeout: timeout
      });
      
      if (poolInfo.waitQueue.length === 1) {
        this.eventEmitter.emitEvent(databaseType, poolInfo, ConnectionPoolEvent.POOL_EMPTY, { databaseType });
      }
    });
  }

  /**
   * 处理等待队列
   */
  private processWaitQueue(databaseType: DatabaseType): void {
    const poolInfo = this.getPoolInfo(databaseType);

    // 尽可能满足等待队列中的请求
    while (poolInfo.waitQueue.length > 0 && poolInfo.idleConnections.length > 0) {
      const queueItem = poolInfo.waitQueue.shift()!;
      const connection = poolInfo.idleConnections.pop()!;
      
      // 清除超时定时器，因为请求已被处理
      clearTimeout(queueItem.timeout);
      
      // 将连接添加到活跃连接集合
      poolInfo.activeConnections.add(connection);
      poolInfo.statistics.totalConnectionsAcquired++;
      
      // 记录连接获取时间
      const waitTime = Date.now() - queueItem.timestamp.getTime();
      this.logger.debug('Connection request fulfilled from wait queue', {
        databaseType,
        connectionId: connection.getId(),
        waitTime: waitTime,
        remainingQueueLength: poolInfo.waitQueue.length
      });
      
      // 解决等待的Promise
      queueItem.resolve(connection);
    }
    
    // 如果仍有等待的请求，可能需要优化池大小
    if (poolInfo.waitQueue.length > 0) {
      this.logger.debug('Connection requests still waiting in queue', {
        databaseType,
        queueLength: poolInfo.waitQueue.length
      });
      
      // 触发自动优化
      this.autoOptimizePool(databaseType).catch(error => {
        this.logger.error('Failed to auto-optimize pool for waiting requests', {
          databaseType,
          error
        });
      });
    }
  }

  /**
   * 尝试重连连接
   */
  private async attemptReconnection(connection: IDatabaseConnection): Promise<boolean> {
    const databaseType = connection.getType();
    const poolInfo = this.getPoolInfo(databaseType);
    
    try {
      const reconnected = await connection.autoReconnect(
        poolInfo.config.retryAttempts,
        poolInfo.config.retryDelay
      );
      
      if (reconnected) {
        // 重连成功，放回空闲连接池
        poolInfo.idleConnections.push(connection);
        this.logger.debug('Connection reconnected successfully', {
          databaseType,
          connectionId: connection.getId()
        });
        return true;
      } else {
        this.logger.warn('Connection reconnection failed', {
          databaseType,
          connectionId: connection.getId()
        });
        return false;
      }
    } catch (error) {
      this.logger.error('Error during connection reconnection', {
        databaseType,
        connectionId: connection.getId(),
        error
      });
      return false;
    }
  }

  /**
   * 拒绝所有等待队列中的请求
   */
  private rejectAllWaitQueue(databaseType: DatabaseType, error: Error): void {
    const poolInfo = this.getPoolInfo(databaseType);
    
    poolInfo.waitQueue.forEach(queueItem => {
      clearTimeout(queueItem.timeout);
      queueItem.reject(error);
    });
    
    poolInfo.waitQueue.length = 0;
  }

  /**
   * 强制关闭所有连接
   */
 private async forceCloseAllConnections(databaseType: DatabaseType): Promise<void> {
    const poolInfo = this.getPoolInfo(databaseType);
    
    this.logger.info('Starting force close of all connections', {
      databaseType,
      idleConnections: poolInfo.idleConnections.length,
      activeConnections: poolInfo.activeConnections.size
    });
    
    // 关闭所有空闲连接
    const idleClosePromises = poolInfo.idleConnections.map(async (connection) => {
      try {
        await this.destroyConnection(connection);
      } catch (error) {
        this.logger.error('Error destroying idle connection during force close', {
          databaseType,
          connectionId: connection.getId(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    await Promise.allSettled(idleClosePromises);
    poolInfo.idleConnections.length = 0;
    
    // 关闭所有活跃连接
    const activeClosePromises = Array.from(poolInfo.activeConnections).map(async (connection) => {
      try {
        await this.destroyConnection(connection);
      } catch (error) {
        this.logger.error('Error destroying active connection during force close', {
          databaseType,
          connectionId: connection.getId(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    await Promise.allSettled(activeClosePromises);
    poolInfo.activeConnections.clear();
    
    this.logger.info('Force close completed', { databaseType });
  }

  /**
   * 优雅关闭所有连接
   */
  private async gracefulCloseAllConnections(databaseType: DatabaseType): Promise<void> {
    const poolInfo = this.getPoolInfo(databaseType);
    
    this.logger.info('Starting graceful shutdown of connection pool', {
      databaseType,
      activeConnections: poolInfo.activeConnections.size,
      idleConnections: poolInfo.idleConnections.length
    });
    
    // 通知等待队列中的请求
    if (poolInfo.waitQueue.length > 0) {
      this.rejectAllWaitQueue(databaseType, new Error(`Connection pool for ${databaseType} is being shut down gracefully`));
    }
    
    // 等待所有活跃连接被释放，但设置一个合理的超时时间
    const maxWaitTime = poolInfo.config.acquireTimeout;
    const startTime = Date.now();
    let checkInterval: NodeJS.Timeout | null = null;
    
    try {
      // 设置一个检查间隔来监控活跃连接数量
      await new Promise<void>((resolve, reject) => {
        checkInterval = setInterval(async () => {
          if (poolInfo.activeConnections.size === 0) {
            clearInterval(checkInterval!);
            resolve();
          } else if (Date.now() - startTime >= maxWaitTime) {
            clearInterval(checkInterval!);
            this.logger.warn('Graceful shutdown timeout reached, proceeding with remaining active connections', {
              databaseType,
              remainingActiveConnections: poolInfo.activeConnections.size
            });
            resolve();
          }
        }, 100);
      });
    } finally {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    }
    
    // 关闭所有剩余连接
    await this.forceCloseAllConnections(databaseType);
    
    this.logger.info('Graceful shutdown completed', { databaseType });
  }



  /**

  /**
   * 检查空闲连接的健康状况
   */
  private async checkIdleConnectionsHealth(databaseType: DatabaseType): Promise<void> {
    const poolInfo = this.getPoolInfo(databaseType);
    
    // 检查每个空闲连接的健康状况
    const unhealthyConnections: IDatabaseConnection[] = [];
    
    for (const connection of poolInfo.idleConnections) {
      try {
        const isHealthy = await connection.isHealthy();
        if (!isHealthy) {
          unhealthyConnections.push(connection);
        }
      } catch (error) {
        this.logger.error('Error checking connection health', {
          databaseType,
          connectionId: connection.getId(),
          error
        });
        unhealthyConnections.push(connection);
      }
    }
    
    // 移除不健康的连接
    for (const connection of unhealthyConnections) {
      // 从空闲连接池中移除
      poolInfo.idleConnections = poolInfo.idleConnections.filter(c => c !== connection);
      
      // 销毁连接
      await this.destroyConnection(connection);
      
      this.logger.debug('Unhealthy idle connection removed and destroyed', {
        databaseType,
        connectionId: connection.getId()
      });
    }
    
    // 如果空闲连接不足，创建新连接补充
    if (poolInfo.idleConnections.length < poolInfo.config.minConnections) {
      const connectionsToAdd = poolInfo.config.minConnections - poolInfo.idleConnections.length;
      for (let i = 0; i < connectionsToAdd; i++) {
        try {
          const newConnection = await this.createNewConnection(databaseType);
          poolInfo.idleConnections.push(newConnection);
        } catch (error) {
          this.logger.error('Failed to create replacement connection during health check', {
            databaseType,
            error
          });
        }
      }
    }
  }



  /**
   * 设置连接配置
   */
  setConnectionConfig(databaseType: DatabaseType, config: any): void {
    this.connectionConfigs.set(databaseType, config);
  }
}