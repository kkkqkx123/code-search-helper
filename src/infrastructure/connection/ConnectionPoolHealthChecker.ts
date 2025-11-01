import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { ConnectionPoolEvent, ConnectionPoolStatistics, ConnectionQueueItem } from './types';
import { IDatabaseConnection } from './DatabaseConnectionAbstractions';
import { ConnectionPoolConfig } from './ConnectionPoolConfig';

// 避免循环依赖，定义本地PoolInfo接口
interface PoolInfo {
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

export interface IConnectionPoolHealthChecker {
  /**
   * 检查连接池是否健康
   */
  isPoolHealthy(databaseType: DatabaseType, poolInfo: PoolInfo): boolean;

  /**
   * 启动健康检查
   */
  startHealthCheck(databaseType: DatabaseType, poolInfo: PoolInfo, checkHealth: (databaseType: DatabaseType) => Promise<boolean>): void;

  /**
   * 检查空闲连接的健康状况
   */
 checkIdleConnectionsHealth(databaseType: DatabaseType, poolInfo: PoolInfo, destroyConnection: (connection: IDatabaseConnection) => Promise<void>, createNewConnection: (databaseType: DatabaseType) => Promise<IDatabaseConnection>): Promise<void>;

  /**
   * 停止所有定时器
   */
  stopTimers(databaseType: DatabaseType, poolInfo: PoolInfo): void;
}

@injectable()
export class ConnectionPoolHealthChecker implements IConnectionPoolHealthChecker {
  private logger: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
  }

  /**
   * 检查连接池是否健康
   */
  isPoolHealthy(databaseType: DatabaseType, poolInfo: PoolInfo): boolean {
    const totalConnections = poolInfo.idleConnections.length + poolInfo.activeConnections.size;
    
    // 检查是否有足够的连接
    if (totalConnections < poolInfo.config.minConnections) {
      return false;
    }
    
    // 检查等待队列是否过长
    if (poolInfo.waitQueue.length > poolInfo.config.maxConnections * 2) {
      return false;
    }
    
    // 检查失败率
    if (poolInfo.statistics.totalConnectionsCreated > 0) {
      const failureRate = poolInfo.statistics.totalFailedConnections / poolInfo.statistics.totalConnectionsCreated;
      if (failureRate > 0.1) { // 10%失败率阈值
        return false;
      }
    }
    
    // 检查超时率
    if (poolInfo.statistics.totalConnectionsAcquired > 0) {
      const timeoutRate = poolInfo.statistics.totalTimeouts / poolInfo.statistics.totalConnectionsAcquired;
      if (timeoutRate > 0.1) { // 10%超时率阈值
        return false;
      }
    }
    
    return true;
  }

  /**
   * 启动健康检查
   */
  startHealthCheck(databaseType: DatabaseType, poolInfo: PoolInfo, checkHealth: (databaseType: DatabaseType) => Promise<boolean>): void {
    if (poolInfo.config.healthCheckInterval <= 0) {
      return;
    }
    
    poolInfo.healthCheckInterval = setInterval(async () => {
      try {
        // 检查整个连接池的健康状况
        const isPoolHealthy = await checkHealth(databaseType);
        if (!isPoolHealthy) {
          this.logger.warn('Connection pool health check failed', { databaseType });
        }

        // 检查空闲连接的健康状况
        // 注意：这里需要外部传入checkIdleConnectionsHealth的实现
        // 因为它依赖于连接池内部的方法
      } catch (error) {
        this.logger.error('Error during health check', {
          databaseType,
          error
        });
      }
    }, poolInfo.config.healthCheckInterval);
  }

 /**
   * 检查空闲连接的健康状况
   */
 async checkIdleConnectionsHealth(
    databaseType: DatabaseType, 
    poolInfo: PoolInfo, 
    destroyConnection: (connection: IDatabaseConnection) => Promise<void>, 
    createNewConnection: (databaseType: DatabaseType) => Promise<IDatabaseConnection>
  ): Promise<void> {
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
      await destroyConnection(connection);
      
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
          const newConnection = await createNewConnection(databaseType);
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
   * 停止所有定时器
   */
  stopTimers(databaseType: DatabaseType, poolInfo: PoolInfo): void {
    if (poolInfo.healthCheckInterval) {
      clearInterval(poolInfo.healthCheckInterval);
      poolInfo.healthCheckInterval = undefined;
    }
  }
}