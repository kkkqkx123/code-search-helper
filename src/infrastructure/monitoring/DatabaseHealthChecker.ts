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
  private allDatabasesHealthStatus: Map<DatabaseType, DatabaseHealthStatus>;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    databaseConnectionPool: DatabaseConnectionPool
  ) {
    this.logger = logger;
    this.databaseConnectionPool = databaseConnectionPool;
    this.healthUpdateCallbacks = [];
    this.allDatabasesHealthStatus = new Map<DatabaseType, DatabaseHealthStatus>();

    // 初始化为未知状态，默认为QDRANT
    this.currentHealthStatus = {
      databaseType: DatabaseType.QDRANT,
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
    // 检查所有数据库类型的健康状况（QDRANT和NEBULA）
    const dbTypes = [DatabaseType.QDRANT, DatabaseType.NEBULA];
    let overallStatus: 'healthy' | 'degraded' | 'error' = 'healthy';
    let totalResponseTime = 0;
    let healthyCount = 0;
    let degradedCount = 0;
    let errorCount = 0;

    // 检查每个数据库类型的健康状况
    for (const dbType of dbTypes) {
      const startTime = Date.now();
      let status: 'healthy' | 'degraded' | 'error' = 'healthy';
      let responseTime = 0;

      try {
        // 尝试获取连接以测试健康状况
        const connection = await this.databaseConnectionPool.getConnection(dbType);

        // 简单的响应时间测试
        responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;

        // 检查响应时间阈值
        if (responseTime > 1000) { // 超过1秒认为是降级状态
          status = 'degraded';
          degradedCount++;
        } else {
          healthyCount++;
        }

        // 释放连接
        await this.databaseConnectionPool.releaseConnection(connection);
      } catch (error) {
        status = 'error';
        responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;
        errorCount++;
        this.logger.error('Database health check failed', {
          databaseType: dbType,
          error: (error as Error).message,
          responseTime
        });
      }

      // 获取连接池状态
      const connectionPoolStatus = this.databaseConnectionPool.getPoolStatus(dbType);

      // 组装单个数据库的健康状况
      const healthStatus: DatabaseHealthStatus = {
        databaseType: dbType,
        status,
        responseTime,
        connectionPoolStatus,
        timestamp: Date.now()
      };

      // 保存到所有数据库状态映射中
      this.allDatabasesHealthStatus.set(dbType, healthStatus);

      this.logger.debug('Database health check completed', {
        databaseType: dbType,
        status,
        responseTime,
        connectionPoolStatus
      });
    }

    // 确定整体状态
    if (errorCount > 0) {
      overallStatus = 'error';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    // 计算平均响应时间
    const averageResponseTime = totalResponseTime / dbTypes.length;

    // 获取QDRANT的连接池状态作为默认状态（为了保持向后兼容）
    const qdrantPoolStatus = this.databaseConnectionPool.getPoolStatus(DatabaseType.QDRANT);

    // 更新当前健康状况（使用QDRANT作为主要状态）
    this.currentHealthStatus = {
      databaseType: DatabaseType.QDRANT, // 保持向后兼容
      status: overallStatus,
      responseTime: averageResponseTime,
      connectionPoolStatus: qdrantPoolStatus,
      timestamp: Date.now()
    };

    // 通知订阅者
    this.healthUpdateCallbacks.forEach(callback => callback(this.currentHealthStatus));

    this.logger.info('All databases health check completed', {
      overallStatus,
      averageResponseTime,
      healthyCount,
      degradedCount,
      errorCount
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

  // 获取所有数据库的当前健康状态
  getAllDatabasesHealthStatus(): Map<DatabaseType, DatabaseHealthStatus> {
    return new Map(this.allDatabasesHealthStatus);
  }
}