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

export interface IConnectionPoolMonitor {
  /**
   * 启动监控
   */
  startMonitoring(databaseType: DatabaseType, poolInfo: PoolInfo, getPoolStatus: (databaseType: DatabaseType) => any, autoOptimizePool: (databaseType: DatabaseType) => Promise<void>): void;

  /**
   * 停止监控定时器
   */
  stopMonitoring(databaseType: DatabaseType, poolInfo: PoolInfo): void;
}

@injectable()
export class ConnectionPoolMonitor implements IConnectionPoolMonitor {
  private logger: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
 }

  /**
   * 启动监控
   */
  startMonitoring(
    databaseType: DatabaseType, 
    poolInfo: PoolInfo, 
    getPoolStatus: (databaseType: DatabaseType) => any, 
    autoOptimizePool: (databaseType: DatabaseType) => Promise<void>
  ): void {
    if (!poolInfo.config.enableMonitoring || poolInfo.config.monitoringInterval <= 0) {
      return;
    }
    
    poolInfo.monitoringInterval = setInterval(() => {
      const status = getPoolStatus(databaseType);
      
      // 记录监控信息
      this.logger.debug('Connection pool status', {
        databaseType,
        activeConnections: status.activeConnections,
        idleConnections: status.idleConnections,
        pendingRequests: status.pendingRequests,
        isHealthy: status.isHealthy
      });
      
      // 如果池不健康或需要优化，触发自动优化
      if (!status.isHealthy) {
        autoOptimizePool(databaseType).catch(error => {
          this.logger.error('Failed to auto-optimize pool during monitoring', {
            databaseType,
            error
          });
        });
      }
    }, poolInfo.config.monitoringInterval);
  }

  /**
   * 停止监控定时器
   */
  stopMonitoring(databaseType: DatabaseType, poolInfo: PoolInfo): void {
    if (poolInfo.monitoringInterval) {
      clearInterval(poolInfo.monitoringInterval);
      poolInfo.monitoringInterval = undefined;
    }
  }
}