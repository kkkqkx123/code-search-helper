import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { ConnectionPoolStatistics, ConnectionQueueItem } from './types';
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

export interface IConnectionPoolStatisticsCollector {
  /**
   * 启动统计收集
   */
  startStatisticsCollection(databaseType: DatabaseType, poolInfo: PoolInfo, getPoolStatus: (databaseType: DatabaseType) => any): void;

  /**
   * 创建初始统计信息
   */
  createInitialStatistics(): ConnectionPoolStatistics;

  /**
   * 停止统计收集定时器
   */
  stopStatisticsCollection(databaseType: DatabaseType, poolInfo: PoolInfo): void;
}

@injectable()
export class ConnectionPoolStatisticsCollector implements IConnectionPoolStatisticsCollector {
  private logger: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
 ) {
    this.logger = logger;
  }

  /**
   * 启动统计收集
   */
  startStatisticsCollection(databaseType: DatabaseType, poolInfo: PoolInfo, getPoolStatus: (databaseType: DatabaseType) => any): void {
    if (!poolInfo.config.enableStatistics || poolInfo.config.statisticsInterval <= 0) {
      return;
    }
    
    poolInfo.statisticsInterval = setInterval(() => {
      // 计算更详细的统计信息
      const stats = poolInfo.statistics;
      const poolStatus = getPoolStatus(databaseType);
      
      // 计算连接池利用率
      const totalConnections = poolStatus.activeConnections + poolStatus.idleConnections;
      const utilization = totalConnections > 0 ? poolStatus.activeConnections / totalConnections : 0;
      
      // 计算失败率
      const failureRate = stats.totalConnectionsCreated > 0
        ? stats.totalFailedConnections / stats.totalConnectionsCreated
        : 0;
      
      // 计算超时率
      const timeoutRate = stats.totalConnectionsAcquired > 0
        ? stats.totalTimeouts / stats.totalConnectionsAcquired
        : 0;
      
      // 记录详细统计信息
      this.logger.info('Connection pool statistics', {
        databaseType,
        utilization: utilization.toFixed(2),
        failureRate: failureRate.toFixed(3),
        timeoutRate: timeoutRate.toFixed(3),
        totalConnectionsCreated: stats.totalConnectionsCreated,
        totalConnectionsAcquired: stats.totalConnectionsAcquired,
        totalConnectionsReleased: stats.totalConnectionsReleased,
        totalConnectionsDestroyed: stats.totalConnectionsDestroyed,
        totalFailedConnections: stats.totalFailedConnections,
        totalTimeouts: stats.totalTimeouts,
        activeConnections: poolStatus.activeConnections,
        idleConnections: poolStatus.idleConnections,
        pendingRequests: poolStatus.pendingRequests,
        maxConnections: poolStatus.maxConnections
      });
    }, poolInfo.config.statisticsInterval);
  }

  /**
   * 创建初始统计信息
   */
  createInitialStatistics(): ConnectionPoolStatistics {
    return {
      totalConnectionsCreated: 0,
      totalConnectionsAcquired: 0,
      totalConnectionsReleased: 0,
      totalConnectionsDestroyed: 0,
      totalFailedConnections: 0,
      totalTimeouts: 0,
      averageAcquireTime: 0,
      averageConnectionLifetime: 0,
      lastResetTime: new Date()
    };
 }

  /**
   * 停止统计收集定时器
   */
  stopStatisticsCollection(databaseType: DatabaseType, poolInfo: PoolInfo): void {
    if (poolInfo.statisticsInterval) {
      clearInterval(poolInfo.statisticsInterval);
      poolInfo.statisticsInterval = undefined;
    }
  }
}