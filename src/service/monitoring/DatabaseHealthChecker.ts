import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../../infrastructure/types';
import { IHealthChecker } from '../../infrastructure/monitoring/types';
import { HealthStatus, AggregateHealthStatus } from '../../infrastructure/monitoring/IDatabaseHealthChecker';
import { DataConsistencyChecker } from '../../database/common/DataConsistencyChecker';

export interface IHealthCheckerRegistry {
  registerHealthChecker(databaseType: DatabaseType, healthChecker: IHealthChecker): void;
  unregisterHealthChecker(databaseType: DatabaseType): void;
  getHealthChecker(databaseType: DatabaseType): IHealthChecker | null;
  getAllHealthCheckers(): Map<DatabaseType, IHealthChecker>;
}

/**
 * DatabaseHealthChecker 实现了 IHealthChecker 接口以兼容基础设施类
 * 同时提供了多数据库健康检查功能
 */
@injectable()
export class DatabaseHealthChecker implements IHealthChecker, IHealthCheckerRegistry {
  private logger: LoggerService;
  private healthCheckers: Map<DatabaseType, IHealthChecker> = new Map();
  private checkInterval: number = 30000; // 默认30秒检查一次
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthStatuses: Map<DatabaseType, HealthStatus> = new Map();
  private healthUpdateCallbacks: Array<(status: HealthStatus) => void> = [];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.DataConsistencyChecker) private consistencyChecker: DataConsistencyChecker
  ) {
    this.logger = logger;
  }

  // IHealthChecker 接口实现 - 单数据库健康检查（默认行为）
  async checkHealth(): Promise<any> {
    // 返回兼容IHealthChecker接口的健康状态
    const healthStatus = await this.getCompatibleHealthStatus();
    return healthStatus;
  }

  // IHealthChecker 接口实现 - 获取健康状态
  getHealthStatus(): any {
    // 返回兼容IHealthChecker接口的健康状态
    return this.getCompatibleHealthStatus();
  }

  // IHealthChecker 接口实现 - 订阅健康状态更新
  subscribeToHealthUpdates(callback: (status: any) => void): void {
    // 适配回调函数
    const adaptedCallback = (status: HealthStatus) => {
      const compatibleStatus = this.convertToCompatibleStatus(status);
      callback(compatibleStatus);
    };
    this.healthUpdateCallbacks.push(adaptedCallback);
  }

  // IHealthCheckerRegistry 接口实现
  registerHealthChecker(databaseType: DatabaseType, healthChecker: IHealthChecker): void {
    if (this.healthCheckers.has(databaseType)) {
      this.logger.warn(`Health checker for ${databaseType} already registered, replacing with new one`);
    }
    this.healthCheckers.set(databaseType, healthChecker);
    this.logger.info(`Health checker registered for ${databaseType}`);
  }

  unregisterHealthChecker(databaseType: DatabaseType): void {
    if (this.healthCheckers.has(databaseType)) {
      this.healthCheckers.delete(databaseType);
      this.logger.info(`Health checker unregistered for ${databaseType}`);
    } else {
      this.logger.warn(`No health checker found for ${databaseType} to unregister`);
    }
  }

  getHealthChecker(databaseType: DatabaseType): IHealthChecker | null {
    return this.healthCheckers.get(databaseType) || null;
  }

  getAllHealthCheckers(): Map<DatabaseType, IHealthChecker> {
    return new Map(this.healthCheckers);
  }

  // 扩展功能：多数据库健康检查
  async checkHealthByDatabase(databaseType: DatabaseType): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // 从注册表中获取健康检查器
      const healthChecker = this.healthCheckers.get(databaseType);
      if (!healthChecker) {
        throw new Error(`No health checker registered for database type: ${databaseType}`);
      }

      // 执行健康检查
      const status = await healthChecker.checkHealth();

      const responseTime = Date.now() - startTime;
      const healthStatus: HealthStatus = {
        status: status.status as 'healthy' | 'degraded' | 'error',
        details: {
          ...status,
          responseTime,
          lastChecked: new Date().toISOString(),
          databaseType
        },
        timestamp: Date.now(),
        responseTime
      };

      this.healthStatuses.set(databaseType, healthStatus);

      // 通知订阅者健康状态更新
      this.notifyHealthUpdateSubscribers(healthStatus);

      this.logger.debug('Database health check completed', {
        databaseType,
        status: healthStatus.status,
        responseTime
      });

      return healthStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const healthStatus: HealthStatus = {
        status: 'error',
        details: {
          error: (error as Error).message,
          responseTime,
          lastChecked: new Date().toISOString(),
          databaseType
        },
        timestamp: Date.now(),
        responseTime
      };

      this.healthStatuses.set(databaseType, healthStatus);

      // 通知订阅者健康状态更新
      this.notifyHealthUpdateSubscribers(healthStatus);

      this.logger.error('Database health check failed', {
        databaseType,
        error: (error as Error).message,
        responseTime
      });

      return healthStatus;
    }
  }

  async checkAllHealth(): Promise<AggregateHealthStatus> {
    const databaseTypes = Array.from(this.healthCheckers.keys());
    const healthChecks = databaseTypes.map(dbType =>
      this.checkHealthByDatabase(dbType).catch(error => {
        // 如果单个数据库检查失败，返回错误状态而不是抛出异常
        const errorStatus: HealthStatus = {
          status: 'error',
          details: {
            error: (error as Error).message,
            databaseType: dbType
          },
          timestamp: Date.now()
        };
        this.healthStatuses.set(dbType, errorStatus);
        return errorStatus;
      })
    );

    const results = await Promise.all(healthChecks);
    const databaseStatuses = new Map<DatabaseType, HealthStatus>();

    let healthyCount = 0;
    let degradedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < databaseTypes.length; i++) {
      const dbType = databaseTypes[i];
      databaseStatuses.set(dbType, results[i]);

      switch (results[i].status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
    }

    let overallStatus: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (errorCount > 0) {
      overallStatus = 'error';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    const aggregateStatus: AggregateHealthStatus = {
      overallStatus,
      databaseStatuses,
      timestamp: Date.now(),
      summary: {
        healthy: healthyCount,
        degraded: degradedCount,
        error: errorCount,
        total: databaseTypes.length
      }
    };

    this.logger.info('Aggregate health check completed', {
      overallStatus,
      summary: aggregateStatus.summary
    });

    return aggregateStatus;
  }

  /**
   * 执行数据一致性检查
   */
  async checkDataConsistency(projectPath: string): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting data consistency check', { projectPath });

      const consistencyResult = await this.consistencyChecker.checkConsistency(projectPath, {
        checkMissingReferences: true,
        checkDataIntegrity: true,
        checkReferenceIntegrity: true,
        batchSize: 100,
        maxResults: 1000
      });

      const responseTime = Date.now() - startTime;
      const healthStatus: HealthStatus = {
        status: consistencyResult.isConsistent ? 'healthy' : 'degraded',
        details: {
          consistencyCheck: {
            isConsistent: consistencyResult.isConsistent,
            inconsistencies: consistencyResult.inconsistencies.length,
            summary: consistencyResult.summary,
            projectPath
          },
          responseTime,
          lastChecked: new Date().toISOString(),
          databaseType: 'consistency_check' as any
        },
        timestamp: Date.now(),
        responseTime
      };

      if (consistencyResult.isConsistent) {
        this.logger.info('Data consistency check passed', {
          projectPath,
          checkTime: consistencyResult.summary.checkTime
        });
      } else {
        this.logger.warn('Data consistency check failed', {
          projectPath,
          inconsistencyCount: consistencyResult.inconsistencies.length,
          checkTime: consistencyResult.summary.checkTime
        });
      }

      return healthStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const healthStatus: HealthStatus = {
        status: 'error',
        details: {
          error: (error as Error).message,
          responseTime,
          lastChecked: new Date().toISOString(),
          databaseType: 'consistency_check' as any,
          projectPath
        },
        timestamp: Date.now(),
        responseTime
      };

      this.logger.error('Data consistency check failed', {
        projectPath,
        error: (error as Error).message,
        responseTime
      });

      return healthStatus;
    }
  }

  /**
   * 执行完整的健康检查，包括数据一致性
   */
  async performComprehensiveHealthCheck(projectPath: string): Promise<AggregateHealthStatus> {
    this.logger.info('Starting comprehensive health check', { projectPath });

    // 执行常规健康检查
    const regularHealthStatus = await this.checkAllHealth();

    // 执行数据一致性检查
    const consistencyHealthStatus = await this.checkDataConsistency(projectPath);

    // 合并结果
    const databaseStatuses = new Map(regularHealthStatus.databaseStatuses);
    databaseStatuses.set('consistency_check' as any, consistencyHealthStatus);

    // 重新计算总体状态
    let overallStatus: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (regularHealthStatus.overallStatus === 'error' || consistencyHealthStatus.status === 'error') {
      overallStatus = 'error';
    } else if (regularHealthStatus.overallStatus === 'degraded' || consistencyHealthStatus.status === 'degraded') {
      overallStatus = 'degraded';
    }

    const comprehensiveStatus: AggregateHealthStatus = {
      overallStatus,
      databaseStatuses,
      timestamp: Date.now(),
      summary: regularHealthStatus.summary
    };

    this.logger.info('Comprehensive health check completed', {
      projectPath,
      overallStatus,
      consistencyStatus: consistencyHealthStatus.status
    });

    return comprehensiveStatus;
  }

  async getHealthStatusByDatabase(databaseType: DatabaseType): Promise<HealthStatus | null> {
    return this.healthStatuses.get(databaseType) || null;
  }

  async getAllHealthStatus(): Promise<Map<DatabaseType, HealthStatus>> {
    // 如果没有缓存的健康状态，执行一次完整的健康检查
    if (this.healthStatuses.size === 0) {
      await this.checkAllHealth();
    }

    return new Map(this.healthStatuses);
  }

  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.logger.warn('Health monitoring already started');
      return;
    }

    this.logger.info('Starting health monitoring', { interval: this.checkInterval });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllHealth();
      } catch (error) {
        this.logger.error('Error during health monitoring', { error: (error as Error).message });
      }
    }, this.checkInterval);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Health monitoring stopped');
    }
  }

  setCheckInterval(interval: number): void {
    if (interval < 1000) { // 最小1秒间隔
      throw new Error('Health check interval must be at least 1000ms');
    }

    this.checkInterval = interval;
    this.logger.info('Health check interval updated', { interval });

    // 如果监控已在运行，重启它以应用新间隔
    if (this.monitoringInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  getCheckInterval(): number {
    return this.checkInterval;
  }

  // 取消订阅健康状态更新
  unsubscribeFromHealthUpdates(callback: (status: any) => void): void {
    // 需要实现取消订阅逻辑
    const index = this.healthUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      this.healthUpdateCallbacks.splice(index, 1);
    }
  }

  private notifyHealthUpdateSubscribers(status: HealthStatus): void {
    this.healthUpdateCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        this.logger.error('Error in health update callback', { error: (error as Error).message });
      }
    });
  }

  private getCompatibleHealthStatus(): any {
    // 返回兼容IHealthChecker接口的健康状态
    if (this.healthStatuses.size === 0) {
      return {
        databaseType: DatabaseType.QDRANT,
        status: 'healthy',
        responseTime: 0,
        timestamp: Date.now()
      };
    }

    const firstStatus = this.healthStatuses.values().next().value;
    if (firstStatus) {
      return this.convertToCompatibleStatus(firstStatus);
    }

    // 备用方案
    return {
      databaseType: DatabaseType.QDRANT,
      status: 'healthy',
      responseTime: 0,
      timestamp: Date.now()
    };
  }

  private convertToCompatibleStatus(status: HealthStatus): any {
    return {
      databaseType: status.details?.databaseType || DatabaseType.QDRANT,
      status: status.status,
      responseTime: status.responseTime || 0,
      timestamp: status.timestamp
    };
  }
}