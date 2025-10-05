import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { IHealthChecker, DatabaseHealthStatus } from './types';
import { DatabaseConnectionPool } from '../connection/DatabaseConnectionPool';

@injectable()
export class DatabaseHealthChecker implements IHealthChecker {
  private logger: LoggerService;
  private databaseConnectionPool: DatabaseConnectionPool;
  private currentHealthStatus: DatabaseHealthStatus;
  private healthUpdateCallbacks: Array<(status: DatabaseHealthStatus) => void>;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    databaseConnectionPool: DatabaseConnectionPool
  ) {
    this.logger = logger;
    this.databaseConnectionPool = databaseConnectionPool;
    this.healthUpdateCallbacks = [];

    // 初始化为未知状态
    this.currentHealthStatus = {
      databaseType: DatabaseType.QDRANT, // 默认类型，实际中可能需要多个健康检查器
      status: 'healthy',
      responseTime: 0,
      connectionPoolStatus: {
        activeConnections: 0,
        idleConnections: 0,
        pendingRequests: 0,
        maxConnections: 0
      },
      timestamp: Date.now()
    };
  }

  async checkHealth(): Promise<DatabaseHealthStatus> {
    // 检查所有数据库类型的健康状况
    // 为简化，这里检查QDRANT，实际应用中可能需要检查所有数据库类型
    const dbType = DatabaseType.QDRANT;

    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'error' = 'healthy';
    let responseTime = 0;

    try {
      // 尝试获取连接以测试健康状况
      const connection = await this.databaseConnectionPool.getConnection(dbType);

      // 简单的响应时间测试
      responseTime = Date.now() - startTime;

      // 检查响应时间阈值
      if (responseTime > 1000) { // 超过1秒认为是降级状态
        status = 'degraded';
      }

      // 释放连接
      await this.databaseConnectionPool.releaseConnection(connection);
    } catch (error) {
      status = 'error';
      responseTime = Date.now() - startTime;
      this.logger.error('Database health check failed', {
        databaseType: dbType,
        error: (error as Error).message,
        responseTime
      });
    }

    // 获取连接池状态
    const connectionPoolStatus = this.databaseConnectionPool.getPoolStatus(dbType);

    // 组装健康状况
    this.currentHealthStatus = {
      databaseType: dbType,
      status,
      responseTime,
      connectionPoolStatus,
      timestamp: Date.now()
    };

    // 通知订阅者
    this.healthUpdateCallbacks.forEach(callback => callback(this.currentHealthStatus));

    this.logger.debug('Database health check completed', {
      databaseType: dbType,
      status,
      responseTime,
      connectionPoolStatus
    });

    return this.currentHealthStatus;
  }

  getHealthStatus(): DatabaseHealthStatus {
    // 检查是否已过期（超过30秒没有更新）
    if (Date.now() - this.currentHealthStatus.timestamp > 30000) {
      this.logger.warn('Health status is outdated, consider running a fresh health check');
    }

    return this.currentHealthStatus;
  }

  subscribeToHealthUpdates(callback: (status: DatabaseHealthStatus) => void): void {
    this.healthUpdateCallbacks.push(callback);

    // 立即发送当前状态
    callback(this.currentHealthStatus);
  }

  // 检查特定数据库类型的健康状况
  async checkDatabaseHealth(databaseType: DatabaseType): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'error' = 'healthy';
    let responseTime = 0;

    try {
      // 尝试获取连接以测试健康状况
      const connection = await this.databaseConnectionPool.getConnection(databaseType);

      // 简单的响应时间测试
      responseTime = Date.now() - startTime;

      // 检查响应时间阈值
      if (responseTime > 1000) { // 超过1秒认为是降级状态
        status = 'degraded';
      }

      // 释放连接
      await this.databaseConnectionPool.releaseConnection(connection);
    } catch (error) {
      status = 'error';
      responseTime = Date.now() - startTime;
      this.logger.error('Database health check failed', {
        databaseType,
        error: (error as Error).message,
        responseTime
      });
    }

    // 获取连接池状态
    const connectionPoolStatus = this.databaseConnectionPool.getPoolStatus(databaseType);

    const healthStatus: DatabaseHealthStatus = {
      databaseType,
      status,
      responseTime,
      connectionPoolStatus,
      timestamp: Date.now()
    };

    // 如果检查的是默认类型，更新全局状态
    if (databaseType === DatabaseType.QDRANT) {
      this.currentHealthStatus = healthStatus;
      this.healthUpdateCallbacks.forEach(callback => callback(healthStatus));
    }

    this.logger.debug('Database health check completed', {
      databaseType,
      status,
      responseTime,
      connectionPoolStatus
    });

    return healthStatus;
  }

  // 检查所有数据库类型的健康状况
  async checkAllDatabasesHealth(): Promise<Map<DatabaseType, DatabaseHealthStatus>> {
    const healthStatusMap = new Map<DatabaseType, DatabaseHealthStatus>();

    // 遍历所有数据库类型
    for (const dbType of Object.values(DatabaseType)) {
      const healthStatus = await this.checkDatabaseHealth(dbType as DatabaseType);
      healthStatusMap.set(dbType as DatabaseType, healthStatus);
    }

    return healthStatusMap;
  }
}